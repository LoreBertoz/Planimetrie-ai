// Client for the PlanimetrieAI backend (AI proxy + accounts + projects).
// API keys never live in the browser: all AI calls go through /api.

import type { LotSpec, RoomSpec, RoomType } from '../types';

export interface CloudPlanRequest {
  lot: LotSpec;
  rooms: RoomSpec[];
  note?: string;
}

export interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  /** Studio branding (Fase 11): used by share pages and PDF export. */
  studioName?: string;
  studioLogo?: string; // data URL
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

const TOKEN_KEY = 'planimetrieai.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  upgrade: boolean;
  constructor(status: number, message: string, upgrade = false) {
    super(message);
    this.status = status;
    this.upgrade = upgrade;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? `Errore ${res.status}`, Boolean(body.upgrade));
  }
  return body as T;
}

/* ------------------------------- cloud AI ------------------------------- */

interface RawRoom {
  type: RoomType;
  label: string;
  targetArea: number;
}
interface RawPlanResponse {
  lot: { width: number; depth: number };
  rooms: RawRoom[];
  note?: string;
}

function normalizePlan(raw: RawPlanResponse): CloudPlanRequest {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  let n = 0;
  return {
    lot: {
      width: clamp(Math.round(raw.lot.width * 2) / 2, 4, 60),
      depth: clamp(Math.round(raw.lot.depth * 2) / 2, 4, 60),
    },
    rooms: raw.rooms.slice(0, 12).map((r) => ({
      id: `c${n++}`,
      type: r.type,
      label: r.label,
      targetArea: clamp(Math.round(r.targetArea), 2, 100),
    })),
    note: raw.note,
  };
}

/** Free-form brief → structured room program via the cloud LLM.
 *  Returns null when the backend/AI is unavailable (callers fall back). */
export async function promptToPlanCloud(prompt: string): Promise<CloudPlanRequest | null> {
  try {
    const raw = await request<RawPlanResponse>('/api/prompt-to-plan', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
    return normalizePlan(raw);
  } catch (err) {
    if (err instanceof ApiError && err.status !== 503) throw err;
    return null; // server off or AI not configured → heuristic fallback
  }
}

/** Facade photo → estimated room program (experimental/beta). */
export async function facadeToPlan(file: File): Promise<CloudPlanRequest> {
  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Lettura immagine fallita'));
    reader.readAsDataURL(file);
  });
  const raw = await request<RawPlanResponse>('/api/facade-to-plan', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, mediaType: file.type }),
  });
  return normalizePlan(raw);
}

/* --------------------------------- auth --------------------------------- */

export async function register(email: string, password: string): Promise<User> {
  const res = await request<{ token: string; user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(res.token);
  return res.user;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await request<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(res.token);
  return res.user;
}

export async function me(): Promise<User | null> {
  if (!getToken()) return null;
  try {
    const res = await request<{ user: User }>('/api/auth/me');
    return res.user;
  } catch {
    setToken(null);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await request('/api/auth/logout', { method: 'POST' });
  } finally {
    setToken(null);
  }
}

/* ------------------------------- projects ------------------------------- */

export interface ProjectData {
  lot: LotSpec;
  rooms: RoomSpec[];
  floorPlan?: unknown;
  wallPlan?: unknown;
  assignment?: unknown;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const res = await request<{ projects: ProjectSummary[] }>('/api/projects');
  return res.projects;
}

export async function saveProject(name: string, data: ProjectData): Promise<ProjectSummary> {
  const res = await request<{ project: ProjectSummary }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name, data }),
  });
  return res.project;
}

export async function loadProject(id: string): Promise<{ name: string; data: ProjectData }> {
  const res = await request<{ project: { name: string; data: ProjectData } }>(
    `/api/projects/${id}`,
  );
  return res.project;
}

export async function deleteProject(id: string): Promise<void> {
  await request(`/api/projects/${id}`, { method: 'DELETE' });
}

export async function upgradePlan(): Promise<User> {
  const res = await request<{ user: User }>('/api/billing/upgrade', { method: 'POST' });
  return res.user;
}

/* --------------------------- sharing (Fase 11) --------------------------- */

/** Generate (or return the existing) public share token for a project. */
export async function shareProject(id: string): Promise<string> {
  const res = await request<{ shareToken: string }>(`/api/projects/${id}/share`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res.shareToken;
}

export async function revokeShare(id: string): Promise<void> {
  await request(`/api/projects/${id}/share`, {
    method: 'POST',
    body: JSON.stringify({ revoke: true }),
  });
}

export interface SharedProject {
  name: string;
  data: ProjectData;
  studioName: string;
  studioLogo: string;
}

/** Public read-only project fetch — no auth required. */
export async function loadSharedProject(shareToken: string): Promise<SharedProject> {
  const res = await request<{ project: SharedProject }>(`/api/public/${shareToken}`);
  return res.project;
}

/* ----------------------- account settings (Fase 11) ---------------------- */

export async function updateStudioSettings(settings: {
  studioName?: string;
  studioLogo?: string;
}): Promise<User> {
  const res = await request<{ user: User }>('/api/account/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
  return res.user;
}

// Local mirror of the studio branding so the PDF export works even before
// login / while the backend is off. Synced on login and on settings save.
const STUDIO_KEY = 'planimetrieai.studio';

export interface StudioBrand {
  studioName: string;
  studioLogo: string;
}

export function getLocalStudioBrand(): StudioBrand {
  try {
    const raw = JSON.parse(localStorage.getItem(STUDIO_KEY) ?? '{}');
    return { studioName: raw.studioName ?? '', studioLogo: raw.studioLogo ?? '' };
  } catch {
    return { studioName: '', studioLogo: '' };
  }
}

export function setLocalStudioBrand(brand: StudioBrand): void {
  localStorage.setItem(STUDIO_KEY, JSON.stringify(brand));
}

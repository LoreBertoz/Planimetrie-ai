// PlanimetrieAI backend: AI proxy (API keys never reach the browser) +
// lightweight accounts/projects/subscription store.
// Run: npm start (reads .env if present; see .env.example)

import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 8787;
// Cloud AI via OpenRouter (OpenAI-compatible). One key, many models; default
// to Gemini Flash — cheap, strong vision, supports structured outputs.
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? '';
const MODEL = process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const FREE_PLAN_MAX_PROJECTS = 3;

const app = express();
app.use(express.json({ limit: '25mb' }));

/* ------------------------------- storage -------------------------------- */

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { users: [], sessions: {}, projects: [] };
  }
}
function saveDb(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
const db = loadDb();

/* --------------------------------- auth --------------------------------- */

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}
function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan,
    studioName: user.studioName ?? '',
    studioLogo: user.studioLogo ?? '',
  };
}
function authUser(req) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const userId = db.sessions[token];
  return db.users.find((u) => u.id === userId) ?? null;
}
function requireAuth(req, res) {
  const user = authUser(req);
  if (!user) res.status(401).json({ error: 'Accesso richiesto' });
  return user;
}

app.post('/api/auth/register', (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || !email.includes('@') || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Email valida e password di almeno 8 caratteri richieste' });
  }
  if (db.users.some((u) => u.email === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email già registrata' });
  }
  const user = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    password: hashPassword(password),
    plan: 'free',
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = user.id;
  saveDb(db);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const user = db.users.find((u) => u.email === String(email).toLowerCase());
  if (!user || !verifyPassword(String(password), user.password)) {
    return res.status(401).json({ error: 'Credenziali non valide' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = user.id;
  saveDb(db);
  res.json({ token, user: publicUser(user) });
});

app.get('/api/auth/me', (req, res) => {
  const user = authUser(req);
  if (!user) return res.status(401).json({ error: 'Accesso richiesto' });
  res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    delete db.sessions[token];
    saveDb(db);
  }
  res.json({ ok: true });
});

/* ------------------------------- projects ------------------------------- */

app.get('/api/projects', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const projects = db.projects
    .filter((p) => p.userId === user.id)
    .map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
  res.json({ projects });
});

app.post('/api/projects', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { name, data } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim() || typeof data !== 'object') {
    return res.status(400).json({ error: 'Nome e dati del progetto richiesti' });
  }
  const mine = db.projects.filter((p) => p.userId === user.id);
  if (user.plan === 'free' && mine.length >= FREE_PLAN_MAX_PROJECTS) {
    return res.status(402).json({
      error: `Il piano gratuito include ${FREE_PLAN_MAX_PROJECTS} progetti salvati. Passa a Pro per progetti illimitati.`,
      upgrade: true,
    });
  }
  const project = {
    id: crypto.randomUUID(),
    userId: user.id,
    name: name.trim().slice(0, 80),
    data,
    updatedAt: new Date().toISOString(),
  };
  db.projects.push(project);
  saveDb(db);
  res.json({ project: { id: project.id, name: project.name, updatedAt: project.updatedAt } });
});

app.get('/api/projects/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const project = db.projects.find((p) => p.id === req.params.id && p.userId === user.id);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
  res.json({ project });
});

app.delete('/api/projects/:id', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const index = db.projects.findIndex((p) => p.id === req.params.id && p.userId === user.id);
  if (index === -1) return res.status(404).json({ error: 'Progetto non trovato' });
  db.projects.splice(index, 1);
  saveDb(db);
  res.json({ ok: true });
});

/* ------------------------- sharing (Fase 11) ---------------------------- */

// Generate or revoke the public read-only share token of a project.
app.post('/api/projects/:id/share', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const project = db.projects.find((p) => p.id === req.params.id && p.userId === user.id);
  if (!project) return res.status(404).json({ error: 'Progetto non trovato' });
  const { revoke } = req.body ?? {};
  if (revoke) {
    delete project.shareToken;
  } else if (!project.shareToken) {
    project.shareToken = crypto.randomBytes(16).toString('hex');
  }
  saveDb(db);
  res.json({ shareToken: project.shareToken ?? null });
});

// Public read-only access: no login, plan data + studio branding only.
app.get('/api/public/:shareToken', (req, res) => {
  const project = db.projects.find(
    (p) => p.shareToken && p.shareToken === req.params.shareToken,
  );
  if (!project) return res.status(404).json({ error: 'Link non valido o revocato' });
  const owner = db.users.find((u) => u.id === project.userId);
  res.json({
    project: {
      name: project.name,
      data: project.data,
      studioName: owner?.studioName ?? '',
      studioLogo: owner?.studioLogo ?? '',
    },
  });
});

/* --------------------- account settings (Fase 11) ----------------------- */

// Studio branding used by the shared page and the branded PDF export.
app.patch('/api/account/settings', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { studioName, studioLogo } = req.body ?? {};
  if (studioName !== undefined) {
    if (typeof studioName !== 'string' || studioName.length > 60) {
      return res.status(400).json({ error: 'Nome studio non valido (max 60 caratteri)' });
    }
    user.studioName = studioName.trim();
  }
  if (studioLogo !== undefined) {
    if (typeof studioLogo !== 'string' || studioLogo.length > 400_000 ||
        (studioLogo !== '' && !studioLogo.startsWith('data:image/'))) {
      return res.status(400).json({ error: 'Logo non valido (immagine, max ~300KB)' });
    }
    user.studioLogo = studioLogo;
  }
  saveDb(db);
  res.json({ user: publicUser(user) });
});

/* ------------------------------- billing -------------------------------- */
// Subscription gate is in place; payment provider integration is roadmap.

app.post('/api/billing/upgrade', (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  user.plan = 'pro';
  saveDb(db);
  res.json({ user: publicUser(user), note: 'Demo: pagamento non ancora collegato.' });
});

/* ------------------------------- cloud AI ------------------------------- */

const aiEnabled = Boolean(OPENROUTER_KEY);

const PLAN_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    lot: {
      type: 'object',
      properties: {
        width: { type: 'number', description: 'Lot width in meters, 4-60' },
        depth: { type: 'number', description: 'Lot depth in meters, 4-60' },
      },
      required: ['width', 'depth'],
      additionalProperties: false,
    },
    rooms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'living', 'kitchen', 'dining', 'bedroom', 'bathroom',
              'hallway', 'office', 'laundry', 'closet', 'garage',
            ],
          },
          label: { type: 'string', description: 'Italian room label, e.g. "Camera 1"' },
          targetArea: { type: 'number', description: 'Target area in m², 2-100' },
        },
        required: ['type', 'label', 'targetArea'],
        additionalProperties: false,
      },
    },
    note: { type: 'string', description: 'One short Italian sentence about assumptions made' },
  },
  required: ['lot', 'rooms', 'note'],
  additionalProperties: false,
};

function aiUnavailable(res) {
  res.status(503).json({
    error: 'AI cloud non configurata sul server (manca OPENROUTER_API_KEY).',
  });
}

// Extract JSON from an OpenAI-compatible chat completion. Some models wrap the
// JSON in ```json fences even under json_schema, so parse defensively.
function extractJson(completion) {
  const text = completion?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) return null;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    // fall back to the first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// Call OpenRouter with a JSON-schema-constrained response.
async function openrouterPlan(messages) {
  const resp = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'PlanimetrieAI',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'plan_request', strict: true, schema: PLAN_REQUEST_SCHEMA },
      },
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    const err = new Error(`OpenRouter ${resp.status}: ${detail.slice(0, 300)}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

const PROMPT_SYSTEM =
  'You turn free-form Italian or English home briefs into a structured room program ' +
  'for a residential floor plan generator. Choose sensible lot dimensions and room areas ' +
  '(meters, m²) when not specified. Use Italian labels (Soggiorno, Cucina, Camera 1, Bagno...). ' +
  'This is for a commercial presentation tool, not construction documents. ' +
  'Reply with ONLY the JSON object required by the schema.';

const FACADE_SYSTEM =
  'You analyze a photo of a house facade and estimate a plausible room program for a ' +
  'single-floor presentation model: overall footprint (meters), and a room list with ' +
  'Italian labels and areas (m²). This is an experimental estimate for a commercial ' +
  'presentation tool — plausibility over precision. If the photo shows multiple floors, ' +
  'estimate the ground floor only and mention it in the note. ' +
  'Reply with ONLY the JSON object required by the schema.';

app.post('/api/prompt-to-plan', async (req, res) => {
  if (!aiEnabled) return aiUnavailable(res);
  const { prompt } = req.body ?? {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt mancante' });
  }
  try {
    const completion = await openrouterPlan([
      { role: 'system', content: PROMPT_SYSTEM },
      { role: 'user', content: prompt },
    ]);
    const data = extractJson(completion);
    if (!data) return res.status(502).json({ error: 'Risposta AI non valida' });
    res.json(data);
  } catch (err) {
    console.error('prompt-to-plan error:', err.message);
    res.status(502).json({ error: 'Errore del servizio AI' });
  }
});

app.post('/api/facade-to-plan', async (req, res) => {
  if (!aiEnabled) return aiUnavailable(res);
  const { imageBase64, mediaType } = req.body ?? {};
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (typeof imageBase64 !== 'string' || !allowed.includes(mediaType)) {
    return res.status(400).json({ error: 'Immagine mancante o formato non supportato' });
  }
  try {
    const completion = await openrouterPlan([
      { role: 'system', content: FACADE_SYSTEM },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Stima il programma stanze del piano terra di questa casa per un modello 3D di presentazione.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:${mediaType};base64,${imageBase64}` },
          },
        ],
      },
    ]);
    const data = extractJson(completion);
    if (!data) return res.status(502).json({ error: 'Risposta AI non valida' });
    res.json(data);
  } catch (err) {
    console.error('facade-to-plan error:', err.message);
    res.status(502).json({ error: 'Errore del servizio AI' });
  }
});

/* --------------------------------- misc --------------------------------- */

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ai: aiEnabled, model: aiEnabled ? MODEL : null });
});

app.listen(PORT, () => {
  console.log(
    `PlanimetrieAI server on http://localhost:${PORT} (AI: ${aiEnabled ? `on · ${MODEL}` : 'off'})`,
  );
});

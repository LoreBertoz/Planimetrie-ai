// PlanimetrieAI backend: AI proxy (API keys never reach the browser) +
// lightweight accounts/projects/subscription store.
// Run: npm start (reads .env if present; see .env.example)

import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ?? 8787;
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';
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
  return { id: user.id, email: user.email, plan: user.plan };
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

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

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
    error: 'AI cloud non configurata sul server (manca ANTHROPIC_API_KEY).',
  });
}

function extractJson(response) {
  const text = response.content.find((b) => b.type === 'text')?.text;
  return text ? JSON.parse(text) : null;
}

app.post('/api/prompt-to-plan', async (req, res) => {
  if (!anthropic) return aiUnavailable(res);
  const { prompt } = req.body ?? {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt mancante' });
  }
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system:
        'You turn free-form Italian or English home briefs into a structured room program ' +
        'for a residential floor plan generator. Choose sensible lot dimensions and room areas ' +
        '(meters, m²) when not specified. Use Italian labels (Soggiorno, Cucina, Camera 1, Bagno...). ' +
        'This is for a commercial presentation tool, not construction documents.',
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema: PLAN_REQUEST_SCHEMA } },
    });
    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'Richiesta non interpretabile' });
    }
    const data = extractJson(response);
    if (!data) return res.status(502).json({ error: 'Risposta AI non valida' });
    res.json(data);
  } catch (err) {
    console.error('prompt-to-plan error:', err);
    res.status(502).json({ error: 'Errore del servizio AI' });
  }
});

app.post('/api/facade-to-plan', async (req, res) => {
  if (!anthropic) return aiUnavailable(res);
  const { imageBase64, mediaType } = req.body ?? {};
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (typeof imageBase64 !== 'string' || !allowed.includes(mediaType)) {
    return res.status(400).json({ error: 'Immagine mancante o formato non supportato' });
  }
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system:
        'You analyze a photo of a house facade and estimate a plausible room program for a ' +
        'single-floor presentation model: overall footprint (meters), and a room list with ' +
        'Italian labels and areas (m²). This is an experimental estimate for a commercial ' +
        'presentation tool — plausibility over precision. If the photo shows multiple floors, ' +
        'estimate the ground floor only and mention it in the note.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            {
              type: 'text',
              text: 'Stima il programma stanze del piano terra di questa casa per un modello 3D di presentazione.',
            },
          ],
        },
      ],
      output_config: { format: { type: 'json_schema', schema: PLAN_REQUEST_SCHEMA } },
    });
    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'Immagine non analizzabile' });
    }
    const data = extractJson(response);
    if (!data) return res.status(502).json({ error: 'Risposta AI non valida' });
    res.json(data);
  } catch (err) {
    console.error('facade-to-plan error:', err);
    res.status(502).json({ error: 'Errore del servizio AI' });
  }
});

/* --------------------------------- misc --------------------------------- */

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ai: Boolean(anthropic) });
});

app.listen(PORT, () => {
  console.log(`PlanimetrieAI server on http://localhost:${PORT} (AI: ${anthropic ? 'on' : 'off'})`);
});

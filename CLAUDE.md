# CLAUDE.md — PlanimetrieAI

Guida di contesto per Claude Code. Leggere **sempre** questo file prima di lavorare, e `HANDOFF.md` per il piano operativo a fasi.

---

## 1. Cos'è il prodotto

PlanimetrieAI è uno strumento web (SaaS) pensato per **architetti, geometri e progettisti** che devono presentare **commercialmente** un'idea di casa a un cliente, in modo veloce e bello da vedere.

Il prodotto genera, a partire da un prompt testuale o da una foto di facciata:

- **Planimetrie 2D** (con possibilità di ritocco manuale)
- **Modelli 3D** navigabili
- Un **tour interno della casa** (camminata 3D in prima persona)
- Una **scelta di materiali naturali** applicati in 3D, con **focus sulla canapa** (biocompositi, calce-canapa, ecc.)

### Posizionamento fondamentale (NON dimenticare mai)

> Questo è uno strumento **presentativo/commerciale, non esecutivo.**

Serve a mostrare al cliente finale un'idea accattivante *prima* della progettazione vera. Il professionista poi "ci mette le mani" nei suoi strumenti CAD/BIM per il progetto definitivo. Quindi:

- Priorità a **velocità, estetica e wow-factor**, non a precisione normativa o costruttiva.
- Ogni output deve essere **esportabile** (`.glb`, JSON, immagini) così il professionista può rifinirlo altrove.
- Non aggiungere complessità da software esecutivo (calcoli strutturali, quote normative, computi) se non richiesto.

### Il focus canapa

La scelta materiali con **focus su materiali naturali e in particolare la canapa** è l'elemento distintivo del prodotto. La libreria materiali deve dare risalto a canapa e biomateriali (calce-canapa/hempcrete, legno, sughero, calce, terra cruda, lino). Non è un dettaglio: è parte del pitch di vendita.

---

## 2. Origine: due prototipi

Il progetto nasce dall'unione di due prototipi presenti in questa cartella. **Nessuno dei due va sviluppato in isolamento**: vanno fusi come descritto sotto e in `HANDOFF.md`.

### `Planimetrieai1/` — vanilla TypeScript + Three.js
Punto di forza: **il motore 3D funzionante**.
- `src/model.ts` — modello dati basato su muri (`Wall`) con aperture (`Opening`)
- `src/editor2d.ts` — editor 2D interattivo su canvas (disegno muri/porte/finestre, snap, zoom/pan)
- `src/generator.ts` — generatore procedurale (slicing tree → muri)
- `src/viewer3d.ts` — **scena Three.js**: estrusione muri con aperture reali, vetri, solaio, luci, ombre, orbit control, export `.glb`
- `src/main.ts` — UI vanilla (tab 2D/3D, dialog generatore, file I/O)

### `Planimetrieai2/` — React 19 + Vite
Punto di forza: **il cervello generativo e il parsing del prompt**.
- `src/lib/generator.ts` — generatore **superiore**: guillotine slicing + random-restart search (400 candidati), scoring per adiacenze/proporzioni/luce naturale, porte via MST, 4 varianti distinte
- `src/lib/prompt.ts` — **prompt in linguaggio naturale** (IT+EN), euristico + Ollama locale opzionale
- `src/types.ts` — modello dati basato su **stanze come rettangoli** (`FloorPlan`, `PlacedRoom`, `Door`, `Window`)
- `src/components/PlanSvg.tsx` — rendering SVG architettonico (battute porte, quote)
- `src/lib/export.ts`, `src/lib/dxf.ts` — export SVG/PNG/DXF/JSON

### Strategia di fusione (decisa con il committente)

- **Stack unico = React 19 + Vite + TypeScript** (base di `Planimetrieai2`), adatto a un SaaS con account/UI scalabile.
- **Motore 3D** = si porta `viewer3d.ts` di `Planimetrieai1` dentro React come modulo (Three.js gira dentro React senza problemi).
- **Generatore + prompt** = si adotta la pipeline di `Planimetrieai2` (`lib/generator.ts` + `lib/prompt.ts`).
- **Editor 2D manuale** = si porta `editor2d.ts` di `Planimetrieai1` (per i ritocchi post-generazione).

---

## 3. Modello dati — il punto critico

I due prototipi usano modelli **diversi** e vanno riconciliati:

| | Planimetrieai1 | Planimetrieai2 |
|---|---|---|
| Unità base | `Wall` (segmento a→b) con `Opening[]` | `PlacedRoom` (rettangolo x,y,w,h) |
| Aperture | dentro il muro (offset lungo il muro) | `Door`/`Window` con punto x,y |
| Adatto a | **editor + 3D** | **generazione + scoring** |

### Regola: due rappresentazioni, un convertitore

- Il **generatore** (P2) lavora sulle **stanze-rettangolo** perché lo scoring di adiacenza/proporzioni ha bisogno delle stanze come oggetti.
- L'**editor 2D** e il **motore 3D** (P1) lavorano sui **muri** (`Wall` + `Opening`).
- Serve un **convertitore `FloorPlan (rooms) → Plan (walls)`**. Nota: `Planimetrieai1/src/generator.ts` **contiene già** la logica `buildRuns()` che trasforma rettangoli di stanze in muri fusi e dedup: riusarla/adattarla è il modo più rapido.

Il modello unificato deve estendere `Wall`/`Opening` con un riferimento al **materiale** applicato (vedi §4). Mantieni le stanze (`PlacedRoom` con `type`) come metadato del piano, servono per etichette, aree e per assegnare materiali per-stanza (es. pavimento cucina).

**Unità: sempre metri.** In 3D: il piano usa (x, y); in Three.js `y` del piano diventa `z`, e l'altezza è l'asse `y` del mondo.

---

## 4. Sistema materiali (focus canapa)

Requisito v1: **libreria visiva + resa 3D reale** (non solo tag).

- Definire un catalogo materiali (`src/materials/catalog.ts`) con proprietà PBR (colore base, roughness, metalness, texture/normal opzionali) e metadati (nome, categoria, descrizione breve orientata alla vendita).
- Categorie con enfasi sui naturali: **canapa / calce-canapa (hempcrete)**, legno, sughero, calce, terra cruda, lino, pietra. La canapa va in evidenza.
- I materiali si applicano alle superfici 3D (muri, pavimenti, eventualmente facciata) in tempo reale via `MeshStandardMaterial` di Three.js.
- Il modello dati collega un `materialId` a muri/pavimenti/stanze.
- Le texture vanno in `public/textures/` (o CDN); usare `MeshStandardMaterial` per PBR realistico.

Le **schede tecniche** dei materiali (isolamento, sostenibilità, costi) sono roadmap post-v1: predisporre il campo dati ma non svilupparle ora.

---

## 5. Funzioni AI (Cloud)

Deciso: **AI su cloud** (non solo locale). Serve per prompt complessi e soprattutto per la foto-facciata.

**Provider scelto: OpenRouter** (API OpenAI-compatible → una sola chiave, tanti modelli con fallback). Modello di default **`google/gemini-2.5-flash`** (economico, vision forte, structured output). Cambiabile via env `OPENROUTER_MODEL` (es. `google/gemini-2.5-pro`, `anthropic/claude-sonnet-4.5`, `openai/gpt-4o`) senza toccare il codice.

- **Prompt → programma stanze**: il parser euristico locale di `lib/prompt.ts` resta come fallback; per prompt liberi/complessi si chiama OpenRouter che restituisce un `PlanRequest` strutturato (JSON) via `response_format: json_schema`. Endpoint backend: `POST /api/prompt-to-plan`.
- **Foto facciata → 3D** (feature *beta*): modello vision su OpenRouter (Gemini) che stima proporzioni, numero piani, aperture e stile dalla foto → genera una planimetria/volumetria di partenza. Immagine inviata come data-URI in `image_url`. Endpoint: `POST /api/facade-to-plan`. È la parte più sperimentale: marcarla chiaramente come sperimentale nell'UI.

Nota implementazione: le chiamate AI usano `fetch` diretto verso `https://openrouter.ai/api/v1/chat/completions` (nessun SDK), con parsing JSON difensivo (alcuni modelli incapsulano il JSON in code-fence anche sotto schema).

### Sicurezza chiavi API

> Le chiavi API **non stanno mai nel browser.** Tutte le chiamate AI passano dal **backend proxy** (vedi §6). La chiave `OPENROUTER_API_KEY` sta solo in `server/.env` (gitignored, mai committato); `server/.env.example` è il template. Mai committare chiavi; usare variabili d'ambiente lato server.

---

## 6. Architettura SaaS

- **Frontend**: React 19 + Vite + TypeScript (SPA).
- **Backend**: servizio leggero (Node/Express in `server/`) che fa da **proxy per le chiamate AI** (OpenRouter, vedi §5) e gestisce **account + progetti + abbonamento**. Non serve per le prime fasi che girano client-side.
- **Export**: `.glb` (3D), JSON (dati piano), immagini/SVG (2D) → il professionista rifinisce altrove.

---

## 7. Tour della casa

- **v1**: camminata 3D in prima persona **in-app** (pointer-lock + movimento WASD/tocco) dentro la scena Three.js esistente. Collisioni semplici coi muri se fattibile, altrimenti free-fly a altezza occhio.
- **Video tour esportato**: **placeholder statico** nell'UI (es. bottone "Esporta video tour — prossimamente", disabilitato). Va inserito ora come segnaposto per non dimenticarlo, ma **non implementato** in v1.

---

## 8. Convenzioni

- **Lingua UI**: italiano (con eventuale i18n IT/EN più avanti — il parser prompt è già bilingue).
- **Unità**: metri, ovunque.
- **TypeScript** strict. Niente `any` non giustificati.
- **Determinismo**: la generazione è seeded (`lib/rng.ts`, mulberry32) — stesso seed = stesso layout. Preservare questa proprietà.
- **Commenti**: brevi e in inglese nel codice (come i prototipi esistenti), documentazione utente in italiano.
- Preferire estendere/portare il codice esistente dei due prototipi piuttosto che riscrivere da zero.

## 9. Design e UI (requisito di prima classe)

L'app deve essere **bella, moderna e curata**, non solo funzionante. È uno strumento di vendita: il professionista lo userà davanti al cliente, quindi l'estetica dell'interfaccia è parte del prodotto tanto quanto il 3D.

Principi:

- **Look professionale e pulito**, stile SaaS moderno (pensa Linear/Vercel/Framer): molto spazio bianco, gerarchia tipografica chiara, angoli morbidi, ombre leggere, micro-interazioni.
- **Identità visiva legata alla canapa/naturale**: palette calda e organica (verdi salvia, terra, sabbia, off-white) con un accento deciso. Evitare il freddo "blu tech" generico. La palette deve trasmettere naturalità/sostenibilità, coerente col posizionamento canapa.
- **Design system**: definire token (colori, tipografia, spaziature, radius, ombre) e usarli ovunque. Consigliato **Tailwind CSS** + una libreria di componenti accessibile (**shadcn/ui** o Radix). Icone: **lucide-react**.
- **Layout applicativo**: shell con top-bar + area di lavoro; pannelli laterali per input (brief/form, materiali) e viewport centrale grande per 2D/3D. Le viste 2D/3D/tour si alternano con transizioni fluide.
- **Stati curati**: loading/skeleton durante generazione, empty state invitante, stati di errore chiari, feedback sulle azioni (toast).
- **Responsive**: ottimizzata desktop (uso professionale), ma usabile su tablet. Il tour 3D deve funzionare anche su touch.
- **Accessibilità**: contrasto adeguato, focus visibile, navigazione da tastiera, `aria-label` sui controlli.
- **Coerenza**: un solo set di componenti riusabili (bottoni, campi, dialog, tab, card, slider) — niente stili one-off sparsi.

La UI è in **italiano**. Curare anche i microcopy (tono professionale ma accessibile).

## 10. Comandi dev

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint     # oxlint (già configurato in Planimetrieai2)
```

## 11. Stato e roadmap

**Stato attuale**: due prototipi separati e funzionanti (P1 = 3D, P2 = generatore/prompt). Nessuna fusione ancora fatta.

**Roadmap** (dettaglio in `HANDOFF.md`):
1. Setup React unico + porting motore 3D di P1
2. Porting generatore + prompt di P2 + convertitore stanze→muri
3. Sistema materiali (focus canapa)
4. Tour 3D in-app (+ placeholder video)
5. Integrazione Cloud AI (prompt avanzato + foto facciata beta)
6. Shell SaaS (account, abbonamento, backend proxy)

**Fuori scope v1**: multi-piano, calcoli esecutivi/normativi, schede tecniche materiali complete, video tour renderizzato, editor mobili/arredi dettagliati.

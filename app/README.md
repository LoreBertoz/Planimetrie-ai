# PlanimetrieAI — app

App unificata (React 19 + Vite + TypeScript + Three.js) nata dalla fusione dei prototipi
`Planimetrieai1` (motore 3D/editor) e `Planimetrieai2` (generatore + prompt).

## Avvio rapido

```bash
# Frontend (obbligatorio)
cd app
npm install
npm run dev          # http://localhost:5173

# Backend AI + account (opzionale ma consigliato)
cd ../server
npm install
cp .env.example .env # inserisci ANTHROPIC_API_KEY per le funzioni AI cloud
npm start            # http://localhost:8787 (il frontend fa proxy su /api)
```

Senza backend l'app funziona in locale: parser euristico per il brief, niente foto-facciata,
niente account/salvataggio cloud. Con backend ma senza chiave API: account e progetti
funzionano, le funzioni AI rispondono 503 e il client usa il fallback locale.

## Struttura

```
src/
  styles/theme.css       design token (palette naturale/canapa, Inter, radius, ombre)
  components/ui/         componenti base shadcn/ui tematizzati
  components/            AppShell, PlanSvg, RoomForm, Viewer3DCanvas, Editor2DCanvas,
                         MaterialPicker, FacadePhotoCard, AccountMenu, Landing
  engine/                Viewer3D.ts (Three.js: estrusione, materiali, tour prima persona)
                         Editor2D.ts (canvas: muri, porte, finestre, etichette)
  lib/                   generator, prompt, floorplanToWalls (stanze→muri), model,
                         export/dxf, api (client backend), rng
  materials/catalog.ts   libreria materiali naturali (canapa in evidenza)
  types.ts               modello dati unificato (FloorPlan a stanze + Plan a muri)
```

## Comandi

```bash
npm run dev      # dev server
npm run build    # build produzione (tsc + vite)
npm run lint     # oxlint
```

## Note

- Unità: metri ovunque. In 3D il piano (x, y) → mondo (x, z).
- Generazione seeded e deterministica: stesso seed = stesso layout.
- Export: SVG/PNG/DXF/JSON (2D) e .glb (3D) — il professionista rifinisce nei suoi strumenti.
- Le chiavi API stanno solo nel server (`server/.env`), mai nel browser.

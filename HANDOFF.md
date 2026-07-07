# HANDOFF.md — Piano di implementazione per Claude Code

Piano operativo a fasi per costruire **PlanimetrieAI** fondendo i due prototipi.
Leggere prima `CLAUDE.md` (visione, decisioni, modello dati).

**Principio guida**: portare/estendere il codice esistente dei due prototipi, non riscrivere. Ogni fase deve chiudersi con l'app funzionante e commit-abile.

---

## Punto di partenza

- `Planimetrieai1/` = motore 3D (Three.js), editor 2D, modello a muri. **Vanilla TS.**
- `Planimetrieai2/` = generatore avanzato, prompt NL, modello a stanze. **React 19 + Vite.**

**Base scelta = `Planimetrieai2` (React)**, dentro cui si portano i moduli 3D/editor di `Planimetrieai1`.

Suggerimento: creare la nuova app unificata in una cartella `app/` (o rinominare/ripulire `Planimetrieai2` come base), lasciando i due prototipi come riferimento sola-lettura finché la fusione non è verificata.

---

## FASE 0 — Setup progetto unificato + fondazione design

**Obiettivo**: un'unica app React che builda e gira, con Three.js installato **e un design system pronto** (vedi CLAUDE.md §9). La UI deve essere bella fin dall'inizio, non abbellita alla fine.

Attività:
- Partire dallo scaffold di `Planimetrieai2` (React 19 + Vite + TS + oxlint già presenti).
- `npm install three @types/three`.
- **Setup design system**:
  - Installare e configurare **Tailwind CSS**; aggiungere **shadcn/ui** (o Radix) e **lucide-react**.
  - Definire i **design token** in `src/styles/theme.css` (o config Tailwind): palette naturale/canapa (verdi salvia, terra, sabbia, off-white + un accento deciso), tipografia (un font sans moderno, es. Inter/Geist), scala di spaziature, radius, ombre leggere.
  - Creare i **componenti base riusabili** in `src/components/ui/` (Button, Input, Select, Dialog, Tabs, Card, Slider, Toast) — coerenti e accessibili.
  - Impostare la **shell applicativa** (`AppShell.tsx`): top-bar con logo/nome + azioni, area di lavoro con pannelli laterali (input/materiali) e viewport centrale grande. Predisporre le tab 2D / 3D / Tour.
  - Stati globali curati: skeleton/loading, empty state invitante, toast di feedback.
- Definire la struttura cartelle target:
  ```
  src/
    styles/theme.css         design token (palette naturale/canapa, tipografia)
    components/ui/           componenti base riusabili (Button, Dialog, Tabs, ...)
    components/AppShell.tsx  shell app (top-bar + pannelli + viewport)
    types.ts                 modello dati unificato (§ vedi Fase 2)
    lib/
      generator.ts           (da P2)
      prompt.ts              (da P2)
      rng.ts                 (da P2)
      floorplanToWalls.ts    convertitore stanze→muri (nuovo, da buildRuns di P1)
      export.ts  dxf.ts      (da P2)
    engine/
      Viewer3D.ts            (da P1 viewer3d.ts, adattato)
      Editor2D.ts            (da P1 editor2d.ts, adattato)
    materials/
      catalog.ts             libreria materiali (Fase 3)
    components/
      PlanSvg.tsx            (da P2)
      RoomForm.tsx           (da P2)
      Viewer3DCanvas.tsx     wrapper React del Viewer3D
      MaterialPicker.tsx     (Fase 3)
    App.tsx
  ```

**Done quando**: `npm run dev` mostra l'app di P2 funzionante con Three.js installato e nessun errore di build.

---

## FASE 1 — Portare il motore 3D di P1 dentro React

**Obiettivo**: da una `FloorPlan` generata, visualizzare il 3D navigabile in-app.

Attività:
- Portare `Planimetrieai1/src/viewer3d.ts` in `src/engine/Viewer3D.ts` (la classe `Viewer3D` è già framework-agnostica: prende un `HTMLElement`).
- Creare `Viewer3DCanvas.tsx`: componente React che monta un `<div ref>`, istanzia `Viewer3D` in `useEffect`, chiama `viewer.build(plan)` quando il piano cambia, fa cleanup all'unmount.
- Aggiungere una tab/vista "3D" in `App.tsx` accanto alla vista 2D SVG esistente.
- Serve il convertitore stanze→muri (anticipare qui la parte minima, vedi Fase 2) perché `Viewer3D.build()` vuole un `Plan` a muri.

**Done quando**: genero un piano da `RoomForm`, passo alla tab 3D e vedo il modello estruso con porte/finestre, orbito, ed esporto `.glb` funzionante.

---

## FASE 2 — Modello dati unificato + generatore/prompt di P2

**Obiettivo**: pipeline completa prompt/form → varianti → piano condiviso da SVG, editor e 3D.

Attività:
- **Modello unificato** in `types.ts`:
  - Mantieni `FloorPlan` / `PlacedRoom` / `Door` / `Window` di P2 come output del generatore.
  - Introduci il modello a muri `Plan` / `Wall` / `Opening` di P1 come rappresentazione per editor+3D.
  - Aggiungi a `Wall`, `Opening`, `PlacedRoom` un campo opzionale `materialId?: string` (predisposizione Fase 3).
- **Convertitore** `lib/floorplanToWalls.ts`: `FloorPlan → Plan`. Adattare `buildRuns()` da `Planimetrieai1/src/generator.ts` (già fa merge/dedup dei muri dai rettangoli e sa dove sono porte/finestre). Le `Door`/`Window` di P2 (punto x,y) vanno mappate su `Opening` (offset lungo il muro).
- Confermare che il **generatore** di P2 (`lib/generator.ts`) e il **prompt NL** (`lib/prompt.ts`) siano attivi come nella base P2 (griglia 4 varianti, rigenera, seed deterministico).
- Collegare: selezione variante → `floorplanToWalls` → stato piano condiviso → SVG 2D (P2) + Editor2D (Fase 4) + Viewer3D (Fase 1).

**Done quando**: scrivo un brief in linguaggio naturale ("3 camere, 2 bagni, cucina con zona pranzo"), ottengo 4 varianti, ne scelgo una e la vedo coerente sia in 2D SVG sia in 3D.

---

## FASE 3 — Sistema materiali (focus canapa)

**Obiettivo**: libreria visiva di materiali naturali applicabili in 3D in tempo reale.

Attività:
- `src/materials/catalog.ts`: array di materiali con `{ id, nome, categoria, descrizioneBreve, pbr: { color, roughness, metalness, map?, normalMap? } }`.
- Categorie con **canapa in evidenza**: `hempcrete` (calce-canapa), `canapa` (pannelli/tessuti), legno, sughero, calce, terra cruda, lino, pietra.
- Texture in `public/textures/` (partire con colori/roughness plausibili; texture reali dove disponibili).
- `MaterialPicker.tsx`: UI per scegliere un materiale e assegnarlo a superfici (muri esterni, muri interni, pavimento; per-stanza in roadmap).
- In `Viewer3D`: usare `materialId` per costruire il `MeshStandardMaterial` corretto invece dei colori fissi attuali (`WALL_COLOR`, `FLOOR_COLOR`).
- Predisporre (senza implementare) il campo per le **schede tecniche** (isolamento, sostenibilità, costo) nel data model del materiale.

**Done quando**: seleziono "calce-canapa" per i muri e il modello 3D si aggiorna in tempo reale con l'aspetto corretto; la canapa è chiaramente valorizzata nella UI.

---

## FASE 4 — Editor 2D manuale + Tour 3D in-app

**Obiettivo**: ritocchi manuali post-generazione e camminata interna.

Attività:
- **Editor 2D**: portare `Planimetrieai1/src/editor2d.ts` in `src/engine/Editor2D.ts` + wrapper React. Deve operare sul `Plan` a muri (disegno/spostamento muri, porte, finestre, etichette, snap, zoom/pan). È lo strumento con cui il professionista "ci mette le mani".
- **Tour 3D in-app**: nel `Viewer3D`, aggiungere una modalità "cammina": pointer-lock, movimento WASD (+ tocco su mobile), camera ad altezza occhio (~1.6 m), collisioni semplici coi muri se fattibili altrimenti free-fly. Bottone per entrare/uscire dal tour.
- **Video tour**: aggiungere un bottone **placeholder disabilitato** "Esporta video tour — prossimamente". NON implementare la generazione video in v1 (vedi CLAUDE.md §7).

**Done quando**: posso modificare a mano un muro/porta dopo la generazione e vederlo aggiornato in 3D; posso "camminare" dentro la casa in prima persona; esiste il segnaposto del video tour.

---

## FASE 5 — Integrazione Cloud AI

**Obiettivo**: prompt liberi di qualità e foto-facciata → 3D (beta).

Attività:
- Introdurre un **backend proxy** (Node/Express) per le chiamate AI **via OpenRouter** (default `google/gemini-2.5-flash`): la chiave `OPENROUTER_API_KEY` sta solo lato server (vedi CLAUDE.md §5–6). Endpoint `/api/prompt-to-plan` e `/api/facade-to-plan`.
- **Prompt avanzato**: se il parser euristico locale non basta, inviare il testo al proxy → LLM cloud → JSON `PlanRequest` validato → generatore. Mantenere l'euristico locale come fallback offline.
- **Foto facciata → 3D (beta)**: upload immagine → proxy → modello vision cloud che stima piani, proporzioni, aperture, stile → planimetria/volumetria iniziale → pipeline esistente. Marcare chiaramente come **sperimentale** in UI.

**Done quando**: un prompt libero complesso produce un programma stanze sensato via cloud; caricando una foto di facciata ottengo una volumetria 3D di partenza (accettando che sia approssimativa/beta).

---

## FASE 6 — Shell SaaS

**Obiettivo**: vendibile ad architetti/geometri.

Attività:
- Account (registrazione/login) e gestione **abbonamento**.
- Salvataggio progetti lato utente (oltre a export locale).
- Landing/onboarding orientati al pitch (velocità + estetica + focus canapa).
- Deploy (frontend statico + backend proxy).

**Done quando**: un utente può registrarsi, creare/salvare progetti, ed è predisposta la barriera di abbonamento.

---

## Note trasversali (valide in ogni fase)

- **Metri ovunque.** In 3D il piano (x,y) → mondo (x,z), altezza = y.
- **Determinismo**: non rompere la generazione seeded.
- **Esportabilità**: mantenere sempre export `.glb` + JSON funzionanti — è la promessa al professionista.
- **Presentativo, non esecutivo**: non aggiungere complessità da CAD esecutivo salvo richiesta esplicita.
- **Chiavi API mai nel client.**
- **Canapa in evidenza**: è l'elemento distintivo di vendita, non un materiale qualsiasi.
- **Design curato in ogni fase**: ogni nuova UI usa i componenti e i token del design system (CLAUDE.md §9), niente stili one-off. Una fase non è "done" se funziona ma è brutta o incoerente: deve essere bella, coerente e responsive.
- Chiudere ogni fase con app funzionante prima di passare alla successiva.

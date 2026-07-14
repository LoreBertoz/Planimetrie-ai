# HANDOFF.md — Piano di implementazione per Claude Code

Piano operativo a fasi per costruire **PlanimetrieAI** fondendo i due prototipi.
Leggere prima `CLAUDE.md` (visione, decisioni, modello dati).

**Principio guida**: portare/estendere il codice esistente dei due prototipi, non riscrivere. Ogni fase deve chiudersi con l'app funzionante e commit-abile.

> **Stato: Fasi 0-11 COMPLETATE.** L'app unificata gira in `app/` (React 19 + Vite + Three.js + design system + generatore/prompt + editor 2D + tour 3D in-app + materiali canapa su 6 superfici + stili + tetto procedurale + stratigrafia muri + arredi procedurali + Cloud AI via OpenRouter + shell SaaS con account/progetti + condivisione link pubblico + PDF brandizzato), backend in `server/`. Tutte le fasi restano qui come riferimento storico. Verificato in browser il 14/07/2026: generazione varianti, stili/materiali in tempo reale, tetto (3 tipi, pendenza, toggle), pannello muro con stratigrafia, "Arreda stanza" su 5 tipi stanza, tour in prima persona con arredi, pagina `/share/:token` in sola lettura con branding studio, export PDF.

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

## FASE 7 — Materiali estesi (6 superfici) + libreria stili

**Obiettivo**: coprire flooring / walls / ceiling / doors / windows / exterior walls come superfici indipendenti (oggi `MaterialAssignment` copre solo `esterno` / `interno` / `pavimento`), più una libreria di "stili" che applica tutte le superfici in un click.

Contesto codice (verificato leggendo il repo): `materials/catalog.ts` ha `MaterialDef` con `pbr:{color,roughness,metalness,map?,normalMap?}` e `scheda?:{isolamento?,sostenibilita?,costo?}` già riservato ma vuoto; `MaterialAssignment` ha solo 3 chiavi (catalog.ts:131-135); `Wall.materialId` (types.ts:108) permette già override per singolo muro; `MaterialPicker.tsx` ha una UI a tab per le 3 superfici attuali, pattern da estendere non da riscrivere.

Attività:
- Estendere il tipo `Surface`/`MaterialAssignment` da `{esterno, interno, pavimento}` a `{flooring, walls, ceiling, doors, windows, exteriorWalls}`. Scrivere una funzione di migrazione per gli assignment/progetti già salvati in `server/data/db.json` (mappa `esterno→exteriorWalls`, `interno→walls`, `pavimento→flooring`), da non rompere.
- Aggiungere le categorie/materiali mancanti al catalogo:
  - **ceiling**: intonaco calce, legno a perline, cartongesso.
  - **doors**: legno rovere, legno abete, laccato bianco/sabbia, canapa/biocomposito (distintivo nostro, Maket non lo ha).
  - **windows**: telaio legno, telaio legno-alluminio — qui basta colore/roughness del telaio, non serve texture fotografica.
  - **exteriorWalls**: intonaco calce (colori terra/sabbia), intonaco calce-canapa a vista, pietra a vista, legno (facciata ventilata).
- Estendere `MaterialPicker.tsx` per iterare sulle 6 superfici invece di 3 (stessa griglia/interazione già esistente).
- Nuovo file `materials/styles.ts`: `StyleDef { id, nome, immaginePreview, assignment: MaterialAssignment }` con 5 preset — *Rustico Canapa* (calce-canapa, legno grezzo, terra cruda), *Minimal Naturale* (calce chiara, rovere, bianco), *Contemporaneo Caldo* (legno scuro, sughero, pietra chiara), *Mediterraneo* (calce, terracotta, legno chiaro), *Industrial Green* (canapa a vista, cemento chiaro, legno). Ogni stile assegna tutte e 6 le superfici in un colpo.
- Nuovo componente `StylePicker.tsx` (galleria a card con preview, click = applica l'intero `assignment` dello stile).
- `Viewer3D.ts`: applicare i nuovi materiali a soffitto (mesh nuova, vedi Fase 8) e a porte/finestre (oggi presumibilmente colore fisso) usando `assignment.doors`/`assignment.windows`.
- Esporre il picker materiali anche per il singolo muro selezionato (usa `Wall.materialId` già esistente), non solo a livello piano.

**Done quando**: posso cambiare flooring/walls/ceiling/doors/windows/exterior walls indipendentemente su un piano generato; cliccando su uno stile tutte le superfici cambiano insieme in un click; nessuna regressione sui progetti esistenti già salvati.

---

## FASE 8 — Tetto procedurale (attivabile/disattivabile) + soffitto + resa 3D migliorata

**Obiettivo**: casa "completa" mostrabile con tetto vero, look più realistico, controllo mostra/nascondi.

Contesto codice: `Viewer3D.build()` (Viewer3D.ts:165) ricostruisce tutto da `buildingGroup.clear()`, estrude i muri (`buildWall()`, righe 237-288) e crea un unico floor slab sul bounding box (righe 191-212); non esiste soffitto né tetto. Luci: `HemisphereLight` + `DirectionalLight` con shadow camera ortografica (righe 104-114), ground plane statico (116-123). Export `.glb` (righe 391-400) usa `GLTFExporter` su `buildingGroup`: qualunque mesh aggiunta lì viene inclusa in automatico, nessuna modifica extra richiesta lì.

Attività:
- **Soffitto**: nuova mesh piana in `build()`, stessa tecnica del floor slab esistente, quota = `wall.height`, materiale = `assignment.ceiling` (Fase 7).
- **Tetto procedurale**: nuovo modulo `engine/roof.ts` (o metodo `buildRoof(plan)` in `Viewer3D.ts`). Le piante generate da `lib/generator.ts` sono **rettilinee/ortogonali** (guillotine slicing): sfruttare questo per evitare un vero straight-skeleton generico (over-engineering per il nostro caso). Approccio: decomporre il footprint esterno in rettangoli, generare un tetto a falde per ciascun rettangolo (inset dei bordi di `altezza_falda / tan(pendenza)`, colmo centrale, piani triangolari/trapezoidali), unire le mesh dove i rettangoli si toccano (i bordi coincidono già per costruzione, non serve un booleano complesso).
  - Tipi tetto selezionabili: **Piano con parapetto** (estrusione box oltre il perimetro di ~20-30cm — implementarlo per primo, è il più semplice e dà già un salto di qualità immediato), **A capanna** (gable), **A padiglione** (hip).
  - Parametri UI: select tipo tetto, slider pendenza (default ~30%), **toggle mostra/nascondi** (aggiunge/rimuove il gruppo tetto da `buildingGroup` o ne setta `.visible`).
  - Se in futuro arriveranno piante non ortogonali, rivalutare un vero straight-skeleton: non farlo ora.
- **Resa 3D**:
  - Ambiente HDRI (`RGBELoader` + `scene.environment`) al posto del cielo piatto attuale.
  - `PCFSoftShadowMap` + risoluzione maggiore della shadow map sulla directional light.
  - Ground plane con texture erba tileable, più ampio del footprint casa.
  - Punto luce per stanza, auto-posizionato al centro di ogni `PlacedRoom` ad altezza soffitto.
  - Popolare `map`/`roughnessMap` in `MaterialDef.pbr` dove oggi ci sono solo colori piatti (pavimenti, esterni) per un salto di realismo.
- **Vincolo di stabilità**: tetto, soffitto e nuove luci non devono degradare il framerate del tour in prima persona né introdurre z-fighting con i muri — vedi criteri dettagliati in Fase 10.

**Done quando**: la casa generata ha un tetto visibile e disattivabile con almeno i 3 tipi sopra, un soffitto texturizzabile, illuminazione HDRI/ombre morbide attive, e il tour in prima persona resta fluido e senza artefatti con tutto acceso.

---

## FASE 9 — Stratigrafia muri (tipologie di parete reali)

**Obiettivo**: sostituire lo spessore muro "a numero libero" con tipologie di parete reali (preset) o stratigrafia personalizzabile a layer — livello di credibilità tecnica per un pubblico di architetti/geometri.

Contesto codice: `Wall.thickness` è oggi un singolo numero (types.ts:98-109), nessun concetto di layer. `lib/model.ts` ha `DEFAULTS.wallThicknessExt = 0.25` e `wallThicknessInt = 0.12` (righe 12-18), usati da `floorplanToWalls()` (righe 149-191) e da `Editor2D.ts:238` per i muri disegnati a mano.

**Nota di scope**: restare **presentativi**, non un vero calcolo termotecnico (no trasmittanza U, no verifica Glaser, no ponti termici). Il campo `MaterialDef.scheda.isolamento` resta il punto di aggancio futuro per un calcolo reale, non va implementato ora.

Attività:
- Nuovi tipi in `types.ts`:
  ```ts
  interface WallLayer {
    materialId: string;
    thickness: number; // metri
    function: 'struttura' | 'isolante' | 'intercapedine' | 'rasante' | 'intonaco' | 'cartongesso' | 'rivestimento';
  }
  interface WallAssembly {
    id: string;
    nome: string;                 // es. "Muratura portante 30cm + cappotto canapa 12cm"
    categoria: 'portante' | 'tamponamento' | 'tramezzo' | 'cartongesso' | 'facciata-ventilata';
    layers: WallLayer[];          // dall'interno all'esterno
    thickness: number;            // = somma layers, calcolata automaticamente, non editabile a mano
  }
  ```
- Nuovo file `materials/wallAssemblies.ts` con preset basati su spessori reali italiani (fonti in fondo a questo file):
  - Muratura portante 30cm (laterizio 30 + intonaco 1,5cm×2) → ~33cm
  - Muratura portante 30cm + cappotto canapa 12cm (usare pannello canapa-calce invece del solito EPS: è il nostro elemento distintivo) → ~45cm
  - Tamponamento 25cm + cappotto lana di roccia 12cm → ~37cm
  - Tramezzo laterizio 10cm (+ intonaco) → ~12cm
  - Parete cartongesso 10cm (doppia lastra 12,5mm + isolante acustico in intercapedine)
  - Facciata ventilata legno (muratura + isolante + intercapedine ventilata + rivestimento legno)
- `Wall` guadagna `assemblyId?: string`; `thickness` numerico resta come fallback derivato (= `assembly.thickness` se `assemblyId` presente, altrimenti valore libero come oggi, per compatibilità con muri disegnati a mano prima di questa fase).
- `floorplanToWalls.ts`: assegnare un `assemblyId` di default sensato in base a `exterior` (assembly "portante + cappotto" per muri esterni, "tramezzo" per interni) al posto dei soli numeri fissi di `model.ts` — mantenere questi ultimi come fallback.
- UI pannello muro: sostituire lo stepper "Wall thickness" con un select **"Tipo di parete"** (preset con badge spessore totale calcolato, es. "33 cm") + link **"Personalizza stratigrafia"** che apre un editor a lista layer (aggiungi/rimuovi layer, scegli materiale e spessore per layer). Semplice di default, avanzato se serve.
- 3D (v1, senza vista sezione): continuare a estrudere **un solo box per muro** con spessore = `assembly.thickness`; materiale faccia esterna = ultimo layer (rivestimento/rasante esterno), faccia interna = primo layer (intonaco/cartongesso interno). Una vera estrusione multi-layer visibile ha senso solo se un giorno introduciamo una vista "sezione" — non ora.
- 2D: nessuna modifica al rendering del muro, solo alla provenienza del numero di spessore (deve continuare a disegnare correttamente lo spessore totale).

**Done quando**: seleziono un muro, scelgo "Muratura portante 30cm + cappotto canapa 12cm" da un menu, vedo lo spessore totale calcolato e il muro si aggiorna coerentemente in 2D e 3D; posso aprire l'editor avanzato e modificare un singolo layer (materiale e/o spessore).

---

## FASE 10 — Catalogo arredi procedurali + "Arreda stanza" automatico

**Obiettivo**: stanze arredabili manualmente e con un pulsante che arreda automaticamente in base al tipo di stanza (equivalente al "Furnish room" di Maket).

Attività:
- `types.ts`: `FurnitureItem { id, catalogId, x, y, rotation, roomId? }`; `Plan.furniture: FurnitureItem[]`.
- Nuovo file `materials/furnitureCatalog.ts`: `FurnitureDef { id, nome, categoria, sottocategoria, footprint: {w,d}, build(material?) => THREE.Group }`. **Geometria procedurale** (composizioni di `BoxGeometry`/`CylinderGeometry`, stesso stile del resto del motore) per il v1, non modelli GLTF esterni — zero costi di licensing, stile coerente col resto della scena, sviluppo molto più rapido. Un `GLTFLoader` per modelli esterni potrà essere aggiunto in una fase futura se servirà più realismo su pezzi specifici (es. divano, tavolo da pranzo).
  - Set minimo v1: letto + comodini, armadio, divano, tavolo da pranzo + sedie, blocco cucina (base + pensili), sanitari bagno (wc, lavabo, doccia/vasca), scrivania.
- UI: nuovo dropdown "Arredi" nella toolbar dell'editor 2D, menu a 2 livelli (categoria → pezzo — 2 livelli bastano, non serve arrivare a 3 come in Maket per restare "semplice"). Click = piazza al centro della stanza selezionata; poi drag per riposizionare (estendere `Editor2D.ts` se già gestisce oggetti selezionabili/trascinabili, altrimenti aggiungere la gestione).
- Pulsante **"Arreda stanza"** nel pannello stanza: dato `PlacedRoom.type`, piazza in automatico un set coerente dal catalogo tramite una tabella `roomType → catalogId[]` con posizionamento euristico semplice (contro le pareti libere) — non serve un vero motore di layout/ottimizzazione.
- `Viewer3D.build()`: iterare `plan.furniture`, istanziare ogni pezzo via `FurnitureDef.build()` dentro `buildingGroup` (incluso automaticamente nell'export `.glb`, nessuna modifica extra all'exporter).

### Requisito esplicito di questa fase: il tour in prima persona non deve rompersi con arredi e materiali/colori diversi

Questo è un requisito esplicito richiesto per questa fase, non opzionale:

- Nessun crash/freeze/rallentamento anomalo quando si entra in modalità tour con stanze arredate.
- Nessuno z-fighting tra arredi e pavimento/muri (controllare gli offset delle geometrie procedurali).
- Le collisioni/free-fly del tour (già esistenti da Fase 4) devono continuare a funzionare con gli arredi presenti — non serve fisica complessa, ma valutare almeno un controllo grossolano (bounding box) sui pezzi più ingombranti così il free-fly non li "attraversa" in modo visivamente scomodo.
- Cambiare materiale/colore di una superficie appena prima o durante l'uso del tour non deve lasciare texture/materiali residui: verificare che ad ogni richiamo di `build()` le vecchie `geometry`/`material`/`texture` vengano correttamente smaltite con `.dispose()` prima di essere sostituite (pattern standard three.js), per evitare memory leak e flickering dopo generazioni/modifiche ripetute nella stessa sessione.
- Testare con un piano pieno di arredi (6+ stanze arredate) che il framerate del tour resti accettabile; se necessario usare `InstancedMesh` per pezzi ripetuti (es. sedie uguali attorno a un tavolo).
- **Non implementare l'esportazione del tour in video.** Resta, come già previsto in Fase 4, un placeholder disabilitato "Esporta video tour — prossimamente". Nessun lavoro di rendering-to-video in questa fase né nelle successive, salvo indicazione esplicita futura.

**Done quando**: ogni tipo di stanza generato ha un pulsante "Arreda stanza" che la riempie in modo plausibile; il tour in prima persona resta stabile, fluido e senza artefatti visivi con arredi e materiali/colori personalizzati attivi contemporaneamente; il video tour resta un placeholder non funzionante come da Fase 4, non implementato.

---

## FASE 11 — Condivisione (link pubblico) + export PDF brandizzato

**Obiettivo**: l'architetto/geometra può mandare la proposta al cliente senza che questo debba aprire o capire l'app.

Attività:
- Backend (`server/`): nuovo endpoint pubblico di sola lettura `GET /api/public/:shareToken` (nessun login richiesto) che restituisce i dati di un piano; `POST /api/projects/:id/share` (autenticato) genera/revoca il token.
- Frontend: nuova route pubblica (es. `/share/:token`) che monta `Viewer3DCanvas`/`PlanSvg` in modalità **read-only** (nessun editor, nessuna azione di scrittura), riusando i componenti esistenti con una prop `readOnly`.
- UI progetto: bottone "Condividi" → genera link, copia negli appunti, toggle per revocare l'accesso.
- Export PDF brandizzato: campo "Logo studio" + "Nome studio" nelle impostazioni account (server + UI); estendere `lib/export.ts` con un template PDF che aggiunge intestazione logo+nome studio+data al piano esportato.

**Done quando**: genero un link di condivisione, lo apro in una finestra in incognito senza login e vedo il piano in sola lettura; esporto un PDF con il logo del mio studio in intestazione.

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
- **Tour in prima persona sempre stabile**: qualunque fase che tocchi arredi, materiali/colori o geometria 3D (Fasi 7, 8, 9, 10) deve lasciare il tour WASD/pointer-lock funzionante, fluido e senza artefatti — vedi criteri espliciti in Fase 10. Non è un "nice to have", è una condizione di done.
- **Video tour: non implementarlo.** Resta un placeholder disabilitato "Esporta video tour — prossimamente" introdotto in Fase 4. Nessuna delle Fasi 7-11 (né future, salvo indicazione esplicita) deve aggiungere generazione o esportazione video del tour.

---

## Fonti per la stratigrafia muri (Fase 9)

- [Facciata ventilata: stratigrafia tipo, spessori — BibLus/ACCA](https://biblus.acca.it/parete-ventilata-stratigrafia-tipo/)
- [Dimensioni dei Blocchi POROTON](https://www.poroton.it/mattoni-laterizi/dimensioni-blocchi-poroton/)
- [Blocchi Poroton per muratura portante sp. 25 cm — FAQ Consorzio POROTON](https://www.poroton.it/domande-risposte/blocchi-per-muratura-portante-spessore-25-cm/)
- [Pareti divisorie in cartongesso: spessori, stratigrafia e prestazioni — Vanoncini](https://www.vanoncini.it/pareti-divisorie-cartongesso)
- [Tramezzi in cartongesso vs muratura: confronto e guida — Edilportale](https://www.edilportale.com/news/2026/06/progettazione/tramezzi-in-cartongesso-vs-muratura-confronto-e-guida-alla-scelta_110998_17.html)
- [Spessore del cappotto esterno, come sceglierlo — Edilportale](https://www.edilportale.com/news/2023/11/focus/spessore-del-cappotto-esterno-come-sceglierlo_96679_67.html)
- [Isolanti per cappotto: EPS, XPS, lana di roccia, PIR — Demasi](https://demasi.biz/comunicazione/isolanti-cappotto-eps-xps-lana-pir-guida-tecnica/)

## Riferimento: analisi maket.ai

Le Fasi 7-11 nascono da un'analisi comparativa approfondita di [maket.ai](https://www.maket.ai) (sito + app live). Il report completo con ogni funzionalità osservata è in `maket-ai-analisi-funzionalita.md`; la proposta di roadmap con il ragionamento completo (incluse le opzioni scartate) è in `proposta-evoluzione-planimetrieai.md`, entrambi nella root del repo.

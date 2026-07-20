# HANDOFF — Fasi 12-16 (evoluzione realismo, multi-piano, arredi, deploy)

Piano operativo per il secondo ciclo di sviluppo di **PlanimetrieAI**.
Documento autosufficiente: può essere ripreso in una chat nuova.

> **Prima di lavorare, leggere sempre:** `CLAUDE.md` (visione, posizionamento, modello dati, design system) e `HANDOFF.md` (fasi 0-11 già completate). Questo file continua la numerazione: **Fasi 12-16**.

---

## Stato attuale (punto di partenza)

App unificata in `app/` (React 19 + Vite + TypeScript + Three.js). Fasi 0-11 completate:
generatore/prompt, editor 2D, motore 3D, tour in prima persona (WASD + pointer-lock), materiali su 6 superfici + stili, tetto procedurale (piano/capanna/padiglione), stratigrafia muri, arredi procedurali + "Arreda stanza", condivisione link pubblico + PDF brandizzato. Backend Node/Express in `server/` (DB su file JSON `server/data/db.json`). Deploy frontend su Vercel via `vercel.json` (solo statico, backend non ancora online).

**File chiave da conoscere:**
- Materiali: `app/src/materials/catalog.ts` — `MaterialDef.pbr` ha già i campi `map`, `normalMap`, `roughnessMap` (oggi inutilizzati, solo colori piatti).
- Motore 3D: `app/src/engine/Viewer3D.ts` — `build()`, `buildWall()`, `toStandard()`, `disposeSubtree()`, luci (IBL RoomEnvironment + directional), tetto, soffitto, luci per stanza, arredi, tour (`startTour()`, `updateWalk()`, `collides()`).
- Tetto: `app/src/engine/roof.ts`.
- Modello dati: `app/src/types.ts` — `Plan`, `Wall`, `Opening`, `PlacedRoom`, `FurnitureItem`, `RoofOptions`, `WallAssembly`.
- Arredi: `app/src/materials/furnitureCatalog.ts` (geometria procedurale), `app/src/lib/furnish.ts` ("Arreda stanza").
- Editor 2D: `app/src/engine/Editor2D.ts`.
- Stili materiali: `app/src/materials/styles.ts`, `app/src/components/StylePicker.tsx`.
- App/UI: `app/src/App.tsx`.
- Backend: `server/index.mjs`, deploy: `vercel.json`.

---

## Decisioni prese col committente (valide per tutte le fasi)

1. **Texture:** libertà piena di sorgente. Priorità = **massima resa visiva**. Uso librerie PBR CC0 di alta qualità (ambientCG, Poly Haven) come base; maket.ai è riferimento per *quali* materiali coprire. App a uso privato del committente. Scelgo io i set migliori.
2. **Passaggio tra piani nel tour:** **pulsante "cambia piano"** (nessuna camminata fisica sulle scale). Affidabile, funziona anche su touch.
3. **Scale:** **rimandate agli arredi** (Fase 15). In Fase 14 nessuna scala fisica; il collegamento tra piani è solo il pulsante.
4. **Mobili (Fase 15):** approccio **ibrido** — GLTF CC0 per i pezzi protagonisti (divano, letto, tavolo, cucina) + procedurale per il resto.
5. **Impronta dei piani superiori (multi-piano):** **DA DEFINIRE** (vedi Fase 14, sezione "Decisione aperta"). Default consigliato: stessa impronta impilata, con possibilità di rimuovere stanze.
6. **Stili architettonici:** decido io (vedi Fase 14). Sistema separato "stile edificio" che guida massa, tetto e disposizione piani.

**Vincoli trasversali (come in HANDOFF.md):** metri ovunque; determinismo del generatore (seed) intatto; export `.glb`/JSON/PDF sempre funzionanti; **tour sempre stabile e fluido** dopo ogni fase; **video tour resta placeholder disabilitato** (non implementare); design curato e coerente col design system (niente stili one-off); canapa in evidenza.

---

## Lista modifiche (ordine di esecuzione)

| Fase | Titolo | Sforzo | Rischio | Dipende da |
|------|--------|--------|---------|------------|
| 12 | Texture PBR reali su tutte le superfici | Medio | Basso | — |
| 13 | Resa realistica + dettagli architettonici + decorazioni | Grande | Medio | 12 |
| 14 | Multi-piano (fino a 3) + tour verticale + stili architettonici | Molto grande | Alto | 12-13 |
| 15 | Stili d'arredo (5-10) con mobili 3D ibridi + scale | Grande | Medio | 12-14 |
| 16 | Backend online (deploy funzionante) | Medio | Medio | indipendente |

Consiglio: **12 + 13 insieme** (si rinforzano), poi rivalutare la 14. La **16 è indipendente**: può essere fatta in qualsiasi momento, va chiusa quando serve il sito pubblico realmente funzionante.

---

## FASE 12 — Texture PBR reali su tutte le superfici — ✅ COMPLETATA (21/07/2026)

**Implementata così:** 14 set PBR CC0 da ambientCG (color+normal+roughness, 1K JPG ricompressi, ~12MB) in `app/public/textures/<set>/` con `manifest.json` degli asset id. Nuovo `app/src/engine/textures.ts`: cache condivisa di texture (mai disposte dal teardown, flag `userData.shared`), `applyTextureSet(mat, set, size, tint?)`, e helper UV in metri (`boxUVsToMeters` con offset U/V per continuità sui segmenti muro, `planeUVsToMeters`, `generateWorldUVs` per il triangle-soup del tetto). `MaterialDef.pbr` ora ha `textureSet`/`textureSize`/`tint` (via `catalog.ts`, 21 materiali su 25 texturizzati; laccati e telai restano lisci). `Viewer3D.toStandard()` applica i set; muri/pavimento/soffitto/porte/tetto/parapetti/terreno con UV metrici; tetto = RoofingTiles014A (coppi cotto); erba reale con tint desaturante; vetro con `envMapIntensity`. Verificato in browser: tiling in scala reale, interni col tour, nessun errore console.

**Obiettivo (originale):** sostituire i colori piatti con texture PBR reali su pavimenti, muri (int/est), soffitto, tetto (interno), porte e finestre. È la base visiva di tutto il resto.

**Contesto codice:** `MaterialDef.pbr` (`catalog.ts:32-39`) ha già `map`/`normalMap`/`roughnessMap` come path opzionali sotto `public/textures/`. Oggi `toStandard()` in `Viewer3D.ts` costruisce `MeshStandardMaterial` usando solo `color/roughness/metalness`.

**Attività:**
- **Sorgente texture:** scaricare/preparare set PBR (albedo + normal + roughness, AO dove utile) per ogni materiale del catalogo. Formati compressi (`.webp`/`.ktx2` se possibile) in `public/textures/<materiale>/`. Priorità ai materiali naturali (canapa/calce-canapa, legno rovere/abete/noce, sughero, cotto, pietra, intonaco calce), poi serramenti (telaio legno/legno-alluminio) e porte.
- **Texture manager:** modulo `app/src/engine/textures.ts` che carica una volta e **cachea** ogni texture (`Map<string, THREE.Texture>`), imposta `wrapS/wrapT = RepeatWrapping`, `colorSpace = SRGBColorSpace` sull'albedo, e restituisce cloni/istanze condivise. Deve integrarsi col `disposeSubtree()` esistente per evitare leak/flicker nel tour.
- **UV tiling in scala reale (punto tecnico chiave):** oggi i muri sono `BoxGeometry` con UV 0-1 per faccia → la texture si stira. Impostare `texture.repeat` in base alle dimensioni reali della superficie (ripetizioni ≈ lunghezza_m / dimensione_texture_m). Valutare `map.repeat.set(w, h)` per mesh o una utility che rigenera le UV in scala. Pavimento, soffitto e falde del tetto vanno gestiti allo stesso modo.
- **Popolare il catalogo:** riempire `pbr.map`/`normalMap`/`roughnessMap` in `catalog.ts` per ogni materiale. Mantenere `color` come fallback/tinta.
- **Aggiornare `toStandard()`** in `Viewer3D.ts` per applicare le texture caricate quando presenti, con `dispose()` corretto.
- **Serramenti/vetri:** finestre = telaio texturizzato + vetro con leggera riflessione/roughness bassa (già presente `glassMat`, migliorarlo con environment map).

**Done quando:** cambiando materiale su una qualsiasi delle 6 superfici il modello mostra la texture reale correttamente ripetuta (non stirata), in 2D nessuna regressione, tour fluido, nessun leak dopo rigenerazioni ripetute.

---

## FASE 13 — Resa realistica + dettagli architettonici + decorazioni

**Obiettivo:** far sembrare la casa un edificio vero e "renderizzato", non un modellino a blocchi.

**Attività — Qualità di resa (post-processing):**
- Tone mapping cinematografico `ACESFilmicToneMapping` + esposizione calibrata sul renderer.
- **Ambient occlusion / contact shadows** (SSAO via `EffectComposer` di three/addons, oppure GTAO) — grande salto di realismo sui contatti muro/pavimento/arredi.
- Ottimizzare ombre morbide già presenti (PCFSoft) e intensità IBL; valutare leggero bloom sulle sorgenti luminose.
- Verificare che il post-processing **non degradi il framerate del tour** (bypass o qualità ridotta in modalità tour se necessario).

**Attività — Dettagli architettonici (geometrie):**
- Battiscopa lungo il perimetro interno delle stanze.
- Cornici porte/finestre con spessore reale; davanzali sporgenti.
- Tetto: gronda/fascia, leggero cordolo, comignolo procedurale.
- Smussi/bevel leggeri sugli spigoli principali (o normal map per simularli) per togliere l'aspetto "cubo".
- Porta d'ingresso valorizzata (dimensione/telaio dedicati).

**Attività — Esterni e decorazioni:**
- Paesaggio minimo attorno alla casa: vialetto d'ingresso, qualche elemento verde (cespugli/alberi low-poly), terreno meno piatto.
- Decorazioni interne di base (tende alle finestre, tappeti, piante, quadri, lampade a soffitto) — parte si sovrappone alla Fase 15; qui solo il set minimo per non avere stanze vuote.

**Nota:** molti di questi elementi vanno inseriti in `buildingGroup` così restano inclusi nell'export `.glb` automaticamente. Rispettare `dispose()` e stabilità del tour.

**Done quando:** una casa generata, con texture attive, appare credibile e "renderizzata" (ombre di contatto, dettagli di bordo, ingresso e contorno esterni), il tour resta fluido e senza artefatti.

---

## FASE 14 — Multi-piano (fino a 3) + tour verticale + stili architettonici

**Obiettivo:** gestire fino a 3 piani impilati, navigabili nel tour tramite pulsante "cambia piano", con un sistema di stili architettonici che guida massa e coperture.

> **Nota di scope:** nel `CLAUDE.md` il multi-piano era "fuori scope v1". Questa fase amplia ufficialmente la roadmap: aggiornare `CLAUDE.md`/`HANDOFF.md` di conseguenza a fine fase.

**Attività — Modello dati:**
- Introdurre un contenitore edificio: `Building { floors: Floor[]; roof: RoofOptions; ... }` dove `Floor { plan: Plan; elevation: number; index: number }`. Oggi esiste un solo `Plan`; va adattato lo stato in `App.tsx` e la persistenza (`ProjectData` lato `api.ts` + `server`).
- Il soffitto del piano N è il pavimento del piano N+1; il tetto va solo sull'ultimo piano.
- Migrazione: i progetti esistenti (un piano) diventano `floors: [piano0]`.

**Attività — 3D:**
- `Viewer3D` impila i piani alle quote corrette (`elevation = index * altezza_interpiano`).
- Rendere possibile mostrare tutti i piani o isolarne uno (utile in vista 3D e per il tour).

**Attività — Tour verticale:**
- **Pulsante "cambia piano"** nel tour: sposta la camera al piano scelto mantenendo x,z, reimposta la quota occhio. Nessuna scala fisica, nessuna gravità/salita gradini.
- Le collisioni del tour usano i muri del piano corrente.

**Attività — Scale:** NON in questa fase (rimandate alla Fase 15 come arredo). Prevedere solo lo spazio/vano scala a livello di layout se emerge, ma senza geometria camminabile.

**Attività — Stili architettonici (decido io):** sistema "stile edificio" separato dagli stili-materiali, che definisce massa + tetto + disposizione piani. Set proposto (4-5):
- **Contemporaneo** — tetto piano, volumi netti, grandi vetrate, piani impilati a filo.
- **Rustico / Casale** — tetto a falde ripide, pietra/legno/cotto, piani con leggeri arretramenti.
- **Mediterraneo** — tetto a padiglione/coppi, intonaco chiaro, logge.
- **Scandinavo / Minimal** — capanna semplice, legno chiaro, linee pulite.
- **Barnhouse (fienile moderno)** — capanna molto ripida, legno a tutta altezza (ottimo per il posizionamento canapa/naturale).
Ogni stile edificio preseleziona: tipo tetto (collega a `roof.ts`), materiali di default (collega a `styles.ts`), e regole di impilamento piani.

**Decisione aperta (punto 5 — DA DEFINIRE col committente):**
Impronta dei piani superiori:
- **Opzione A (consigliata, stabile):** stessa impronta del piano terra, impilata, con possibilità di *rimuovere* stanze/aree ai piani alti (setback semplici).
- **Opzione B (flessibile, complessa):** ogni piano disegnabile liberamente e diverso.
Partire da A; valutare B solo se richiesto. **Confermare prima di implementare la Fase 14.**

**Done quando:** posso creare 2-3 piani, vederli impilati in 3D con tetto solo in cima, e nel tour passare da un piano all'altro col pulsante; scegliendo uno stile edificio cambiano coerentemente tetto/materiali/massa; nessuna regressione su progetti a piano singolo.

---

## FASE 15 — Stili d'arredo (5-10) con mobili 3D ibridi + scale

**Obiettivo:** personalizzazione reale dell'arredamento: 5-10 stili d'arredo, ognuno con un set di mobili 3D, inseribili uno a uno o via "Arreda stanza" nello stile scelto. Include le scale come arredo.

**Contesto codice:** `furnitureCatalog.ts` ha ~10 pezzi procedurali con un solo stile; `furnish.ts` ha un solo set per tipo stanza; piazzamento/drag/rotate/delete già in `Editor2D.ts`.

**Attività:**
- **Sistema stili d'arredo:** `FurnitureStyle { id, nome, preview, pieces }`. Ogni stile fornisce la variante di ogni pezzo (letto, comodini, armadio, divano, tavolo+sedie, cucina, sanitari, scrivania, ecc.).
- **Approccio ibrido:** pezzi protagonisti (divano, letto, tavolo, blocco cucina) come **GLTF CC0** caricati con `GLTFLoader` (con cache + dispose, come per le texture); resto procedurale parametrizzato per stile (colori/proporzioni/finiture).
- **Set stili (5-10):** es. Scandinavo, Moderno, Rustico/Naturale (canapa/legno grezzo), Industriale, Classico, Mediterraneo… (definizione precisa in fase di implementazione).
- **UI:** selettore stile d'arredo; poi piazzamento singolo (menu arredi esistente) **oppure** "Arreda stanza" che usa lo stile attivo. Estendere `furnish.ts` per accettare lo stile.
- **Scale (rimandate qui dalla Fase 14):** aggiungere le scale come elemento/arredo piazzabile (modello GLTF o procedurale), posizionabile nel vano scala; puramente visivo (il tour continua a usare il pulsante "cambia piano").
- **Performance:** `InstancedMesh` per pezzi ripetuti (es. sedie uguali); tour deve restare fluido con più stanze arredate e stili diversi; dispose rigoroso.

**Done quando:** posso scegliere tra 5-10 stili d'arredo, arredare una stanza automaticamente nello stile scelto o piazzare i pezzi uno a uno, e piazzare una scala; il tour resta stabile e fluido con arredi realistici e materiali/colori personalizzati.

---

## FASE 16 — Backend online (deploy funzionante)

**Obiettivo:** rendere il sito pubblico realmente funzionante: account, salvataggio/caricamento progetti, condivisione (`/share/:token` + pagina pubblica), AI cloud (prompt e foto-facciata via OpenRouter), impostazioni studio. Oggi il deploy Vercel serve solo il frontend statico; le chiamate `/api/...` falliscono in produzione.

**Contesto:** `server/index.mjs` (Express) usa un DB su file JSON (`server/data/db.json`) — non persistente su filesystem serverless. `vercel.json` attuale builda solo `app/` come statico.

**Attività (da valutare in implementazione):**
- **Opzione 1 (consigliata):** portare `server/` su **Vercel come funzione serverless** (Fluid Compute supporta Express nativamente) + spostare i dati su un **database reale** (Supabase è già collegato a questo ambiente e si adatta bene) al posto del file JSON. Gestire `OPENROUTER_API_KEY` come env var lato server (mai nel client).
- **Opzione 2:** hostare `server/` separatamente (Render/Railway) e puntare il frontend via env var sull'URL del backend.
- Aggiornare `vercel.json` / config per instradare `/api/*` al backend.
- Verificare che condivisione, salvataggio, AI e impostazioni studio funzionino sul dominio pubblico.

**Done quando:** dal sito pubblico posso registrarmi, salvare/caricare un progetto, generare un link di condivisione che si apre senza login, e usare l'AI cloud; le chiavi API restano solo lato server.

**Nota:** richiede autorizzazione degli MCP server (Vercel/Supabase) in una sessione interattiva.

---

## Riepilogo decisioni ancora aperte (da confermare)

- **Fase 14 — impronta piani superiori:** Opzione A (impilata, consigliata) vs B (liberi). *Confermare prima di iniziare la Fase 14.*
- Tutto il resto è deciso (vedi sezione "Decisioni prese").

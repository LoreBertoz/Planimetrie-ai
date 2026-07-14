# Maket.ai — Analisi completa delle funzionalità (ricerca per PlanimetrieAI)

Ricerca condotta navigando dal vivo dentro **app.maket.ai** (account loggato, "Federico") con Claude in Chrome, più il sito marketing **maket.ai** (Home, Features, Pricing, Releases/changelog). Data ricerca: 14 luglio 2026.

---

## 1. Posizionamento e modello di business

- **Claim**: "The AI Floor Plan Studio" — genera planimetrie, esplora layout, visualizza la casa con l'AI.
- **Target dichiarato**: homeowner, builder, professionisti del real estate. Non si presenta come sostituto dell'architetto ("Maket is designed to complement architects, not replace them... poi porta il progetto da un professionista per revisione strutturale e permessi") — posizionamento molto simile al nostro "presentativo, non esecutivo".
- **Numeri di marketing**: 1M+ utenti su v1; v2 è l'attuale generazione di prodotto ("smarter, more flexible, radically simple").
- **Modello a crediti**:
  - Free: 50 crediti una tantum, no carta di credito, single-story generation.
  - Plus: **20 $/mese**, 300 crediti/mese, multi-floor (fino a 4 piani), text-based optimization tools, top-up pack acquistabili (10$/150 crediti, non scadono).
  - Costo consumo: **20 crediti per generazione di un piano**, **10 crediti per render**.
  - I crediti mensili non fanno rollover; i top-up sì e restano anche se disdici l'abbonamento.
- **Funzioni gated dietro paywall**: upload planimetria esistente, generazione multi-piano, top-up.
- Export **DWG/DXF verso CAD professionali (AutoCAD, Revit, SketchUp) è dichiarato "coming soon"** — oggi l'export reale è PDF e DXF base.

---

## 2. Dashboard e creazione progetto

Alla home ("What would you like to do today?") tre percorsi paralleli, ognuno apre lo stesso editor:

1. **Generate a new floor plan** — chat AI: raccoglie in modo conversazionale/progressivo un brief con 5 campi espliciti mostrati come checklist live ("Gathering your input"): *Number of floors, Floor plan area, Floor plan shape, Preferred rooms, Additional requirements*. L'assistente fa domande una alla volta, mostra "Thinking…"/"On it, this typically takes me a few minutes" e poi consegna il piano generato con suggerimenti rapidi cliccabili ("Make changes to my plan", "Start a new floor plan").
2. **Draw plan from scratch** — canvas vuoto, editor manuale (muri, aperture, mobili) con lo strumento "Draw wall" già attivo.
3. **Upload your floor plan** — flusso via chat: bottone "Upload plan (image or PDF)", il messaggio di sistema dice esplicitamente "PDFs and images both work". Dal changelog: riconoscimento automatico della scala se la planimetria ha quote stampate, altrimenti fallback a calibrazione manuale; rilevamento muri diagonali/smussati (preservati, non più "a gradini"); upload multi-piano caricabile un piano alla volta in turni di chat successivi e poi riconosciuto come un unico progetto; pre-check leggero prima del riconoscimento completo per feedback più veloce; preprocessing "text-free" per riconoscimento più accurato.

Ogni progetto ha una vista elenco con tab **Plans** / **Images** (le immagini sono quelle generate via chat, es. reference/mood), pulsante **New Folder**, **Sort**, ricerca. Rinomina file, "Return to [progetto]" dal menu contestuale del titolo.

---

## 3. Editor — modalità "Layout" (2D)

Barra in alto: tab **Layout / Visualize**, selettore piano ("First Floor" ▾ con opzione **Add floor** — multi-piano nativo), undo/redo, icona impostazioni canvas, contatore crediti, **Share**.

**Barra strumenti in basso**:
- **Furniture ▾** — menu a 3 livelli con ricerca: 11 categorie (Accessories, Bathroom, Bedroom, Entry & Laundry, Garage & Storage, Gym, Kitchen & Dining, Living Room, Office, Outdoors, Recreation) → sottocategorie (es. Kitchen & Dining → Dining Tables + Chairs, Kitchen Cabinet Sets, Kitchen Island, Separate Counters + Appliances) → varianti parametriche specifiche (es. Rectangular 6/8 sedie, Round 4, Square 4/8). Tutto drag-in-canvas.
- **Structure ▾** — Door (Garage/Hinged/Sliding), Railing, Stairs (dal changelog: anche **scale a L con pianerottolo e variante "winder"**), Support, Window.
- **Select** / **Draw wall** (ora anche **a qualunque angolo**, non solo 90°, dal changelog).
- Zoom +/-, "recenter" canvas.
- Icona **?** guida in basso a sinistra.
- Dal changelog: **multi-selezione** (box di selezione o shift-click) su stanze/muri/arredi insieme, poi spostamento di gruppo; **drag diretto dei muri** (hover+trascina, i bordi collineari si muovono insieme).

**Pannello destro contestuale** (cambia in base a cosa selezioni):
- *Nessuna selezione / piano*: Dimensioni (Floor area, Exterior), Configurazione (Wall thickness +/-), Design References → **Style** (8 stili moodboard: Rustic, Traditional, Mid-century Modern, Scandinavian, Modern, Farmhouse, Coastal, Industrial — ognuno con foto di riferimento reale), **Finishes** per l'intero piano: Flooring, Walls, Ceiling, Doors, Windows, **Exterior walls**. Pulsante **Remove floor**.
- *Stanza selezionata*: nome stanza editabile, Dimensioni (Floor area, Interior), **Room type** (dropdown con ricerca, decine di tipi: Bedroom, Full/Half Bathroom, Living Room, Family Room, Game Room, Recreation Room, Kitchen, Dining Room, Office, Pantry, Laundry, Mechanical Room, Entry, Mudroom, Corridor, Garage, Front Porch, Deck, Balcony, Home Gym, ecc.), pulsante **"Furnish room"** (arreda automaticamente via AI in base al tipo stanza), Design References (Style) e Finishes **per-stanza** (override rispetto al piano).
- *Mobile selezionato*: nome oggetto, icone di configurazione (flip orizzontale/verticale, rotazione, allineamento), Finish per il singolo pezzo, **Remove furniture**. Quote di ingombro mostrate a lato durante la selezione.

**Materiali/finiture** ("Add finish"): due tab — **Material** (griglia fotografica di materiali reali con filtro per categoria: es. per pavimenti → Wood flooring, Concrete, Tile; nomi tipo "Terrazzo", "Natural Oak", "Terracotta Fan Tile", "Concrete – Light") e **Colour** (color picker HSV completo + hex, non solo preset).

**Impostazioni canvas** (icona ingranaggio): toggle "Show styles", **Measurements** (unità Metric/Imperial persistente per progetto — salvata dal changelog — + toggle "Show all measurements"), **Wall snap angle**.

Dal changelog, arredo automatico intelligente per tipologia stanza: *Home Gym* → tapis roulant, cyclette, rack pesi, panca, tappetino yoga; *Front Porch* → sedute lounge e fioriere ai lati della porta; *Game/Recreation Room* → tavolo da biliardo, ping-pong, divano opzionale; cucine con isola non duplicano il lavello; sedie "si infilano" sotto le scrivanie negli export SVG e nei layout auto-generati; controlli di **percorribilità** (walkability) — ogni porta/apertura deve restare raggiungibile; niente sovrapposizioni tra stanze; hall e cucina restano sempre accessibili (circolazione non spezzata).

---

## 4. Editor — modalità "Visualize" (render fotorealistico AI)

Sul piano 2D compaiono icone "camera/omino" preposizionate in ogni stanza (viste "walk-in" per stanza, generate automaticamente). Cliccandone una si apre un pannello a destra:

- Anteprima immagine (placeholder/ultimo render).
- Titolo camera modificabile (es. "Walk In Camera", poi rinominata tipo "Dining Room Camera" — dal changelog i nomi camera hanno perso il prefisso "any").
- Tab **Scene** / **Renders** (galleria render generati per quella specifica inquadratura, con stato "No renders yet — Click 'Render scene' to create your first render").
- **Configuration**: Field of view (slider/stepper in gradi, default 75°), **Aspect ratio** (dropdown, es. Landscape 4:3).
- **Prompt** libero (placeholder: "E.g. add a cat, golden hour") + **Attach** (upload immagine di riferimento).
- Pulsante **Render scene** (consuma 10 crediti).
- Menu "…" → **Edit Scene**.

Dal changelog, migliorie recenti al motore 3D/render: **cielo HDRI, ombre solari dinamiche, piano prato esterno, luci per-stanza, pannello ridimensionabile trascinando**; texture pavimenti esterni dedicate per deck/balconi/portici; corretta geometria 3D per muri inclinati/diagonali.

---

## 5. Condivisione ed export

Modal **Share** (bottone in alto a destra, rinominato di recente da "Export" a "Share"):
- **Download plan** → PDF o DXF.
- **Download renders** (se presenti).
- **Share view-only link** (toggle on/off + pulsante Share) — link pubblico di sola visualizzazione.
- Dal changelog: condivisione diretta a **LinkedIn o X** oltre al link; l'apertura del modal ora abilita subito la condivisione senza dover prima attivare il toggle.

---

## 6. Account, impostazioni, assistente

- Menu utente (icona ingranaggio in alto a destra, fuori dal progetto): **Account settings**, **Sign out**.
- **My Profile**: nome, **Delete account**.
- **Billing**: piano corrente + crediti residui, box upgrade a Plus con elenco feature incluse, pricing $20/mese in evidenza.
- **Assistente AI conversazionale** presente come chat persistente a sinistra in ogni progetto: capisce comandi in linguaggio naturale ("Make changes to my plan", "Upload my floor plan", "Start a new floor plan"), fa domande di chiarimento, mostra stato di avanzamento ("On it! This typically takes me a few minutes", "Understanding your request…"), propone suggerimenti cliccabili contestuali, e permette anche generazione di **immagini reference** raccolte poi nel tab "Images" del progetto.
- Bolla di **help/supporto** fluttuante in basso a destra su ogni schermata.
- Legal: al signup ora si accettano esplicitamente Terms of Service e Privacy Policy (novità di changelog).

---

## 7. Roadmap dichiarata pubblicamente (pagina Features, sezione "One workspace. Every space.")

Funzionalità già live: **Floor plans** (genera/disegna/carica, poi cammina in 3D).

Marcate **"COMING SOON"** sul sito (quindi ancora non disponibili nemmeno per Maket, utile per capire dove sta andando il mercato):
- **Renovations** — carica il tuo piano esistente e anteprima delle modifiche prima di deciderle.
- **Interiors** — testare vernici, mobili, finiture affiancate.
- **Home exteriors** — provare rivestimenti, colori, stili di facciata in render fotorealistici.
- **Kitchens** — testare layout e finiture cucina prima di decidere.
- **Rooms** — focus su una stanza singola alla volta (dal salotto allo studio).
- **Room decorator** — restyle di una stanza partendo da una foto (decor, colori, mood).
- **Living rooms**, **Bedrooms** — moduli dedicati per arredo/layout mirato.
- **Architecture** — concept plan e studi di massing in scala, in pochi minuti.

---

## 8. Changelog rilevante (funzionalità "minute" ma indicative di cura del prodotto)

- Ricerca stanze nel dropdown "Add Room"/selettore tipo stanza.
- Preferenza unità Metric/Imperial salvata per progetto tra un reload e l'altro.
- Editor 2D si aggiorna automaticamente dopo modifiche fatte via chat (niente reload).
- Rinomina/cambio tipo stanza via chat → l'AI ri-arreda automaticamente con il set corretto per il nuovo tipo.
- Etichette camere leggibili ("Dining Room Camera" invece di placeholder generici).
- Riconoscimento più affidabile delle planimetrie caricate, specie complesse, con meno "drift" nella geometria.
- Upload multi-piano: pre-check di ogni piano eseguito in parallelo per ridurre l'attesa.
- Generazione AI non va più in timeout su richieste lunghe/complesse.
- Messaggi di progresso persistenti in chat durante la generazione.
- Riepilogo delle capacità dell'"optimizer" mostrato *prima* di iniziare una modifica, non dopo.
- Il flusso di chat riprende automaticamente dopo un pagamento/upgrade, senza dover reinviare il messaggio.

---

## 9. Confronto rapido con PlanimetrieAI — spunti concreti

Aree in cui Maket è oggi più avanti della nostra app (utile come lista di candidati per le prossime fasi):

- **Multi-piano nativo** ("Add floor") — nel nostro HANDOFF è esplicitamente "fuori scope v1"; Maket lo tratta come feature normale (anche se a pagamento).
- **Generazione guidata a checklist trasparente** ("Gathering your input": piani, superficie, forma, stanze preferite, requisiti extra) invece di un unico prompt libero — più rassicurante per un cliente non tecnico durante una demo commerciale.
- **Upload planimetria esistente (PDF/immagine) → riconoscimento automatico** con rilevazione scala/quote e muri diagonali — funzionalità che il nostro HANDOFF prevede solo come "foto facciata → 3D" (beta, un caso d'uso diverso: volumetria da foto esterna, non planimetria 2D da PDF/scan).
- **Editor con multi-selezione e drag diretto dei muri** — più fluido del nostro editor 2D pianificato.
- **Materiali con due modalità (foto reali + color picker libero)** e **finiture sia per-piano sia per-singola-stanza sia per-singolo-oggetto** — noi abbiamo pensato materiali a livello muro/pavimento/stanza ma non ancora un color picker libero né override per singolo arredo.
- **Libreria arredi strutturata a 3 livelli con varianti parametriche** — molto più ricca di quanto pianificato nella nostra Fase 4 (che è focalizzata su editor muri/porte/finestre, non arredo).
- **"Furnish room" AI** — arredo automatico con un click in base al tipo di stanza, con set coerenti (bagno, cucina, palestra, ecc.) — non presente nel nostro piano.
- **Render AI fotorealistico per-camera con prompt libero + reference image**, non solo materiali PBR statici in Three.js — Maket usa generazione immagine via AI (stile "prompt: aggiungi un gatto, luce dorata") oltre al motore 3D navigabile.
- **Condivisione**: link pubblico view-only + condivisione diretta sui social — noi non abbiamo ancora un flusso di condivisione/export pubblico.
- **Export dichiarato in arrivo verso DWG/Revit/AutoCAD/SketchUp** — oggi solo PDF/DXF anche per loro, quindi siamo alla pari o leggermente indietro solo su questo punto (noi abbiamo già `.glb` + JSON + SVG/PNG/DXF).
- **Modello a crediti con costi differenziati per azione** (20 cred/piano, 10 cred/render) — utile riferimento se in futuro vorremo introdurre un sistema di monetizzazione a consumo invece che puro abbonamento.

Aree in cui la nostra impostazione resta **distintiva e da non perdere**: il focus verticale sulla canapa/materiali naturali (Maket non ha nulla di simile, è generalista), l'export `.glb` per il 3D (Maket non lo menziona, solo PDF/DXF), e il posizionamento esplicito "presentativo per il cliente finale" con tour in prima persona già incluso in v1 (Maket ha il walkthrough 3D ma il render fotorealistico sembra il fulcro, più che il tour navigabile in tempo reale).

---

*Nota: durante l'esplorazione sono stati creati due progetti di test vuoti ("Untitled Project") nell'account Maket per osservare i flussi "Draw from scratch" e "Upload floor plan". Non è stato speso alcun credito (nessuna generazione AI né render è stata effettivamente lanciata). Se vuoi, posso eliminarli dal tuo account — fammi sapere.*

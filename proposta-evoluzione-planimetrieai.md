# Proposta di evoluzione PlanimetrieAI — verso lo strumento commerciale per studi

Documento di proposta (nessuna modifica al codice effettuata). Copre: (1) come implementare le tue 3 richieste, (2) ricerca tecnica sulla stratigrafia murature, (3) lista completa e prioritizzata di tutto ciò che vale la pena sviluppare, ispirata all'analisi di maket.ai e tarata sul target reale (studi di architettura, geometri, che devono vendere velocemente un'idea a un cliente finale).

Base di partenza: ho fatto leggere a un agente l'intero codice rilevante (`types.ts`, `model.ts`, `floorplanToWalls.ts`, `materials/catalog.ts`, `engine/Viewer3D.ts`, `MaterialPicker.tsx`) per ancorare la proposta a quello che esiste davvero, non a supposizioni.

---

## Il mio giudizio generale

Le tre cose che proponi sono esattamente quelle giuste, e nell'ordine giusto di impatto percepito da un cliente in una demo commerciale: materiali/arredi (bellezza immediata), tetto/3D (la casa "sembra vera" invece di un guscio senza copertura), stratigrafia muri (credibilità tecnica agli occhi del collega architetto/geometra, anche se il cliente finale non la guarderà quasi mai). Aggiungerei un quarto asse che oggi manca ed è quasi gratis da implementare rispetto al valore che dà in una demo dal vivo: **condivisione/export pulito per il cliente** (link pubblico, PDF con logo studio). Un tool "commerciale" che l'architetto usa davanti al cliente vive o muore sulla rapidità di: genera → rendi bello → mostra/mandi. Le prime due cose che proponi coprono "rendi bello", la terza dà credibilità tecnica, ma senza un buon "mostra/mandi" il ciclo resta incompleto.

Nota di scope: terrei la stratigrafia muri **presentativa e parametrica**, non un vero calcolo termotecnico (trasmittanza U, ponti termici, verifica Glaser). Il CLAUDE.md è chiaro sul fatto che questo è uno strumento pre-progettuale, non esecutivo — la stratigrafia serve per mostrare "sappiamo di cosa parliamo" e per generare sezioni/quote plausibili, non per sostituire un software di calcolo energetico. Lascerei un campo dati pronto per agganciare in futuro un calcolo reale (il campo `scheda.isolamento` in `MaterialDef` esiste già, inutilizzato).

---

## 1) Materiali e arredi (Flooring, Walls, Ceiling, Doors, Windows, Exterior walls) + libreria stili

### Stato attuale (da codice)
- `MaterialAssignment` copre solo **3 superfici**: `esterno`, `interno`, `pavimento` (`materials/catalog.ts:131-135`).
- `Wall.materialId` esiste già e permette override per singolo muro, ma è un solo materiale per muro (nessuna distinzione faccia interna/esterna).
- `MaterialPicker.tsx` ha una UI a tab già pronta per 3 superfici — è il pattern giusto, va solo esteso.
- Il catalogo materiali ha 7 categorie tutte "naturali" (canapa, legno, sughero, calce, terra, lino, pietra): manca tutto ciò che serve per **soffitti**, **infissi (porte/finestre)** e **muri esterni come superficie a sé** (oggi "esterno" esiste ma è trattato come un intonaco generico, non distinto da "pareti interne").
- Non esiste alcuna infrastruttura arredi (nessun campo dati, nessun catalogo, nessun loader 3D).

### Cosa propongo — Materiali (6 superfici come maket)
1. Estendere `Surface` da 3 a 6 valori: `flooring | walls | ceiling | doors | windows | exteriorWalls`.
2. Estendere `MaterialAssignment` di conseguenza; aggiungere le categorie mancanti al catalogo:
   - **Ceiling**: intonaco calce, legno (perline), cartongesso.
   - **Doors**: legno naturale (rovere, abete), laccato bianco/sabbia, canapa/biocomposito (materiale distintivo nostro — Maket non ce l'ha).
   - **Windows**: telaio legno, telaio legno-alluminio (colori neutri, per restare semplice: qui l'importante è il colore telaio, non la texture).
   - **Exterior walls**: intonaco calce (colori terra/sabbia), intonaco calce-canapa a vista, pietra a vista, legno (facciata ventilata) — qui la canapa può brillare parecchio in facciata.
3. Mantenere l'override per-muro già esistente (`Wall.materialId`) ma renderlo selezionabile dalla stessa UI, non solo via dati.
4. **Libreria "Stili"** (moodboard), come lo `Style` picker di maket: 5-6 stili con nome ed effetto "applica tutto insieme" (imposta in un click flooring+walls+ceiling+doors+windows+exterior di quello stile), tarati sul nostro posizionamento naturale/canapa invece che genericisti:
   - *Rustico Canapa* (calce-canapa, legno grezzo, terra cruda)
   - *Minimal Naturale* (calce chiara, rovere, bianco)
   - *Contemporaneo Caldo* (legno scuro, sughero, pietra chiara)
   - *Mediterraneo* (calce, terracotta, legno chiaro)
   - *Industrial Green* (canapa a vista, cemento chiaro, legno)
   Tecnicamente: un nuovo file `materials/styles.ts` con `StyleDef { id, nome, immagine, assignment: MaterialAssignment }` — semplice da costruire riusando gli asset materiali esistenti, nessuna nuova infrastruttura 3D richiesta.

### Cosa propongo — Arredi
Qui la scelta tecnica più importante è: **modelli GLTF pronti (stile maket/IKEA-catalog) vs arredi procedurali low-poly generati a codice** (come già facciamo per muri/finestre con `BoxGeometry`).

Consiglio di **partire procedurale** per il v1, per tre motivi: (a) zero costi di licensing/asset, (b) stile visivo coerente e "pulito" con il resto della scena senza dover uniformare modelli di provenienze diverse, (c) tempi di sviluppo molto più brevi (un letto, un tavolo, un divano fatto di 4-6 box con materiale legno/tessuto sono un paio d'ore di lavoro l'uno, non giorni). In una fase 2, se serve più realismo, si possono sostituire i pezzi più "in vista" (divano, tavolo da pranzo) con modelli GLTF free/CC0 (es. Poly Pizza, Kenney assets) caricati via `GLTFLoader` (oggi assente in `Viewer3D.ts`, va aggiunto).

Struttura dati proposta:
```ts
// types.ts
interface FurnitureItem {
  id: string;
  catalogId: string;   // riferimento a FurnitureDef
  x: number; y: number; rotation: number;
  roomId?: string;
}
// Plan { ...; furniture: FurnitureItem[] }
```
```ts
// materials/furnitureCatalog.ts — stesso pattern di catalog.ts
interface FurnitureDef {
  id: string; nome: string;
  categoria: 'bagno'|'camera'|'cucina'|'soggiorno'|'ufficio'|'esterno';
  sottocategoria: string;         // es. "tavoli da pranzo"
  footprint: { w: number; d: number }; // ingombro in pianta, per drag/collisioni
  build: (material?: MaterialDef) => THREE.Group; // geometria procedurale
}
```
UI: nuovo dropdown "Arredi" nella toolbar dell'editor 2D (stesso posto di "Structure"/"Furniture" in maket), menu a 2 livelli (categoria → sottocategoria/pezzo, senza serve arrivare a 3 livelli come loro — per uno strumento "semplice" come vuoi tu, 2 livelli bastano), click per piazzare al centro stanza selezionata poi drag per posizionare. In `Viewer3D`, `build()` itera `plan.furniture` e istanzia ogni pezzo nel `buildingGroup` (viene incluso in automatico nell'export `.glb`, nessuna modifica extra lì).

Priorità arredi v1 (coerente con le stanze che il generatore già produce): letto+comodini, armadio, divano, tavolo da pranzo+sedie, cucina (blocco base+pensili), sanitari bagno (wc, lavabo, doccia/vasca), scrivania.

---

## 2) 3D più bello + tetto attivabile/disattivabile

### Stato attuale
`Viewer3D.ts` estrude solo i muri e un unico solaio (pavimento); non c'è soffitto né tetto; luci = una `HemisphereLight` + una `DirectionalLight` con ombre; `buildingGroup` è il contenitore unico esportato in `.glb`.

### Tetto — come lo implementerei
Il generatore di piante (`Planimetrieai2` guillotine slicing, ereditato) produce **piante ortogonali** (rettangoli uniti ad angolo retto), non poligoni qualunque. Questo è un vantaggio enorme: non serve l'algoritmo generale "straight skeleton" (complesso, richiede una libreria dedicata), basta la versione per poligoni rettilinei, molto più semplice da implementare a mano:

1. Calcolare il perimetro esterno del piano (già disponibile via `bounds(plan)`/geometria muri esterni).
2. Scomporre il footprint in rettangoli (la pianta nasce già da un `slicing tree` di rettangoli — possiamo riusare l'informazione di generazione, oppure ricavarla a posteriori con un semplice algoritmo di decomposizione rettangolare di poligoni ortogonali, ben documentato).
3. Per ogni rettangolo generare un tetto "a padiglione" (hip) o "a capanna" (gable) standard: inset dei 4 bordi di una quantità pari a `altezza_falda / tan(pendenza)`, colmo al centro, 4 (o 2) piani triangolari/trapezoidali con la pendenza scelta.
4. Unire i tetti dei singoli rettangoli dove si toccano (semplice unione geometrica delle mesh, non serve un booleano complesso perché i bordi coincidono già per costruzione).
5. Esporre in UI: **tipo di tetto** (Piano con parapetto / A capanna / A padiglione), **pendenza** (slider, default ~30%), **toggle mostra/nascondi** (proprio come chiedi tu — utile anche per continuare a vedere l'interno dall'alto in pianta/3D mentre si lavora, e per l'export "casa completa" quando serve mostrarla finita).

Se in futuro arriveranno piante non ortogonali (es. da un editor a muri liberi con angoli qualsiasi), a quel punto vale la pena investire in una vera libreria di straight skeleton — per ora sarebbe over-engineering.

Il tetto piano (parapetto) è banale: un box esteso oltre il perimetro di ~20-30cm, stessa tecnica già usata per il pavimento — lo implementerei per primo perché richiede letteralmente 30 minuti di lavoro e dà già un netto salto di qualità percepita.

Aggiungerei anche il **soffitto interno** (piano orizzontale all'altezza dei muri, sotto al tetto/sottotetto), oggi assente — necessario sia per la resa visiva sia per applicarci un materiale (Ceiling, vedi punto 1).

### Migliorie di resa 3D (ispirate al changelog di maket, alla tua portata con Three.js)
- **Ambiente HDRI** invece del cielo piatto attuale: un `RoomEnvironment` o una HDRI CC0 caricata via `RGBELoader`, per riflessi/illuminazione ambientale molto più realistici a costo quasi zero.
- **Ombre più morbide**: passare da `PCFShadowMap` a `PCFSoftShadowMap`, aumentare risoluzione shadow map sulla directional light.
- **Prato/terreno** invece del semplice ground plane: texture erba tileable + leggero displacement, piano più ampio del footprint casa.
- **Luci interne per stanza** (punto luce soffitto per stanza, auto-posizionato al centro) — utile soprattutto nel tour in prima persona, oggi probabilmente le stanze sono illuminate solo dalla luce globale.
- **Materiali migliori**: usare `map` + `roughnessMap` (già previsti in `MaterialDef.pbr` ma probabilmente sotto-popolati) per dare texture reali invece di colori piatti dove serve più impatto (pavimenti, muri esterni).
- Tutto questo è incrementale e non tocca l'architettura esistente (`buildingGroup`, `build()`), sono aggiunte dentro lo stesso metodo.

---

## 3) Stratigrafia muri — ricerca e proposta

### Cosa dice la pratica costruttiva italiana (fonti in fondo)
- **Muratura portante** (laterizio tipo Poroton): spessori standard **25 / 30 / 35 / 38 cm**, tutti ≥20cm idonei anche in zona sismica.
- **Muratura di tamponamento** (non portante, riempimento telaio c.a.): **25–40 cm**.
- **Tramezzo/parete divisoria interna** in laterizio forato: **8 / 10 / 12 cm** (grezzo; +intonaco ~2cm per lato → finito ~10-12/12-14/14-16cm).
- **Parete in cartongesso**: orditura 50mm + lastra 12,5mm per lato = **75mm**; doppia lastra per lato = **100mm**; esistono varianti fino a 150mm+ per prestazioni acustiche/REI.
- **Isolamento a cappotto esterno** (EPS o lana di roccia): tipicamente **8–16 cm** a seconda di zona climatica e trasmittanza obiettivo (in zona climatica E, per rientrare nei limiti NZEB, indicativamente 7cm di EPS o 9-12cm di lana di roccia su parete esistente in laterizio 25-30cm già intonacata).
- **Cappotto interno** (contropareti): pannello isolante + eventuale barriera vapore + lastra cartongesso o intonaco, spessori variabili in base al pannello (in genere 6-10cm).

Fonti: BibLus/ACCA, Consorzio POROTON Italia, Vanoncini (pareti cartongesso), Edilportale (spessore cappotto e trasmittanza NZEB), progettarebioedile.it.

### Modello dati proposto
Sostituire il singolo numero `Wall.thickness` con un concetto a due livelli — così restiamo semplici in UI ma corretti come dati:

```ts
interface WallLayer {
  materialId: string;     // riferimento a catalog.ts (o nuovo, es. "isolante-lana-roccia")
  thickness: number;      // metri
  function: 'struttura' | 'isolante' | 'intercapedine' | 'rasante' | 'intonaco' | 'cartongesso' | 'rivestimento';
}
interface WallAssembly {
  id: string;
  nome: string;           // "Muratura portante 30cm + cappotto 12cm"
  categoria: 'portante' | 'tamponamento' | 'tramezzo' | 'cartongesso' | 'facciata-ventilata';
  layers: WallLayer[];    // ordinati dall'interno all'esterno
  thickness: number;      // = somma layers, calcolato automaticamente
}
```
`Wall` guadagna un campo `assemblyId?: string` (in alternativa al vecchio `thickness` singolo, che resta come fallback/derivato = `assembly.thickness`).

### Catalogo preset (pronti all'uso, coerenti con la ricerca sopra)
Un nuovo file `materials/wallAssemblies.ts` con preset tipo:
- **Muratura portante 30cm** (laterizio 30 + intonaco 1,5cm x2) → ~33cm
- **Muratura portante 30cm + cappotto canapa 12cm** (nostro fiore all'occhiello: pannello canapa-calce invece del solito EPS) → ~45cm
- **Tamponamento 25cm + cappotto lana di roccia 12cm** → ~37cm
- **Tramezzo laterizio 10cm** (+ intonaco) → ~12cm
- **Parete cartongesso 10cm** (doppia lastra + isolante acustico in intercapedine)
- **Facciata ventilata legno** (muratura + isolante + intercapedine ventilata + rivestimento legno)

### UI proposta
Nel pannello muro (oggi "Wall thickness" con stepper numerico +/-): sostituire con un selettore **"Tipo di parete"** a tendina (i preset sopra, con badge spessore totale calcolato tipo "33 cm"), più un link "Personalizza stratigrafia" che apre un piccolo editor a lista (aggiungi/rimuovi layer, scegli materiale e spessore per layer) per chi vuole entrare nel dettaglio — esattamente il pattern "semplice di default, potente se serve" che vuoi per uno strumento da studio professionale.

### Ricaduta in 2D e 3D
- **2D**: lo spessore del muro sul disegno resta quello totale dell'assembly (già oggi `thickness` guida il disegno) — nessun cambiamento nel rendering 2D, solo nella provenienza del numero.
- **3D**: per non complicare subito la geometria (che oggi è un unico box per segmento muro), propongo per il v1 di continuare a estrudere **un solo box con lo spessore totale** e materiale = layer più "in vista" per faccia (intonaco/rivestimento esterno sulla faccia esterna, cartongesso/intonaco interno sulla faccia interna) — visivamente indistinguibile da un vero multi-layer per lo scopo presentativo. Una vera estrusione a strati (visibile solo in una sezione tagliata, che oggi non esiste) la lascerei come feature futura se un giorno introduciamo una vista "sezione".

Questo dà già moltissimo valore percepito (un architetto che clicca su un muro e vede "Muratura portante 30cm + cappotto in canapa 12cm — spessore totale 45cm" è un livello di credibilità tecnica che nessuno strumento "giocattolo" ha) senza il costo di un vero motore di calcolo termico.

---

## 4) Lista completa di tutto quello che vale la pena sviluppare

Riorganizzo qui **tutto** quanto emerso dalla ricerca su maket.ai (messaggio precedente) più le mie considerazioni, con una priorità pensata per "strumento commerciale, semplice, completo, ottimizzato" per studi di architettura/geometri che devono chiudere in fretta una demo con un cliente.

### Priorità Alta — impatto diretto sulla demo commerciale
1. **Materiali estesi 6 superfici + libreria stili** (punto 1 sopra).
2. **Tetto attivabile/disattivabile + soffitto** (punto 2 sopra).
3. **Stratigrafia muri con preset** (punto 3 sopra).
4. **Arredi base per stanza** (punto 1 sopra) — anche solo i pezzi essenziali per le stanze più comuni (camera, soggiorno, cucina, bagno) cambia moltissimo la percezione "casa vuota" vs "casa vissuta".
5. **"Arreda stanza" automatico** (equivalente a "Furnish room" di maket): un pulsante che, dato il tipo di stanza già presente nel nostro modello dati (`PlacedRoom.type`), piazza in automatico un set di arredi coerente (letto+comodini per camera, tavolo+sedie per cucina/sala da pranzo, ecc.) usando il catalogo del punto precedente. Bassissimo costo di sviluppo una volta che esiste il catalogo arredi, altissimo impatto "wow" in demo dal vivo (un click e la casa è arredata).
6. **Condivisione: link pubblico view-only** — oggi il progetto non è condivisibile fuori dall'app. Per un architetto che vuole mandare la proposta al cliente via WhatsApp/email dopo l'incontro, è quasi indispensabile. Tecnicamente: una route pubblica sola-lettura che carica un piano via id/token, riusa `Viewer3DCanvas`/`PlanSvg` esistenti in modalità read-only.
7. **Export PDF "brandizzato"** con logo e dati dello studio (white-label) — dato che vendi lo strumento *agli studi*, ogni studio vuole che l'output porti il proprio logo, non "PlanimetrieAI". Aggiunge valore di vendita concreto: campo "logo studio" nelle impostazioni + template PDF con intestazione personalizzata.
8. **Multi-selezione + drag diretto dei muri** nell'editor 2D — miglioria di usabilità che rende l'editing post-generazione (dove oggi presumo si muova un muro alla volta) molto più professionale/veloce, importante perché il professionista "ci mette le mani" (è esplicitamente nel nostro CLAUDE.md §2).

### Priorità Media — differenzianti ma con costo di sviluppo maggiore o beneficio meno immediato
9. **Render fotorealistico AI on-demand per singola inquadratura**, alla maket (prompt libero + immagine di riferimento, tipo "aggiungi luce dorata al tramonto"): differenziante fortissimo ma richiede integrazione con un modello di image-generation via OpenRouter/altro provider e un sistema di crediti/costo, quindi è naturale collegarlo alla Fase 5 (Cloud AI) già prevista in HANDOFF.md, non a un intervento isolato.
10. **Multi-piano** (`Add floor` come maket): esplicitamente fuori scope v1 nel nostro HANDOFF, ma vista la direzione "vendiamo a studi professionali" quasi certamente serve presto — ville su 2 piani sono la norma, non l'eccezione, per il target clientela di un geometra. Consiglio di iniziare a pensarci in parallelo al punto 3 (la stratigrafia muro non cambia con multi-piano, ma il modello dati `Plan` sì).
11. **Upload planimetria esistente (PDF/immagine) con riconoscimento automatico**: utile per partire da un rilievo/progetto già esistente del professionista invece che da zero, ma tecnicamente è il pezzo più costoso (serve vision AI capace di riconoscere muri/quote/aperture da un'immagine con buona affidabilità — maket ci ha lavorato per mesi a giudicare dal changelog). Consiglio di valutarlo solo dopo che il resto è solido.
12. **Color picker libero** (oltre ai materiali predefiniti) per pareti/finiture — piccola feature ma utile quando il cliente chiede "però io lo vorrei più verde salvia".
13. **Organizzazione progetti per cliente** (cartelle, uno "spazio" per cliente con più planimetrie/varianti) — utile appena lo strumento viene usato da uno studio con decine di clienti in parallelo, meno urgente a 1-2 progetti pilota.
14. **Ricerca nei picker** (materiali, stanze, arredi) quando i cataloghi crescono — banale da aggiungere, ma solo utile quando i cataloghi non sono più piccoli.

### Priorità Bassa — valutare più avanti o scartare
15. **Export DWG/Revit verso CAD professionali**: anche maket lo segna "coming soon" dopo mesi di sviluppo — non è la battaglia giusta ora, restiamo con PDF/DXF/SVG/JSON/glb che già copriamo (e siamo avanti a loro sul `.glb`, da non perdere).
16. **Modello a crediti/consumo per feature AI**: sensato se in futuro esponiamo il render AI (punto 9), ma prematuro fino a lì — oggi il posizionamento CLAUDE.md prevede abbonamento (§6), non consumo a crediti; deciderei in base a quanto costerà realmente l'uso AI una volta implementato il render fotorealistico.
17. Dettagli minori osservati in maket (scale a L, cabinet cucina con finiture indipendenti dal piano cucina, ecc.): interessanti ma da valutare solo dopo aver coperto i punti sopra — sono rifiniture, non differenzianti.

### Cosa NON copierei / su cui restare distintivi
- Il **focus canapa/materiali naturali** — Maket è generalista, la nostra unicità di posizionamento vale più di qualunque feature singola.
- Il **tour in prima persona già incluso** (loro puntano più sul render statico fotorealistico che su un walkthrough navigabile in tempo reale).
- L'**export `.glb`** — già oggi un vantaggio per un professionista che vuole rifinire altrove.

---

## Proposta di roadmap aggiornata (fasi aggiuntive rispetto a HANDOFF.md)

Suggerirei di inserire, tra l'attuale Fase 3 (materiali canapa) e Fase 4 (editor 2D + tour), una nuova sequenza:

- **Fase 3.1** — Materiali estesi a 6 superfici + libreria stili (punto 1, parte materiali)
- **Fase 3.2** — Tetto proceduralale + soffitto + migliorie resa 3D (punto 2)
- **Fase 3.3** — Stratigrafia muri con preset (punto 3)
- **Fase 3.4** — Catalogo arredi procedurali + "Arreda stanza" automatico (punto 1, parte arredi)
- **Fase 3.5** — Condivisione link pubblico + export PDF brandizzato (priorità alta 6-7)

Poi proseguire con Fase 4 (editor 2D avanzato con multi-select/drag muri incluso) e Fase 5 (Cloud AI, dove agganciare eventualmente il render fotorealistico e l'upload planimetrie) come già previsto.

---

## Prossimi passi

Aspetto tua conferma su cosa iniziare a costruire per davvero. Il mio consiglio sull'ordine, se dovessi scegliere io: **materiali estesi + tetto/soffitto** insieme (danno il salto visivo più immediato con il minor rischio tecnico), poi **stratigrafia muri** (credibilità tecnica), poi **arredi + "arreda stanza"**, poi **condivisione/PDF brandizzato**. Fammi sapere se vuoi seguire quest'ordine, cambiarlo, o partire subito con un sottoinsieme.

### Fonti consultate per la stratigrafia
- [Facciata ventilata: stratigrafia tipo, spessori — BibLus/ACCA](https://biblus.acca.it/parete-ventilata-stratigrafia-tipo/)
- [Dimensioni dei Blocchi POROTON](https://www.poroton.it/mattoni-laterizi/dimensioni-blocchi-poroton/)
- [Blocchi Poroton per muratura portante sp. 25 cm — FAQ Consorzio POROTON](https://www.poroton.it/domande-risposte/blocchi-per-muratura-portante-spessore-25-cm/)
- [Pareti divisorie in cartongesso: spessori, stratigrafia e prestazioni — Vanoncini](https://www.vanoncini.it/pareti-divisorie-cartongesso)
- [Tramezzi in cartongesso vs muratura: confronto e guida — Edilportale](https://www.edilportale.com/news/2026/06/progettazione/tramezzi-in-cartongesso-vs-muratura-confronto-e-guida-alla-scelta_110998_17.html)
- [Spessore del cappotto esterno, come sceglierlo — Edilportale](https://www.edilportale.com/news/2023/11/focus/spessore-del-cappotto-esterno-come-sceglierlo_96679_67.html)
- [Isolanti per cappotto: EPS, XPS, lana di roccia, PIR — Demasi](https://demasi.biz/comunicazione/isolanti-cappotto-eps-xps-lana-pir-guida-tecnica/)

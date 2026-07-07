# Planimetrie — editor locale 2D/3D

Versione privata e locale di uno strumento tipo maket.ai: crea planimetrie
residenziali e trasformale in modelli 3D. Nessun cloud, nessuna rete — tutto
gira sulla tua macchina.

## Avvio

```bash
npm install
npm run dev
# apri http://localhost:5173
```

## Funzioni

- **Pianta 2D**: disegna muri (click–click, doppio click per terminare),
  porte e finestre (click su un muro), etichette stanze. Snap a griglia 10 cm
  e agli estremi dei muri esistenti. Zoom con rotellina, pan con
  Shift+trascina, Canc elimina la selezione.
- **✨ Genera layout**: generatore procedurale a vincoli. Inserisci footprint
  (larghezza × profondità) ed elenco stanze con m² target; genera layout con
  muri, porte (albero di connessione tra stanze + ingresso) e finestre sui
  muri esterni. "Altra variante" cambia seed e produce alternative.
- **Vista 3D**: estrusione della pianta con aperture reali (porte, finestre
  con vetro), solaio, ombre, orbit/zoom.
- **Esporta 3D (.glb)**: modello glTF binario — si apre in Blender, Godot,
  Unreal, visualizzatori 3D di macOS/Windows.
- **Salva/Apri JSON**: formato di progetto leggibile; salvataggio automatico
  in localStorage.

## Architettura

| File | Ruolo |
|---|---|
| `src/model.ts` | Modello dati (muri, aperture, etichette), geometria, persistenza |
| `src/editor2d.ts` | Editor canvas 2D |
| `src/generator.ts` | Generatore procedurale (slicing tree + dedup muri + porte/finestre) |
| `src/viewer3d.ts` | Scena Three.js + export glTF |
| `src/main.ts` | UI e collegamento componenti |

Unità: metri. La pianta usa coordinate (x, y); in 3D y diventa z e l'altezza è y.

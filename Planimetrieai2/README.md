# PlanimetrieAI

Private, local floor plan generator inspired by [maket.ai](https://www.maket.ai). Everything runs on your machine — no accounts, no credits, no cloud calls.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

## Features

- **Room program input**: lot dimensions (meters), room list with type, target area, and optional "must be adjacent to" constraint per room — mirroring maket's structured generator form.
- **Natural-language brief** (English + Italian): "3 bedrooms, 2 bathrooms, kitchen with dining" / "3 camere, 2 bagni, cucina" fills the room list. Uses a local Ollama model (`llama3.2` at `localhost:11434`) when available, otherwise a built-in keyword parser. Still 100% local either way.
- **Generation**: returns the 4 best distinct layout variants per run (same as maket). Regenerate for new ones. Deterministic per seed.
- **Rendering**: architectural 2D SVG — walls, door swings, windows, room labels with computed areas, overall dimension lines.
- **Export**: SVG, PNG, DXF (opens in AutoCAD / LibreCAD / Rhino, meters), JSON (full plan data model).

## How generation works

maket.ai uses a proprietary constraint-conditioned layout model (built with Mila). This clone replaces it with a transparent algorithmic pipeline that covers the same input/output contract:

1. **Guillotine slicing** — the lot rectangle is recursively split among rooms proportional to their target areas, with seeded randomness in room ordering, split axis, and cut fractions.
2. **Random-restart search** — 400 candidate layouts are generated per click and scored on:
   - room proportions (skinny rooms punished),
   - type-based adjacency rules (kitchen↔dining, bedroom↔hallway, bathroom↔hallway, …),
   - user-specified adjacency pairs (weighted above the defaults),
   - exterior wall access for habitable rooms (natural light),
   - central circulation.
3. **Top 4 distinct** layouts (by topology fingerprint) are returned.
4. **Openings** — interior doors are placed on a minimum-cost spanning tree over the room adjacency graph (circulation prefers hallway/living, avoids routing through private rooms), an entrance door goes on an exterior wall of the hallway or living room, and windows are placed on exterior walls.

All geometry is rectilinear and vector, in meters.

## Structure

```
src/
  types.ts              data model: rooms, doors, windows, plan, constraints
  lib/generator.ts      slicing + scoring + search + door/window placement
  lib/prompt.ts         NL brief → room program (heuristic + optional Ollama)
  lib/dxf.ts            minimal DXF R12 writer
  lib/export.ts         SVG / PNG / JSON export
  lib/rng.ts            seeded PRNG (mulberry32)
  components/PlanSvg.tsx    architectural SVG renderer
  components/RoomForm.tsx   lot + room program editor
  App.tsx               variant grid + detail view + exports
```

## Not implemented (maket features out of scope for v1)

Multi-floor plans, manual wall-drawing editor, plan-image recognizer, photorealistic style renders, chat-based plan editing. The JSON data model (rooms / doors / windows as first-class vector objects) is designed so an editor can be layered on later.

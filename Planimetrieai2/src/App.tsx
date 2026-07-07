import { useRef, useState } from 'react';
import type { FloorPlan, LotSpec, RoomSpec } from './types';
import { defaultRooms, generateVariants } from './lib/generator';
import { parsePromptHeuristic, parsePromptOllama } from './lib/prompt';
import { exportJson, exportPng, exportSvg } from './lib/export';
import { exportDxf } from './lib/dxf';
import { PlanSvg } from './components/PlanSvg';
import { RoomForm } from './components/RoomForm';
import './App.css';

const VARIANTS = 4;

export default function App() {
  const [lot, setLot] = useState<LotSpec>({ width: 12, depth: 9 });
  const [rooms, setRooms] = useState<RoomSpec[]>(defaultRooms());
  const [prompt, setPrompt] = useState('');
  const [parsing, setParsing] = useState(false);
  const [plans, setPlans] = useState<FloorPlan[]>([]);
  const [selected, setSelected] = useState(0);
  const [generation, setGeneration] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  const onGenerate = () => {
    if (rooms.length === 0) return;
    const gen = generation + 1;
    setGeneration(gen);
    const baseSeed = 1000003 * gen;
    setPlans(generateVariants({ lot, rooms }, VARIANTS, baseSeed));
    setSelected(0);
  };

  const onParsePrompt = async () => {
    if (!prompt.trim()) return;
    setParsing(true);
    // try local LLM first (Ollama), fall back to built-in parser
    const viaLlm = await parsePromptOllama(prompt);
    const parsed = viaLlm ?? parsePromptHeuristic(prompt);
    setParsing(false);
    if (parsed.length) setRooms(parsed);
  };

  const plan = plans[selected];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▦</span> Planimetrie<span className="brand-ai">AI</span>
        </div>
        <div className="tagline">Local floor plan generator — everything runs on your machine</div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="section-title">Describe your home</div>
          <div className="prompt-box">
            <textarea
              placeholder={'e.g. "3 bedrooms, 2 bathrooms, kitchen with dining"\n(anche in italiano: "3 camere, 2 bagni, cucina")'}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
            <button className="btn-secondary" onClick={onParsePrompt} disabled={parsing}>
              {parsing ? 'Interpreting…' : 'Fill rooms from description'}
            </button>
            <div className="hint">
              Uses Ollama at localhost:11434 if running, otherwise a built-in parser. Nothing
              leaves your machine.
            </div>
          </div>

          <RoomForm lot={lot} rooms={rooms} onLotChange={setLot} onRoomsChange={setRooms} />

          <button className="btn-primary" onClick={onGenerate} disabled={rooms.length === 0}>
            {plans.length ? '↻ Regenerate designs' : 'Generate designs'}
          </button>
        </aside>

        <main className="canvas">
          {plans.length === 0 ? (
            <div className="empty">
              <div className="empty-mark">▦</div>
              <p>
                Set your lot and rooms, then hit <b>Generate designs</b>.
              </p>
              <p className="hint">
                The engine searches hundreds of layouts and returns the {VARIANTS} best distinct
                variants, scored on room proportions, adjacencies and natural light.
              </p>
            </div>
          ) : (
            <>
              <div className="variants">
                {plans.map((p, i) => (
                  <button
                    key={p.seed}
                    className={`variant ${i === selected ? 'active' : ''}`}
                    onClick={() => setSelected(i)}
                  >
                    <PlanSvg plan={p} showLabels={false} showDimensions={false} />
                    <span className="variant-tag">
                      #{i + 1} · score {p.score.toFixed(1)}
                    </span>
                  </button>
                ))}
              </div>

              {plan && (
                <div className="detail">
                  <div className="detail-toolbar">
                    <span className="detail-title">
                      Variant #{selected + 1} — {plan.rooms.length} rooms,{' '}
                      {(lot.width * lot.depth).toFixed(0)} m²
                    </span>
                    <div className="detail-actions">
                      <button onClick={() => svgRef.current && exportSvg(svgRef.current, 'floorplan')}>
                        SVG
                      </button>
                      <button onClick={() => svgRef.current && exportPng(svgRef.current, 'floorplan')}>
                        PNG
                      </button>
                      <button onClick={() => exportDxf(plan, 'floorplan')}>DXF</button>
                      <button onClick={() => exportJson(plan, 'floorplan')}>JSON</button>
                    </div>
                  </div>
                  <div className="detail-plan">
                    <PlanSvg ref={svgRef} plan={plan} />
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

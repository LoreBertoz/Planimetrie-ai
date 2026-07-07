import { forwardRef } from 'react';
import type { Door, FloorPlan, Window } from '../types';
import { ROOM_META } from '../types';

const M = 2.2; // svg margin (m) around plan, leaves room for dimension lines
const EXT_WALL = 0.25;
const INT_WALL = 0.12;

function DoorMark({ d }: { d: Door }) {
  const half = d.width / 2;
  const gapT = d.exterior ? EXT_WALL : INT_WALL;
  if (d.horizontal) {
    return (
      <g>
        <rect x={d.x - half} y={d.y - gapT} width={d.width} height={gapT * 2} fill="white" />
        <path
          d={`M ${d.x - half} ${d.y} A ${d.width} ${d.width} 0 0 1 ${d.x + half} ${d.y - d.width}`}
          fill="none"
          stroke="#94a3b8"
          strokeWidth={0.03}
          transform={`translate(${d.width / 2 - half},0)`}
        />
        <line x1={d.x - half} y1={d.y} x2={d.x - half} y2={d.y - d.width} stroke="#475569" strokeWidth={0.05} />
      </g>
    );
  }
  return (
    <g>
      <rect x={d.x - gapT} y={d.y - half} width={gapT * 2} height={d.width} fill="white" />
      <path
        d={`M ${d.x} ${d.y - half} A ${d.width} ${d.width} 0 0 1 ${d.x - d.width} ${d.y + half - d.width}`}
        fill="none"
        stroke="#94a3b8"
        strokeWidth={0.03}
        transform={`translate(0,${d.width / 2 - half})`}
      />
      <line x1={d.x} y1={d.y - half} x2={d.x - d.width} y2={d.y - half} stroke="#475569" strokeWidth={0.05} />
    </g>
  );
}

function WindowMark({ w }: { w: Window }) {
  const half = w.width / 2;
  if (w.horizontal) {
    return (
      <g>
        <rect x={w.x - half} y={w.y - EXT_WALL} width={w.width} height={EXT_WALL * 2} fill="white" />
        <line x1={w.x - half} y1={w.y - 0.06} x2={w.x + half} y2={w.y - 0.06} stroke="#0f172a" strokeWidth={0.035} />
        <line x1={w.x - half} y1={w.y + 0.06} x2={w.x + half} y2={w.y + 0.06} stroke="#0f172a" strokeWidth={0.035} />
      </g>
    );
  }
  return (
    <g>
      <rect x={w.x - EXT_WALL} y={w.y - half} width={EXT_WALL * 2} height={w.width} fill="white" />
      <line x1={w.x - 0.06} y1={w.y - half} x2={w.x - 0.06} y2={w.y + half} stroke="#0f172a" strokeWidth={0.035} />
      <line x1={w.x + 0.06} y1={w.y - half} x2={w.x + 0.06} y2={w.y + half} stroke="#0f172a" strokeWidth={0.035} />
    </g>
  );
}

interface Props {
  plan: FloorPlan;
  showLabels?: boolean;
  showDimensions?: boolean;
}

export const PlanSvg = forwardRef<SVGSVGElement, Props>(function PlanSvg(
  { plan, showLabels = true, showDimensions = true },
  ref,
) {
  const { width: W, depth: D } = plan.lot;
  const fontS = Math.max(0.32, Math.min(W, D) * 0.032);

  return (
    <svg
      ref={ref}
      viewBox={`${-M} ${-M} ${W + 2 * M} ${D + 2 * M}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <rect x={-M} y={-M} width={W + 2 * M} height={D + 2 * M} fill="white" />

      {/* room fills */}
      {plan.rooms.map((r) => (
        <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} fill={ROOM_META[r.type].color} />
      ))}

      {/* interior walls */}
      {plan.rooms.map((r) => (
        <rect
          key={`w-${r.id}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill="none"
          stroke="#1e293b"
          strokeWidth={INT_WALL}
        />
      ))}

      {/* exterior wall */}
      <rect x={0} y={0} width={W} height={D} fill="none" stroke="#0f172a" strokeWidth={EXT_WALL} />

      {/* openings */}
      {plan.doors.map((d, i) => (
        <DoorMark key={`d${i}`} d={d} />
      ))}
      {plan.windows.map((w, i) => (
        <WindowMark key={`f${i}`} w={w} />
      ))}

      {/* labels */}
      {showLabels &&
        plan.rooms.map((r) => (
          <g key={`l-${r.id}`} pointerEvents="none">
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2 - fontS * 0.25}
              textAnchor="middle"
              fontSize={fontS}
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight={600}
              fill="#1e293b"
            >
              {r.label}
            </text>
            <text
              x={r.x + r.w / 2}
              y={r.y + r.h / 2 + fontS}
              textAnchor="middle"
              fontSize={fontS * 0.8}
              fontFamily="Inter, system-ui, sans-serif"
              fill="#64748b"
            >
              {(r.w * r.h).toFixed(1)} m²
            </text>
          </g>
        ))}

      {/* dimension lines */}
      {showDimensions && (
        <g stroke="#94a3b8" strokeWidth={0.03} fontFamily="Inter, system-ui, sans-serif">
          <line x1={0} y1={-M * 0.55} x2={W} y2={-M * 0.55} />
          <line x1={0} y1={-M * 0.55 - 0.15} x2={0} y2={-M * 0.55 + 0.15} />
          <line x1={W} y1={-M * 0.55 - 0.15} x2={W} y2={-M * 0.55 + 0.15} />
          <text
            x={W / 2}
            y={-M * 0.55 - 0.2}
            textAnchor="middle"
            fontSize={fontS * 0.9}
            fill="#475569"
            stroke="none"
          >
            {W.toFixed(2)} m
          </text>
          <line x1={-M * 0.55} y1={0} x2={-M * 0.55} y2={D} />
          <line x1={-M * 0.55 - 0.15} y1={0} x2={-M * 0.55 + 0.15} y2={0} />
          <line x1={-M * 0.55 - 0.15} y1={D} x2={-M * 0.55 + 0.15} y2={D} />
          <text
            x={-M * 0.55 - 0.2}
            y={D / 2}
            textAnchor="middle"
            fontSize={fontS * 0.9}
            fill="#475569"
            stroke="none"
            transform={`rotate(-90 ${-M * 0.55 - 0.2} ${D / 2})`}
          >
            {D.toFixed(2)} m
          </text>
        </g>
      )}
    </svg>
  );
});

// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
"use client";

import { useRef } from "react";
import s from "./Widgets.module.css";

/* ---------------- Dial: a draggable 270° knob ---------------- */
export function Dial({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  marks = [],
  color = "var(--ember)",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  marks?: { v: number; l: string }[];
  color?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const R = 42, C = 56;
  const a0 = 135, sweep = 270;
  const frac = (v: number) => (v - min) / (max - min);
  const ang = (v: number) => ((a0 + frac(v) * sweep) * Math.PI) / 180;
  const pt = (a: number, r: number) => [C + r * Math.cos(a), C + r * Math.sin(a)];
  const arc = (from: number, to: number, r: number) => {
    const [x0, y0] = pt(from, r), [x1, y1] = pt(to, r);
    const large = to - from > Math.PI ? 1 : 0;
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const set = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const x = clientX - (r.left + r.width / 2), y = clientY - (r.top + r.height / 2);
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    deg = (deg - a0 + 360) % 360;
    if (deg > sweep) deg = deg > sweep + (360 - sweep) / 2 ? 0 : sweep;
    const v = min + (deg / sweep) * (max - min);
    onChange(Math.round(v / step) * step);
  };
  const start = ang(min), end = ang(max), cur = ang(value);
  const [kx, ky] = pt(cur, R);
  return (
    <div className={s.dial}>
      <svg
        ref={ref}
        viewBox="0 0 112 112"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          set(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => e.buttons && set(e.clientX, e.clientY)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(Math.min(max, +(value + step).toFixed(2)));
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(Math.max(min, +(value - step).toFixed(2)));
        }}
      >
        <path d={arc(start, end, R)} className={s.track} />
        <path d={arc(start, cur, R)} className={s.fill} style={{ stroke: color }} />
        {marks.map((m) => {
          const [x0, y0] = pt(ang(m.v), R - 7), [x1, y1] = pt(ang(m.v), R + 7);
          return <line key={m.l} x1={x0} y1={y0} x2={x1} y2={y1} className={s.mark} />;
        })}
        <circle cx={kx} cy={ky} r={6} className={s.knob} style={{ stroke: color }} />
        <text x={C} y={C + 2} className={s.val} textAnchor="middle">
          {value % 1 ? value.toFixed(1) : value}
        </text>
        <text x={C} y={C + 17} className={s.unit} textAnchor="middle">
          {unit}
        </text>
      </svg>
      <div className={s.dialLabel}>{label}</div>
      {marks.length > 0 && (
        <div className={s.dialMarks}>
          {marks.map((m) => (
            <button key={m.l} onClick={() => onChange(m.v)} className={Math.abs(value - m.v) < step / 2 ? s.markOn : ""}>
              {m.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- O2 gauge: semicircle needle vs Earth air ---------------- */
export function O2Gauge({ o2 }: { o2: number }) {
  const min = 10, max = 50;
  const f = Math.max(0, Math.min(1, (o2 - min) / (max - min)));
  const a = Math.PI * (1 - f);
  const C = 70, R = 56;
  const nx = C + (R - 6) * Math.cos(a), ny = C - (R - 6) * Math.sin(a);
  const zone = (from: number, to: number, cls: string) => {
    const fa = Math.PI * (1 - (from - min) / (max - min)), ta = Math.PI * (1 - (to - min) / (max - min));
    return (
      <path
        key={cls + from}
        d={`M${(C + R * Math.cos(fa)).toFixed(2)} ${(C - R * Math.sin(fa)).toFixed(2)} A${R} ${R} 0 0 1 ${(C + R * Math.cos(ta)).toFixed(2)} ${(C - R * Math.sin(ta)).toFixed(2)}`}
        className={`${s.zone} ${cls}`}
      />
    );
  };
  const pct = Math.round((o2 / 20.95 - 1) * 100);
  return (
    <div className={s.gauge}>
      <svg viewBox="0 0 140 84">
        {zone(10, 19.5, s.zLow)}
        {zone(19.5, 23.5, s.zOk)}
        {zone(23.5, 30, s.zMid)}
        {zone(30, 50, s.zHigh)}
        <line x1={C} y1={C} x2={nx.toFixed(2)} y2={ny.toFixed(2)} className={s.needle} />
        <circle cx={C} cy={C} r={4} className={s.hub} />
        <text x={14} y={82} className={s.gTick}>10%</text>
        <text x={126} y={82} className={s.gTick} textAnchor="end">50%</text>
      </svg>
      <div className={s.gRead}>
        <span className={`serif num ${pct >= 25 ? "hot" : ""}`}>
          {pct >= 0 ? "+" : ""}
          {pct}%
        </span>
        <span className="eyebrow">O2 vs Earth air</span>
      </div>
    </div>
  );
}

/* ---------------- Ring: donut progress ---------------- */
export function Ring({ value, size = 64, color, children }: { value: number; size?: number; color: string; children?: React.ReactNode }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className={s.ring} style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} className={s.ringBg} />
        <circle
          cx="32"
          cy="32"
          r={r}
          className={s.ringFg}
          style={{ stroke: color, strokeDasharray: `${(Math.max(0.02, Math.min(1, value)) * c).toFixed(2)} ${c.toFixed(2)}` }}
        />
      </svg>
      <div className={s.ringIn}>{children}</div>
    </div>
  );
}

/* ---------------- Scenario icons ---------------- */
export function ScenarioIcon({ id }: { id: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden>
      {id === "iss" && (
        <g {...p}>
          <rect x="12" y="13" width="8" height="6" rx="1" />
          <path d="M3 9v14M8 9v14M24 9v14M29 9v14M8 16h4M20 16h4" />
        </g>
      )}
      {id === "lunar" && (
        <g {...p}>
          <path d="M5 24h22" />
          <path d="M8 24a8 8 0 0 1 16 0" />
          <path d="M14 24v-3h4v3" />
          <circle cx="25" cy="8" r="3" />
        </g>
      )}
      {id === "rover" && (
        <g {...p}>
          <rect x="6" y="11" width="18" height="8" rx="3" />
          <circle cx="10" cy="22" r="2.5" />
          <circle cx="20" cy="22" r="2.5" />
          <path d="M24 14h3M9 14h4" />
        </g>
      )}
      {id === "mars" && (
        <g {...p}>
          <circle cx="16" cy="16" r="9" />
          <path d="M9 13c3 1 5-1 8 0s4 3 6 2M10 20c2-1 4 1 7 0" />
        </g>
      )}
      {id === "suit" && (
        <g {...p}>
          <circle cx="16" cy="11" r="6" />
          <path d="M13 11h6" />
          <path d="M8 27c0-5 3-9 8-9s8 4 8 9" />
        </g>
      )}
    </svg>
  );
}

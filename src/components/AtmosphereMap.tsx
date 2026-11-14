"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { runs, byId, label, PHASE_COLOR, PHASE_LABEL, STATS, type Phase, type Run } from "@/lib/data";
import { PSI_PER_ATM } from "@/lib/scenarios";
import s from "./AtmosphereMap.module.css";

const ATMOS = [
  { name: "Earth / ISS", o2: 21, psi: 14.7, kind: "now" },
  { name: "Spacesuit", o2: 100, psi: 4.3, kind: "future" },
  { name: "Lunar habitat", o2: 30, psi: 10.2, kind: "future" },
  { name: "Lunar rover", o2: 34, psi: 8.2, kind: "future" },
  { name: "Mars habitat", o2: 26.5, psi: 10.2, kind: "future" },
  { name: "Apollo 1 (pad)", o2: 100, psi: 16.7, kind: "past" },
] as const;

const X0 = 3, X1 = 80; // psi, log
const Y0 = 10, Y1 = 100; // O2 %, log

export interface MapProps {
  height?: number;
  target?: { o2: number; psi: number; label?: string } | null;
  phases?: Phase[];
  highlight?: string | null; // investigation id
  onPick?: (invId: string) => void;
  showGap?: boolean;
  compact?: boolean;
}

export default function AtmosphereMap({ height = 460, target, phases, highlight, onPick, showGap = true, compact }: MapProps) {
  // On phones the chart redraws with a narrower canvas so labels and dots stay legible.
  const wrap = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 600));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const W = narrow ? 480 : 1000, H = narrow ? Math.round(height * 0.9) : height;
  const m = narrow ? { l: 46, r: 12, t: 30, b: 42 } : { l: compact ? 52 : 66, r: 18, t: 30, b: compact ? 38 : 48 };
  // rounded so server and browser Math.log agree during hydration
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const x = (psi: number) => r2(m.l + ((Math.log(psi) - Math.log(X0)) / (Math.log(X1) - Math.log(X0))) * (W - m.l - m.r));
  const y = (o2: number) => r2(H - m.b - ((Math.log(o2) - Math.log(Y0)) / (Math.log(Y1) - Math.log(Y0))) * (H - m.t - m.b));
  const [hover, setHover] = useState<{ r: Run; px: number; py: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const pts = useMemo(
    () =>
      runs
        .filter((r) => r.o2 != null && r.p != null && (!phases || phases.includes(r.phase)))
        .map((r, i) => {
          // deterministic jitter so stacked identical conditions read as a cluster
          const j = ((i * 9301 + 49297) % 233280) / 233280 - 0.5;
          const k = ((i * 4271 + 1237) % 23328) / 23328 - 0.5;
          return { r, px: r2(x(r.p! * PSI_PER_ATM) + j * (narrow ? 6 : 9)), py: r2(y(r.o2!) + k * 7) };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phases?.join(","), H, W]
  );

  const onMove = (e: React.PointerEvent) => {
    const el = svg.current!;
    const rect = el.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * W;
    const sy = ((e.clientY - rect.top) / rect.height) * H;
    let best = null as null | (typeof pts)[number];
    let bd = narrow ? 26 * 26 : 18 * 18;
    for (const p of pts) {
      const d = (p.px - sx) ** 2 + (p.py - sy) ** 2;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    setHover(best);
  };

  const xt = narrow ? [4.3, 8.2, 14.7, 29.4, 73.5] : [4.3, 8.2, 10.2, 14.7, 29.4, 44.1, 73.5];
  const yt = narrow ? [12, 21, 30, 40, 60, 100] : [12, 15, 21, 30, 40, 60, 85, 100];
  const gapY = y(STATS.maxSolidO2);

  return (
    <div ref={wrap} className={`${s.wrap} ${narrow ? s.narrow : ""}`}>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className={s.svg}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={() => hover && onPick?.(hover.r.inv)}
        style={{ cursor: hover && onPick ? "pointer" : "default" }}
        role="img"
        aria-label="Scatter plot of PSI test conditions by oxygen percentage and pressure"
      >
        {/* grid */}
        {xt.map((v) => (
          <g key={"x" + v}>
            <line x1={x(v)} x2={x(v)} y1={m.t} y2={H - m.b} className={s.grid} />
            <text x={x(v)} y={H - m.b + 16} className={s.tick} textAnchor="middle">
              {v}
            </text>
          </g>
        ))}
        {yt.map((v) => (
          <g key={"y" + v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className={v === 21 ? s.grid21 : s.grid} />
            <text x={m.l - 8} y={y(v) + 4} className={s.tick} textAnchor="end">
              {v}%
            </text>
          </g>
        ))}
        <text x={W - m.r} y={H - 6} className={s.axis} textAnchor="end">
          {narrow ? "Pressure, psi →" : "Total pressure, psi (log) →"}
        </text>
        <text x={10} y={m.t + 4} className={s.axis} transform={`rotate(90 10 ${m.t + 4})`}>
          {narrow ? "Oxygen % →" : "Oxygen, % by volume (log) →"}
        </text>

        {/* the gap: no solid-material flight data above this line */}
        {showGap && (!phases || phases.includes("solid")) && (
          <g>
            <rect x={m.l} y={m.t} width={W - m.l - m.r} height={gapY - m.t} className={s.gap} />
            <line x1={m.l} x2={W - m.r} y1={gapY} y2={gapY} className={s.gapLine} />
            <text x={W - m.r - 8} y={gapY - 8} className={s.gapText} textAnchor="end">
              {narrow ? `no solids burned above ${STATS.maxSolidO2}% O2` : `no solid material burned above ${STATS.maxSolidO2}% O2 in PSI flight data`}
            </text>
          </g>
        )}

        {/* data */}
        {pts.map(({ r, px, py }, i) => {
          const dim = highlight && r.inv !== highlight;
          const assumed = r.assumed?.includes("o2") || r.assumed?.includes("p");
          const fill = PHASE_COLOR[r.phase];
          return r.kind === "condition" ? (
            <rect key={i} x={px - 2.6} y={py - 2.6} width={5.2} height={5.2} fill="none" stroke={fill} strokeWidth={1}
              opacity={dim ? 0.08 : 0.75} />
          ) : (
            <circle key={i} cx={px} cy={py} r={(assumed ? 2.6 : 2.3) * (narrow ? 1.25 : 1)} fill={assumed ? "none" : fill} stroke={assumed ? fill : "none"}
              strokeWidth={1} opacity={dim ? 0.07 : assumed ? 0.45 : 0.72} />
          );
        })}

        {/* human atmospheres */}
        {ATMOS.map((a) => (
          <g key={a.name} className={s.atmo}>
            <circle cx={x(a.psi)} cy={y(a.o2)} r={6} className={a.kind === "future" ? s.future : a.kind === "past" ? s.past : s.now} />
            <text x={x(a.psi) + (a.name === "Spacesuit" ? 10 : 10)} y={y(a.o2) + (a.name === "Mars habitat" ? 14 : a.name === "Lunar rover" ? -8 : -9)}
              className={s.atmoText}>
              {a.name}
            </text>
          </g>
        ))}

        {/* scenario crosshair */}
        {target && (
          <g className={s.target}>
            <line x1={x(target.psi)} x2={x(target.psi)} y1={m.t} y2={H - m.b} />
            <line x1={m.l} x2={W - m.r} y1={y(target.o2)} y2={y(target.o2)} />
            <circle cx={x(target.psi)} cy={y(target.o2)} r={16} />
            <circle cx={x(target.psi)} cy={y(target.o2)} r={3} className={s.tdot} />
            <text x={x(target.psi) + 20} y={y(target.o2) + 22} className={s.ttext}>
              {narrow ? `${target.o2}% · ${target.psi} psi` : `${target.label ?? "Your scenario"} · ${target.o2}% · ${target.psi} psi`}
            </text>
          </g>
        )}

        {hover && <circle cx={hover.px} cy={hover.py} r={7} className={s.hoverRing} />}
      </svg>

      {hover && (
        <div
          className={s.tip}
          style={{
            left: `${(hover.px / W) * 100}%`,
            top: `${(hover.py / H) * 100}%`,
            transform: hover.px > W * 0.66 ? "translate(calc(-100% - 14px), -50%)" : undefined,
          }}
        >
          <div className="eyebrow">
            {label(byId[hover.r.inv])} · {hover.r.inv}
          </div>
          <div className={s.tipFuel}>{hover.r.fuel ?? PHASE_LABEL[hover.r.phase]}</div>
          <div className="mono num">
            {hover.r.o2?.toFixed(1)}% O2 · {(hover.r.p! * PSI_PER_ATM).toFixed(1)} psi
            {hover.r.flow != null && ` · ${hover.r.flow} cm/s`}
          </div>
          {hover.r.outcome && <div className={s.tipOut}>{hover.r.outcome}</div>}
          {hover.r.assumed?.length ? <div className={s.tipNote}>cabin default: {hover.r.assumed.join(", ")}</div> : null}
          {hover.r.kind === "condition" && <div className={s.tipNote}>tested condition (PI summary)</div>}
        </div>
      )}

      <div className={s.legend}>
        {(Object.keys(PHASE_LABEL) as Phase[])
          .filter((p) => !phases || phases.includes(p))
          .map((p) => (
            <span key={p} className="chip">
              <span className="dot" style={{ background: PHASE_COLOR[p] }} />
              {PHASE_LABEL[p]}
            </span>
          ))}
        <span className="chip">
          <span className="dot" style={{ border: "1px solid var(--ink-2)" }} /> cabin default
        </span>
        <span className="chip">
          <span className="dot" style={{ border: "1px solid var(--ink-2)", borderRadius: 0 }} /> tested condition
        </span>
      </div>
    </div>
  );
}

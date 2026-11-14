"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import { MATERIALS, evaluate, buoyantFlow, type BurnResult } from "@/lib/burn";
import { byId, label } from "@/lib/data";
import type { TunnelEngine, Telemetry } from "./TunnelEngine";
import s from "./FlameLabApp.module.css";

const O2_PRESETS = [
  { v: 21, l: "Earth" },
  { v: 26.5, l: "Mars hab" },
  { v: 30, l: "Moon base" },
  { v: 34, l: "Rover" },
];
const P_PRESETS = [
  { v: 14.7, l: "1 atm" },
  { v: 10.2, l: "10.2" },
  { v: 8.2, l: "8.2" },
];
const G_PRESETS = [
  { v: 0, l: "Orbit", sub: "0 g" },
  { v: 0.165, l: "Moon", sub: "0.17 g" },
  { v: 0.38, l: "Mars", sub: "0.38 g" },
  { v: 1, l: "Earth", sub: "1 g" },
];

const VERDICT_CLASS: Record<BurnResult["verdict"], string> = {
  "No sustained flame": "safe",
  "Near-limit flame": "warn",
  Burns: "hot",
  "Burns vigorously": "danger",
};

export default function FlameLabApp() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<TunnelEngine | null>(null);
  const [matId, setMatId] = useState("nomex");
  const [o2, setO2] = useState(21);
  const [psi, setPsi] = useState(14.7);
  const [flow, setFlow] = useState(10);
  const [direction, setDirection] = useState<"concurrent" | "opposed">("concurrent");
  const [gravity, setGravity] = useState(0);
  const [speed, setSpeed] = useState(5);
  const [tel, setTel] = useState<Telemetry>({ phase: "idle", t: 0, burned: 0, rate: 0, strength: 0 });
  const [hist, setHist] = useState<number[]>([]);
  const [ready, setReady] = useState(false);

  const material = MATERIALS.find((m) => m.id === matId)!;
  const result = useMemo(() => evaluate({ material, o2, psi, flow, direction, gravity }), [material, o2, psi, flow, direction, gravity]);
  const onEarth = useMemo(() => evaluate({ material, o2, psi, flow, direction, gravity: 1 }), [material, o2, psi, flow, direction]);
  const inOrbit = useMemo(() => evaluate({ material, o2, psi, flow, direction, gravity: 0 }), [material, o2, psi, flow, direction]);

  useEffect(() => {
    let disposed = false;
    import("./TunnelEngine").then(({ TunnelEngine }) => {
      if (disposed || !canvas.current) return;
      engine.current = new TunnelEngine(canvas.current);
      if (process.env.NODE_ENV === "development") (window as unknown as { __tunnel: TunnelEngine }).__tunnel = engine.current;
      setReady(true);
    });
    return () => {
      disposed = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.setParams({ material, result, flow, direction, gravity, o2 });
  }, [ready, material, result, flow, direction, gravity, o2]);

  useEffect(() => {
    engine.current?.setSpeed(speed);
  }, [ready, speed]);

  useEffect(() => {
    const id = setInterval(() => {
      const t = engine.current?.telemetry();
      if (!t) return;
      setTel(t);
      if (t.phase === "burning" || t.phase === "igniting" || t.phase === "dying")
        setHist((h) => (h.length > 160 ? [...h.slice(1), t.burned] : [...h, t.burned]));
    }, 150);
    return () => clearInterval(id);
  }, []);

  const ignite = () => {
    setHist([]);
    engine.current?.ignite();
  };
  const reset = () => {
    setHist([]);
    engine.current?.reset();
  };
  const running = tel.phase === "igniting" || tel.phase === "burning" || tel.phase === "dying";

  const status =
    tel.phase === "idle"
      ? "Ready"
      : tel.phase === "igniting"
        ? "Igniting"
        : tel.phase === "burning"
          ? "Flame spreading"
          : tel.phase === "dying"
            ? "Flame failing"
            : tel.phase === "extinguished"
              ? "Self-extinguished"
              : "Sample consumed";

  // sparkline
  const spark = useMemo(() => {
    if (hist.length < 2) return "";
    return hist.map((v, i) => `${(i / 160) * 100},${30 - (v / 20) * 28}`).join(" ");
  }, [hist]);

  // oxygen gauge 10..50 %
  const gx = (v: number) => `${Math.max(0, Math.min(100, ((v - 10) / 40) * 100))}%`;

  return (
    <div className={s.app}>
      <header className={s.top}>
        <Link href="/" className={s.brand}>
          <Logo size={20} />
          <span>
            Flame <span className="ital serif">in</span> Freefall
          </span>
        </Link>
        <span className={s.crumb}>
          <span className="eyebrow">Flame Lab</span>
          <span className={s.crumbSub}>virtual microgravity wind tunnel</span>
        </span>
        <nav className={s.nav}>
          <Link href="/">Home</Link>
          <Link href="/explore" className="btn">
            Dashboard
          </Link>
        </nav>
      </header>

      <div className={s.body}>
        {/* ---------- stage ---------- */}
        <section className={s.stage}>
          <canvas ref={canvas} className={s.canvas} />

          <div className={`${s.verdict} ${s[VERDICT_CLASS[result.verdict]]}`}>
            <div className="eyebrow">Prediction · {material.name}</div>
            <div className={`serif ${s.vTitle}`}>{result.verdict}</div>
            <p>{result.reason}</p>
          </div>

          <div className={s.axes}>
            <div>
              <span className="eyebrow">Flow</span>
              <span className={`mono ${s.axisVal}`}>{flow} cm/s →</span>
            </div>
            <div>
              <span className="eyebrow">Gravity</span>
              <span className={`mono ${s.axisVal}`}>{gravity === 0 ? "0 g ✕" : `${gravity} g ↓`}</span>
            </div>
            <div>
              <span className="eyebrow">Buoyant draft</span>
              <span className={`mono ${s.axisVal}`}>{buoyantFlow(gravity).toFixed(0)} cm/s ↑</span>
            </div>
          </div>

          <div className={s.hud}>
            <div className={s.status}>
              <span className={`${s.led} ${running ? s.ledOn : ""} ${tel.phase === "extinguished" ? s.ledOut : ""}`} />
              <span className="mono">{status}</span>
            </div>
            <Metric k="Time" v={`${tel.t.toFixed(0)} s`} />
            <Metric k="Burned" v={`${tel.burned.toFixed(1)} / 20 cm`} />
            <Metric k="Spread" v={`${tel.rate.toFixed(2)} mm/s`} />
            <Metric k="Flame temp" v={running ? `~${result.tempK} K` : "-"} />
            <svg className={s.spark} viewBox="0 0 100 32" preserveAspectRatio="none">
              <line x1="0" y1="30" x2="100" y2="30" />
              {spark && <polyline points={spark} />}
            </svg>
            <div className={s.track}>
              <span style={{ width: `${(tel.burned / 20) * 100}%`, marginLeft: direction === "opposed" ? "auto" : 0 }} />
            </div>
          </div>
          <div className={s.hint}>Drag to orbit · scroll to zoom · change settings mid-burn</div>
        </section>

        {/* ---------- controls ---------- */}
        <aside className={s.panel}>
          <div className={`${s.block} ${s.mInfo}`}>
            <p className={s.note}>{result.reason}</p>
            <div className={s.mAxes}>
              <span className="chip">flow {flow} cm/s →</span>
              <span className="chip">{gravity === 0 ? "0 g" : `${gravity} g ↓`}</span>
              <span className="chip">buoyant draft {buoyantFlow(gravity).toFixed(0)} cm/s ↑</span>
            </div>
          </div>
          <div className={s.block}>
            <div className="eyebrow">1 · Sample material</div>
            <div className={s.mats}>
              {MATERIALS.map((m) => (
                <button key={m.id} className={`${s.mat} ${m.id === matId ? s.matOn : ""}`} onClick={() => setMatId(m.id)}>
                  <span className={s.swatch} style={{ background: m.color }} />
                  <span className={s.matName}>{m.name}</span>
                  <span className={`mono ${s.loi}`}>LOI {m.loi}%</span>
                </button>
              ))}
            </div>
            <p className={s.note}>{material.note}</p>
          </div>

          <div className={s.block}>
            <div className={s.row}>
              <div className="eyebrow">2 · Oxygen</div>
              <span className={`mono ${s.big}`}>{o2}%</span>
            </div>
            <input type="range" min={15} max={50} step={0.5} value={o2} onChange={(e) => setO2(+e.target.value)} aria-label="Oxygen" />
            <div className={s.chips}>
              {O2_PRESETS.map((p) => (
                <button key={p.l} className={`${s.chipBtn} ${o2 === p.v ? s.chipOn : ""}`} onClick={() => setO2(p.v)}>
                  {p.l} {p.v}%
                </button>
              ))}
            </div>
            <div className={s.gauge}>
              <div className={s.gBar}>
                <span className={s.gSafe} style={{ width: gx(result.limit) }} />
                <span className={s.gLimit} style={{ left: gx(result.limit) }}>
                  <em>limit {result.limit.toFixed(1)}%</em>
                </span>
                <span className={s.gNow} style={{ left: gx(o2) }}>
                  <em>you {o2}%</em>
                </span>
              </div>
              <div className={s.gScale}>
                <span>10%</span>
                <span>won&apos;t burn ← | → burns</span>
                <span>50%</span>
              </div>
            </div>
          </div>

          <div className={s.block}>
            <div className={s.row}>
              <div className="eyebrow">3 · Pressure</div>
              <span className={`mono ${s.big}`}>{psi} psi</span>
            </div>
            <input type="range" min={4} max={15} step={0.1} value={psi} onChange={(e) => setPsi(+e.target.value)} aria-label="Pressure" />
            <div className={s.chips}>
              {P_PRESETS.map((p) => (
                <button key={p.l} className={`${s.chipBtn} ${psi === p.v ? s.chipOn : ""}`} onClick={() => setPsi(p.v)}>
                  {p.l} {p.v === 14.7 ? "" : "psi"}
                </button>
              ))}
            </div>
          </div>

          <div className={s.block}>
            <div className={s.row}>
              <div className="eyebrow">4 · Airflow</div>
              <span className={`mono ${s.big}`}>{flow} cm/s</span>
            </div>
            <input type="range" min={0} max={60} step={1} value={flow} onChange={(e) => setFlow(+e.target.value)} aria-label="Flow speed" />
            <div className={s.seg}>
              {(["concurrent", "opposed"] as const).map((d) => (
                <button key={d} className={direction === d ? s.segOn : ""} onClick={() => { setDirection(d); reset(); }}>
                  <svg viewBox="0 0 60 18" aria-hidden>
                    <path d="M2 9h22M18 4l6 5-6 5" className={s.svgFlow} />
                    <path d={d === "concurrent" ? "M34 9h22M50 4l6 5-6 5" : "M56 9H34M40 4l-6 5 6 5"} className={s.svgSpread} />
                  </svg>
                  {d === "concurrent" ? "Concurrent" : "Opposed"}
                </button>
              ))}
            </div>
            <p className={s.note}>
              <span className="cold">Blue</span> = airflow, <span className="hot">orange</span> = flame spread.{" "}
              {direction === "concurrent" ? "Flow pushes the flame onto fresh fuel (faster, more dangerous)." : "Flame creeps into the wind (slower, steadier)."}
            </p>
          </div>

          <div className={s.block}>
            <div className="eyebrow">5 · Gravity</div>
            <div className={s.seg4}>
              {G_PRESETS.map((g) => (
                <button key={g.l} className={gravity === g.v ? s.segOn : ""} onClick={() => setGravity(g.v)}>
                  <b>{g.l}</b>
                  <span>{g.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={`${s.block} ${s.runBlock}`}>
            <button className={s.ignite} onClick={ignite} disabled={running}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2c3 4 5 6.8 5 10a5 5 0 0 1-10 0c0-2 .8-3.7 2-5 .2 1.6 1 2.6 2 3 0-2.6.3-5 1-8z" />
              </svg>
              {running ? "Burning..." : tel.phase === "idle" ? "Ignite sample" : "Ignite again"}
            </button>
            <div className={s.runRow}>
              <button className="btn" onClick={reset}>
                Reset
              </button>
              <div className={s.speed}>
                {[1, 5, 20].map((v) => (
                  <button key={v} className={speed === v ? s.segOn : ""} onClick={() => setSpeed(v)}>
                    {v}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={s.block}>
            <div className="eyebrow">Same sample, other worlds</div>
            <div className={s.compare}>
              <Mini label="In orbit (0 g)" r={inOrbit} />
              <Mini label="On Earth (1 g)" r={onEarth} />
            </div>
          </div>

          <div className={s.block}>
            <div className="eyebrow">Closest PSI evidence</div>
            <div className={s.chips}>
              {material.psi.length ? (
                material.psi.map((id) => (
                  <Link key={id} href={`/explore?open=${id}`} className={s.chipLink}>
                    {byId[id] ? label(byId[id]) : id} →
                  </Link>
                ))
              ) : (
                <span className={s.note}>None in PSI - comparison material only.</span>
              )}
            </div>
            <p className={s.disclaimer}>
              Teaching model, not a flammability certification. Oxygen limits (LOI) come from the literature; flow, gravity and
              pressure trends follow BASS, BASS-II and Saffire. Calibrated to Saffire-II&apos;s measured 2.1-2.6 mm/s for
              cotton-fiberglass in orbit.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className={s.metric}>
      <span className="eyebrow">{k}</span>
      <span className="mono num">{v}</span>
    </div>
  );
}

function Mini({ label, r }: { label: string; r: BurnResult }) {
  return (
    <div className={`${s.mini} ${s[VERDICT_CLASS[r.verdict]]}`}>
      <span className={s.miniL}>{label}</span>
      <b>{r.verdict}</b>
      <span className="mono">{r.burns ? `${r.spread.toFixed(2)} mm/s` : `needs ${r.limit.toFixed(1)}% O2`}</span>
    </div>
  );
}

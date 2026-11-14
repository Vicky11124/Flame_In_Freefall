"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "@/components/Logo";
import AtmosphereMap from "@/components/AtmosphereMap";
import { byId, label, runs, PHASE_COLOR, PHASE_LABEL, THEME_LABEL, type Phase, type Theme } from "@/lib/data";
import { SCENARIOS, DEFAULT_WEIGHTS, toAtm, type Weights } from "@/lib/scenarios";
import { rank, coverage, type Ranked } from "@/lib/score";
import { Dial, O2Gauge, Ring, ScenarioIcon } from "./Widgets";
import Drawer from "./Drawer";
import Compare from "./Compare";
import Analyst from "./Analyst";
import Network from "./Network";
import EarthView from "./EarthView";
import s from "./Explorer.module.css";

type Tab = "rank" | "map" | "network" | "compare" | "earth" | "ask";
const TABS: Tab[] = ["rank", "map", "network", "compare", "earth", "ask"];
const PHASES: Phase[] = ["solid", "liquid", "gas", "aerosol"];
const THEMES: Theme[] = ["prevention", "detection", "suppression", "modeling"];
const PARTS = [
  { k: "conditions", l: "Atmosphere match", w: 35, c: "var(--ember)" },
  { k: "mission", l: "Mission focus", w: 25, c: "var(--ug)" },
  { k: "relevance", l: "Material match", w: 20, c: "var(--c-solid)" },
  { k: "evidence", l: "Evidence strength", w: 20, c: "var(--ink-3)" },
] as const;
const TAB_ICON: Record<Tab, React.ReactNode> = {
  rank: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  map: <><circle cx="7" cy="15" r="1.6" /><circle cx="12" cy="9" r="1.6" /><circle cx="17" cy="13" r="1.6" /><path d="M3 3v18h18" /></>,
  network: <><circle cx="6" cy="7" r="2.5" /><circle cx="18" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8 8.5l3 7.5M16 8.5l-3 7.5M8.5 7h7" /></>,
  compare: <><rect x="3" y="4" width="7" height="16" rx="1" /><rect x="14" y="4" width="7" height="16" rx="1" /></>,
  earth: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  ask: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
};
const PHASE_SHORT: Record<Phase, string> = { solid: "Solids", liquid: "Liquids", gas: "Gases", aerosol: "Smoke" };

export default function Explorer() {
  const [scenarioId, setScenarioId] = useState("lunar");
  const base = SCENARIOS.find((x) => x.id === scenarioId)!;
  const [o2, setO2] = useState(base.o2);
  const [psi, setPsi] = useState(base.psi);
  const [flow, setFlow] = useState(base.flow);
  const [focus, setFocus] = useState<Phase[]>(base.focus);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [tab, setTab] = useState<Tab>("rank");
  const [open, setOpen] = useState<string | null>(null);
  const [cmp, setCmp] = useState<string[]>([]);
  const [askSeed, setAskSeed] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const hydrated = useRef(false);

  /* ---------- URL state: read once, then keep in sync (shareable links) ---------- */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sc = SCENARIOS.find((x) => x.id === q.get("s"));
    if (sc) {
      setScenarioId(sc.id);
      setO2(sc.o2);
      setPsi(sc.psi);
      setFlow(sc.flow);
      setFocus(sc.focus);
    }
    if (q.get("o2")) setO2(+q.get("o2")!);
    if (q.get("psi")) setPsi(+q.get("psi")!);
    if (q.get("flow")) setFlow(+q.get("flow")!);
    const f = q.get("m")?.split(",").filter((x): x is Phase => PHASES.includes(x as Phase));
    if (f?.length) setFocus(f);
    const t = q.get("tab") as Tab;
    if (TABS.includes(t)) setTab(t);
    const o = q.get("open");
    if (o && byId[o]) setOpen(o);
    const c = q.get("cmp")?.split(",").filter((x) => byId[x]);
    if (c?.length) setCmp(c.slice(0, 3));
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const q = new URLSearchParams({ s: scenarioId, o2: String(o2), psi: String(psi), flow: String(flow), m: focus.join(","), tab });
    if (open) q.set("open", open);
    if (cmp.length) q.set("cmp", cmp.join(","));
    window.history.replaceState(null, "", `?${q.toString()}`);
  }, [scenarioId, o2, psi, flow, focus, tab, open, cmp]);

  const pick = (id: string) => {
    const sc = SCENARIOS.find((x) => x.id === id)!;
    setScenarioId(id);
    setO2(sc.o2);
    setPsi(sc.psi);
    setFlow(sc.flow);
    setFocus(sc.focus);
  };

  const ranked = useMemo(() => rank({ o2, psi, flow, focus, weights }), [o2, psi, flow, focus, weights]);
  const cov = useMemo(() => coverage(o2, psi), [o2, psi]);
  const custom = o2 !== base.o2 || psi !== base.psi;
  const toggleCmp = (id: string) =>
    setCmp((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? [...c.slice(1), id] : [...c, id]));
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  };

  const scenarioCtx = { name: custom ? `${base.name} (custom)` : base.name, o2, psi, flow, gravity: base.gravity, focus, weights };

  const briefing = () => {
    setAskSeed(
      `Write a fire-safety briefing for the "${scenarioCtx.name}" scenario (${o2}% O2 at ${psi} psi, ${base.gravity} g). ` +
        `Which PSI investigations matter most and why, what does their data say about flammability, detection and suppression at these conditions, and where are the biggest data gaps?`
    );
    setTab("ask");
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash("Link copied - it opens this exact view");
    } catch {
      flash("Copy the address bar to share this view");
    }
  };

  const exportCsv = () => {
    const cols = ["inv", "acronym", "kind", "phase", "fuel", "o2_pct", "p_atm", "p_psi", "flow_cms", "diluent", "outcome", "burn_s", "d0_mm", "assumed"];
    const rows = runs
      .filter((r) => focus.includes(r.phase))
      .map((r) =>
        [r.inv, byId[r.inv]?.acronym ?? "", r.kind, r.phase, r.fuel ?? "", r.o2 ?? "", r.p ?? "", r.p ? (r.p * 14.696).toFixed(2) : "", r.flow ?? "", r.dil ?? "", r.outcome ?? "", r.burn ?? "", r.d0 ?? "", (r.assumed ?? []).join("|")]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
    const blob = new Blob([[cols.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `psi-combustion-runs-${focus.join("-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    flash(`Exported ${rows.length.toLocaleString()} runs`);
  };

  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const tabLabel: Record<Tab, string> = {
    rank: "Rank",
    map: "Map",
    network: "Network",
    compare: `Compare${cmp.length ? ` ${cmp.length}` : ""}`,
    earth: "Earth",
    ask: "Ask AI",
  };

  return (
    <div className={s.app}>
      <header className={s.top}>
        <Link href="/" className={s.brand}>
          <Logo size={20} />
          <span>
            Flame <span className="ital serif">in</span> Freefall
          </span>
        </Link>
        <nav className={s.tabs} role="tablist">
          {TABS.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`${s.tab} ${tab === k ? s.tabOn : ""}`} onClick={() => setTab(k)}>
              {k === "ask" && <span className={s.spark}>✦</span>}
              {tabLabel[k]}
            </button>
          ))}
        </nav>
        <div className={s.topRight}>
          <Link href="/lab" className={s.labLink}>
            <span className={s.liveDot} /> <span className={s.labText}>Flame Lab</span>
            <span className={s.labShort}>Lab</span>
          </Link>
          <button className={s.iconBtn} onClick={share} title="Copy a link to this view">
            <svg viewBox="0 0 20 20" aria-hidden>
              <path d="M8 11.5 12 8.5M8 8.5l4 3M5.5 10a2 2 0 1 0 0 .01M14.5 6a2 2 0 1 0 0 .01M14.5 14a2 2 0 1 0 0 .01" />
            </svg>
            <span>Share</span>
          </button>
          <button className={`btn ${s.menuBtn}`} onClick={() => setMenu((m) => !m)}>
            {menu ? "Close" : "Mission"}
          </button>
        </div>
      </header>

      <div className={s.body}>
        {/* ------------ mission controls ------------ */}
        <aside className={`${s.side} ${menu ? s.sideOpen : ""}`}>
          <div className={s.block}>
            <div className="eyebrow">Where are the crew?</div>
            <div className={s.scen}>
              {SCENARIOS.map((sc) => (
                <button key={sc.id} className={`${s.scBtn} ${sc.id === scenarioId ? s.scOn : ""}`} onClick={() => pick(sc.id)} title={sc.note}>
                  <ScenarioIcon id={sc.id} />
                  <span className={s.scName}>{sc.name.replace(" / spacecraft cabin", "").replace(" & habitat", "")}</span>
                  <span className={`mono ${s.scNum}`}>{sc.o2}%</span>
                </button>
              ))}
            </div>
          </div>

          <div className={s.block}>
            <div className="eyebrow">
              Atmosphere {custom && <span className="hot">· custom</span>}
            </div>
            <div className={s.dials}>
              <Dial label="Oxygen" unit="% O2" value={o2} min={10} max={100} step={0.5} onChange={setO2}
                marks={[{ v: 21, l: "Earth" }, { v: 30, l: "Moon" }, { v: 34, l: "Rover" }]} />
              <Dial label="Pressure" unit="psi" value={psi} min={3} max={20} step={0.1} onChange={setPsi} color="var(--ug)"
                marks={[{ v: 14.7, l: "1 atm" }, { v: 10.2, l: "10.2" }, { v: 8.2, l: "8.2" }]} />
            </div>
            <label className={s.flow}>
              <span>
                Ventilation <b className="mono">{flow} cm/s</b>
              </span>
              <input type="range" min={0} max={40} step={1} value={flow} onChange={(e) => setFlow(+e.target.value)} />
            </label>
          </div>

          <div className={s.block}>
            <div className="eyebrow">What could burn?</div>
            <div className={s.pills}>
              {PHASES.map((p) => (
                <button
                  key={p}
                  className={`${s.pill} ${focus.includes(p) ? s.pillOn : ""}`}
                  style={{ ["--pc" as string]: PHASE_COLOR[p] }}
                  onClick={() => setFocus((f) => (f.includes(p) ? (f.length > 1 ? f.filter((x) => x !== p) : f) : [...f, p]))}
                >
                  <span className="dot" style={{ background: PHASE_COLOR[p] }} />
                  {PHASE_SHORT[p]}
                </button>
              ))}
            </div>
          </div>

          <div className={s.block}>
            <div className="eyebrow">Mission priorities · tap to set</div>
            <div className={s.prio}>
              {THEMES.map((t) => (
                <button key={t} className={s.prioRow} onClick={() => setWeights((w) => ({ ...w, [t]: (w[t] + 1) % 4 }))}>
                  <span>{THEME_LABEL[t]}</span>
                  <span className={s.dots}>
                    {[1, 2, 3].map((d) => (
                      <i key={d} className={weights[t] >= d ? s.dotOn : ""} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className={s.doneWrap}>
            <button className="btn btn-hot" onClick={() => setMenu(false)}>
              Show results →
            </button>
          </div>
        </aside>

        {/* ------------ main ------------ */}
        <main className={s.main}>
          <div className={s.mScen} role="group" aria-label="Choose habitat">
            {SCENARIOS.map((sc) => (
              <button key={sc.id} className={sc.id === scenarioId ? s.mScenOn : ""} onClick={() => pick(sc.id)}>
                <ScenarioIcon id={sc.id} />
                <span>{sc.name.split(" ")[0].replace("/", "")}</span>
              </button>
            ))}
            <button className={s.mTune} onClick={() => setMenu(true)}>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
                <circle cx="16" cy="6" r="2" />
                <circle cx="10" cy="12" r="2" />
                <circle cx="18" cy="18" r="2" />
              </svg>
              <span>Tune</span>
            </button>
          </div>
          <section className={s.hero}>
            <div className={s.heroL}>
              <div className={s.heroIcon}>
                <ScenarioIcon id={scenarioId} />
              </div>
              <div>
                <div className="eyebrow">
                  {base.where} · {base.gravity === 0 ? "microgravity" : `${base.gravity} g`}
                </div>
                <h1 className="serif">{scenarioCtx.name}</h1>
              </div>
            </div>
            <div className={s.heroR}>
              <O2Gauge o2={o2} />
              <div className={s.mini}>
                <Stat k="O2 partial pressure" v={`${((o2 / 100) * psi).toFixed(2)} psi`} />
                <Stat k="Total pressure" v={`${toAtm(psi).toFixed(2)} atm`} />
                <Stat k="Gravity data in PSI" v={base.gravity === 0 ? "Yes" : "None"} hot={base.gravity !== 0} />
              </div>
            </div>
          </section>

          <section className={s.coverage}>
            {cov.map((c) => {
              const close = c.distance < 0.75;
              const val = c.total ? c.near / Math.max(1, Math.min(c.total, 60)) : 0;
              const col = c.total === 0 ? "var(--ink-3)" : close ? "var(--ok)" : "var(--warn)";
              return (
                <div key={c.phase} className={`${s.cov} ${focus.includes(c.phase) ? "" : s.covDim}`}
                  title={c.best ? `Nearest: ${c.best.o2?.toFixed(1)}% O2 in ${label(byId[c.best.inv])}` : "O2 never varied"}>
                  <Ring value={c.total ? Math.max(close ? 0.15 : 0.04, val) : 0.02} color={col}>
                    <span className="num">{c.total ? c.near : "-"}</span>
                  </Ring>
                  <div>
                    <div className={s.covName}>
                      <span className="dot" style={{ background: PHASE_COLOR[c.phase] }} />
                      {PHASE_SHORT[c.phase]}
                    </div>
                    <div className={s.covState} style={{ color: col }}>
                      {c.total === 0 ? "O2 not varied" : close ? "data nearby" : "data gap"}
                    </div>
                    {c.maxO2 != null && <div className={s.covSub}>tested to {c.maxO2.toFixed(0)}% O2</div>}
                  </div>
                </div>
              );
            })}
          </section>

          {tab === "rank" && (
            <section>
              <div className={s.bar}>
                <h2 className="serif">
                  Top matches
                  <button className={s.info} onClick={() => setHowOpen((v) => !v)} aria-expanded={howOpen}>
                    i
                  </button>
                </h2>
                <div className={s.barBtns}>
                  <button className="btn" onClick={exportCsv}>
                    CSV
                  </button>
                  <button className="btn btn-hot" onClick={briefing}>
                    ✦ AI briefing
                  </button>
                </div>
              </div>
              {howOpen && (
                <div className={s.how}>
                  {PARTS.map((p) => (
                    <span key={p.k}>
                      <i style={{ background: p.c }} />
                      <b>{p.w}%</b> {p.l}
                    </span>
                  ))}
                </div>
              )}

              <div className={s.podium}>
                {podium.map((r, i) => (
                  <article key={r.inv.id} className={`${s.pod} ${i === 0 ? s.pod1 : ""}`} onClick={() => setOpen(r.inv.id)}>
                    <div className={s.podTop}>
                      <span className={s.medal}>#{i + 1}</span>
                      <button
                        className={`${s.plus} ${cmp.includes(r.inv.id) ? s.plusOn : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCmp(r.inv.id);
                        }}
                        title="Add to compare"
                      >
                        {cmp.includes(r.inv.id) ? "✓" : "+"}
                      </button>
                    </div>
                    <Ring value={r.total / 100} size={86} color={i === 0 ? "var(--flame)" : "var(--ember)"}>
                      <span className={`serif ${s.podScore}`}>{r.total.toFixed(0)}</span>
                    </Ring>
                    <div className={`serif ${s.podName}`}>{label(r.inv)}</div>
                    <p className={s.podShort}>{r.inv.short}</p>
                    <Stack r={r} />
                    <span className="chip">
                      <span className="dot" style={{ background: PHASE_COLOR[r.inv.phase] }} />
                      {r.inv.phase} · {r.inv.type}
                    </span>
                  </article>
                ))}
              </div>

              <ol className={s.list} start={4}>
                {rest.map((r, i) => (
                  <li key={r.inv.id} className={s.row} style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }} onClick={() => setOpen(r.inv.id)}>
                    <span className={`${s.rk} num`}>{String(i + 4).padStart(2, "0")}</span>
                    <span className="dot" style={{ background: PHASE_COLOR[r.inv.phase] }} />
                    <span className={s.rowName}>
                      <b className="serif">{label(r.inv)}</b>
                      <span className={s.rowShort}>{r.inv.short}</span>
                    </span>
                    <Stack r={r} />
                    <span className={`${s.rowScore} serif num`}>{r.total.toFixed(0)}</span>
                    <button
                      className={`${s.plus} ${cmp.includes(r.inv.id) ? s.plusOn : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCmp(r.inv.id);
                      }}
                      title="Add to compare"
                    >
                      {cmp.includes(r.inv.id) ? "✓" : "+"}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {tab === "map" && (
            <section>
              <div className={s.bar}>
                <h2 className="serif">Where the data lives</h2>
                <button className="btn" onClick={exportCsv}>
                  CSV
                </button>
              </div>
              <div className={`${s.mapCard} marks`}>
                <AtmosphereMap target={{ o2, psi, label: base.name }} phases={focus} highlight={open} onPick={setOpen} height={560} />
              </div>
            </section>
          )}

          {tab === "network" && <Network ranked={ranked} onOpen={setOpen} />}
          {tab === "compare" && <Compare ids={cmp} ranked={ranked} onRemove={toggleCmp} onOpen={setOpen} onAdd={() => setTab("rank")} />}
          {tab === "earth" && <EarthView onOpen={setOpen} />}
          {tab === "ask" && <Analyst scenario={scenarioCtx} ranked={ranked} seed={askSeed} onSeedUsed={() => setAskSeed(null)} onOpen={setOpen} />}
        </main>
      </div>

      <nav className={s.bottomTabs} aria-label="Dashboard sections">
        {TABS.map((k) => (
          <button
            key={k}
            className={tab === k ? s.btOn : ""}
            onClick={() => {
              setTab(k);
              setMenu(false);
              window.scrollTo({ top: 0 });
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              {TAB_ICON[k]}
            </svg>
            <span>{k === "compare" && cmp.length ? `Compare ${cmp.length}` : k === "ask" ? "Ask AI" : k[0].toUpperCase() + k.slice(1)}</span>
          </button>
        ))}
      </nav>

      {open && (
        <Drawer id={open} onClose={() => setOpen(null)} onOpen={setOpen} inCompare={cmp.includes(open)} onCompare={() => toggleCmp(open)} target={{ o2, psi }} />
      )}
      {cmp.length > 0 && tab !== "compare" && (
        <button className={s.cmpDock} onClick={() => setTab("compare")}>
          {cmp.map((id) => (
            <span key={id} className="chip">
              {label(byId[id])}
            </span>
          ))}
          <b>Compare →</b>
        </button>
      )}
      {toast && <div className={s.toast}>{toast}</div>}
    </div>
  );
}

function Stack({ r }: { r: Ranked }) {
  return (
    <span className={s.stack} title={PARTS.map((p) => `${p.l}: ${Math.round(r.parts[p.k] * 100)}%`).join("\n")}>
      {PARTS.map((p) => (
        <span key={p.k} style={{ width: `${(r.parts[p.k] * p.w).toFixed(2)}%`, backgroundColor: p.c }} />
      ))}
    </span>
  );
}

function Stat({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return (
    <div className={s.stat}>
      <span className="eyebrow">{k}</span>
      <span className={`serif num ${hot ? "hot" : ""}`}>{v}</span>
    </div>
  );
}

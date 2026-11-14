"use client";

import { useMemo, useState } from "react";
import { investigations, byId, label, PHASE_COLOR, PHASE_LABEL, type Investigation, type Phase } from "@/lib/data";
import type { Ranked } from "@/lib/score";
import s from "./Network.module.css";

const FAMILIES = [
  { id: "acme", name: "CIR · ACME gas-flame hardware", match: (i: Investigation) => i.rack.includes("ACME") },
  { id: "mdca", name: "CIR · MDCA droplet hardware", match: (i: Investigation) => i.rack.includes("MDCA") },
  { id: "msg", name: "MSG · fan-driven flow duct", match: (i: Investigation) => i.rack.startsWith("MSG") },
  { id: "cygnus", name: "Cygnus · large-scale fires", match: (i: Investigation) => i.rack.includes("Cygnus") },
  { id: "cabin", name: "ISS cabin · aerosol", match: (i: Investigation) => i.rack.includes("cabin") },
  { id: "ground", name: "Ground analysis & modeling", match: (i: Investigation) => i.type === "ground" },
];

const W = 1000, H = 640;

function family(i: Investigation) {
  return (FAMILIES.find((f) => f.id !== "ground" && f.match(i)) ?? FAMILIES[5]).id;
}

export default function Network({ ranked, onOpen }: { ranked: Ranked[]; onOpen: (id: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const top = useMemo(() => new Set(ranked.slice(0, 5).map((r) => r.inv.id)), [ranked]);

  const { nodes, links, hulls } = useMemo(() => {
    const centers: Record<string, [number, number]> = {
      acme: [230, 185], mdca: [790, 185], msg: [470, 245], cygnus: [190, 480], cabin: [830, 470], ground: [530, 515],
    };
    const nodes = investigations.map((inv, k) => {
      const f = family(inv);
      const [cx, cy] = centers[f];
      const a = k * 2.399; // golden-angle scatter, deterministic
      return { id: inv.id, inv, f, x: cx + Math.cos(a) * 40, y: cy + Math.sin(a) * 40, vx: 0, vy: 0, r: 7 + Math.sqrt(inv.runs + inv.conditions * 0.5) * 0.55 };
    });
    const idx = Object.fromEntries(nodes.map((n, i) => [n.id, i]));
    const seen = new Set<string>();
    const links: [number, number][] = [];
    for (const n of nodes)
      for (const r of n.inv.related) {
        if (idx[r] == null) continue;
        const key = [n.id, r].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        links.push([idx[n.id], idx[r]]);
      }
    // small force simulation: cluster gravity + link springs + collision
    for (let it = 0; it < 260; it++) {
      for (const n of nodes) {
        const [cx, cy] = centers[n.f];
        n.vx += (cx - n.x) * 0.03;
        n.vy += (cy - n.y) * 0.03;
      }
      for (const [a, b] of links) {
        const A = nodes[a], B = nodes[b];
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
        const k = (d - 120) * 0.002;
        A.vx += dx / d * k * d * 0.008; A.vy += dy / d * k * d * 0.008;
        B.vx -= dx / d * k * d * 0.008; B.vy -= dy / d * k * d * 0.008;
      }
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const A = nodes[i], B = nodes[j];
          const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.01;
          const min = A.r + B.r + 34;
          if (d < min) {
            const push = (min - d) * 0.25;
            A.vx -= (dx / d) * push; A.vy -= (dy / d) * push;
            B.vx += (dx / d) * push; B.vy += (dy / d) * push;
          }
        }
      for (const n of nodes) {
        n.vx *= 0.6; n.vy *= 0.6;
        n.x = Math.max(40, Math.min(W - 40, n.x + n.vx));
        n.y = Math.max(40, Math.min(H - 30, n.y + n.vy));
      }
    }
    const hulls = FAMILIES.map((f) => {
      const ms = nodes.filter((n) => n.f === f.id);
      if (!ms.length) return null;
      const cx = ms.reduce((a, n) => a + n.x, 0) / ms.length;
      const cy = ms.reduce((a, n) => a + n.y, 0) / ms.length;
      const r = Math.max(...ms.map((n) => Math.hypot(n.x - cx, n.y - cy) + n.r)) + 26;
      return { ...f, cx, cy, r };
    }).filter(Boolean) as ((typeof FAMILIES)[number] & { cx: number; cy: number; r: number })[];
    return { nodes, links, hulls };
  }, []);

  const neigh = useMemo(() => {
    if (!hover) return null;
    const set = new Set([hover]);
    for (const [a, b] of links) {
      if (nodes[a].id === hover) set.add(nodes[b].id);
      if (nodes[b].id === hover) set.add(nodes[a].id);
    }
    const f = nodes.find((n) => n.id === hover)!.f;
    nodes.filter((n) => n.f === f).forEach((n) => set.add(n.id));
    return set;
  }, [hover, links, nodes]);

  const hn = hover ? nodes.find((n) => n.id === hover)! : null;

  return (
    <section>
      <div className={s.head}>
        <h2 className="serif">How the investigations connect</h2>
        <div className={s.legend}>
          {(Object.keys(PHASE_LABEL) as Phase[]).map((p) => (
            <span key={p} className="chip">
              <span className="dot" style={{ background: PHASE_COLOR[p] }} />
              {PHASE_LABEL[p]}
            </span>
          ))}
          <span className="chip">
            <span className="dot" style={{ boxShadow: "0 0 0 2px var(--ember)" }} /> top 5 for your scenario
          </span>
        </div>
      </div>
      <div className={`${s.stage} marks`}>
        <svg viewBox={`0 0 ${W} ${H}`} className={s.svg}>
          {hulls.map((h) => (
            <g key={h.id} className={neigh && hn?.f !== h.id ? s.dim : ""}>
              <circle cx={h.cx} cy={h.cy} r={h.r} className={s.hull} />
              <text x={h.cx} y={h.cy - h.r - 8} textAnchor="middle" className={s.hullText}>
                {h.name}
              </text>
            </g>
          ))}
          {links.map(([a, b], i) => {
            const A = nodes[a], B = nodes[b];
            const on = hover && (A.id === hover || B.id === hover);
            return (
              <path
                key={i}
                d={`M${A.x.toFixed(1)} ${A.y.toFixed(1)} Q${((A.x + B.x) / 2).toFixed(1)} ${((A.y + B.y) / 2 - 30).toFixed(1)} ${B.x.toFixed(1)} ${B.y.toFixed(1)}`}
                className={`${s.link} ${on ? s.linkOn : ""} ${hover && !on ? s.dim : ""}`}
              />
            );
          })}
          {nodes.map((n) => {
            const dim = neigh && !neigh.has(n.id);
            return (
              <g
                key={n.id}
                transform={`translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`}
                className={`${s.node} ${dim ? s.dim : ""}`}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
                onClick={() => onOpen(n.id)}
              >
                {top.has(n.id) && <circle r={n.r + 5} className={s.topRing} />}
                <circle r={n.r} fill={PHASE_COLOR[n.inv.phase]} className={s.dotC} />
                <text y={n.r + 14} textAnchor="middle" className={s.nodeText}>
                  {label(n.inv)}
                </text>
              </g>
            );
          })}
        </svg>
        {hn && (
          <div
            className={s.tip}
            style={{
              left: `${(hn.x / W) * 100}%`,
              top: `${(hn.y / H) * 100}%`,
              transform: hn.x > W * 0.62 ? "translate(calc(-100% - 18px), -50%)" : undefined,
            }}
          >
            <div className="eyebrow">
              {hn.inv.id} · {hn.inv.rack}
            </div>
            <div className="serif">{label(hn.inv)}</div>
            <p>{hn.inv.short}</p>
            <span className="mono">
              {hn.inv.runs} runs
              {hn.inv.related.length ? ` · linked to ${hn.inv.related.filter((r) => byId[r]).map((r) => label(byId[r])).join(", ")}` : ""}
            </span>
          </div>
        )}
      </div>
      <p className={s.foot}>Clusters = shared flight hardware. Lines = related investigations named by PSI. Size = number of tabulated tests. Click any node.</p>
    </section>
  );
}

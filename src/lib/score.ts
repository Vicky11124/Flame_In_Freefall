import { investigations, runs, byId, type Investigation, type Phase, type Run } from "./data";
import { toAtm, type Weights } from "./scenarios";

export interface Target {
  o2: number; // %
  psi: number;
  flow: number;
  focus: Phase[];
  weights: Weights;
}

export interface Ranked {
  inv: Investigation;
  total: number; // 0..100
  parts: { conditions: number; relevance: number; mission: number; evidence: number }; // each 0..1
  nearest: Run | null;
  nearestGap: { dO2: number; pRatio: number } | null;
  why: string[];
}

/** Normalised distance between a test condition and the target atmosphere. */
export function conditionDistance(r: { o2?: number; p?: number }, o2: number, pAtm: number) {
  if (r.o2 == null) return 3;
  const dO2 = (r.o2 - o2) / 8; // 8 percentage points of O2 = 1 unit
  const dP = r.p == null ? 0.8 : Math.log(r.p / pAtm) / Math.log(1.6); // a 1.6x pressure ratio = 1 unit
  return Math.sqrt(dO2 * dO2 + dP * dP);
}

const WEIGHT = { conditions: 0.35, relevance: 0.2, mission: 0.25, evidence: 0.2 };

const runsByInv: Record<string, Run[]> = {};
for (const r of runs) (runsByInv[r.inv] ??= []).push(r);

export function rank(t: Target): Ranked[] {
  const pAtm = toAtm(t.psi);
  const wSum = t.weights.prevention + t.weights.detection + t.weights.suppression + t.weights.modeling || 1;

  const first = investigations.map((inv) => {
    const mine = runsByInv[inv.id] ?? [];
    let nearest: Run | null = null;
    let best = Infinity;
    const ds: number[] = [];
    for (const r of mine) {
      const d = conditionDistance(r, t.o2, pAtm);
      ds.push(d);
      if (d < best) {
        best = d;
        nearest = r;
      }
    }
    ds.sort((a, b) => a - b);
    const top = ds.slice(0, 5);
    const conditions = top.length ? top.reduce((s, d) => s + Math.exp(-d), 0) / top.length : 0;

    const relevance = t.focus.includes(inv.phase) ? 1 - t.focus.indexOf(inv.phase) * 0.15 : 0.25;
    const mission = inv.themes.reduce((s, th) => s + t.weights[th], 0) / wSum;
    const volume = Math.min(1, Math.log10((inv.runs + inv.conditions * 0.5) + 1) / Math.log10(400));
    const evidence = (inv.type === "flight" ? 0.55 : 0.3) + 0.45 * volume;
    return { inv, nearest, best, conditions, relevance, mission: Math.min(1, mission * 1.6), evidence };
  });

  // Ground studies inherit (discounted) condition coverage from the flight data they analyse.
  for (const f of first) {
    if (f.conditions === 0 && f.inv.related.length) {
      const rel = first.filter((o) => f.inv.related.includes(o.inv.id));
      if (rel.length) f.conditions = 0.6 * Math.max(...rel.map((o) => o.conditions));
    }
  }

  return first
    .map((f) => {
      const parts = { conditions: f.conditions, relevance: f.relevance, mission: f.mission, evidence: f.evidence };
      const total =
        100 *
        (WEIGHT.conditions * parts.conditions +
          WEIGHT.relevance * parts.relevance +
          WEIGHT.mission * parts.mission +
          WEIGHT.evidence * parts.evidence);
      const n = f.nearest;
      const why: string[] = [];
      if (n && n.o2 != null) {
        const dO2 = n.o2 - t.o2;
        why.push(
          `Closest test: ${n.o2.toFixed(1)}% O2${n.p ? ` at ${(n.p * 14.696).toFixed(1)} psi` : ""}` +
            ` (${dO2 >= 0 ? "+" : ""}${dO2.toFixed(1)} pts O2 vs target)`
        );
      } else if (f.inv.type === "ground") {
        why.push("Ground analysis of flight data" + (f.inv.related.length ? ` (${f.inv.related.map((r) => byId[r]?.acronym ?? r).join(", ")})` : ""));
      } else {
        why.push("Test conditions not tabulated in PSI");
      }
      if (t.focus.includes(f.inv.phase)) why.push(`Matches material focus: ${f.inv.phase}`);
      return {
        inv: f.inv,
        total,
        parts,
        nearest: n,
        nearestGap: n && n.o2 != null ? { dO2: n.o2 - t.o2, pRatio: n.p ? n.p / pAtm : NaN } : null,
        why,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** How well the whole PSI archive covers a target atmosphere, by fuel phase. */
export function coverage(o2: number, psi: number) {
  const pAtm = toAtm(psi);
  const phases: Phase[] = ["solid", "liquid", "gas", "aerosol"];
  return phases.map((phase) => {
    const rs = runs.filter((r) => r.phase === phase && r.o2 != null && !r.assumed?.includes("o2"));
    let best: Run | null = null;
    let bd = Infinity;
    let near = 0;
    for (const r of rs) {
      const d = conditionDistance(r, o2, pAtm);
      if (d < bd) {
        bd = d;
        best = r;
      }
      if (d < 0.75) near++;
    }
    const maxO2 = rs.length ? Math.max(...rs.map((r) => r.o2!)) : null;
    return { phase, near, total: rs.length, best, distance: bd, maxO2 };
  });
}

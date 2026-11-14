/**
 * Flame Lab burn model - a TEACHING model, not a certified flammability test.
 *
 * Idea: a material keeps burning when the oxygen available beats its effective oxygen limit.
 *   effective limit = LOI (limiting oxygen index, published 1-g value)
 *                   + flow term   (no flow in orbit -> oxygen starvation; very high flow -> blow-off)
 *                   + direction   (concurrent flow preheats fuel ahead of the flame -> easier)
 *                   + pressure    (lower total pressure -> slightly harder at the same O2 %)
 *                   + material quirks (e.g. silicone's silica ash shields it in microgravity)
 * Gravity enters through buoyancy: on Earth, hot gas rises and drags in ~30 cm/s of fresh air,
 * so the flame "feels" an effective flow even in still air. In orbit that flow is gone.
 *
 * Calibration: Saffire-II measured SIBAL (cotton-fiberglass) spreading at 2.1-2.6 mm/s,
 * concurrent, 20 cm/s, ~21.5% O2, microgravity [PSI-99]. Trends from BASS / BASS-II [PSI-26, PSI-25].
 */

export interface Material {
  id: string;
  name: string;
  short: string;
  loi: number; // limiting oxygen index, % (1 g, literature)
  v0: number; // spread-rate scale, mm/s
  soot: number; // 0..1 how yellow/sooty its flame gets
  ugPenalty: number; // extra O2 % needed in microgravity (material-specific)
  color: string; // swatch
  weave: "fabric" | "film" | "slab" | "rubber" | "paper";
  where: string;
  psi: string[]; // closest PSI evidence
  note: string;
}

export const MATERIALS: Material[] = [
  {
    id: "sibal", name: "Cotton-fiberglass", short: "SIBAL", loi: 19, v0: 8.1, soot: 0.55, ugPenalty: 0,
    color: "#d9cdb4", weave: "fabric", where: "Saffire & BASS standard sample",
    psi: ["PSI-98", "PSI-99", "PSI-100", "PSI-26"],
    note: "NASA's reference fabric: 75% cotton, 25% fiberglass. Burned 29 cm at 2.1-2.6 mm/s in Saffire-II.",
  },
  {
    id: "cotton", name: "Cotton fabric", short: "Cotton", loi: 18.4, v0: 9, soot: 0.5, ugPenalty: 0,
    color: "#ece4d2", weave: "fabric", where: "Crew clothing, towels",
    psi: ["PSI-26", "PSI-98"],
    note: "Everyday clothing. Burns readily in air; one of the most common fuels in a habitat.",
  },
  {
    id: "nomex", name: "Nomex", short: "Nomex", loi: 28.5, v0: 4, soot: 0.75, ugPenalty: 0,
    color: "#c9b27a", weave: "fabric", where: "Flight suits, cargo bags",
    psi: ["PSI-25", "PSI-26", "PSI-99"],
    note: "Flame-resistant aramid. Self-extinguishes in normal air - but its oxygen limit sits right in the 30-34% range planned for lunar habitats.",
  },
  {
    id: "pmma-film", name: "PMMA film", short: "PMMA thin", loi: 17.4, v0: 6.5, soot: 0.8, ugPenalty: 0,
    color: "#bfe3ff", weave: "film", where: "Acrylic windows, covers (thin)",
    psi: ["PSI-25", "PSI-26", "PSI-99"],
    note: "Thin acrylic. The workhorse fuel of BASS-II, which burned it while bleeding oxygen down to find extinction.",
  },
  {
    id: "pmma-slab", name: "PMMA slab", short: "PMMA thick", loi: 17.4, v0: 1.2, soot: 0.85, ugPenalty: 0.5,
    color: "#9fd0f5", weave: "slab", where: "Thick acrylic parts",
    psi: ["PSI-25", "PSI-26"],
    note: "Thick fuel: slow to heat, so it spreads slowly - but once going it bubbles and spurts melt (seen in BASS-II rods).",
  },
  {
    id: "silicone", name: "Silicone rubber", short: "Silicone", loi: 22, v0: 3, soot: 0.25, ugPenalty: 2.2,
    color: "#e8a49a", weave: "rubber", where: "Seals, gaskets, tubing",
    psi: ["PSI-99"],
    note: "Saffire-II: thin silicone burned completely in the 1-g test but did not spread in microgravity at 20 cm/s. Its silica ash shields the surface.",
  },
  {
    id: "paper", name: "Paper tissue", short: "Paper", loi: 18, v0: 14, soot: 0.35, ugPenalty: 0,
    color: "#f4f1ea", weave: "paper", where: "Wipes, labels, notebooks",
    psi: [],
    note: "Very thin cellulose: fast spread. Not tabulated in PSI - shown for comparison.",
  },
  {
    id: "ultem", name: "Ultem (PEI)", short: "Ultem", loi: 47, v0: 2.5, soot: 0.9, ugPenalty: 0,
    color: "#d89a3c", weave: "slab", where: "Aerospace panels, connectors",
    psi: ["PSI-26"],
    note: "High-performance plastic chosen because it is hard to burn. Flown as a sample in BASS.",
  },
];

export interface BurnInput {
  material: Material;
  o2: number; // %
  psi: number;
  flow: number; // cm/s forced flow
  direction: "concurrent" | "opposed";
  gravity: number; // g
}

export interface BurnResult {
  burns: boolean;
  margin: number; // O2 % above effective limit
  limit: number; // effective O2 limit %
  spread: number; // mm/s (initial)
  effFlow: number; // cm/s felt by the flame
  buoyant: number; // cm/s from buoyancy
  flameLen: number; // cm
  tempK: number;
  sootiness: number; // 0..1
  verdict: "No sustained flame" | "Near-limit flame" | "Burns" | "Burns vigorously";
  reason: string;
}

export const buoyantFlow = (g: number) => (g <= 0 ? 0 : 30 * Math.cbrt(g));

function flowTerm(u: number) {
  // starvation at very low flow, a sweet spot around 5-20 cm/s, heat-loss/blow-off at high flow
  return 4.6 * Math.exp(-u / 2.5) - 1.0 * Math.exp(-(((u - 10) / 9) ** 2)) + 0.045 * Math.max(0, u - 35);
}

export function evaluate(i: BurnInput): BurnResult {
  const ub = buoyantFlow(i.gravity);
  const u = Math.sqrt(i.flow * i.flow + ub * ub);
  const pAtm = i.psi / 14.696;
  const dir = i.direction === "concurrent" ? -1.5 : 0;
  const ugQuirk = i.material.ugPenalty * Math.max(0, 1 - i.gravity * 3);
  const limit = i.material.loi + flowTerm(u) + dir + 2.5 * (1 - pAtm) + ugQuirk;
  const margin = i.o2 - limit;
  const burns = margin > 0;
  const ratio = Math.max(0, i.o2 / limit - 1);
  const dirF = i.direction === "concurrent" ? 1 : 0.35;
  const spread = burns ? i.material.v0 * Math.pow(ratio, 0.9) * dirF * Math.sqrt(Math.max(u, 1) / 20) * Math.pow(pAtm, 0.3) : 0;
  const flameLen = burns
    ? (i.direction === "concurrent" ? 2.6 : 1.1) * Math.pow(Math.max(u, 2) / 20, 0.35) * Math.pow(i.o2 / 21, 1.6) * (0.6 + Math.min(1, margin / 6))
    : 0.5;
  const tempK = Math.round(Math.min(2900, 1150 + 1050 * Math.pow(i.o2 / 21, 0.45) * (burns ? 1 : 0.7) - (u < 3 ? 250 : 0)));
  const sootiness = Math.min(1, i.material.soot * Math.sqrt(Math.min(1, i.gravity + 0.08)) * Math.pow(i.o2 / 21, 0.8));

  let verdict: BurnResult["verdict"] = "No sustained flame";
  if (burns) verdict = margin < 1.2 ? "Near-limit flame" : margin > 7 ? "Burns vigorously" : "Burns";

  let reason: string;
  if (!burns) {
    if (u < 2.5) reason = "Oxygen starvation: with no gravity and no fan, nothing carries fresh oxygen to the flame.";
    else if (u > 45 && flowTerm(u) > 0.5) reason = "Blow-off: the flow strips heat away faster than the flame makes it.";
    else reason = `Below its oxygen limit: needs about ${limit.toFixed(1)}% O2 here, has ${i.o2}%.`;
  } else if (verdict === "Near-limit flame") {
    reason = "Just above its oxygen limit: a dim, fragile flame. A small change in flow or O2 will kill it.";
  } else if (i.gravity === 0 && i.flow <= 25 && i.flow >= 5) {
    reason = "Gentle flow in microgravity is the sweet spot: fresh oxygen arrives, but little heat is carried away.";
  } else if (i.o2 >= 28) {
    reason = "Enriched oxygen: the flame runs hotter and spreads faster than in Earth air.";
  } else {
    reason = `Clears its oxygen limit by ${margin.toFixed(1)} points.`;
  }

  return { burns, margin, limit, spread, effFlow: u, buoyant: ub, flameLen, tempK, sootiness, verdict, reason };
}

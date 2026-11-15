// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
import investigationsJson from "@/data/investigations.json";
import runsJson from "@/data/runs.json";
import insightsJson from "@/data/insights.json";
import imagesJson from "@/data/images.json";

export type Phase = "gas" | "liquid" | "solid" | "aerosol";
export type Theme = "prevention" | "detection" | "suppression" | "modeling";

export interface Investigation {
  id: string;
  acronym: string | null;
  title: string;
  sub: string;
  type: "flight" | "ground";
  platform: string | null;
  hardware: string | null;
  center: string | null;
  start: string | null;
  end: string | null;
  doi: string | null;
  sizeGB: number;
  objective: string;
  approach: string;
  hypothesis: string;
  impacts: string;
  contacts: string[];
  publications: { title: string; doi: string; authors: string }[];
  related: string[];
  runs: number;
  conditions: number;
  fuels: string[];
  envelope: { o2: [number, number] | null; p: [number, number] | null; flow: [number, number] | null };
  varied: string[];
  held: string[];
  outcomes: Record<string, number>;
  envNote: string | null;
  phase: Phase;
  themes: Theme[];
  rack: string;
  sensors: string[];
  short: string;
  earth: string;
}

export interface Run {
  inv: string;
  fuel?: string;
  phase: Phase;
  o2?: number;
  p?: number;
  flow?: number;
  dil?: string;
  outcome?: string;
  burn?: number;
  d0?: number;
  assumed?: string[];
  kind: "run" | "condition";
  flame?: string;
  [extra: string]: unknown;
}

export interface Insight {
  inv: string;
  text: string;
  stat: string;
}

export const investigations = investigationsJson as unknown as Investigation[];
export const runs = runsJson as unknown as Run[];
export const insights = insightsJson as Insight[];
export const images = imagesJson as Record<string, { src: string; caption: string }[]>;

export const byId: Record<string, Investigation> = Object.fromEntries(investigations.map((i) => [i.id, i]));

export const label = (i: Investigation) => i.acronym ?? i.id;

export const PHASE_COLOR: Record<Phase, string> = {
  solid: "var(--c-solid)",
  liquid: "var(--c-liquid)",
  gas: "var(--c-gas)",
  aerosol: "var(--c-aerosol)",
};

export const PHASE_LABEL: Record<Phase, string> = {
  solid: "Solid materials",
  liquid: "Liquid droplets",
  gas: "Gaseous flames",
  aerosol: "Smoke & aerosol",
};

export const THEME_LABEL: Record<Theme, string> = {
  prevention: "Prevention",
  detection: "Detection",
  suppression: "Suppression",
  modeling: "Modeling",
};

/* Headline numbers, computed once from the shipped data */
const solidO2 = runs.filter((r) => r.phase === "solid" && r.o2 && !r.assumed?.includes("o2")).map((r) => r.o2!);
export const STATS = {
  investigations: investigations.length,
  flight: investigations.filter((i) => i.type === "flight").length,
  runs: runs.filter((r) => r.kind === "run").length,
  conditions: runs.filter((r) => r.kind === "condition").length,
  tables: 21,
  terabytes: Math.round(investigations.reduce((s, i) => s + i.sizeGB, 0) / 100) / 10,
  maxSolidO2: Math.max(...solidO2),
  maxO2: Math.max(...runs.filter((r) => r.o2).map((r) => r.o2!)),
};

// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
import type { Phase, Theme } from "./data";

export const PSI_PER_ATM = 14.696;

export interface Scenario {
  id: string;
  name: string;
  where: string;
  o2: number; // %
  psi: number;
  flow: number; // cm/s ventilation
  gravity: number; // in Earth g
  focus: Phase[];
  note: string;
}

/**
 * Atmospheres from the challenge brief and NASA's published exploration-atmosphere work.
 * Moon base: "30% or greater, with a corresponding pressure of 10.2 psi or less" (challenge brief).
 */
export const SCENARIOS: Scenario[] = [
  {
    id: "iss",
    name: "ISS / spacecraft cabin",
    where: "Low Earth orbit",
    o2: 21,
    psi: 14.7,
    flow: 8,
    gravity: 0,
    focus: ["solid", "aerosol", "liquid"],
    note: "Sea-level air, microgravity, forced ventilation. Most PSI flight data was taken here.",
  },
  {
    id: "lunar",
    name: "Lunar surface habitat",
    where: "Moon base",
    o2: 30,
    psi: 10.2,
    flow: 5,
    gravity: 0.165,
    focus: ["solid", "aerosol"],
    note: "Challenge brief: O2 of 30% or more at 10.2 psi or less, to shorten spacesuit pre-breathe.",
  },
  {
    id: "rover",
    name: "Pressurized rover",
    where: "Lunar surface",
    o2: 34,
    psi: 8.2,
    flow: 3,
    gravity: 0.165,
    focus: ["solid", "aerosol", "liquid"],
    note: "Exploration atmosphere (8.2 psi, 34% O2): small cabin, frequent suit swaps, little room to escape a fire.",
  },
  {
    id: "mars",
    name: "Mars transit & habitat",
    where: "Deep space / Mars",
    o2: 26.5,
    psi: 10.2,
    flow: 5,
    gravity: 0.38,
    focus: ["solid", "liquid", "aerosol"],
    note: "Mid-range enriched atmosphere (as used before Shuttle spacewalks). Months from any rescue.",
  },
  {
    id: "suit",
    name: "Spacesuit / airlock",
    where: "EVA prep",
    o2: 100,
    psi: 4.3,
    flow: 2,
    gravity: 0.165,
    focus: ["solid"],
    note: "Pure oxygen at 4.3 psi. Apollo 1 burned in pure O2 above sea-level pressure.",
  },
];

export interface Weights {
  prevention: number;
  detection: number;
  suppression: number;
  modeling: number;
}

export const DEFAULT_WEIGHTS: Weights = { prevention: 3, detection: 2, suppression: 2, modeling: 1 };

export type ThemeKey = Theme;

export const toAtm = (psi: number) => psi / PSI_PER_ATM;

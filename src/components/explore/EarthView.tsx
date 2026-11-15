// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
"use client";

import { useState } from "react";
import { investigations, byId, label, PHASE_COLOR, THEME_LABEL, type Theme } from "@/lib/data";
import s from "./EarthView.module.css";

const SPINOFFS = [
  {
    icon: "mist",
    title: "Fine-water-mist extinguishers",
    text: "Developed for the ISS, where water must work without gravity. Now used in homes, ships and server rooms because mist cools and smothers fire with far less water.",
    psi: ["PSI-69", "PSI-68"],
  },
  {
    icon: "detector",
    title: "Smoke detectors that ignore dust",
    text: "A shuttle-era detector that tells smoke from dust cut nuisance alarms. SAME and DAFT measured both in orbit. The idea now helps mines and factories.",
    psi: ["PSI-102", "PSI-47", "PSI-115"],
  },
  {
    icon: "fabric",
    title: "Smarter material fire tests",
    text: "BASS and Saffire showed where 1-g screening over- or under-predicts flammability. Their data validates fire-spread models used for buildings, ships and aircraft cabins.",
    psi: ["PSI-26", "PSI-25", "PSI-99", "PSI-62"],
  },
  {
    icon: "tank",
    title: "Firefighter air tanks & gear",
    text: "Spacesuit engineering led to lighter breathing tanks and better protective clothing for firefighters - a spinoff of crewed-spaceflight safety work.",
    psi: [],
  },
];

function Icon({ k }: { k: string }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round" as const };
  return (
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
      {k === "mist" && (
        <g {...p}>
          <path d="M12 8h10v6H12zM22 11h6" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx={28 + (i % 3) * 3} cy={16 + Math.floor(i / 3) * 4 + (i % 2)} r="0.8" />
          ))}
          <path d="M15 14v18h4V14" />
        </g>
      )}
      {k === "detector" && (
        <g {...p}>
          <circle cx="20" cy="14" r="9" />
          <circle cx="20" cy="14" r="3" />
          <path d="M8 30c4-2 8 2 12 0s8 2 12 0M8 35c4-2 8 2 12 0s8 2 12 0" />
        </g>
      )}
      {k === "fabric" && (
        <g {...p}>
          <path d="M8 10h24v20H8z" />
          <path d="M8 16h24M8 22h24M14 10v20M20 10v20M26 10v20" opacity="0.5" />
          <path d="M24 30c0-4 3-5 3-9 2 2 3 4 3 6a3 3 0 0 1-6 3z" />
        </g>
      )}
      {k === "tank" && (
        <g {...p}>
          <rect x="14" y="10" width="12" height="24" rx="6" />
          <path d="M18 10V6h4v4M14 18h12" />
        </g>
      )}
    </svg>
  );
}

export default function EarthView({ onOpen }: { onOpen: (id: string) => void }) {
  const [theme, setTheme] = useState<Theme | "all">("all");
  const list = investigations.filter((i) => theme === "all" || i.themes.includes(theme));
  return (
    <section>
      <div className={s.head}>
        <h2 className="serif">Back on Earth</h2>
        <p>Space fire research keeps paying off at home.</p>
      </div>
      <div className={s.spin}>
        {SPINOFFS.map((x) => (
          <article key={x.title} className={s.card}>
            <span className={s.icon}>
              <Icon k={x.icon} />
            </span>
            <h3 className="serif">{x.title}</h3>
            <p>{x.text}</p>
            <div className={s.links}>
              {x.psi.length ? (
                x.psi.map((id) => (
                  <button key={id} className="chip" onClick={() => onOpen(id)}>
                    {label(byId[id])} →
                  </button>
                ))
              ) : (
                <span className="chip">NASA Spinoff</span>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className={s.filter}>
        {(["all", "prevention", "detection", "suppression", "modeling"] as const).map((t) => (
          <button key={t} className={theme === t ? s.on : ""} onClick={() => setTheme(t)}>
            {t === "all" ? "All" : THEME_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={s.grid}>
        {list.map((i) => (
          <button key={i.id} className={s.tile} onClick={() => onOpen(i.id)}>
            <span className={s.tileTop}>
              <span className="dot" style={{ background: PHASE_COLOR[i.phase] }} />
              <b>{label(i)}</b>
            </span>
            <span className={s.tileText}>{i.earth}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

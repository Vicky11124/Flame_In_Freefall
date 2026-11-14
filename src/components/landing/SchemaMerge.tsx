"use client";

import { useEffect, useRef, useState } from "react";
import s from "./SchemaMerge.module.css";

/* Real column headers copied from the 21 PSI experimental tables. */
const GROUPS = [
  {
    key: "o2",
    unit: "% O2",
    raw: [
      "Percent O2",
      "XO2 (init)",
      "O initial ambient composition; mole fraction",
      "Oxygen Conc (percent)",
      "Calibrated  initial O2 % by vol",
      " XO2 before test",
      "Atmosphere: ~21% O2 with N2",
      "Oxygen Mole Fraction",
    ],
  },
  {
    key: "p",
    unit: "atm",
    raw: ["Ambient pressure; mmHg", "approx p (bar)", "pmean (atm)", "Pressure  \"1 atm\"", "Ambient Pressure (atm)"],
  },
  {
    key: "flow",
    unit: "cm/s",
    raw: ["Air Rate (cm/s)", "Air display", "Air Flow (cm/s)", "Flow Velocity (cm/s)", "Air Flow \"30 cm/s\""],
  },
  {
    key: "outcome",
    unit: "state",
    raw: ["Test end", "Hot ignition", "Self-ext or flow term", "Flames Ignited", "µ-g Burn Length"],
  },
];

export default function SchemaMerge() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { threshold: 0.35 });
    io.observe(ref.current!);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${s.merge} ${on ? s.on : ""}`}>
      {GROUPS.map((g, gi) => (
        <div key={g.key} className={s.row}>
          <div className={s.raw}>
            {g.raw.map((r, i) => (
              <span key={r} className={s.rawItem} style={{ transitionDelay: `${gi * 180 + i * 70}ms` }}>
                {r}
              </span>
            ))}
          </div>
          <div className={s.arrow} style={{ transitionDelay: `${gi * 180 + 500}ms` }}>
            <svg viewBox="0 0 80 12" preserveAspectRatio="none">
              <path d="M0 6 H74 M68 1 L76 6 L68 11" />
            </svg>
          </div>
          <div className={s.clean} style={{ transitionDelay: `${gi * 180 + 700}ms` }}>
            <span className="mono">{g.key}</span>
            <span className={s.unit}>{g.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

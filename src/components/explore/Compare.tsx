// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
"use client";

import { byId, label, PHASE_COLOR, THEME_LABEL, type Investigation } from "@/lib/data";
import type { Ranked } from "@/lib/score";
import s from "./Compare.module.css";

const range = (r: [number, number] | null, k = 1, unit = "", dp = 1) =>
  r ? (r[0] === r[1] ? `${(r[0] * k).toFixed(dp)}${unit}` : `${(r[0] * k).toFixed(dp)}-${(r[1] * k).toFixed(dp)}${unit}`) : "-";

const ROWS: { k: string; f: (i: Investigation) => React.ReactNode; t?: (i: Investigation) => string }[] = [
  { k: "Fuel phase", t: (i) => i.phase, f: (i) => <span className="chip"><span className="dot" style={{ background: PHASE_COLOR[i.phase] }} />{i.phase}</span> },
  { k: "Fire-safety role", f: (i) => i.themes.map((t) => THEME_LABEL[t]).join(", ") },
  { k: "Platform", f: (i) => (i.type === "flight" ? i.platform : "Ground analysis") },
  { k: "Hardware", f: (i) => i.rack },
  { k: "Oxygen", f: (i) => range(i.envelope.o2, 1, "%") },
  { k: "Pressure", f: (i) => range(i.envelope.p, 14.696, " psi") },
  { k: "Flow speed", f: (i) => range(i.envelope.flow, 1, " cm/s", 0) },
  { k: "Varied", f: (i) => i.varied.join(", ") || "-" },
  { k: "Held constant", f: (i) => i.held.join(", ") || "-" },
  { k: "Fuels / samples", f: (i) => (i.fuels.length ? `${i.fuels.slice(0, 5).join(", ")}${i.fuels.length > 5 ? ` +${i.fuels.length - 5}` : ""}` : "-") },
  { k: "Sensors", f: (i) => i.sensors.join(", ") },
  { k: "Outcomes logged", f: (i) => Object.entries(i.outcomes).map(([k, n]) => `${k} (${n})`).join(", ") || "-" },
  { k: "Records", f: (i) => `${i.runs} runs${i.conditions ? `, ${i.conditions} conditions` : ""}` },
  { k: "Years", f: (i) => `${i.start?.slice(-4) ?? "?"}-${i.end?.slice(-4) ?? "?"}` },
  { k: "Earth benefit", f: (i) => i.earth },
];

export default function Compare({
  ids,
  ranked,
  onRemove,
  onOpen,
  onAdd,
}: {
  ids: string[];
  ranked: Ranked[];
  onRemove: (id: string) => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  if (!ids.length) {
    return (
      <div className={s.empty}>
        <h2 className="serif">Nothing to compare yet.</h2>
        <p>Tick &quot;compare&quot; on up to three investigations in the ranking.</p>
        <div className={s.quick}>
          {ranked.slice(0, 3).map((r) => (
            <span key={r.inv.id} className="chip">{label(r.inv)}</span>
          ))}
        </div>
        <button className="btn btn-hot" onClick={onAdd}>
          Go to ranking
        </button>
      </div>
    );
  }
  const invs = ids.map((id) => byId[id]);
  const score = (id: string) => ranked.find((r) => r.inv.id === id)?.total ?? 0;

  // what they share vs where they differ
  const text = (r: (typeof ROWS)[number], i: Investigation) => (r.t ? r.t(i) : String(r.f(i) ?? ""));
  const same = ROWS.filter((r) => ["Fuel phase", "Hardware", "Platform"].includes(r.k)).filter(
    (r) => invs.length > 1 && invs.every((i) => text(r, i) === text(r, invs[0]))
  );

  return (
    <section>
      <div className={s.bar}>
        <h2 className="serif">Side by side</h2>
        {invs.length > 1 && (
          <p>
            {same.length
              ? `Shared: ${same.map((r) => `${r.k.toLowerCase()} (${text(r, invs[0])})`).join("; ")}. `
              : "These investigations differ in platform, hardware and fuel phase. "}
            Differences are shown in <span className="hot">orange</span>.
          </p>
        )}
      </div>
      <div className={s.scroll}>
        <table className={s.t}>
          <thead>
            <tr>
              <th />
              {invs.map((i) => (
                <th key={i.id}>
                  <button className={s.name} onClick={() => onOpen(i.id)}>
                    <span className="serif">{label(i)}</span>
                    <span className="mono">{i.id}</span>
                  </button>
                  <div className={s.sc}>
                    score <b className="num">{score(i.id).toFixed(0)}</b>
                    <button onClick={() => onRemove(i.id)} aria-label={`Remove ${label(i)}`}>
                      remove
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const vals = invs.map((i) => r.f(i));
              const differs = invs.length > 1 && new Set(invs.map((i) => text(r, i))).size > 1;
              return (
                <tr key={r.k}>
                  <th scope="row">{r.k}</th>
                  {vals.map((v, j) => (
                    <td key={j} className={differs ? s.diff : ""}>
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

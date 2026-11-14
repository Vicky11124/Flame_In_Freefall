import Link from "next/link";
import { MATERIALS, evaluate } from "@/lib/burn";
import s from "./LabTeaser.module.css";

const ENVS = [
  { l: "Earth air", sub: "21% · 14.7 psi · 1 g", o2: 21, psi: 14.7, g: 1, flow: 0 },
  { l: "ISS cabin", sub: "21% · 14.7 psi · 0 g", o2: 21, psi: 14.7, g: 0, flow: 8 },
  { l: "Moon base", sub: "30% · 10.2 psi · 0.17 g", o2: 30, psi: 10.2, g: 0.165, flow: 5 },
  { l: "Lunar rover", sub: "34% · 8.2 psi · 0.17 g", o2: 34, psi: 8.2, g: 0.165, flow: 3 },
];

const SHOW = ["sibal", "nomex", "pmma-film", "silicone", "ultem"];

export default function LabTeaser() {
  const mats = SHOW.map((id) => MATERIALS.find((m) => m.id === id)!);
  return (
    <div className={s.wrap}>
      <div className={s.table} role="table" aria-label="Predicted burning behaviour by material and habitat">
        <div className={s.head} role="row">
          <span role="columnheader">Material</span>
          {ENVS.map((e) => (
            <span key={e.l} role="columnheader">
              <b>{e.l}</b>
              <em>{e.sub}</em>
            </span>
          ))}
        </div>
        {mats.map((m) => (
          <div key={m.id} className={s.row} role="row">
            <span className={s.mat} role="cell">
              <i style={{ background: m.color }} />
              {m.name}
            </span>
            {ENVS.map((e) => {
              const r = evaluate({ material: m, o2: e.o2, psi: e.psi, flow: e.flow, direction: "concurrent", gravity: e.g });
              const cls = !r.burns ? s.no : r.verdict === "Near-limit flame" ? s.weak : r.verdict === "Burns vigorously" ? s.vig : s.yes;
              return (
                <span key={e.l} className={`${s.cell} ${cls}`} role="cell" title={r.reason} data-env={e.l}>
                  <span className={s.flame} />
                  {r.burns ? (r.verdict === "Near-limit flame" ? "barely" : `${r.spread.toFixed(1)} mm/s`) : "out"}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <Link href="/lab" className={`btn btn-hot ${s.cta}`}>
        Burn them yourself in the Flame Lab <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

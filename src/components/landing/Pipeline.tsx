import { STATS } from "@/lib/data";
import s from "./Pipeline.module.css";

const NODES = [
  { k: "Source", t: "NASA PSI API", d: `${STATS.investigations} investigations · ${STATS.terabytes} TB`, tone: "ug" },
  { k: "Ingest", t: "21 raw tables", d: "each with its own columns & units", tone: "ink" },
  { k: "Normalize", t: "One schema", d: `${STATS.runs.toLocaleString()} runs · assumptions flagged`, tone: "ember" },
  { k: "Rank", t: "Relevance engine", d: "4 visible factors per habitat", tone: "ember" },
  { k: "Explain", t: "Gemini analyst", d: "answers cite PSI IDs", tone: "flame" },
  { k: "Act", t: "You", d: "design, test, decide", tone: "flame" },
];

export default function Pipeline() {
  return (
    <ol className={s.pipe}>
      {NODES.map((n, i) => (
        <li key={n.k} className={`${s.node} ${s[n.tone]}`} style={{ animationDelay: `${i * 0.35}s` }}>
          <span className={s.k}>
            {String(i + 1).padStart(2, "0")} · {n.k}
          </span>
          <span className={`serif ${s.t}`}>{n.t}</span>
          <span className={s.d}>{n.d}</span>
          {i < NODES.length - 1 && <span className={s.wire} aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

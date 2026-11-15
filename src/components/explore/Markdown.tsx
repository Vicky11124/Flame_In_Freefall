// SI disclosure: written with Claude (Anthropic) under the author's direction; reviewed and tested by the author. See SI_DISCLOSURE.md.
"use client";

import { Fragment } from "react";
import { byId, label } from "@/lib/data";

/** Tiny markdown renderer for analyst answers: headings, bullets, bold/italic, [PSI-##] citations. */
export default function Markdown({ text, onCite }: { text: string; onCite: (id: string) => void }) {
  const inline = (s: string, k: string) => {
    const parts = s.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[PSI-\d+\](?:\s*,?\s*\[PSI-\d+\])*)/g);
    return parts.map((p, i) => {
      if (/^\*\*[^*]+\*\*$/.test(p)) return <b key={k + i}>{p.slice(2, -2)}</b>;
      if (/^\*[^*]+\*$/.test(p)) return <i key={k + i}>{p.slice(1, -1)}</i>;
      if (p.startsWith("[PSI-")) {
        const ids = p.match(/PSI-\d+/g) ?? [];
        return (
          <Fragment key={k + i}>
            {ids.map((id) => (
              <button key={id} className="cite" onClick={() => onCite(id)} title={byId[id]?.title ?? id}>
                {byId[id] ? label(byId[id]) : id}
              </button>
            ))}
          </Fragment>
        );
      }
      return <Fragment key={k + i}>{p}</Fragment>;
    });
  };

  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => {
    if (list.length) {
      out.push(
        <ul key={"u" + k}>
          {list.map((l, i) => (
            <li key={i}>{inline(l, `l${k}-${i}-`)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  lines.forEach((raw, i) => {
    const l = raw.trimEnd();
    if (/^\s*[-*•]\s+/.test(l)) {
      list.push(l.replace(/^\s*[-*•]\s+/, ""));
      return;
    }
    if (/^\s*\d+\.\s+/.test(l)) {
      list.push(l.replace(/^\s*\d+\.\s+/, ""));
      return;
    }
    flush(i);
    if (!l.trim()) return;
    if (/^---+$/.test(l.trim())) out.push(<hr key={i} />);
    else if (/^#{1,4}\s/.test(l)) out.push(<h4 key={i}>{inline(l.replace(/^#+\s/, ""), `h${i}-`)}</h4>);
    else out.push(<p key={i}>{inline(l, `p${i}-`)}</p>);
  });
  flush(lines.length);
  return <>{out}</>;
}

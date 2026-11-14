"use client";

import { useEffect, useRef, useState } from "react";
import type { Ranked } from "@/lib/score";
import Markdown from "./Markdown";
import s from "./Analyst.module.css";

interface Msg {
  role: "user" | "model";
  text: string;
}

export interface ScenarioCtx {
  name: string;
  o2: number;
  psi: number;
  flow: number;
  gravity: number;
  focus: string[];
}

const SUGGEST = [
  "What do we know about solid-material flammability above 30% oxygen?",
  "Which suppression results could inform an extinguisher for a lunar habitat?",
  "How should smoke detectors be designed for this habitat, based on SAME and DAFT?",
  "Compare BASS-II and Saffire-II: what does each say about 1-g vs microgravity flammability?",
  "What PSI data would a modeler use to predict flame spread at this atmosphere?",
];

export default function Analyst({
  scenario,
  ranked,
  seed,
  onSeedUsed,
  onOpen,
}: {
  scenario: ScenarioCtx;
  ranked: Ranked[];
  seed: string | null;
  onSeedUsed: () => void;
  onOpen: (id: string) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    const history: Msg[] = [...msgs, { role: "user", text: q.trim() }];
    setMsgs([...history, { role: "model", text: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/analyst", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: history,
          scenario,
          top: ranked.slice(0, 10).map((r) => ({ id: r.inv.id, score: r.total })),
        }),
      });
      setMode(res.headers.get("x-analyst"));
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...history, { role: "model", text: acc }]);
      }
      if (!acc.trim()) setMsgs([...history, { role: "model", text: "The analyst returned an empty answer. Try rephrasing." }]);
    } catch {
      setMsgs([...history, { role: "model", text: "Could not reach the analyst. Check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const NL = "\n";
    const body = msgs.map((m) => `### ${m.role === "user" ? "Question" : "Analyst"}${NL}${NL}${m.text}`).join(NL + NL);
    const md = [
      `# Fire-safety briefing - ${scenario.name}`,
      `*${scenario.o2}% O2 at ${scenario.psi} psi · ${scenario.gravity} g · generated ${new Date().toISOString().slice(0, 10)} by Flame in Freefall from NASA PSI data*`,
      body,
      "---",
      "Citations like [PSI-25] refer to NASA Physical Sciences Informatics investigations: https://psi.nasa.gov",
    ].join(NL + NL);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = `fire-safety-briefing-${scenario.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  useEffect(() => {
    if (seed) {
      ask(seed);
      onSeedUsed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  return (
    <section className={s.wrap}>
      <div className={s.head}>
        <div>
          <h2 className="serif">Ask the analyst</h2>
          <p>
            Answers come from the PSI records for your scenario ({scenario.o2}% O2, {scenario.psi} psi). Every claim cites its
            investigation; click a citation to open it.
          </p>
        </div>
        <div className={s.headR}>
          {mode && <span className="chip">{mode === "offline" ? "offline summary" : mode === "error" ? "AI unavailable" : `model: ${mode}`}</span>}
          {!busy && msgs.some((m) => m.role === "model" && m.text) && (
            <button className="btn" onClick={download}>
              ↓ Download briefing
            </button>
          )}
        </div>
      </div>

      {msgs.length === 0 && (
        <div className={s.suggest}>
          {SUGGEST.map((q) => (
            <button key={q} onClick={() => ask(q)}>
              <span className="mono hot">→</span> {q}
            </button>
          ))}
        </div>
      )}

      <div className={s.thread}>
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? s.user : s.model}>
            {m.role === "user" ? (
              <p>{m.text}</p>
            ) : m.text ? (
              <div className={s.answer}>
                <Markdown text={m.text} onCite={onOpen} />
                {busy && i === msgs.length - 1 && <span className={s.caret} />}
              </div>
            ) : (
              <div className={s.thinking}>
                <span />
                <span />
                <span />
                reading {ranked.slice(0, 3).map((r) => r.inv.acronym ?? r.inv.id).join(", ")} ...
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={2}
          placeholder="Ask about flammability limits, suppression, detection, materials, data gaps..."
          disabled={busy}
        />
        <button className="btn btn-hot" disabled={busy || !input.trim()}>
          {busy ? "Thinking" : "Ask"}
        </button>
      </form>
    </section>
  );
}

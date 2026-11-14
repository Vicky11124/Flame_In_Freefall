import { investigations, insights, byId, label } from "@/lib/data";
import { coverage } from "@/lib/score";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  messages: { role: "user" | "model"; text: string }[];
  scenario: { name: string; o2: number; psi: number; flow: number; gravity: number; focus: string[] };
  top: { id: string; score: number }[];
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "..." : s);
const rng = (r: [number, number] | null, k = 1, u = "") => (r ? `${(r[0] * k).toFixed(1)}-${(r[1] * k).toFixed(1)}${u}` : "n/a");

function buildContext(b: Body) {
  const topIds = b.top.slice(0, 10).map((t) => t.id);
  const detailed = topIds
    .map((id) => byId[id])
    .filter(Boolean)
    .map((i) => {
      const facts = insights.filter((x) => x.inv === i.id).map((x) => `  - DATA: ${x.text}`).join("\n");
      return [
        `### [${i.id}] ${label(i)} - ${i.title}`,
        `relevance score for this scenario: ${b.top.find((t) => t.id === i.id)?.score.toFixed(0)}/100`,
        `type: ${i.type}; platform: ${i.platform ?? "-"}; hardware: ${i.rack}; phase: ${i.phase}; roles: ${i.themes.join(", ")}`,
        `envelope: O2 ${rng(i.envelope.o2, 1, "%")}; pressure ${rng(i.envelope.p, 14.696, " psi")}; flow ${rng(i.envelope.flow, 1, " cm/s")}; ${i.runs} runs, ${i.conditions} conditions`,
        `varied: ${i.varied.join(", ") || "-"}; held: ${i.held.join(", ") || "-"}`,
        `outcomes: ${Object.entries(i.outcomes).map(([k, n]) => `${k} ${n}`).join(", ") || "-"}`,
        `sensors: ${i.sensors.join(", ")}`,
        `fuels: ${i.fuels.slice(0, 12).join(", ")}`,
        `objective: ${clip(i.objective, 700)}`,
        i.hypothesis ? `hypothesis: ${clip(i.hypothesis, 400)}` : "",
        i.impacts ? `impacts: ${clip(i.impacts, 450)}` : "",
        facts,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
  const others = investigations
    .filter((i) => !topIds.includes(i.id))
    .map((i) => `- [${i.id}] ${label(i)} (${i.phase}, ${i.type}): ${i.short} O2 ${rng(i.envelope.o2, 1, "%")}`)
    .join("\n");
  const cov = coverage(b.scenario.o2, b.scenario.psi)
    .map(
      (c) =>
        `- ${c.phase}: ${c.near} of ${c.total} tabulated tests are near the target; highest O2 tested ${c.maxO2?.toFixed(0) ?? "n/a"}%; nearest ${
          c.best ? `${c.best.o2?.toFixed(1)}% O2 at ${c.best.p ? (c.best.p * 14.696).toFixed(1) : "?"} psi in [${c.best.inv}]` : "none"
        }`
    )
    .join("\n");
  return { detailed, others, cov };
}

function systemPrompt(b: Body) {
  const { detailed, others, cov } = buildContext(b);
  const s = b.scenario;
  return `You are the fire-safety analyst inside "Flame in Freefall", a dashboard over NASA's Physical Sciences Informatics (PSI) combustion-science archive. Your users are aerospace engineers, researchers and students.

SCENARIO the user is designing for: ${s.name}. Atmosphere ${s.o2}% O2 at ${s.psi} psi (${(s.psi / 14.696).toFixed(2)} atm), ventilation ~${s.flow} cm/s, gravity ${s.gravity} g. Materials on board: ${s.focus.join(", ")}.

RULES
- Ground every factual claim in the PSI records below and cite them inline as [PSI-##]. Never invent test results, numbers or publications.
- If the records do not contain the answer, say so plainly and name the closest evidence. Distinguish "PSI data shows" from "general combustion knowledge suggests".
- PSI contains NO partial-gravity combustion data. For Moon/Mars, reason from microgravity (PSI flight data) and normal gravity as bounds, and say that.
- Oxygen-enriched, reduced-pressure atmospheres raise material flammability; flag where PSI coverage stops short of the scenario.
- Be concise and practical: short paragraphs or bullets, ## headings when the answer is long, end with "Data gaps" when relevant. Under ~350 words unless asked for more.
- Out of scope: rocket propulsion and propellants.

ARCHIVE COVERAGE AT THIS ATMOSPHERE (computed from normalized PSI tables)
${cov}

MOST RELEVANT INVESTIGATIONS (ranked for this scenario)
${detailed}

OTHER PSI COMBUSTION INVESTIGATIONS
${others}`;
}

function offline(b: Body) {
  const { cov } = buildContext(b);
  const top = b.top.slice(0, 5).map((t) => byId[t.id]).filter(Boolean);
  const facts = insights.filter((x) => top.some((t) => t.id === x.inv)).slice(0, 4);
  return `## Offline briefing - ${b.scenario.name}
*The live AI analyst is not configured (no GEMINI_API_KEY), so this is an automatic summary built from the ranked PSI data.*

**Target atmosphere:** ${b.scenario.o2}% O2 at ${b.scenario.psi} psi, ${b.scenario.gravity} g.

## Most relevant investigations
${top.map((i) => `- **${label(i)}** [${i.id}]: ${i.short}`).join("\n")}

## What the data says
${facts.map((f) => `- ${f.text} [${f.inv}]`).join("\n") || "- No computed findings for these investigations."}

## Coverage at this atmosphere
${cov}

## Data gaps
- PSI has no partial-gravity combustion data; Moon and Mars must be bounded by microgravity and 1-g results.`;
}

export async function POST(req: Request) {
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!b?.messages?.length || !b.scenario) return new Response("Bad request", { status: 400 });
  const msgs = b.messages.slice(-8).map((m) => ({ role: m.role, parts: [{ text: clip(String(m.text), 4000) }] }));

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return new Response(offline(b), { headers: { "content-type": "text/plain; charset=utf-8", "x-analyst": "offline" } });
  }

  // Configured model first, then fast fallbacks. Model names get retired, and some models
  // queue for 20s+ on the free tier, so each attempt has a time limit before trying the next.
  const models = [
    ...new Set([process.env.GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash-lite"].filter(Boolean)),
  ] as string[];
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt(b) }] },
    contents: msgs,
    generationConfig: { temperature: 0.35, maxOutputTokens: 1600 },
  });
  let upstream: Response | null = null;
  let model = models[0];
  for (const m of models) {
    model = m;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`,
        { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key }, body: payload, signal: ctrl.signal }
      );
    } catch {
      upstream = null; // timed out or network error: try the next model
      continue;
    } finally {
      clearTimeout(timer);
    }
    if (upstream.ok || ![404, 429, 500, 503].includes(upstream.status)) break;
  }
  if (!upstream) {
    return new Response(`The AI service did not respond in time. Try again in a moment.\n\n---\n\n${offline(b)}`, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-analyst": "error" },
    });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    const msg =
      upstream.status === 429
        ? "The Gemini free tier is rate-limited right now. Wait a minute and ask again."
        : `The AI service returned an error (${upstream.status}). ${clip(detail.replace(/\s+/g, " "), 200)}`;
    return new Response(`${msg}\n\n---\n\n${offline(b)}`, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-analyst": "error" },
    });
  }

  // Re-stream Gemini's SSE as plain text chunks.
  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      let buf = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line.startsWith("data:")) continue;
            try {
              const j = JSON.parse(line.slice(5));
              const t = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
              if (t) ctrl.enqueue(enc.encode(t));
            } catch {
              /* partial line */
            }
          }
        }
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "x-analyst": model } });
}

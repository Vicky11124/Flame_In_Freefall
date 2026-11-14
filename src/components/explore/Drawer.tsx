"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import AtmosphereMap from "@/components/AtmosphereMap";
import { byId, images, label, insights, PHASE_COLOR, THEME_LABEL } from "@/lib/data";
import s from "./Drawer.module.css";

const fmtR = (r: [number, number] | null, unit: string, k = 1, dp = 1) =>
  r ? (r[0] === r[1] ? `${(r[0] * k).toFixed(dp)} ${unit}` : `${(r[0] * k).toFixed(dp)}-${(r[1] * k).toFixed(dp)} ${unit}`) : "not tabulated";

export default function Drawer({
  id,
  onClose,
  onOpen,
  inCompare,
  onCompare,
  target,
}: {
  id: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  inCompare: boolean;
  onCompare: () => void;
  target: { o2: number; psi: number };
}) {
  const inv = byId[id];
  const [more, setMore] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  useEffect(() => setMore(false), [id]);
  if (!inv) return null;
  const imgs = images[id] ?? [];
  const facts = insights.filter((x) => x.inv === id);
  const outs = Object.entries(inv.outcomes).sort((a, b) => b[1] - a[1]);
  const outTotal = outs.reduce((a, [, n]) => a + n, 0);

  return (
    <div className={s.scrim} onClick={onClose}>
      <aside className={s.drawer} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={inv.title}>
        <div className={s.head}>
          <div className="eyebrow">
            {inv.id} · {inv.type === "flight" ? inv.platform ?? "flight" : "ground investigation"}
          </div>
          <button className={s.x} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <h2 className="serif">{label(inv)}</h2>
        <div className={s.title}>{inv.title}</div>
        <div className={s.chips}>
          <span className="chip">
            <span className="dot" style={{ background: PHASE_COLOR[inv.phase] }} />
            {inv.phase}
          </span>
          {inv.themes.map((t) => (
            <span key={t} className="chip">
              {THEME_LABEL[t]}
            </span>
          ))}
          <span className="chip">{inv.rack}</span>
        </div>
        <p className={s.short}>{inv.short}</p>

        <div className={s.actions}>
          <button className={`btn ${inCompare ? "btn-hot" : ""}`} onClick={onCompare}>
            {inCompare ? "In compare ✓" : "+ Compare"}
          </button>
          <a className="btn" href={`https://psi.nasa.gov/physci/repo/data/investigations/${inv.id}`} target="_blank" rel="noreferrer">
            Open in PSI ↗
          </a>
          {inv.doi && (
            <a className="btn" href={`https://doi.org/${inv.doi}`} target="_blank" rel="noreferrer">
              DOI ↗
            </a>
          )}
        </div>

        {imgs.length > 0 && (
          <div className={s.imgs}>
            {imgs.slice(0, 2).map((im) => (
              <figure key={im.src}>
                <div className={s.img}>
                  <Image src={im.src} alt={im.caption} fill sizes="300px" />
                </div>
                <figcaption>{im.caption}</figcaption>
              </figure>
            ))}
          </div>
        )}

        <section className={s.sec}>
          <div className="eyebrow">Test envelope</div>
          <dl className={s.env}>
            <div>
              <dt>Oxygen</dt>
              <dd>{fmtR(inv.envelope.o2, "%")}</dd>
            </div>
            <div>
              <dt>Pressure</dt>
              <dd>{fmtR(inv.envelope.p, "psi", 14.696)}</dd>
            </div>
            <div>
              <dt>Flow</dt>
              <dd>{fmtR(inv.envelope.flow, "cm/s", 1, 0)}</dd>
            </div>
            <div>
              <dt>Records</dt>
              <dd>
                {inv.runs} runs{inv.conditions ? ` · ${inv.conditions} conditions` : ""}
              </dd>
            </div>
          </dl>
          {inv.envNote && <p className={s.small}>{inv.envNote}</p>}
          <div className={s.vh}>
            <div>
              <span className={s.vhK}>Varied</span>
              {inv.varied.length ? inv.varied.map((v) => <span key={v} className="chip">{v}</span>) : <span className={s.small}>-</span>}
            </div>
            <div>
              <span className={s.vhK}>Held</span>
              {inv.held.length ? inv.held.map((v) => <span key={v} className="chip">{v}</span>) : <span className={s.small}>-</span>}
            </div>
          </div>
        </section>

        {(inv.runs > 0 || inv.conditions > 0) && (
          <section className={s.sec}>
            <div className="eyebrow">Its tests vs your atmosphere</div>
            <AtmosphereMap highlight={id} target={target} height={380} compact showGap={false} />
          </section>
        )}

        {facts.length > 0 && (
          <section className={s.sec}>
            <div className="eyebrow">Computed from the PSI table</div>
            {facts.map((f) => (
              <div key={f.text} className={s.fact}>
                <span className="serif hot">{f.stat}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </section>
        )}

        {outs.length > 0 && (
          <section className={s.sec}>
            <div className="eyebrow">How tests ended</div>
            <div className={s.outBar}>
              {outs.map(([k, n], i) => (
                <span key={k} style={{ flex: n, opacity: 1 - i * 0.2 }} title={`${k}: ${n}`} />
              ))}
            </div>
            <div className={s.outLegend}>
              {outs.map(([k, n]) => (
                <span key={k} className="mono">
                  {k} <b>{n}</b> ({Math.round((100 * n) / outTotal)}%)
                </span>
              ))}
            </div>
          </section>
        )}

        <section className={s.sec}>
          <div className="eyebrow">Sensors &amp; measurements</div>
          <div className={s.chips}>
            {inv.sensors.map((x) => (
              <span key={x} className="chip">
                {x}
              </span>
            ))}
          </div>
        </section>

        {inv.fuels.length > 0 && (
          <section className={s.sec}>
            <div className="eyebrow">Fuels &amp; samples ({inv.fuels.length})</div>
            <div className={s.fuels}>{inv.fuels.slice(0, 18).join(" · ")}{inv.fuels.length > 18 ? " ..." : ""}</div>
          </section>
        )}

        <section className={s.sec}>
          <div className="eyebrow">Objective</div>
          <p className={`${s.text} ${more ? "" : s.clamp}`}>{inv.objective}</p>
          {more && inv.hypothesis && (
            <>
              <div className="eyebrow">Hypothesis</div>
              <p className={s.text}>{inv.hypothesis}</p>
            </>
          )}
          {more && inv.approach && (
            <>
              <div className="eyebrow">Approach</div>
              <p className={s.text}>{inv.approach}</p>
            </>
          )}
          <button className={s.link} onClick={() => setMore((m) => !m)}>
            {more ? "Show less" : "Read hypothesis & approach"}
          </button>
        </section>

        <section className={s.sec}>
          <div className="eyebrow">Earth benefit</div>
          <p className={s.text}>{inv.earth}</p>
        </section>

        {inv.publications.length > 0 && (
          <section className={s.sec}>
            <div className="eyebrow">Key publications</div>
            <ul className={s.pubs}>
              {inv.publications.slice(0, 4).map((p) => (
                <li key={p.title}>
                  {p.doi ? (
                    <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">
                      {p.title}
                    </a>
                  ) : (
                    p.title
                  )}
                  <span>{p.authors}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {inv.related.length > 0 && (
          <section className={s.sec}>
            <div className="eyebrow">Related investigations</div>
            <div className={s.chips}>
              {inv.related
                .filter((r) => byId[r])
                .map((r) => (
                  <button key={r} className="chip" onClick={() => onOpen(r)}>
                    {label(byId[r])} →
                  </button>
                ))}
            </div>
          </section>
        )}
        <p className={s.small}>
          {inv.center} · {inv.start} to {inv.end} · {inv.sizeGB} GB in PSI · {inv.contacts.slice(0, 3).join(", ")}
        </p>
      </aside>
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import FlameLab from "@/components/landing/FlameLab";
import SchemaMerge from "@/components/landing/SchemaMerge";
import AtmosphereMap from "@/components/AtmosphereMap";
import Reveal from "@/components/Reveal";
import Logo from "@/components/Logo";
import CountUp from "@/components/CountUp";
import Pipeline from "@/components/landing/Pipeline";
import LabTeaser from "@/components/landing/LabTeaser";
import { STATS, insights, byId, label } from "@/lib/data";
import s from "./landing.module.css";

const INCIDENTS = [
  { year: "1967", name: "Apollo 1", atm: "100% O2 · 16.7 psi", text: "A cabin fire during a launch-pad test killed the three-person crew. Pure oxygen above sea-level pressure made ordinary materials violently flammable." },
  { year: "1970", name: "Apollo 13", atm: "O2 tank · cryogenic", text: "An oxygen tank exploded on the way to the Moon. The crew survived by improvising in a crippled spacecraft." },
  { year: "1997", name: "Mir", atm: "O2 generator · 14.7 psi", text: "An oxygen-generating canister caught fire aboard the station, filling it with smoke and blocking an escape path to a docked spacecraft." },
  { year: "2026", name: "Artemis II", atm: "Smoke alarm · deep space", text: "A smoke alarm sounded tens of thousands of miles from home - a reminder that the nearest fire department is days away." },
];

const FEATURES = [
  { n: "01", t: "Rank", d: "Pick a habitat - ISS, Moon base, rover, Mars, airlock. Every investigation is scored on how close its tests came to your atmosphere, your materials and your mission focus. The scoring is shown, never hidden." },
  { n: "02", t: "Map", d: "All test runs on one oxygen-pressure chart. See at a glance where NASA has data, and where future crews will live without any." },
  { n: "03", t: "Compare", d: "Put up to three investigations side by side: fuels, sample geometry, O2, pressure, flow, what was varied, what was held, sensors and outcomes." },
  { n: "04", t: "Ask", d: "An AI fire-safety analyst that answers from the PSI records only and cites the investigation behind every claim." },
];

export default function Landing() {
  return (
    <main className={s.page}>
      <header className={s.nav}>
        <div className={`wrap ${s.navIn}`}>
          <Link href="/" className={s.brand}>
            <Logo />
            <span>
              Flame <span className="ital serif">in</span> Freefall
            </span>
          </Link>
          <nav className={s.links}>
            <a href="#problem">Problem</a>
            <a href="#data">Data</a>
            <a href="#gap">The gap</a>
            <Link href="/lab" className={s.labLink}>
              <span className={s.liveDot} /> Flame Lab
            </Link>
            <Link href="/explore" className="btn btn-hot">
              Open dashboard <span aria-hidden>→</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* ---------------- HERO (gravity drains as you scroll past) ---------------- */}
      <div className={s.scrolly} data-scrolly>
      <section className={s.hero}>
        <div className={s.heroText}>
          <div className="eyebrow">NASA Space Apps 2026 · Fire safety intelligence</div>
          <h1 className={`serif ${s.h1}`}>
            Fire behaves <span className="ital cold">differently</span> when nothing falls.
          </h1>
          <p className={s.lede}>
            On Earth, hot gas rises and a flame becomes a flickering teardrop. In orbit, nothing rises: the flame turns into a
            dim blue sphere that feeds on oxygen by diffusion alone. NASA has spent decades measuring this. We turned{" "}
            {STATS.investigations} investigations and {STATS.runs.toLocaleString()} test runs into answers for the crews heading to the
            Moon and Mars.
          </p>
          <div className={s.ctas}>
            <Link href="/explore" className="btn btn-hot">
              Explore the data <span aria-hidden>→</span>
            </Link>
            <Link href="/lab" className="btn">
              Enter the Flame Lab
            </Link>
          </div>
          <dl className={s.stats}>
            <div>
              <dt>Investigations</dt>
              <dd><CountUp to={STATS.investigations} /></dd>
            </div>
            <div>
              <dt>Test runs normalized</dt>
              <dd><CountUp to={STATS.runs} /></dd>
            </div>
            <div>
              <dt>Raw archive</dt>
              <dd><CountUp to={STATS.terabytes} decimals={1} suffix=" TB" /></dd>
            </div>
            <div>
              <dt>Max O2 tested</dt>
              <dd><CountUp to={STATS.maxO2} suffix="%" /></dd>
            </div>
          </dl>
        </div>
        <div className={s.heroLab}>
          <FlameLab />
        </div>
      </section>
      </div>

      {/* ---------------- INCIDENTS ---------------- */}
      <section id="problem" className={`${s.section} grid-paper`}>
        <div className="wrap">
          <Reveal className={s.head}>
            <div className="eyebrow">Fig. 02 - Incident log</div>
            <h2 className={`serif ${s.h2}`}>
              Every era of spaceflight has had its <span className="ital hot">fire</span>.
            </h2>
            <p className={s.sub}>
              Spacecraft fire safety rests on three things: <b>prevention</b> (choose materials that won&apos;t burn),{" "}
              <b>detection</b> (see smoke early) and <b>suppression</b> (put it out with no fire service to call).
            </p>
          </Reveal>
          <ol className={s.timeline}>
            {INCIDENTS.map((x, i) => (
              <Reveal as="li" key={x.year} className={s.event} delay={i * 110}>
                <div className={`serif ${s.year}`}>{x.year}</div>
                <div className={s.evName}>{x.name}</div>
                <div className="chip">{x.atm}</div>
                <p>{x.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- FIELD NOTES ---------------- */}
      <section className={s.section}>
        <div className="wrap">
          <Reveal className={s.head}>
            <div className="eyebrow">Fig. 03 - Field notes from orbit</div>
            <h2 className={`serif ${s.h2}`}>
              Same fuel. <span className="ital cold">Different physics.</span>
            </h2>
          </Reveal>
          <div className={s.gallery}>
            {[
              { src: "/psi/PSI-22-1.jpg", id: "PSI-22", cap: "No buoyancy: the flame spreads into a soft blue dome." },
              { src: "/psi/PSI-22-2.jpg", id: "PSI-22", cap: "Add an electric field and ion wind pulls it back into a teardrop. This is the closest stand-in for partial gravity in PSI." },
              { src: "/psi/PSI-10-1.jpg", id: "PSI-10", cap: "Nine flames from ACME Flame Design: from soot-free blue to sooty orange, by changing where the oxygen sits." },
              { src: "/psi/PSI-25-0.jpg", id: "PSI-25", cap: "BASS-II: an acrylic rod burning in a fan-driven flow. Melting plastic bubbles and bursts." },
            ].map((g, i) => (
              <Reveal as="article" key={g.src} className={`${s.shot} ${i === 2 ? s.shotTall : ""}`} delay={i * 90}>
                <div className={s.shotImg}>
                  <Image src={g.src} alt={g.cap} fill sizes="(max-width: 900px) 100vw, 33vw" />
                </div>
                <div className={s.shotCap}>
                  <span className="eyebrow">
                    {label(byId[g.id])} · {g.id}
                  </span>
                  <p>{g.cap}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- DATA PROBLEM ---------------- */}
      <section id="data" className={`${s.section} ${s.dataSec}`}>
        <div className={`wrap ${s.split}`}>
          <Reveal className={s.head}>
            <div className="eyebrow">Fig. 04 - The data problem</div>
            <h2 className={`serif ${s.h2}`}>
              {STATS.tables} spreadsheets. <span className="ital">{STATS.tables} dialects.</span>
            </h2>
            <p className={s.sub}>
              PSI holds about {STATS.terabytes} TB of combustion data, but every investigation describes its tests its own way:
              mole fractions vs percentages, mmHg vs bar vs atm, &quot;Air display&quot; vs &quot;Air Rate&quot;. You can&apos;t
              compare what you can&apos;t line up.
            </p>
            <p className={s.sub}>
              Our pipeline pulls PSI&apos;s public API, maps every table onto <b>one schema</b> and marks every value it had to
              assume. No silent guesses.
            </p>
          </Reveal>
          <SchemaMerge />
        </div>
      </section>

      {/* ---------------- PIPELINE ---------------- */}
      <section className={s.section}>
        <div className="wrap">
          <Reveal className={s.head}>
            <div className="eyebrow">Fig. 05 - How it works</div>
            <h2 className={`serif ${s.h2}`}>
              From raw archive to <span className="ital hot">cited answer</span>.
            </h2>
          </Reveal>
          <Reveal>
            <Pipeline />
          </Reveal>
        </div>
      </section>

      {/* ---------------- THE GAP ---------------- */}
      <section id="gap" className={`${s.section} grid-paper`}>
        <div className="wrap">
          <Reveal className={s.head}>
            <div className="eyebrow">Fig. 06 - Where crews will live vs where we have data</div>
            <h2 className={`serif ${s.h2}`}>
              Moon habitats will breathe <span className="ital hot">30-34% oxygen</span>. Solid materials in PSI&apos;s flight data
              have only burned up to {STATS.maxSolidO2}%.
            </h2>
            <p className={s.sub}>
              A richer atmosphere shortens spacesuit pre-breathe, but makes fabrics and plastics far easier to ignite. Each dot
              below is a PSI test. Hover to inspect it. The orange rings are the atmospheres NASA is planning.
            </p>
          </Reveal>
          <Reveal className={`${s.mapCard} marks`}>
            <AtmosphereMap height={520} />
          </Reveal>
          <div className={s.insights}>
            {insights.slice(0, 6).map((x, i) => (
              <Reveal key={x.text} className={s.insight} delay={i * 80}>
                <div className={`serif num ${s.insStat}`}>{x.stat}</div>
                <p>{x.text}</p>
                <span className="eyebrow">
                  {label(byId[x.inv])} · {x.inv} · computed from PSI table
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- FLAME LAB TEASER ---------------- */}
      <section className={`${s.section} ${s.labSec}`}>
        <div className="wrap">
          <Reveal className={s.head}>
            <div className="eyebrow">Fig. 07 - Flame Lab</div>
            <h2 className={`serif ${s.h2}`}>
              Nomex won&apos;t burn in Earth air. <span className="ital hot">On the Moon, it will.</span>
            </h2>
            <p className={s.sub}>
              Our virtual wind tunnel burns real spacecraft materials under any oxygen, pressure, airflow and gravity. The model uses
              each material&apos;s published oxygen limit and the flow and gravity trends measured in BASS and Saffire.
            </p>
          </Reveal>
          <Reveal>
            <LabTeaser />
          </Reveal>
        </div>
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section className={s.section}>
        <div className="wrap">
          <Reveal className={s.head}>
            <div className="eyebrow">Fig. 08 - The instrument</div>
            <h2 className={`serif ${s.h2}`}>
              From <span className="ital">archive</span> to answer in four moves.
            </h2>
          </Reveal>
          <div className={s.features}>
            {FEATURES.map((f, i) => (
              <Reveal key={f.n} className={s.feature} delay={i * 90}>
                <span className="mono hot">{f.n}</span>
                <h3 className="serif">{f.t}</h3>
                <p>{f.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className={s.cta}>
        <div className="wrap">
          <Reveal>
            <h2 className={`serif ${s.ctaH}`}>
              Make the next giant leap <span className="ital hot">a safer one.</span>
            </h2>
            <Link href="/explore" className="btn btn-hot">
              Open the dashboard <span aria-hidden>→</span>
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className={s.foot}>
        <div className={`wrap ${s.footIn}`}>
          <span>
            Data: NASA Physical Sciences Informatics (PSI), CC0. Cite each investigation by its DOI. Built for the 2026 NASA Space Apps
            Challenge, &quot;Flame in Freefall&quot;.
          </span>
          <a href="https://psi.nasa.gov" target="_blank" rel="noreferrer">
            psi.nasa.gov ↗
          </a>
        </div>
      </footer>
    </main>
  );
}

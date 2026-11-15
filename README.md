# Ember Atlas

**AI-assisted fire-safety intelligence from NASA microgravity combustion data.**
Built for the 2026 NASA Space Apps Challenge: *Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data*.

NASA's Physical Sciences Informatics (PSI) archive holds 23 combustion investigations and about 13 TB of data, spread across 21 experiment tables. Each table uses its own column names and units. This project turns that archive into answers for the people designing habitats for the Moon and Mars.

## What it does

| | |
|---|---|
| **Flame Lab** (`/lab`) | A 3D virtual wind tunnel (three.js). Burn cotton-fiberglass, cotton, Nomex, PMMA film/slab, silicone, paper or Ultem under any O2, pressure, airflow (concurrent/opposed) and gravity. Watch the flame front spread, char form and smoke drift; change settings mid-burn. Built on a teaching model: published oxygen limits (LOI) plus flow/gravity/pressure trends from BASS, BASS-II and Saffire, calibrated to Saffire-II's measured 2.1-2.6 mm/s. Each material links to its PSI evidence. |
| **Hero flame** (landing page) | A live WebGL flame. Drag gravity from Earth to orbit and the teardrop becomes a blue sphere. Raise the oxygen and it intensifies. Move the cursor to blow air across it. |
| **Mission controls** | Scenario tiles, draggable O2 / pressure dials, material pills, tap-to-set priorities, an O2 gauge vs Earth air and coverage rings per fuel type. |
| **Rank** | Choose a habitat (ISS, lunar habitat, pressurized rover, Mars, spacesuit/airlock) or set your own O2, pressure, flow, on-board materials and mission priorities. Every investigation is scored with a visible breakdown: atmosphere match, material match, mission focus, evidence strength. |
| **Coverage** | For each fuel phase (solids, liquids, gases, smoke), shows how many PSI tests sit near your atmosphere and where the data stops. |
| **Map** | All test runs on one oxygen-pressure chart, overlaid with real and planned crew atmospheres. Click a point to open its investigation. |
| **Compare** | Up to three investigations side by side: fuels, O2, pressure, flow, what was varied vs held, sensors, outcomes. Differences are highlighted. |
| **Ask the analyst** | A Gemini-powered analyst that answers **only from the PSI records**, cites every claim (`[PSI-25]` becomes a clickable chip), and states plainly where data is missing. Without a key it falls back to an automatic offline briefing. |
| **Network** | Investigations clustered by shared flight hardware (ACME, MDCA, MSG duct, Cygnus), linked by PSI's "related investigations". |
| **Earth** | Spinoffs (water mist, dust-tolerant smoke detection, material testing, firefighter gear) and every investigation's Earth benefit. |
| **Share & export** | The URL captures the whole view (scenario, dials, tab, open investigation, compare set). Download runs as CSV or analyst answers as a Markdown briefing. |
| **Export** | Download the normalized test runs as CSV for flammability modeling. |

### Headline finding
Planned Moon habitats will run at **30-34% O2** at 8.2-10.2 psi. In PSI's flight data, **no solid material has burned above about 22% O2**. Liquids (FLEX) reach 34% and gases (CFI-G) reach 85%, but the materials that line a habitat have not been flown there. PSI also has **no partial-gravity combustion data** yet, so Moon and Mars estimates must be bounded by microgravity and 1-g results.

## How the data works

```
PSI JSON API ──> scripts/fetch_psi.py ──> data/raw/ (metadata + 21 CSV tables, public, CC0)
                                     └─> scripts/build_data.py ──> src/data/*.json (ships with the app)
```

`build_data.py` maps every table onto one schema: `o2 (%)`, `p (atm)`, `flow (cm/s)`, `fuel`, `phase`, `diluent`, `outcome`, `burn time`, `droplet size`. Unit conversions include mole fraction to %, mmHg and bar to atm, and parsing values like "~ 21.5" or "30 cm/s". When a table doesn't report a value and the PSI description documents a cabin default (e.g. BASS ran in ISS cabin air), the value is filled in **and flagged as assumed**. Assumed values are drawn as hollow points on the chart. Tables that only summarize tested conditions (ACME, FLEX-2) are stored as `condition` rows, not runs. Data-derived insights (e.g. FLEX extinction rates by diluent) are computed by the script, not written by hand.

Result: **1,730 test runs + 286 tested conditions** across 23 investigations.

## Run it locally

```bash
npm install
cp .env.example .env.local   # add your free Gemini key from https://aistudio.google.com/apikey
npm run dev                  # http://localhost:3000
```

Rebuild the dataset from PSI (optional, needs Python 3):

```bash
python scripts/fetch_psi.py
python scripts/build_data.py
```

## Deploy to Vercel

1. Push this folder to a GitHub repository.
2. On vercel.com: **Add New > Project**, import the repo (framework auto-detects Next.js).
3. Under **Environment Variables**, add `GEMINI_API_KEY` (keep it out of `.env.example`, which is committed).
4. Deploy.

## Tech

Next.js 15 (App Router) · React 19 · TypeScript · three.js wind tunnel · hand-written WebGL shader · custom SVG charts (no chart library) · CSS Modules · Gemini API (streamed through a server route so the key never reaches the browser).

## Data & credits

- Data: [NASA Physical Sciences Informatics](https://psi.nasa.gov), CC0. Cite each investigation by its DOI (shown in the app).
- Images: NASA PSI representative images (ACME, BASS-II, DAFT).
- The flame simulation is illustrative. Microgravity and 1-g shapes follow ISS imagery; partial gravity is interpolated.
- Photos are real NASA images, unmodified and not SI-generated.

## SI disclosure

This project was built with Super Intelligence (SI) tools, as allowed by the NASA Space Apps rules:

- **Code, data pipeline, design and written copy:** developed with **Claude (Anthropic)**, directed, reviewed and tested by the author. Every source file carries a header saying so.
- **In-app analyst:** answers are generated at request time by **Google Gemini** and labelled "SI-generated" in the app and in downloaded briefings.
- **Visuals:** no SI image generation. The hero flame and Flame Lab are rendered live by SI-written code and carry an "SI-assisted render" watermark.
- **NASA branding:** no NASA logos, insignia or design elements are used, generated or modified.

Full breakdown: [SI_DISCLOSURE.md](SI_DISCLOSURE.md), and `/si` on the live site.

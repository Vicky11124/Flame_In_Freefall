"""
Normalize NASA PSI combustion-science investigations into two JSON files the app ships with:

  src/data/investigations.json  - one profile per investigation (metadata + curated tags + envelope)
  src/data/runs.json            - every experimental-table row mapped onto ONE common schema

Raw inputs live in data/raw (downloaded by scripts/fetch_psi.py, public, CC0, no login).

Common run schema (null = not reported):
  inv      PSI accession
  fuel     fuel / material as written by the PI (lightly cleaned)
  phase    gas | liquid | solid | aerosol
  o2       oxidizer O2 mole fraction, percent
  p        pressure, atm
  flow     imposed flow speed, cm/s
  dil      diluent (N2, He, CO2)
  outcome  normalized end state
  burn     burn time, s
  d0       initial droplet diameter, mm (droplet studies)
  assumed  fields filled from documented cabin defaults rather than the table
  kind     run (one test) | condition (one tested condition summarised by the PI)
"""
import csv, glob, io, json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "src", "data")

BAR = 1 / 1.01325


def read(name):
    path = glob.glob(os.path.join(RAW, "csv", name + "*"))
    if not path:
        return []
    txt = open(path[0], "rb").read().decode("utf-8-sig", "replace")
    rows = list(csv.reader(io.StringIO(txt)))
    return [r for r in rows[1:] if any(c.strip() for c in r)]


def num(s):
    if s is None:
        return None
    m = re.search(r"-?\d*\.?\d+", str(s).replace(",", ""))
    return float(m.group()) if m else None


def nums(s):
    return [float(x) for x in re.findall(r"\d*\.?\d+", str(s))]


def clean(s):
    s = (s or "").replace("�", "'").replace(" ", " ")
    return re.sub(r"\s+", " ", s).strip()


OUTCOME = {
    "extinction": "extinction", "disruption": "disruption", "completion": "burned out",
    "se": "self-extinguished", "ft": "flow terminated",
}

runs = []


def add(inv, **kw):
    r = dict(inv=inv, fuel=None, phase=None, o2=None, p=None, flow=None, dil=None,
             outcome=None, burn=None, d0=None, assumed=[], kind="run")
    r.update(kw)
    # physical sanity: blank cells parsed as 0, ramped tests, typos
    if r["o2"] is not None and not (0 < r["o2"] <= 100):
        r["o2"] = None
    if r["p"] is not None and not (0.05 < r["p"] < 20):
        r["p"] = None
    if r["flow"] is not None and r["flow"] < 0:
        r["flow"] = None
    for k in ("o2", "p", "flow", "burn", "d0"):
        if r[k] is not None:
            r[k] = round(r[k], 4)
    runs.append(r)


# ---------- FLEX (PSI-69): droplet extinction by inert dilution ----------
for r in read("PSI-69"):
    co2, he = num(r[8]) or 0, num(r[9]) or 0
    add("PSI-69", fuel=clean(r[4]), phase="liquid", o2=(num(r[6]) or 0) * 100,
        p=(num(r[5]) or 0) / 760, dil="CO2" if co2 > 0 else "He" if he > 0 else "N2",
        d0=num(r[10]), burn=num(r[13]), outcome=OUTCOME.get(clean(r[14]).lower(), clean(r[14]).lower() or None))

# ---------- CFI (PSI-39): cool-flame droplets ----------
for r in read("PSI-39"):
    he = num(r[7]) or 0
    add("PSI-39", fuel=clean(r[9]), phase="liquid", o2=(num(r[5]) or 0) * 100, p=num(r[4]),
        dil="He" if he > 0 else "N2")

# ---------- CFI-G (PSI-159): gaseous cool flames, up to 85% O2 ----------
for r in read("PSI-159_Experimental table_CFI-G_Normal"):
    add("PSI-159", fuel=clean(r[2]), phase="gas", o2=(num(r[5]) or 0) * 100, p=(num(r[7]) or 0) * BAR,
        burn=num(r[14]), outcome=("ignited" if clean(r[13]).lower() == "yes" else "no hot ignition")
        if r[13].strip() else None, flame="normal")
for r in read("PSI-159_Experimental table_CFI-G_Inverse"):
    if not r[2].strip():
        continue
    ign = clean(r[13]).lower()
    add("PSI-159", fuel=clean(r[2]), phase="gas", o2=(num(r[7]) or 0) * 100, p=(num(r[6]) or 0) * BAR,
        burn=num(r[14]), outcome="ignited" if ign == "yes" else "failed to ignite" if ign == "no" else None,
        flame="inverse")

# ---------- ACME Flame Design (PSI-10) ----------
for r in read("PSI-10_Experimental table_Flame Design_Normal"):
    add("PSI-10", fuel=clean(r[2]), phase="gas", o2=(num(r[8]) or 0) * 100, p=num(r[12]), flame="normal")
for r in read("PSI-10_Experimental table_Flame Design_Inverse"):
    add("PSI-10", fuel="C2H4", phase="gas", o2=(num(r[3]) or 0) * 100, p=num(r[11]), flame="inverse")

# ---------- SPICE (PSI-107): smoke point in co-flow, cabin air ----------
seen = set()
for r in read("PSI-107"):
    key = tuple(r)
    if key in seen:
        continue
    seen.add(key)
    add("PSI-107", fuel=clean(r[3]), phase="gas", o2=21, p=1.0, flow=num(r[8]), assumed=["o2", "p"])

# ---------- BASS (PSI-26) and BASS-II (PSI-25): solids in a flow duct ----------
for r in read("PSI-26"):
    add("PSI-26", fuel=clean(r[5]), phase="solid", o2=21, p=1.0, assumed=["o2", "p"])
for r in read("PSI-25"):
    o2i, o2f = num(r[11]), num(r[12])
    add("PSI-25", fuel=clean(r[5]), phase="solid", o2=o2i, p=1.0, flow=num(r[8]), assumed=["p"],
        o2_final=o2f)

# ---------- Saffire I / II / III: large-scale solids on Cygnus ----------
for r in read("PSI-98"):
    if not num(r[5]):
        continue
    add("PSI-98", fuel=clean(r[1]), phase="solid", o2=num(r[6]), p=1.0, flow=num(r[5]), burn=num(r[9]),
        assumed=["p"], direction=clean(r[10]))
last_mat = None
for r in read("PSI-99"):
    if not num(r[5]):
        continue
    last_mat = clean(r[1]) or last_mat  # merged cells in the PI's sheet
    add("PSI-99", fuel=last_mat, phase="solid", o2=num(r[6]), p=1.0, flow=num(r[5]), assumed=["p"],
        direction=clean(r[10]), thickness=clean(r[2]), ug_burn=clean(r[11]), g1_burn=clean(r[13]))
for r in read("PSI-100"):
    add("PSI-100", fuel=clean(r[1]), phase="solid", o2=21, p=1.0, flow=num(r[5]), assumed=["o2", "p"],
        direction=clean(r[6]))

# ---------- SAME (PSI-102): smoke from overheated materials ----------
for r in read("PSI-102"):
    add("PSI-102", fuel=clean(r[1]), phase="aerosol", o2=21, p=1.0, flow=num(r[2]), assumed=["o2", "p"])

# ---------- DAFT (PSI-47): dust (nuisance-alarm discrimination) ----------
for r in read("PSI-47"):
    add("PSI-47", fuel="Arizona road dust", phase="aerosol", o2=21, p=1.0, assumed=["o2", "p"])

# ---------- ACME condition summaries (one row per tested condition) ----------
for r in read("PSI-20"):
    for o in nums(r[5]):
        o = o / 100 if o > 100 else o  # "3400%" typo in source = 34%
        add("PSI-20", fuel=clean(r[4]), phase="gas", o2=o, kind="condition")
for r in read("PSI-23"):
    if r[5].strip():
        add("PSI-23", fuel=clean(r[6]), phase="gas", o2=num(r[5]), p=1.0, kind="condition", assumed=["p"])
for r in read("PSI-21"):
    if r[4].strip():
        add("PSI-21", fuel=clean(r[4]), phase="gas", kind="condition")
for r in read("PSI-22"):
    if r[6].strip():
        add("PSI-22", fuel=clean(r[6]), phase="gas", kind="condition")
for r in read("PSI-106"):
    add("PSI-106", fuel=clean(r[1])[:40], phase="gas", o2=21, p=1.0, kind="condition", assumed=["o2", "p"])

# FLEX-2 publishes its matrix as ranges; record the corners as conditions
for r in read("PSI-68"):
    for o in nums(r[3]):
        for p in nums(r[4]):
            add("PSI-68", fuel=clean(r[0]), phase="liquid", o2=o * 100, p=p, kind="condition",
                dil="He" if "He" in r[2] else "N2")

# ------------------------------------------------------------------
# Curated layer: what each investigation is FOR, in fire-safety terms.
# Sources: challenge brief, PSI objective/approach text, PSI experimental tables.
# ------------------------------------------------------------------
CURATED = {
    "PSI-26": dict(phase="solid", themes=["prevention", "suppression"], rack="MSG flow duct",
                   sensors=["Color video (2 views)", "Radiometer", "O2 / CO2 sensors"],
                   short="Flame spread over fabrics, PMMA, wax and Ultem in a fan-driven duct, plus N2 suppression.",
                   earth="Better material-selection tests than the 1-g upward-burning standard."),
    "PSI-25": dict(phase="solid", themes=["prevention", "suppression"], rack="MSG flow duct",
                   sensors=["Color video", "Radiometer", "O2 / CO2 / CO sensors"],
                   short="Thick and thin solids burned in reduced O2 and low flow to find extinction limits.",
                   earth="Validated flame-spread models used in building-fire codes."),
    "PSI-98": dict(phase="solid", themes=["prevention", "detection"], rack="Cygnus vehicle (uncrewed)",
                   sensors=["2 video cameras", "Flow sensors", "O2 / CO2 sensors", "Radiometers"],
                   short="First large-scale fire in a spacecraft: a 94 cm cotton-fiberglass sheet burned in Cygnus.",
                   earth="Large-fire scaling data for confined spaces such as ships and aircraft."),
    "PSI-99": dict(phase="solid", themes=["prevention"], rack="Cygnus vehicle (uncrewed)",
                   sensors=["Video", "Flow sensors", "O2 / CO2 sensors"],
                   short="Nine materials ignited in microgravity and compared with 1-g burn behavior.",
                   earth="Shows where 1-g screening tests over- or under-predict flammability."),
    "PSI-100": dict(phase="solid", themes=["prevention", "detection"], rack="Cygnus vehicle (uncrewed)",
                    sensors=["Video", "Gas sampling", "Radiometers"],
                    short="Repeat of the large-scale SIBAL burn with concurrent vs opposed flow.",
                    earth="Fire growth and smoke spread data for sealed habitats."),
    "PSI-102": dict(phase="aerosol", themes=["detection"], rack="MSG",
                    sensors=["Ionization & photoelectric detectors", "P-Trak", "DustTrak", "Thermal precipitator"],
                    short="Smoke particles from overheated spacecraft materials, measured to tune smoke detectors.",
                    earth="Fewer false alarms and earlier warning in terrestrial smoke detectors."),
    "PSI-47": dict(phase="aerosol", themes=["detection"], rack="ISS cabin",
                   sensors=["P-Trak", "DustTrak"],
                   short="Same instruments as SAME, pointed at dust to tell nuisance dust from smoke.",
                   earth="Dust-tolerant smoke detection for mines and industry."),
    "PSI-69": dict(phase="liquid", themes=["suppression"], rack="CIR / MDCA",
                   sensors=["Backlit droplet camera", "OH* chemiluminescence camera", "Radiometer"],
                   short="Burning droplets extinguished by diluting the cabin with CO2 or helium.",
                   earth="Data behind fine-water-mist and inert-gas suppression design."),
    "PSI-68": dict(phase="liquid", themes=["suppression", "modeling"], rack="CIR / MDCA",
                   sensors=["Backlit droplet camera", "Color camera", "Radiometer"],
                   short="Fuel blends, sooting and convective effects on droplet burning and extinction.",
                   earth="Cleaner, more efficient liquid-fuel combustion."),
    "PSI-39": dict(phase="liquid", themes=["prevention", "modeling"], rack="CIR / MDCA",
                   sensors=["Backlit droplet camera", "Radiometer", "Pressure / gas sensors"],
                   short="Cool flames: low-temperature burning that can persist after the visible flame dies.",
                   earth="Engine knock and low-temperature ignition chemistry."),
    "PSI-159": dict(phase="gas", themes=["prevention"], rack="CIR / ACME",
                    sensors=["Color camera", "Burner thermocouples", "Radiometer"],
                    short="Gaseous cool flames with oxidizer up to 85% O2 - the highest O2 tested in orbit.",
                    earth="Low-temperature combustion for cleaner engines."),
    "PSI-10": dict(phase="gas", themes=["prevention", "modeling"], rack="CIR / ACME",
                   sensors=["Color camera", "Soot-temperature imaging", "Radiometer"],
                   short="Normal and inverse flames designed to be soot-free and strong.",
                   earth="Soot-free burner design."),
    "PSI-20": dict(phase="gas", themes=["prevention"], rack="CIR / ACME",
                   sensors=["Color camera", "Heat-flux gauges", "Thermocouples", "Radiometer"],
                   short="A gas burner that emulates a burning solid, testing flammability from 21% to 40% O2.",
                   earth="A faster way to estimate material flammability."),
    "PSI-21": dict(phase="gas", themes=["modeling"], rack="CIR / ACME",
                   sensors=["Color camera", "Soot imaging", "Thermocouples"],
                   short="Coflow laminar diffusion flames: soot and lift-off near extinction.",
                   earth="Soot formation models."),
    "PSI-22": dict(phase="gas", themes=["modeling"], rack="CIR / ACME",
                   sensors=["Color camera", "Ion-current probe", "Voltage / current"],
                   short="An electric field pulls flame ions - an analogue for partial gravity.",
                   earth="Electric-field flame control."),
    "PSI-23": dict(phase="gas", themes=["modeling"], rack="CIR / ACME",
                   sensors=["Color camera", "Thermocouples", "Radiometer"],
                   short="Spherical flames from a porous burner to study extinction and radiation.",
                   earth="Validation data for combustion models."),
    "PSI-107": dict(phase="gas", themes=["detection", "modeling"], rack="MSG flow duct",
                    sensors=["Color camera", "Soot imaging"],
                    short="Smoke points of jet flames in co-flowing air - when a flame starts releasing soot.",
                    earth="Fuel sooting tendency for engines and fire smoke."),
    "PSI-106": dict(phase="gas", themes=["modeling"], rack="MSG flow duct",
                    sensors=["Color camera", "Pyrometry"],
                    short="Lift-off and blow-out of jet flames in co-flow.",
                    earth="Burner stability."),
    "PSI-117": dict(phase="liquid", themes=["modeling"], rack="Ground (CFD)", sensors=["OpenFOAM 3-D CFD"],
                    short="3-D CFD of FLEX cool flames under thermal and convective disturbances.",
                    earth="Validated low-temperature combustion models."),
    "PSI-142": dict(phase="liquid", themes=["modeling"], rack="Ground (analysis)", sensors=["Numerical models"],
                    short="When cool flames turn into hot flames, and radiation/stretch extinction limits.",
                    earth="Combustion chemistry models."),
    "PSI-60": dict(phase="gas", themes=["modeling", "detection"], rack="Ground (analysis)",
                   sensors=["CFD + SPICE images"], short="Computational and experimental analysis of SPICE smoke-point data.",
                   earth="Soot emission prediction."),
    "PSI-62": dict(phase="solid", themes=["modeling", "prevention"], rack="Ground (CFD)",
                   sensors=["Flamelet CFD"], short="CFD of concurrent flame spread over solids in microgravity.",
                   earth="Faster fire-spread simulation."),
    "PSI-115": dict(phase="aerosol", themes=["detection", "modeling"], rack="Ground (analysis)",
                    sensors=["Aerosol models"], short="Advanced smoke-aerosol modeling from SAME data.",
                    earth="Smarter smoke detection algorithms."),
}

# Envelopes for studies whose tables do not report a condition (documented in PSI text).
ENVELOPE_NOTES = {
    "PSI-20": "Chamber pressure varied but not listed in the PSI table.",
    "PSI-21": "Coflow burner in ACME chamber; ambient O2 not listed in table.",
    "PSI-22": "Fuel concentration and field polarity varied; ambient not listed.",
    "PSI-26": "BASS ran in ISS cabin air (about 21% O2, 1 atm) in the MSG.",
}


def rng(vals):
    v = [x for x in vals if x is not None and not (isinstance(x, float) and math.isnan(x))]
    return [round(min(v), 3), round(max(v), 3)] if v else None


investigations = []
for path in sorted(glob.glob(os.path.join(RAW, "inv", "*.json"))):
    j = json.load(open(path, encoding="utf-8"))
    acc = j["accession"]
    if j.get("researchArea") != "Combustion Science":
        continue
    c = CURATED.get(acc, {})
    mine = [r for r in runs if r["inv"] == acc]
    fuels = sorted({r["fuel"] for r in mine if r["fuel"]}, key=str.lower)
    env = {k: rng([r[k] for r in mine]) for k in ("o2", "p", "flow")}
    varied, held = [], []
    for k, label in (("o2", "Oxygen"), ("p", "Pressure"), ("flow", "Flow speed"), ("fuel", "Fuel / material"),
                     ("dil", "Diluent"), ("d0", "Droplet size")):
        vals = {r[k] for r in mine if r[k] is not None and k not in r["assumed"]}
        if len(vals) > 1:
            varied.append(label)
        elif len(vals) == 1:
            held.append(label)
    outcomes = {}
    for r in mine:
        if r["outcome"]:
            outcomes[r["outcome"]] = outcomes.get(r["outcome"], 0) + 1
    pubs = [dict(title=clean(p.get("title")), doi=clean(p.get("doi")), authors=clean(p.get("authorList"))[:120])
            for p in (j.get("publications") or []) if p.get("title")][:6]
    related = [x for x in re.split(r"[\s,]+", j.get("related_glds") or "") if x.startswith("PSI-")]
    investigations.append(dict(
        id=acc,
        acronym=clean(j.get("investigationAcronym")) or None,
        title=clean(j.get("title")),
        sub=clean(j.get("subResearchArea")),
        type="flight" if "Microgravity" in (j.get("projectType") or "") else "ground",
        platform=clean(j.get("flightProgram")) or None,
        hardware=clean(j.get("experimentHardware")) or None,
        center=clean(j.get("managingNasaCenter")) or None,
        start=j.get("investigationStartDate") or None,
        end=j.get("investigationEndDate") or None,
        doi=j.get("doi") or None,
        sizeGB=round((j.get("totalFileSize") or 0) / 1e9, 1),
        objective=clean(j.get("objective")),
        approach=clean(j.get("approach")),
        hypothesis=clean(j.get("hypothesis")),
        impacts=clean(j.get("researchImpacts")),
        contacts=[clean(f"{x.get('firstName','')} {x.get('lastName','')}") for x in (j.get("contacts") or [])][:6],
        publications=pubs,
        related=related,
        runs=len([r for r in mine if r["kind"] == "run"]),
        conditions=len([r for r in mine if r["kind"] == "condition"]),
        fuels=fuels[:30],
        envelope=env,
        varied=varied,
        held=held,
        outcomes=outcomes,
        envNote=ENVELOPE_NOTES.get(acc),
        **{k: c.get(k) for k in ("phase", "themes", "rack", "sensors", "short", "earth")},
    ))

# ---------- data-derived insights (computed, not written by hand) ----------
def insight_lines():
    out = []
    flex = [r for r in runs if r["inv"] == "PSI-69"]
    for dil in ("CO2", "He", "N2"):
        g = [r for r in flex if r["dil"] == dil]
        if g:
            ext = sum(1 for r in g if r["outcome"] == "extinction")
            out.append(dict(inv="PSI-69", text=f"FLEX droplets in {dil}-diluted air: {ext}/{len(g)} tests ended in flame extinction.",
                            stat=f"{round(100*ext/len(g))}%"))
    burned = [r["o2"] for r in flex if r["outcome"] in ("extinction", "burned out", "disruption") and r["o2"]]
    if burned:
        out.append(dict(inv="PSI-69", text=f"Liquid droplets sustained a flame down to {min(burned):.0f}% O2 in microgravity.",
                        stat=f"{min(burned):.0f}% O2"))
    b2 = [r for r in runs if r["inv"] == "PSI-25" and r.get("o2_final")]
    if b2:
        lo = min(r["o2_final"] for r in b2 if r["o2_final"] > 5)
        out.append(dict(inv="PSI-25", text=f"BASS-II solids were burned while O2 was bled down to {lo:.1f}% - well below Earth air.",
                        stat=f"{lo:.1f}% O2"))
    cg = [r for r in runs if r["inv"] == "PSI-159"]
    if cg:
        hi = max(r["o2"] for r in cg if r["o2"])
        ign = [r for r in cg if r["outcome"] == "ignited"]
        out.append(dict(inv="PSI-159", text=f"CFI-G pushed oxidizer to {hi:.0f}% O2; {len(ign)} of {len(cg)} attempts produced a hot flame.",
                        stat=f"{hi:.0f}% O2"))
    s2 = [r for r in runs if r["inv"] == "PSI-99"]
    if s2:
        n = sum(1 for r in s2 if (r.get("g1_burn") or "").lower().startswith("complete") and (r.get("ug_burn") or "").startswith("~ 0"))
        out.append(dict(inv="PSI-99", text=f"Saffire-II: {n} silicone samples burned completely in the 1-g test yet did not spread in microgravity at 20 cm/s - 1-g screening is not always the worst case.",
                        stat=f"{n}/{len(s2)}"))
    sp = [r for r in runs if r["inv"] == "PSI-107"]
    if sp:
        out.append(dict(inv="PSI-107", text=f"SPICE logged {len(sp)} jet-flame points across {len({r['fuel'] for r in sp})} fuels to map when flames start shedding smoke.",
                        stat=f"{len(sp)}"))
    return out


os.makedirs(OUT, exist_ok=True)
slim = []
for r in runs:
    s = {k: v for k, v in r.items() if v not in (None, [], "")}
    slim.append(s)
json.dump(investigations, open(os.path.join(OUT, "investigations.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(slim, open(os.path.join(OUT, "runs.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
json.dump(insight_lines(), open(os.path.join(OUT, "insights.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"{len(investigations)} investigations, {len(runs)} rows "
      f"({sum(1 for r in runs if r['kind']=='run')} runs, {sum(1 for r in runs if r['kind']=='condition')} conditions)")
for i in investigations:
    print(f"  {i['id']:8} {str(i['acronym'] or '')[:18]:18} runs={i['runs']:4} cond={i['conditions']:3} o2={i['envelope']['o2']} p={i['envelope']['p']} flow={i['envelope']['flow']} varied={i['varied']}")
for l in insight_lines():
    print("  *", l["text"])

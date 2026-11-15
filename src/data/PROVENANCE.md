# Data provenance

- **Source:** NASA Physical Sciences Informatics (PSI), https://psi.nasa.gov, CC0. Downloaded with `scripts/fetch_psi.py` and normalised with `scripts/build_data.py`.
- **Measurements** (`runs.json`): oxygen, pressure, flow, fuel, outcome and burn values are taken from the PSI tables. The only changes are documented unit and typo fixes in `build_data.py` (for example a BRE oxygen value of "3400%" divided by 100). Values the tables do not state are filled with stated defaults and flagged in each run's `assumed` list.
- **Curated fields** (`investigations.json`: `short`, `themes`, `phase`, `rack`, `sensors`, `earth`) and the insight text in `insights.json` were drafted with SI assistance (Claude, Anthropic) from the PSI records, then checked by the author.
- **SI disclosure:** the scripts that produce these files were written with Claude (Anthropic). See `SI_DISCLOSURE.md`.

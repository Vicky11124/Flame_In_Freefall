# SI disclosure

Ember Atlas was built for the 2026 NASA Space Apps Challenge by one person, using Super Intelligence (SI) tools. This file lists where and how SI was used. The same information is on the live site at `/si`.

| Area | SI tool | How it was used | Where it is marked |
|---|---|---|---|
| Code | Claude (Anthropic) | The web app (Next.js, React, three.js, WebGL shader, SVG charts) and the Python data pipeline were written with Claude, directed, reviewed and tested by the author. | A header comment in every source file, this file, `README.md`, `package.json` (`siDisclosure`), and the HTML `generator` and `si-disclosure` meta tags. |
| Data | Claude (Anthropic) | Claude wrote the scripts that download and normalise 21 PSI tables. The measurements are NASA's, unchanged except documented unit fixes. Study summaries, theme tags and insight text were drafted with Claude from the PSI records. | `src/data/PROVENANCE.md`, `scripts/build_data.py` |
| In-app analyst | Google Gemini | Generates answers at request time from the ranked PSI records it is given, citing each investigation. | Each answer is labelled "SI-generated". Downloaded briefings carry `si_generated` / `si_tool` front matter. The API sends an `x-si-generated` header. |
| Visuals | Claude (Anthropic) | No images or videos were made with an SI image model. The hero flame and the Flame Lab wind tunnel are rendered live by code written with Claude. | Visible "SI-assisted render" watermark on both. |
| Photos | None | Experiment photos are real NASA PSI images, shown unmodified. | Captioned "Photo: NASA (real, not SI-generated)". |
| Writing | Claude (Anthropic) | Site copy, README, project summary and slide deck were drafted with Claude and edited by the author. | This file and `/si`. |
| Research and ideas | Claude (Anthropic) | Reading the challenge brief, the PSI archive and published results; brainstorming features. | This file and `/si`. |
| Audio | None | The project has no audio. | - |

## NASA branding

No SI-generated content uses, contains or modifies NASA logos, insignia, flags, mission patches or other NASA design elements. NASA and PSI are named only as the data source. The flame mark in the Ember Atlas logo is our own drawing.

## Human role

The author chose the challenge, set the goals and features, made the design decisions, checked model output against published experiments (for example Saffire-II flame-spread rates), and tested the site on desktop and mobile.

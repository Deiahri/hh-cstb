---
title: Evidence
order: 2
---

The ratings run from **strong**, meaning read from the primary source or computed here, to **weak**, meaning a
snippet, one study, or a different setting. Sources are listed in [sources](/ideas/closed-school-travel-burden/reports/ai-assistant/sources/).

## Computed here (2026-09-27 00:12)

Script: `research/ai-assistant/grounding-size.mts`, run from the app folder. It prints only.

**Context per address** (1,664 grid points in the closed zones) — *strong*

| | Characters | Tokens (chars/4 to ×1.35) |
|---|---|---|
| Median | 883 | 221–298 |
| p95 | 1,364 | 341–460 |
| Max | 1,846 | 462–623 |

**Fixed context** — *strong*

- App English copy (`i18n.ts` before the Spanish dictionary): 17,065 chars, about 4.3k–5.8k tokens.
- Staff files (`corridors.json` 37,883, `zone_requests.json` 47,697, `zones.json` 17,855): 103,435 chars, about 26k–35k
  tokens. These byte counts were checked again against `public/data` in this repo.

**OSM sidewalk tags in the seven zones** — *strong (computed from Overpass)*

- There are 884 street ways, 219.5 km in all. 14.1% of ways (10.0% of km) carry any sidewalk tag: 87 "yes" and 38 "no".
- There are 40.0 km of mapped `footway=sidewalk` ways.
- Ross: 0% tagged. Port Houston: 28 "no", 0 "yes".
- Conclusion: OSM can't answer the §48.151 walkway question.

## Public-sector chatbots that failed

- **NYC MyCity** — *strong.* Launched in Oct 2023 on Azure AI. The Markup (2024-03-29) found it told employers "Yes,
  you can take a cut of your worker's tips", and it gave different answers to the same question. Its disclaimer said it
  "may occasionally produce incorrect, harmful or biased content". In 2026-01 the Mamdani administration moved to end it
  as "functionally unusable", at about $500k a year to maintain and about $600k to build (StateScoop, 2026-01-30).
  *Lesson: answer only from vetted data, and refuse otherwise.*
- **LAUSD "Ed" (AllHere)** — *strong.* A $6M, 5-year contract, of which about $3M was paid. It shut down 2024-06-14 when
  the vendor collapsed. A whistleblower said student personal data in prompts reached third parties, and "seven of eight
  chatbot requests were processed through overseas servers" (GovTech, 2024-07-03). *Lesson: don't keep children's
  data, and don't depend on one vendor.*

## Assistants that worked

- **Georgia State "Pounce"** — *strong for the channel, weak as evidence about LLMs.* Page & Gehlbach, *AERA Open* 2017,
  RCT, N=7,489. On-time enrollment rose 3.3 percentage points. It ran on about 250 staff-written answers, not an LLM, and
  unknown questions went to counselors by email. *Lesson: text channel + curated answers + human fallback.*
- **Nava caseworker assistant** — *moderate.* It retrieved from vetted sources and cited them. In an RCT with 125
  caseworkers, accuracy rose 40% on average. In a 14-week pilot with 61 caseworkers in LA County, only 65% of those with
  access used it, and use declined over time. Answers read at a 10th–12th grade level, above the target. *Lesson: check
  the reading level in code, and expect use to decline.*

## Translation quality

- **Carreras Tartak et al. 2026** (*JMIR Form Res*, PMC12835839) — *moderate.* Claude 3.5 Sonnet translated 100 ED
  discharge instructions into Spanish, averaging 4.9/5 with no harmful errors.
- **Brewster et al. 2024** (*Pediatrics*) — *weak (snippet only).* ChatGPT and Google Translate matched professional
  translation for Spanish and Portuguese, but not for Haitian Creole.
- **Language mix in the zones** — *strong (from the reaching-families report).* 14.8 of the 14.9 limited-English points
  are Spanish.

## Sidewalks from imagery

- **Kang et al. 2021** (*Sensors*, PMC8126193) — *moderate.* A Street View classifier reached 87% image-level and about
  95% street-level accuracy.
- **Google Maps Platform terms §(c)** — *strong.* "No Creating Content From Google Maps Content." The terms give
  "construct an index of tree locations within a city from Street View imagery" as a banned example, and they ban ML use.
- **Lieu et al., arXiv 2609.17882 (Sept 2026)** — *moderate (preprint).* It tested vision-language models on sidewalk
  attributes: "No quantitative attribute reaches the precision required".
- **Mapillary** — not checked, because it needs an access token.

## Law and local context

- **Texas HB 149 (TRAIGA), effective 2026-01-01** — *strong (read from the enrolled bill and the analysis).*
  "Governmental entity" includes political subdivisions, which likely covers the City and HISD. Sec. 552.051 says an
  agency offering an AI system that interacts with consumers must disclose "before or at the time of interaction" that
  it's AI, "clear and conspicuous", with no dark patterns. The Attorney General enforces it, with penalties of
  $10k–$200k.
- **City of Houston 311 "Virtual Agent"**, launched 2021-06-26 — *weak (snippet).*
- **HISD** has a generative-AI guidebook and "AI Future 2" pilot schools in 2026–27 — *weak (snippet).*
- **City of Houston AI policy** — none found.

## Costs

- **Claude list prices** ($ per 1M tokens in/out, from the claude-api skill, cached 2026-06-24, checked 2026-09-27):
  Haiku 4.5 $1/$5, Sonnet 5 $2/$10, Opus 5 $5/$25, Opus 5.5 $4/$20. *Strong.*
- **Twilio US SMS**: $0.0083 per segment each way, plus 10DLC registration fees. *Strong (read).*

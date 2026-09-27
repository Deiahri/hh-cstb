# Handoff: "Add AI to the Walk Check app" research report

Written 2026-09-27 ~00:15 Houston time. The session stopped partway. **The research and the script are done. The
report itself is NOT written yet.**

## The task
The team asked for ideas on adding AI to this app: a chatbot that explains the site, or one that acts for you. The
ideas go into a research report, not code. Approved plan: `~/.claude/plans/for-the-builds-closed-school-travel-smooth-brook.md`.

**Where it goes:** `site/content/Idea Research/Closed-School Travel Burden/Reports/ai-assistant/`. The folder
doesn't exist yet, and no sibling topic existed as of 00:01.
- `Report.md`. Frontmatter: title, `slug: ai-assistant`, `status: exploratory`, `updated: 2026-09-27 00:01`,
  question, prompted_by, headline. Sections: `## Summary` (idea table with verdicts), one section per idea group,
  "How it reads to the City judge", "What doesn't hold up", "What this means for the build", "Open questions".
- `idea-catalog.md` (`order: 1`), `evidence.md` (`order: 2`), `build-notes.md` (`order: 3`), and `sources.md`
  (`order: 99`, with a Read / Snippet / Blocked / Computed status column).
- Copy the style of `Reports/warning-families/Report.md`: a neutral report, not a pitch, with a strength rating on
  every finding and a "what doesn't hold up" table. Cross-links use `/ideas/closed-school-travel-burden/reports/<topic>/`.
- Then add a row to the Topics table in `research/README.md`, and one line to the research-folder memory.

## Script (done, ran OK)
`research/ai-assistant/grounding-size.mts`. Run it from this app folder:
`npx tsx ../../../research/ai-assistant/grounding-size.mts` (add `--no-osm` to skip the network part). It prints only.

**Computed results (2026-09-27 00:12):**
- **Context per address** (the JSON describing zones, walks, crossings, controls and the shuttle), over 1,664 grid
  points in the closed zones: median 883 characters, p95 1,364, max 1,846. That's about 221–298 tokens at the median
  and 462–623 at the max. Tokens are estimated as chars/4 up to ×1.35, because no API key was available for
  `count_tokens`.
- **Fixed context:**
  - The app's English copy (i18n.ts before the Spanish dictionary) is 17,065 characters, about 4.3k–5.8k tokens.
  - The staff files (`corridors.json`, `zone_requests.json`, `zones.json`) total 103,435 characters, about 26k–35k
    tokens. They fit whole in context, so no retrieval layer is needed.
- **Cost of one conversation.** Assumed shape: 5 questions of ~300 characters, 5 answers of ~800, the full history
  resent each turn, no caching, so these are upper bounds.

  | Conversation | Haiku 4.5 | Sonnet 5 | Opus 5 |
  |---|---|---|---|
  | Family | $0.045 | $0.091 | $0.227 |
  | Staff | $0.19 | $0.38 | $0.94 |
  | 10,000 family chats | $454 | $909 | $2,272 |

  List prices from the claude-api skill (cached 2026-06-24), $ per 1M tokens in/out: Haiku 4.5 $1/$5, Sonnet 5
  $2/$10, Opus 5 $5/$25, Opus 5.5 $4/$20.
- **OSM sidewalk tags:** 884 street ways, 219.5 km, in the seven zones. Only 14.1% of ways (10.0% of km) carry any
  sidewalk tag: 87 "yes", 38 "no". There are 40.0 km of mapped footway=sidewalk ways.
  - Ross: 0% tagged.
  - Port Houston: 28 ways tagged "no" and 0 "yes".
  - Takeaway: OSM can't fill the §48.151 "walkway" gap.

## Research findings (all read unless marked)
- **NYC MyCity chatbot.** Launched Oct 2023 on Microsoft Azure AI. The Markup (2024-03-29) found it told businesses
  "Yes, you can take a cut of your worker's tips" and gave different answers to the same question. Its disclaimer said
  it "may occasionally produce incorrect, harmful or biased content". Mayor Mamdani moved to kill it (StateScoop,
  2026-01-30): "functionally unusable", ~$500k a year to maintain, ~$600k to build.
- **LAUSD "Ed" (AllHere).** A $6M, 5-year contract with ~$3M paid. It was shut down 2024-06-14 when the vendor
  collapsed. A whistleblower said student personal data in prompts went to third parties, and "seven of eight chatbot
  requests were processed through overseas servers" (GovTech, 2024-07-03).
- **Texas TRAIGA (HB 149), effective 2026-01-01.** "Governmental entity" includes any political subdivision, which
  likely covers the City and HISD. Sec. 552.051: a governmental agency offering an AI system that interacts with
  consumers must disclose "before or at the time of interaction" that it's AI, "clear and conspicuous", with no dark
  patterns. The AG enforces it, with penalties of $10k–$200k. Source: capitol.texas.gov HB00149F and the E analysis.
  If the City or HISD adopted the tool, the disclosure would apply. Show it anyway.
- **Georgia State "Pounce"** (Page & Gehlbach, *AERA Open* 2017, RCT, N=7,489): +3.3 percentage points on-time
  enrollment by text message. This was **not an LLM**. It ran on a ~250-question staff-seeded knowledge base, and
  unknown questions were emailed to counselors. The lesson: a text channel plus a curated knowledge base plus a
  human fallback worked.
- **Nava caseworker chatbot** (retrieval over vetted sources with citations): an RCT with 125 caseworkers and a
  14-week pilot with 61 of them in LA County. Accuracy +40% on average. Only 65% of those with access used it, and use
  declined over time. Answers read at a 10th–12th grade level, above the target.
- **Translation:**
  - Carreras Tartak et al. 2026 (*JMIR Form Res*, PMC12835839): Claude 3.5 Sonnet translated 100 ED discharge
    instructions into Spanish, averaging 4.9/5, with no harmful errors.
  - Brewster et al. 2024 (*Pediatrics*, Snippet): ChatGPT and Google Translate matched professional translation for
    Spanish and Portuguese but not Haitian Creole.
  - reaching-families found 14.8 of the 14.9 limited-English points in the zones are Spanish, so more languages is
    low value.
- **Sidewalk from imagery:**
  - Kang et al. 2021 (*Sensors*, PMC8126193): a Google Street View classifier with 87% image-level and ~95%
    street-level accuracy.
  - The Google Maps Platform ToS §(c) says "No Creating Content From Google Maps Content" and gives "construct an index
    of tree locations within a city from Street View imagery" as an example. It also bans ML use. So Street View is
    off-limits.
  - Lieu et al. (arXiv 2609.17882, Sept 2026) tested vision-language models on sidewalk attributes: "No quantitative
    attribute reaches the precision required".
  - Mapillary needs a token, so it wasn't checked.
- **Houston context:**
  - The City's 311 "Virtual Agent" launched 2021-06-26 (Snippet).
  - HISD has a generative-AI guidebook and "AI Future 2" pilot schools in 2026–27 (Snippet).
  - No City of Houston AI policy was found.
- **Twilio US SMS:** $0.0083 per segment in or out, plus 10DLC registration fees (read).

## Ideas and draft verdicts
1. **"Ask about my result" explainer** on Lookup, grounded on the address JSON above, EN/ES, read-only. **Build first.**
2. **The assistant drives the app** (set the address, move the stop pin, open the plan or packet, switch language, fill
   the copy box). It **never submits** HISD or City forms, because bulk-filing fails the judge filter. **Later**, as an
   extension of #1.
3. **Walkway-conditions helper:** the family describes the walk in their own words or language, and the AI drafts the
   English sentence for the form's one box. The family confirms. OSM can't supply sidewalk data, so the family's
   words are the only evidence. **Build first, alongside #1.**
4. **More languages.** **Don't:** the zones are almost all Spanish.
5. **SMS or phone front door** for the 17.3% of households with no home internet. Pounce is the evidence for it. **Later**,
   since it needs a number, 10DLC registration and consent.
6. **Staff Q&A over corridors and zone requests, plus help drafting the April 15 narrative.** The data fits in context,
   and this is the audience for the City judge (Innovation & Performance). **Build second / demo candidate.**
7. **Letter or flyer photo decoder.** **Later.** The shuttle times aren't published anyway.
8. **Sidewalk detection from street imagery.** **Don't** (Google ToS, poor VLM precision). Possibly Mapillary later.

**Guardrails for build-notes:**
- Enforce the copy rules at the top of `src/lib/i18n.ts`: never "safe", never "qualifies", about 6th-grade reading
  level. Check the model's output for those words in code.
- Answer only from the grounding JSON plus the app copy, and say "not in the data" otherwise. That's the NYC lesson.
- Show a TRAIGA-style "this is AI" notice.
- The app is static with no backend, so it needs a small proxy to hold the API key.
- Don't store addresses, since they're children's home locations (the LAUSD lesson).
- Model: the claude-api skill says to default to `claude-opus-5`. Haiku 4.5 / Sonnet 5 are the team's cost choice;
  present them as options.

## Status (2026-09-27, continued in the hh-cstb repo)
- **Report written** to `docs/ai-assistant/` in this repo: `Report.md`, `idea-catalog.md`, `evidence.md`,
  `build-notes.md`, `sources.md`. The frontmatter and cross-links follow the plan, so the folder can be copied to
  `site/content/Idea Research/Closed-School Travel Burden/Reports/ai-assistant/` unchanged.
- This repo holds only the app. The site folder, `research/` (README and script), the plan file and
  `Reports/warning-families/` aren't here, so the style was matched from the description above, not the file.
- **Still to do where the site lives:** copy the folder over, add a row to the Topics table in `research/README.md`,
  and add the research-folder memory line.
- Build notes add an Opus 5.5 column (Opus 5 × 0.8, not from the script).
- Nothing in the app changed.

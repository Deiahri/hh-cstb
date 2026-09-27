---
title: Sources
order: 99
---

Status key: **Read** means the full source was read. **Snippet** means only a search excerpt or abstract.
**Blocked** means it couldn't be accessed. **Computed** means it was derived here from data.

| Source | Used for | Status |
|---|---|---|
| `research/ai-assistant/grounding-size.mts`, run 2026-09-27 00:12 | Context size per address, fixed context, cost table, OSM sidewalk tags | Computed |
| `public/data/corridors.json`, `zone_requests.json`, `zones.json` (byte counts) | Staff context size (103,435 chars) | Computed |
| OpenStreetMap via Overpass, street ways in the seven zones | Sidewalk tag coverage | Computed |
| The Markup, "NYC's AI chatbot tells businesses to break the law" (2024-03-29) | MyCity wrong answers, disclaimer | Read |
| StateScoop, NYC MyCity chatbot shutdown (2026-01-30) | "Functionally unusable", ~$500k/yr, ~$600k build | Read |
| GovTech, LAUSD "Ed" / AllHere (2024-07-03) | Contract size, shutdown, overseas processing | Read |
| Texas HB 149 enrolled text (capitol.texas.gov HB00149F) and bill analysis (E version) | TRAIGA definitions, Sec. 552.051 disclosure, penalties | Read |
| Page & Gehlbach, *AERA Open* 2017, "How an artificially intelligent virtual assistant helps students navigate the road to college" | Pounce RCT, +3.3 pp, knowledge base + counselor fallback | Read |
| Nava PBC, caseworker AI assistant RCT and LA County pilot | +40% accuracy, 65% uptake, reading level | Read |
| Carreras Tartak et al. 2026, *JMIR Formative Research* (PMC12835839) | Claude 3.5 Sonnet Spanish discharge-instruction quality | Read |
| Brewster et al. 2024, *Pediatrics* | ChatGPT / Google Translate vs professional, by language | Snippet |
| Kang et al. 2021, *Sensors* (PMC8126193) | Street View sidewalk classifier accuracy | Read |
| Google Maps Platform Terms of Service, §(c) | Ban on creating content / ML from Street View | Read |
| Lieu et al., arXiv 2609.17882 (Sept 2026) | VLM precision on sidewalk attributes | Read |
| Mapillary API | Alternative imagery | Blocked (needs token) |
| City of Houston 311 "Virtual Agent" launch (2021-06-26) | Local precedent | Snippet |
| HISD generative-AI guidebook; "AI Future 2" pilot schools 2026–27 | Local context | Snippet |
| City of Houston AI policy | Local context | Not found |
| Twilio US SMS pricing page | $0.0083/segment, 10DLC fees | Read |
| claude-api skill model table (cached 2026-06-24, checked 2026-09-27) | Model IDs and list prices | Read |
| Reaching-families report (this project) | 14.8 of 14.9 limited-English points are Spanish; 17% no home internet | Read |
| `src/lib/i18n.ts` (this repo) | Copy rules; §48.151 walkway text; "Walk Route Concerns" instructions | Read |

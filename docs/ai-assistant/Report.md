---
title: Adding AI to the Walk Check app
slug: ai-assistant
status: exploratory
updated: 2026-09-27 00:01
question: >
  Where could an AI assistant help families and staff use the Closed-School Walk Check, whether it explains the
  site or acts for the user, and where would it cause harm?
prompted_by: Team request for AI ideas (a chatbot that explains the site, or one that acts for you), 2026-09-26
headline: >
  Two small, read-only features are worth building: a grounded "ask about my result" explainer and a helper that
  turns a family's own words into the one sentence HISD's form asks for. A staff Q&A over the corridor data is the
  best demo for the City judge. Skip more languages and sidewalk detection from imagery.
---

## Summary

The app already computes everything an assistant would need to explain a result. The JSON for one address has a
median size of 883 characters (about 220–300 tokens). All of the staff data (corridors, zone requests, zones) is
103,435 characters (about 26k–35k tokens), so it fits in one prompt and needs no retrieval layer. A family
conversation costs about 5–23 cents at list price, before caching. The risks come from what the assistant says and
what it keeps, not from cost. NYC's MyCity bot gave illegal advice and was shut down. LAUSD's "Ed" sent student
data overseas and folded with its vendor.

| # | Idea | Who it's for | Verdict | Strength of case |
|---|---|---|---|---|
| 1 | "Ask about my result" explainer, EN/ES, read-only | Families | **Build first** | Strong |
| 3 | Walkway-conditions helper: family's words → one English sentence for the form | Families | **Build first**, with #1 | Strong |
| 6 | Staff Q&A over corridors and zone requests, plus help drafting the April 15 application | City / HISD staff | **Build second (demo candidate)** | Moderate–strong |
| 2 | Assistant drives the app (address, stop pin, plan, packet, language) but never submits a form | Families | **Later**, as an extension of #1 | Moderate |
| 5 | SMS or phone front door | Households with no home internet (17%) | **Later** | Moderate (evidence is strong, but setup is heavy) |
| 7 | Photo decoder for a letter or flyer | Families | **Later** | Weak |
| 4 | More languages | Families | **Don't** | Weak: 14.8 of 14.9 limited-English points are Spanish |
| 8 | Sidewalk detection from street imagery | Staff / data | **Don't** | Weak: blocked by license, precision too low |

Full descriptions are in the [idea catalog](/ideas/closed-school-travel-burden/reports/ai-assistant/idea-catalog/).
The evidence behind each rating is in [evidence](/ideas/closed-school-travel-burden/reports/ai-assistant/evidence/),
and the guardrails and costs are in [build notes](/ideas/closed-school-travel-burden/reports/ai-assistant/build-notes/).

## Explaining the result (ideas 1 and 3)

**Finding: a grounded explainer is small and cheap.** *Strength: strong (computed).* The Lookup result is already
structured: zones, the two walks, dangerous roads and rail crossed, where to cross, controls and the shuttle. Serialized,
it's 883 characters at the median and 1,846 at the max over 1,664 grid points in the closed zones. Add the app's English
copy (17,065 characters, about 4.3k–5.8k tokens) and the model has the full picture for well under 10k tokens.

**Finding: the walkway box is where families get stuck, and only the family can fill it.** *Strength: strong.* Texas's
hazardous-walk test (Tex. Educ. Code §48.151) asks whether there's a walkway. Houston doesn't publish sidewalk data, and
OpenStreetMap doesn't fill the gap. Only 14.1% of the 884 street ways in the seven zones (10.0% of the 219.5 km) carry any
sidewalk tag. Ross has none. Port Houston's 28 tagged ways are all "no". So the family's own description is the only
evidence. An assistant that takes that description in Spanish or in loose English and drafts one plain English sentence
for the Description box (which the family then confirms) fills a real gap. It invents nothing.

**What precedent says.** Georgia State's "Pounce" raised on-time enrollment by 3.3 points in an RCT (N=7,489). It wasn't
an LLM. It answered from a ~250-question knowledge base written by staff and emailed counselors when it didn't know. Nava's
caseworker assistant answered from vetted sources with citations and raised accuracy by 40%. The pattern that holds up:
answer only from curated sources, and hand off when the answer isn't there.

## Acting for the user (idea 2)

**Finding: letting the assistant drive the app is fine, but submitting forms isn't.** *Strength: moderate.* Moving the stop
pin, opening the plan or packet, switching language and filling the copy box are all actions the family can see and undo.
Submitting HISD's Transportation Support Request Form or a City application for the family isn't. It would turn one
family's evidence into bulk filings and take the decision out of their hands. It also breaks the copy rule "the page
gathers evidence; HISD decides." Build this after #1 and reuse its grounding.

## Other channels and inputs (ideas 4, 5, 7, 8)

- **SMS (5).** 17% of households in the zones have no home internet. Pounce's result came over text message. But a real
  line needs a number, 10DLC registration, consent handling and a backend. Twilio's US rate is $0.0083 per segment each
  way, and registration fees come on top. The app's existing "Text this" `sms:` link covers the demo.
- **Letter or flyer photos (7).** HISD hasn't published the shuttle times, so a decoder would have little to decode.
- **More languages (4).** The reaching-families analysis found 14.8 of the 14.9 limited-English points in the zones are
  Spanish. The app already ships Spanish. The better use of AI is to check the existing Spanish: Claude 3.5 Sonnet averaged
  4.9/5 on ED discharge instructions with no harmful errors, though a human review is still needed.
- **Sidewalks from imagery (8).** The Google Maps terms forbid building an index from Street View imagery, and the ban
  covers ML use. A 2026 test of vision-language models on sidewalk attributes found "no quantitative attribute reaches the
  precision required". Mapillary wasn't checked, because it needs a token.

## Staff tools (idea 6)

**Finding: a staff Q&A is the strongest demo for the City judge.** *Strength: moderate–strong.* The judge sits in
Innovation & Performance, and staff are the audience for the Corridors and Before April 15 pages. All of the staff data
fits in one prompt. That makes "Which corridors near Ross have no signal within 400 m?" or "draft the narrative for this
school's zone application" answerable from the app's own numbers, with citations. A staff conversation costs about
19–94 cents at list price, before caching. Staff are also better placed than families to catch a wrong answer.

## How it reads to the City judge

- **Strong point:** the answers come from public City and HISD layers the app already recomputes. The AI explains and
  drafts. It doesn't decide.
- **Strong point:** it goes after known failures. It answers only from its data and says "not in the data" otherwise (the
  NYC lesson). It stores no addresses (the LAUSD lesson). It shows a clear "this is AI" notice. Texas HB 149 (TRAIGA),
  in force since 2026-01-01, requires that notice from a governmental entity that offers an AI system to consumers. It
  would apply if the City or HISD adopted the tool.
- **Weak point:** Houston has no published AI policy that we found. The City's 311 "Virtual Agent" (2021) is the only
  precedent, so the judge has little local to anchor on.
- **Weak point:** an AI feature can pull attention from the core evidence. Present it as a helper on top of the walk
  check, not as the product.

## What doesn't hold up

| Claim | Why it doesn't hold | What to say instead |
|---|---|---|
| "AI can map the missing sidewalks" | OSM tags cover 10% of km. Street View is off-limits by license. VLM precision is too low. | "The family's own description is the walkway evidence. AI helps them write it down." |
| "A chatbot will reach families who don't use the site" | Pounce reached them by SMS, not web chat. 17% have no home internet. | "Web chat helps families already on the page. Reaching the rest takes SMS, which is later work." |
| "Add Vietnamese, Chinese…" | 14.8 of 14.9 limited-English points are Spanish. | "Spanish covers the zones. Spend the effort on reviewing the Spanish." |
| "The assistant can file the request for you" | Bulk filing breaks the evidence-not-advocacy stance and fails the judge filter. | "It fills the copy box. The family pastes and submits." |
| "It's basically free" | Cheap per chat (≈ $0.05–$0.23), but it needs a proxy for the API key and someone to maintain it. MyCity cost ~$500k a year. | "Pennies per chat, plus a small server and an owner." |
| Token figures are exact | Estimated as chars/4 × up to 1.35. There was no API key for `count_tokens`. | Quote ranges and treat cost as an upper bound. |

## What this means for the build

1. Add #1 and #3 together on the Lookup result, as one panel with two entry points ("Ask about this result" and "Help me
   describe the sidewalk"). Ground it only on the address JSON and the app copy.
2. Add a small proxy (such as a serverless function) to hold the API key. The app is static and must stay that way for
   everything else.
3. Build #6 on the Corridors page for the demo if there's time.
4. Leave #2, #5 and #7 in the backlog. Drop #4 and #8.

Guardrails, prompts and cost detail are in [build notes](/ideas/closed-school-travel-burden/reports/ai-assistant/build-notes/).

## Open questions

- Would the City or HISD host this, which would make TRAIGA apply, or would it stay a community tool? We show the notice either way.
- Who owns the proxy and the key after the hackathon?
- Should a native speaker review the Spanish answers before families see them, as they should for the rest of the app?
- Does Mapillary imagery cover the zones well enough, and under what license? This hasn't been checked.
- Model choice: Opus 5 is the default. Is Haiku 4.5 or Sonnet 5 good enough for #1 and #3? Test on sample addresses before deciding.

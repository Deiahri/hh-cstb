---
title: Idea catalog
order: 1
---

Each idea has what it does, what it reads, what it may do, and its verdict. The numbers match the
[report](/ideas/closed-school-travel-burden/reports/ai-assistant/).

## 1. "Ask about my result" explainer — Build first

- **What it does:** a chat panel under the Lookup result. The family can ask things like "Why does it say one
  dangerous road?", "Where should we cross?", "What happens in 2028?" or "Does my Pre-K child get the shuttle?". The
  panel answers in English or Spanish, whichever the page is showing.
- **Reads:** the result JSON for that address (zones, both walks, roads and rail crossed, crossings, controls, shuttle),
  plus the English app copy (`src/lib/i18n.ts`, before the Spanish dictionary).
- **May do:** answer and point to the part of the page it's quoting. Nothing else.
- **Must not:** answer from outside its data, say "safe", say a family qualifies, or give legal advice.
- **Size:** about 220–620 tokens per address, plus about 4.3k–5.8k tokens of copy.

## 2. Assistant drives the app — Later

- **What it does:** "Move the stop to the corner of Lyons and Waco." "Show me the walk plan." "Switch to Spanish."
  "Fill in the text for HISD."
- **Tools:** set the address, move the stop pin, open the plan or packet, set the language, fill the copy box. Each is an
  action already in the UI, visible and reversible.
- **Never:** submit HISD's Transportation Support Request Form or a City application. The family pastes and submits.
- **Why later:** it adds tool use and UI state to #1. Build it once #1 has proven its answers.

## 3. Walkway-conditions helper — Build first, with #1

- **What it does:** the family describes the walk in their own words and language ("no hay banqueta en Lyons, los
  niños caminan en la calle junto a los camiones"). The helper drafts one plain English sentence for the form's
  Description box: *"There is no sidewalk on Lyons Ave between our home and the school; children walk in the street next
  to truck traffic."* The family edits or confirms it before it goes into the copy box.
- **Why:** §48.151 asks about a walkway. Houston doesn't publish sidewalk data, and OSM tags only 10% of street km in the
  zones. The family's account is the only evidence.
- **Must not:** add facts the family didn't give, or make the account stronger than they said it.

## 4. More languages — Don't

The zones' limited-English households are almost all Spanish-speaking (14.8 of 14.9 points). The app already has
Spanish. A better use of AI here is a first-pass check of the existing Spanish, followed by a human review.

## 5. SMS or phone front door — Later

- **What it does:** a family texts an address and gets back the one-line answer and where to cross, and can ask follow-ups.
- **Why it's promising:** 17% of households have no home internet, and Georgia State's Pounce (text message, curated
  answers, human fallback) moved enrollment in an RCT.
- **Why later:** it needs a phone number, 10DLC registration, opt-in and opt-out, a backend, and someone to answer
  hand-offs. The existing `sms:` "Text this" link is enough for the demo.

## 6. Staff Q&A and April 15 drafting — Build second (demo candidate)

- **What it does:** on the Corridors and Before April 15 pages, staff ask questions of `corridors.json`,
  `zone_requests.json` and `zones.json`, such as which corridors carry the most walks, or what one school's request
  covers. They can also ask for a first draft of a school's zone-application narrative from its numbers.
- **Size:** 103,435 characters in all (about 26k–35k tokens), which fits in context with no retrieval layer.
- **Must:** cite the corridor or request ID behind each number, and leave the final wording to staff.

## 7. Photo decoder for a letter or flyer — Later

A family photographs an HISD letter and asks what it means for them. Low value today because HISD hasn't published
the shuttle times, so there's little to decode. Revisit once letters with times go out.

## 8. Sidewalk detection from imagery — Don't

A classifier on Google Street View reached 87% image-level accuracy in one study, but the Google Maps terms forbid it.
Vision-language models don't reach usable precision on sidewalk attributes. Mapillary might be an option later, but
it's unchecked.

---
title: Build notes
order: 3
---

These are notes for building ideas 1, 3 and 6. Nothing in the app has changed yet.

## Architecture

- **The app stays static.** The AI panel calls a small proxy, such as one serverless function, that holds the API key
  and forwards to the Messages API with the official SDK (`@anthropic-ai/sdk`). The browser never sees the key.
- **The proxy stores nothing.** No address, coordinates, conversation or IP log. These are children's home locations
  (the LAUSD lesson). Log only counts and errors.
- **Grounding goes in the prompt, not through retrieval.** The system prompt holds the copy rules and the English app
  copy. The user turn starts with the address JSON the page already computed. For staff (#6), the three staff files go
  in the system prompt. At about 26k–35k tokens they fit easily.
- **Caching.** The app copy and staff files don't change between conversations, so put them first and mark them with
  `cache_control`. The costs below assume no caching, so they're upper bounds.

## Guardrails

1. **Copy rules from `src/lib/i18n.ts`, checked in code, not only in the prompt.** After each answer, reject or
   regenerate if it contains "safe", "seguro/segura", "qualify", "qualifies" or "califica". Aim for about a
   6th-grade reading level. Run a reading-level check and ask again for a shorter answer if it's too hard (Nava's
   answers crept up to a 10th–12th grade level).
2. **Answer only from the data.** If the JSON or the copy doesn't say it, reply "That's not in this page's data" and
   point to HISD or the City contact the page already lists. This is the NYC MyCity lesson.
3. **Show a "this is AI" notice** before the first message, in the page's language, clear and conspicuous (TRAIGA
   Sec. 552.051). Show it even if the tool is never adopted by the City or HISD.
4. **Never submit anything.** Idea #2's tools stop at filling the copy box. The family pastes and submits.
5. **Walkway helper (#3):** the draft may only restate what the family wrote. Show it next to their words, and require
   a tap to confirm before it goes into the copy box.
6. **Spanish:** answers in Spanish carry the same "not professionally reviewed" note the app already shows.

## Model and cost

The claude-api skill defaults to `claude-opus-5`. Cheaper models are the team's call: test Haiku 4.5
(`claude-haiku-4-5`) or Sonnet 5 (`claude-sonnet-5`) on sample addresses before switching. Opus 5.5 (`claude-opus-5-5`)
is launching at lower prices than Opus 5 and is worth naming as an option.

Assumed conversation: 5 questions of about 300 characters, 5 answers of about 800, the full history resent each turn,
and no caching.

| Conversation | Haiku 4.5 | Sonnet 5 | Opus 5 | Opus 5.5 |
|---|---|---|---|---|
| Family | $0.045 | $0.091 | $0.227 | ≈ $0.18 |
| Staff | $0.19 | $0.38 | $0.94 | ≈ $0.75 |
| 10,000 family chats | $454 | $909 | $2,272 | ≈ $1,818 |

The Opus 5.5 column is Opus 5 × 0.8 (both input and output prices are 0.8× Opus 5). The script didn't compute it.
Token counts are estimates (chars/4 up to ×1.35), because there was no API key for `count_tokens`. Re-run with
`count_tokens` once there's a key.

## Suggested order

1. Proxy, AI notice, and #1 on Lookup (EN/ES) with the word filter.
2. #3 as a second button in the same panel.
3. #6 on the Corridors page, if there's time before the demo.
4. Backlog: #2 (tools over existing UI actions), #5 (SMS), #7 (photo decoder).

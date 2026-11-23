# Generate candidates aimed at genuine novelty

Read STYLE.md first (Boris's rules; note r16: names mostly plain, only ~1 in 8 memorable).
Files in this folder:
- recent_effects.json: ~40 effects discovered 1990-2025, the least-explored raw material.
- new_jobs.json: 15 jobs 2030 needs that the historical board doesn't have.
- inventory.json: 359 older effects from deck cards no invention uses yet. existing_effects.json: the 129 effects already on the board.
- board_cards.json: board cards (id, t, y, job) — parts must come from here. used_by_job.json: effects each existing job already uses.
- existing_names.json: Future Technologies already proposed; don't repeat them.

Every candidate MUST use at least one recent effect (from recent_effects.json) or do one of the new jobs (new_jobs.json), and is best when it does both. Chains of 2-3 effects are welcome.

The point is novelty: things for which NO WORKING VERSION exists yet. Before writing each one, ask yourself whether you know of a product, prototype or published demonstration that already does it; if you do, drop it or push it further until you don't. Expect plausibility 2-4; obviously buildable ideas usually exist already. No magic: it must respect known physics, chemistry and biology. It must matter (r14).

Output a JSON array (about 50 items) to the output file you were given. Each element:
{"id": "short-kebab-slug", "name": "...", "subtitle": "plain, at most 8 words",
 "job": "an existing board job or one from new_jobs.json", "newJob": true/false,
 "effects": [{"effect": "...", "card": "card id from recent_effects.json, inventory.json or existing_effects.json", "recent": true/false}],
 "parts": ["board card ids, 1-4"], "how": "2-3 sentences, problem first", "obstacle": "one sentence",
 "searchQuery": "the web search you'd run to check whether a working version exists (6-10 words)",
 "plausibility": 1-5, "why": "at most 20 words"}

Validate before finishing: parts are board card ids; every effect card id is in one of the three effect files; at least one effect is recent or the job is new. Reply only with: count, and your 5 favourites (name: subtitle).

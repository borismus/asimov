# Future Technologies from the TRIZ effect cards

Read STYLE.md first: it holds Boris's approved rules for Future Technology cards (plain names,
problem first, the obstacle, it must matter, parts inside the device).

The raw material this round is new. Boris curated physical effects from the TRIZ Effects Database
into phenomenon cards: `triz_effects.json` (117 cards). Each one has the effect, what it is already
`usedIn`, how strong it is, and `can`: the TRIZ functions it performs ("Move / Liquid",
"Heat / Solid", "Detect / Field"...). Your slice of effect ids is the input file you were given.

Other files in this folder:
- board_cards.json: existing inventions (id, t, y, job). Parts must come from here.
- used_by_job.json: the effects each existing job already works by.
- new_jobs.json: 15 jobs 2030 needs that the historical board doesn't have.
- existing_effects.json / inventory.json: older effects already in the deck; you may chain one in.
- existing_names.json: Future Technologies already proposed. Don't repeat them or near-copies.

## The method

For each effect in your slice, use its `can` list to ask: which board jobs or new jobs need this
function, and don't use this effect yet (check used_by_job.json and the effect's own usedIn)? That
pairing, a job meeting an effect it has never worked by, is Arthur's definition of an invention.
Then pick the parts and write the card. Chains of 2-3 effects are welcome (r17), but at least one
effect from YOUR slice must be new to the job.

Aim for genuine novelty: before writing a candidate, ask whether you know of a product, prototype
or published demonstration that already does this job by this effect. If you do, drop it or push it
until you don't. Expect plausibility 2-4. No magic. It must matter (r14). Skip effects in your slice
that yield nothing good; don't force one per effect. Spread across many jobs, not just energy and
cooling.

## Output

Write a JSON array of about 30 items to the output file you were given. Each element:
{"id": "short-kebab-slug", "name": "...", "subtitle": "plain, at most 8 words",
 "job": "an existing board job or one from new_jobs.json", "newJob": true/false,
 "effects": [{"effect": "plain phrase", "card": "id from triz_effects.json, existing_effects.json or inventory.json", "triz": true/false, "newToJob": true/false}],
 "parts": ["board card ids, 1-4"], "how": "2-3 sentences, problem first", "obstacle": "one sentence",
 "searchQuery": "the web search you'd run to check whether a working version exists (6-10 words)",
 "plausibility": 1-5, "why": "at most 20 words"}

Validate with a short script before finishing: parts are board card ids; every effect card id exists
in one of the effect files; at least one effect has triz true, comes from your slice and is newToJob.
Don't use the web. Reply only with: count, and your 5 favourites (name: subtitle).

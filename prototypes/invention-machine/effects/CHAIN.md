# Generate chained-effect Future Technologies

Read STYLE.md (same folder) first. Files: inventory.json (359 effects from deck cards no invention uses yet: card, title, year, effect, does, strength, alsoCards), board_cards.json (board cards: id, t, y, job), used_by_job.json (effects each job already uses), existing_effects.json (the 129 effects already on the board, with their card ids), and existing_names.json (Future Technologies already proposed; don't repeat them).

Goal: new inventions nobody has built yet, made by CHAINING two or three effects in one device (rule r17), with at least one effect new to the job (not in used_by_job.json for that job). Chains are where new things hide: heat -> magnetism -> current; a tear enzyme opening a drug capsule; sunlight -> salt brine -> water. Mix fresh effects from inventory.json with effects already on the board (existing_effects.json). Old effects are fine when the combination is new.

Stick to your assigned jobs (given in your instructions). Propose about 15 candidates, quality over count. Check each against what you know: if it has been built, either drop it or note the closest prior art honestly in `real`. Prefer ones that don't exist yet but are plausible with known physics, chemistry and biology. They must matter (r14).

Output a JSON array to the output file you were given. Each element:
{"id": "short-kebab-slug", "name": "evocative, 1-3 words", "subtitle": "plain, at most 8 words",
 "job": "exact board job", "effects": [{"effect": "plain phrase", "card": "deck card id", "newToJob": true/false}],
 "parts": ["board card ids, 1-4, inside the device"], "how": "2-3 sentences, problem first",
 "obstacle": "one sentence", "real": null or "closest prior art and rough date",
 "plausibility": 1-5, "why": "at most 20 words: why this chain is interesting"}

Validate before finishing: job in board_cards.json, parts are board card ids, at least one effect has newToJob true and is truly absent from used_by_job.json for that job, each effect card id exists in inventory.json (card or alsoCards) or existing_effects.json. Reply only with: count, and your 5 favourites (name: subtitle).

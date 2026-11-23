# Judge: pair fresh effects with jobs to propose "Future Technologies"

Context: invention.cards has an "assembly board" where every invention card does a **job** (e.g. "makes light", "measures", "stores data") by one or more **effects** (natural phenomena, short plain phrases), and is built from other cards as **parts**. Following W. Brian Arthur, a real invention puts an effect to work on a job it has never been used for. The owner, Boris, wants plausible new inventions, playfully called "Future Technology N", built from what the deck already contains.

Files (all in this folder):
- your input `judge_inN.json`: effects found on deck cards that no invention on the board uses yet. Each has card, title, year, effect, does (input -> output), strength.
- `board_cards.json`: the 432 board cards with id, title (t), year (y) and job. Jobs and parts must come from here.
- `used_by_job.json`: for each job, the effects board cards already use for it.

For each effect in your input, propose 0, 1 or 2 candidates. A candidate is a device or method that does an EXISTING board job by THIS effect, built from EXISTING board cards as parts. Boris's approved rules:
- r1: the job must be on the board, and the effect must not already be in used_by_job.json for that job.
- r3: no improvements. If the job is really still done by its old effect, skip it.
- r5: reject when the effect is real but far too weak to do the job at a useful size.
- r9: parts must be physically inside the device. Fuel, feedstock and whatever makes them stay out.
- r11: if a part already does the job by this same effect, name the narrower effect that is actually new.
- r12: at least one part. Use 1 to 4 parts, by exact board card id.
- r13: "how" is two or three sentences a curious reader follows without looking anything up: what it is, what it's for, and how the effect does the job.
Prefer candidates that do NOT exist yet, or exist only in labs, over ones already in everyday use; those are the point. But be honest: if the candidate is an existing technology, name it in `real` (e.g. "Doppler radar, 1940s"). Skip effects with nothing plausible rather than forcing one; quality beats count. No perpetual motion, no magic, nothing that breaks known physics.

Write a JSON array to the output file you were given. Each element:
{"id": "short-kebab-slug", "name": "plain name, at most 5 words", "job": "exact board job",
 "effect": "the effect phrase (narrowed per r11 if needed)", "effectCard": "the input card id",
 "parts": ["board card ids"], "how": "2-3 sentences",
 "real": null or "existing technology and rough date",
 "plausibility": 1-5 (5 = clearly buildable with today's know-how), "why": "at most 20 words: why this pairing is interesting"}

Validate before finishing: every job is in board_cards.json, every part id is a board card id, and the effect is not in used_by_job.json for that job. When done, reply only with: number of candidates, how many have real == null, and your 5 favourites (name: one line).

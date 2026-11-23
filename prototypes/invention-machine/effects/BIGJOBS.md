# Big Future Technologies, job first

Read STYLE.md first: Boris's approved card rules (plain names, problem first, obstacle, parts...).

Earlier rounds started from an effect and looked for a job; Boris found the results too small
("these still don't feel big enough"). This round starts from the job. He picked the civilisation-
scale jobs in `big_jobs.json`; each names its **bottleneck** (the physical reason today's tools fall
short) and a **target** (what a 10x win looks like). Your input file lists the job ids you own.

How he judged the job list (use it to judge your own ideas):
- Dropped "feed 10 billion": "we can already do". A job today's tools are on track to do isn't big.
- "Steel and cement without carbon" "might not be big enough": the same product, only cleaner.
- Dropped ageing and cheap housing as "too general": a card must break ONE named bottleneck.
- Dropped "metals without mines" as "unrealistic": the path must be physically plausible.
- Called "water from desert air" "prescient": he likes jobs that will matter more than people expect.

## The method

For each job, attack the bottleneck itself. Ask: what effect, if it worked at scale, would make the
bottleneck vanish rather than shave it? Look in this order:
1. Recent research (2015-2026): use WebSearch to find lab results, new phenomena or materials that
   break this bottleneck but aren't deployed. This is where big ideas come from now. Prefer results
   with a real measured demonstration.
2. The deck's effects: kept_effects.json (146 curated phenomena), triz_effects.json,
   existing_effects.json, inventory.json. An effect from another field that nobody applies to this
   job is the classic invention.

## Lesson from the first round

Half of last round's cards were dropped because a funded startup or a named programme is already
building exactly that (Deep Fission, Helion, LyGenesis, Vaire, SABRE...). Before writing a card,
search for a company, pilot or trial doing it; if one exists, push past it (what's the next step
they can't reach?) or move on. Boris kept two jobs despite doubts ("a tutor for every child", where
AI tutors are arriving; "cross a continent in an hour"), so aim high, but an AI app alone is not a
Future Technology: the card needs a physical effect doing new work.

## The bar (the "big" rule, proposed)

- A 2060 history of technology would name it. It moves the job's target number by 10x or more, or
  it is a platform that many later inventions build on.
- Not yet built: no product or deployment does this job this way. Known moonshots ARE allowed if
  not built, but say so (`familiar: true`), and make the card specific: name the mechanism, not
  the wish. "Fusion power" is a wish; "a fusion plant whose magnets are cooled by ..." is a card.
- Physically plausible: the effect is demonstrated at least in a lab; say what scale-up remains.
- Still a device: parts are existing board cards physically inside it (board_cards.json ids).

Aim for 4-5 strong candidates per job; fewer is fine if the job yields nothing big. Rather 3 that a
history book would name than 6 gadgets. Don't propose two cards that are the same idea.
Avoid names in existing_names.json.

## Output

Write a JSON array to the output file you were given. Each element:
{"id": "short-kebab-slug", "name": "...", "subtitle": "plain, at most 8 words",
 "bigJob": "id from big_jobs.json", "job": "plain job phrase",
 "effects": [{"effect": "plain phrase", "card": "id from an effect file, or null if new", "newToJob": true/false}],
 "parts": ["board card ids, 1-4"], "how": "2-3 sentences, problem first",
 "obstacle": "one sentence", "evidence": "the strongest real result it rests on: who, year, what was shown, with URL if you found one",
 "existsCheck": "what you searched to make sure it isn't already built, and what you found",
 "familiar": true/false, "tenX": "which target number moves and by roughly how much",
 "plausibility": 1-5, "why": "at most 20 words: why a 2060 history book would name it"}

Validate with a short script: parts are board card ids; non-null effect card ids exist in an effect
file; bigJob is valid. Reply only with: count per job, and your 5 favourites (name: subtitle).

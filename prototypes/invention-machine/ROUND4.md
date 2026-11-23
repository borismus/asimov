# Brief: the N most impactful assemblies of a decade

Context: "Assembly Cards" is a timeline board of real inventions built from Isaac Asimov's 1993
Chronology of Science and Discovery. Asimov's density of entries doubles about every 90 years;
the board keeps ~42% of his deck. Because the book ended in 1993, the board is thin after 1980.
Boris (the owner) set per-decade targets from that trend. Your job: one decade.

Deliverable: a ranked list of real inventions ("assemblies": devices, machines, materials,
systems, methods and services that people use) whose first practical, widely used version falls
in your decade, ranked by impact, about 1.5x your quota long, with a verdict for each.

Must not repeat anything in prototypes/invention-machine/round4_exclude.json (Asimov's deck, cards
already on the board, and everything already proposed, kept or dropped). Also don't propose a
mere rename or near-duplicate of something there (e.g. "cellphone" when "Mobile phone" exists).
Read that file first.

Impact ranking: how many people's daily life, work, health, safety or wealth it changed, and how
much; whether a history book written in 2060 would name it; whether a whole field now runs on it.
Rank 1 = most impactful.

Boris's approved rules (apply them):
- m1 Keep what's in everyday use worldwide, or is the standard way its field works, including
  war, farming and practices like email and search.
- m2 Drop what's still only in labs or trials, and research instruments.
- m3 Drop it only if it isn't in most people's daily life: niche conveniences (hook-and-loop) go;
  everyday ones (the zipper, spandex, drywall) stay.
- m4 A version of a card already there (scaled up, shrunk, put somewhere new): when it does the
  same job the same way for the same people, drop it; when it changed who could use it or how it
  works (transistor radio, turbofan), make it "borderline" rather than dropping.
- m5 Recent is fine once it's used by hundreds of millions or has reshaped its field.
- m6 Generic names, never brands (LASIK -> laser eye surgery, MP3 -> compressed media,
  Bluetooth -> short-range wireless link, M-Pesa -> mobile payments).
Things Boris kept that show his taste: container shipping, email, fracking, stealth aircraft,
GLP-1 drugs, large language models, oral rehydration therapy, drywall, plastic bottle, fax
machine, video game console, social media, online shopping. Things he dropped: graphene, Bitcoin,
quantum computers, LIGO, the Webb telescope, induced stem cells, hook-and-loop, stomach-ulcer cure
(no new assembly: old antibiotics aimed at a new cause).

Verdicts, with Q = your quota:
- "keep": ranks 1 to Q-5 that pass the rules.
- "borderline": ranks Q-4 to Q+5, anything a rule makes ambiguous (m4 cases, recency under m5,
  "is it an invention or a business?"), and anything you're unsure of.
- "drop": ranks beyond Q+5 ("below the decade's cut"), and clear m2/m3/m4 failures at any rank.

Output: a JSON list, ranked, each
  {"name": ..., "year": 1987, "rank": 1, "how": ..., "impact": ..., "verdict": "keep",
   "rule": "m1", "why": ...}
- name: short generic card title.
- year: first practical, widely used version; must be inside your decade. Check it.
- how: parts it's built from and the effect it works by, terse, like
  "Microchips, lithium-ion battery; ★ an effect that would need a new card". Mark with ★ an effect
  the board probably lacks.
- impact: one plain sentence on scale ("in two billion phones", "a quarter of the world's power").
- rule: the rule that decided it, or "cut" for below the decade's cut.
- why: one short sentence, written to Boris, for borderline and drop verdicts (empty for keeps).
Check dates and facts with web search where unsure. Save progress to your output file as you go.

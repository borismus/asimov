# Turn TRIZ database effects into deck phenomenon cards

You are sorting entries from the TRIZ Effects Database (a free list of physical effects indexed
by what they can do) into phenomenon cards for Asimov, a chronology of inventions and discoveries
(`static/asimov.tsv`, columns ID, Year, Title, Description, Inventor, Location, Dependencies, Field).
Extra phenomenon cards not yet in the TSV live in `prototypes/assembly-cards/assemblies.json`
under `new_cards` (id -> [title, year, description, inventor, location]).

The curator reviewed a sample of 25 and approved these rules. Apply them.

## Rules

- **e1 Only specific, nameable effects.** Drop words for whole fields (Sound, Radiation), everyday
  processes (Freezing, Melting), conditions (Vacuum), machines (Lever, Wedge) and shapes or geometry
  (Möbius strip, Reuleaux triangle, Spheroid, Holes). Generic engineering terms (Jet, Pressurisation,
  Displacement) count as too general.
- **e2 Strength and conditions.** Drop effects that appear only in extreme conditions (near absolute
  zero, inside stars) or are too weak to do work at a useful size (Casimir force); being able to measure
  something in a lab isn't enough (electroacoustic effect, sonoluminescence). Having no use yet is NOT
  on its own a reason to drop, if a use is imaginable.
- **e3 No duplicates of the deck.** Search the TSV and `new_cards` (grep titles AND descriptions; deck
  titles are idiosyncratic, e.g. "Lever mathematics", "Laws of electrolysis", "Piezoelectricity",
  "Kinetic gases"). If the deck already has the effect, verdict `in-deck` with that card id. If an
  existing card comes from the same discovery (same person, same work) but describes a different
  effect, verdict `attach` with that card id: the effect goes on the existing card instead of a new one.
- **e4 Merge only true synonyms** or variants doing the same job (Forced/Free/Mixed convection -> Convection;
  Thermoacoustics/Thermoacoustic effect -> one). A variant that does a different job gets its own card
  (phosphorescence beside fluorescence, superelasticity beside shape-memory alloys). The full list of database names is in
  `effects/edb_names.json`; check it for siblings in other batches. Verdict `merge` with `into` = the
  slug of the canonical card (e.g. `convection`). Make exactly one entry per family the `keep` that
  carries the card text, using that same slug as its id; if the canonical one isn't in your batch,
  mark all yours `merge` and say so.
- **e5 Name** each card by its clearest standard name, the broadest common term, not the oldest or most
  technical (Mechanoluminescence not Triboluminescence; Coagulation not Flocculation).
- **e6 Uses and strength.** Every kept card says what it's used for, naming real inventions, and how
  strong the effect is in everyday terms. Describe it so someone with no physics can picture it.

Also: the curator wants cards that could drive future inventions, so a keep is good when the effect
does a clear job (moves, heats, cools, separates, detects, holds...) and could do more.

## Card style (for keeps)

- `title`: plain standard name. `year`: when the effect was discovered or first explained, as an
  integer (negative for BCE). `inventor`: the discoverer; `location`: country (modern name).
  If no clear discoverer/date exists, set them null and mark borderline.
- `description`: 2-3 sentences, concrete and plain, like the deck: what you'd see happen, who found it
  or how, and what it's used for. Example (Capillary action, 1709, Francis Hauksbee, England): "Water
  climbs up a narrow glass tube, higher the narrower the tube, drawn by the pull between the liquid
  and the glass. It's what lifts oil up a lamp's wick and ink into a pen's nib."
- `effect`: one lower-case phrase, what happens: "a spinning object moving through air is pushed sideways".
- `usedIn`: 1-4 real inventions or uses, specific ("Ring-laser gyroscopes in airliners").
- `strength`: one sentence in everyday terms, with a number when you know one.
- `deps`: 0-2 deck card ids it naturally follows (must exist in the TSV or new_cards).
- `field`: "Science: Physics", "Science: Chemistry", "Science: Biology", etc.

Use your own knowledge; you may grep the repo. Don't use the web. If unsure of a year or discoverer,
say so in `why` and mark `borderline: true` rather than guessing confidently.

## Output

Write a JSON array to the output path you're given, one object per input entry, in input order:

```
{"edb": "<database name>", "verdict": "keep|drop|merge|in-deck|attach",
 "rule": "e1|e2|e3|e4|e5|e6|other", "borderline": true|false,
 "why": "<one plain sentence; for borderline ones, the judgment call and your pick>",
 "card": "<deck card id for in-deck/attach>", "into": "<slug for merge>",
 "id": "<slug, keeps only>", "title": ..., "year": ..., "inventor": ..., "location": ..., "field": ...,
 "description": ..., "effect": ..., "usedIn": [...], "strength": ..., "deps": [...]}
```

Omit fields that don't apply. Rule e7: an uncertain date or discoverer is a note in `why`, not borderline. Borderline means the rules genuinely don't settle it; aim for
under 1 in 5. Reply with just a one-line count by verdict when done.

# Extract usable effects from deck cards

Context: invention.cards is a deck of 1,486 discovery and invention cards. On its "assembly board" every invention card does a **job** (e.g. "makes light", "measures", "stores data") by one or more **effects**: natural phenomena it harnesses, written as short plain phrases such as "a current makes a magnet", "light knocks electrons loose", "X-rays pass through tissue unevenly", "Boolean logic". Each effect points at the deck card that discovered it. Following W. Brian Arthur, an invention is a job done by an effect never used for it before. We want a full inventory of effects the deck knows about but no invention uses yet: the raw material for proposing new inventions.

`existing_effects.json` lists the 129 effects already on the board as [effect, card id] pairs. Read it first for the house style, and so you can mark duplicates.

Your batch file is a JSON list of cards: id, year (negative = BCE), title, field, desc, long. None of them is used on the board yet.

For EVERY card in your batch, decide:
- **effect**: the card describes a reliable cause and result in nature, physical, chemical, biological, or mathematical, that a device or method could put to work. A discovered substance, particle or organism counts when it has a property you can use; phrase the property, not the thing ("helium stays liquid down to absolute zero", not "liquid helium"). Math results count when a procedure could run on them ("multiplying primes is easy, factoring is hard").
- **same-as**: it describes an effect already in existing_effects.json (give that exact string in `sameAs`).
- **not-an-effect**: events, people, institutions, expeditions, maps, classifications, naming, pure history, astronomical sightings with nothing to harness (a new moon of Jupiter), theories with no usable consequence, and inventions/devices themselves (devices are jobs, not effects).

When in doubt between effect and not-an-effect, choose effect with strength "weak" or a note: a later judge filters.

Write one JSON object per line (JSONL) to the output file you were given, in batch order, with these fields:
{"id": "...", "verdict": "effect" | "same-as" | "not-an-effect",
 "effect": "plain lowercase phrase, at most 12 words, in the house style (only for effect)",
 "sameAs": "exact existing effect string (only for same-as)",
 "does": "input -> output in a few plain words, e.g. 'heat -> current', 'pressure -> light' (only for effect)",
 "strength": "strong" | "weak" | "tiny" (how big an effect a device could get from it at a useful size; only for effect),
 "note": "at most 15 words, optional"}

Rules: one line per card, no card skipped, valid JSON per line, no commentary in the file. Phrase effects so a curious non-scientist understands them. Don't invent facts the card doesn't support beyond well-established science. When finished, reply with counts by verdict and the 10 effects you think are most promising for new inventions (id + effect), nothing else.

# Bringing the natural phenomena back: plan

**Update (Nov 13): the effect goes on the link.** A phenomenon link is an effect plus the card that
describes it, the way a part is a job plus the card that does it ("lift → Aerodynamics",
"a current makes a magnet → Electromagnetism"). So both kinds of edge carry a label: jobs on parts,
effects on phenomena. A broad card is fine when the effect names what's used; a card whose own text
doesn't describe the effect isn't (Acoustics is Sabine's reverberation, so not the telephone).
"Harnessed by" on a discovery card groups by effect, so its list of effects comes for free.
Calibration triaged on the sheet; `phenomena_effects.py` holds the effect vocabulary, the revised
rows and the mapping of the drafted links, and writes the sheet's Effects tab. Decision 1 below is
superseded: laws and maths aren't folded or dropped by kind, they're judged by whether the job
uses their effect.

**Status (Nov 14).** Calibration, the Effects tab and the materials batch (70) are fully triaged;
rules 21-28 are in `RULES.md` with an "Applies to" column. Nov 14 decisions: Vaccination and
Chemotherapy left the board to become phenomenon cards (no parts, no one's part; rule 9); supplying
a need counts (fertilizer: rule 26); a material's property doesn't (no Hardness card: rule 28); nerve
drugs link to Endorphins, Vagusstoffe and Electric nerve fibers; explosives "burn all at once,
without air" (Oxygen), fuels "burn with oxygen from the air" (Combustion), moved off Oil wells and
Coal mining onto the refined fuels; 2,4-D links to Gibberellins. Practices batch (58) reviewed on the sheet tab "Phenomena: practices"
and recorded in `phenomena_drafts.py` (PRACTICES): all approved, including Rational surgery (blood flows in closed vessels → Blood circulation)
and Talking pictures (none; persistence of vision comes through Motion pictures). Chromatography is now
a phenomenon card (excluded; board 491, 432 with lists), and rule 9 now applies only when other cards
link to the effect, so Pasteurization, Zone refining and Electrophoresis stay inventions. Leftovers
(57 cards that are only ever parts) reviewed on the sheet tab "Phenomena: leftovers" (borderline cases
only, per Boris) and recorded in `phenomena_drafts.py` (LEFTOVERS, LEFTOVER_NONE): 19 links (vitamins,
Penicillin, Sex hormones, the bomb's fissile and initiator materials, Deuterium, and General anesthesia as a
gap for Nitrous oxide and Chloroform), 38 none. Rule 24 gained: a plain substance gets an effect only
when it does it on its own, the same way in every use. Through rule 23 this moves approved links onto
the parts: Practical penicillin, Vitamin pills, Oral contraceptives.
Objects (201, the last batch) reviewed on the sheet tab "Phenomena: objects" and recorded in
`phenomena_drafts.py` (OBJECTS, OBJECT_NONE): 109 with effects, 92 none. Boris accepted all 10
borderline picks (burning for lamps and candles; new cards Ionizing radiation and Thermal expansion;
Rifle ← Gyroscope; seismographs ← Laws of motion; Acoustics and Color vision as stand-ins; Couched
lance; Rudders), and Arches now get Laws of motion (stones push back: action and reaction), which
Domes, Aqueducts and Flying buttresses get through the arch. Every card is now triaged. `phenomena_effects.final_links()` combines all batches and applies rule 23;
the sheet's Effects tab was rebuilt from it (Nov 14: 300 links on 265 of 491 board cards, 129 effects,
25 with no card yet, 8 of them new cards at 3+ uses; Photosynthesis and Genetics drop off). The old tab
is kept as "Effects (Nov 13)". The links are now in `assemblies.json` under "phenomena" (card ->
[{effect, card | gap}], own level applied; `python3 phenomena_effects.py export` rewrites them from the
decisions), and `lists.py`/`build.py` read them from there, including cards with no list of their own.
The build writes two views: parts only (cards.json, lists.json; 491 cards) and parts + phenomena
(cards-phen.json, lists-phen.json; 579 cards, adding 88 phenomenon cards). The lightning button in the
header switches them (?phen=1). A pinned card's links are labelled with the job (parts, steelblue) or
the effect (phenomena, amber, italic), placed near the card and slid apart so they don't overlap. A card
back lists "Works by" (effect: card, "explained later" when the card is newer) and, on a card whose
effect others use, "Harnessed by" grouped by effect. Nothing committed yet.

## Where it stands (before the effect model)

- **Drafted:** the pilot and batch 1, 86 inventions in `pilot_data.py` and `batches.py`, with 155 links
  to 59 deck cards plus 3 gaps (Elasticity twice, Rolling friction once). They were drafted under the
  old three-relation model and have never been checked against `RULES.md`.
- **Not started:** the other 349 inventions. They are mostly objects (211), but also 75 materials and
  63 practices. The drafted 86 are nearly all objects (83), so materials and practices haven't been
  tried yet: chemistry and biology phenomena (catalysis, fermentation, immunity) rather than mechanics.
- **The deck's dependencies are a weak seed.** Only 18 of the 155 drafted links were already deck
  dependencies. For the 349, the deck's own dependencies point at 150 links to 109 cards that aren't
  on the board (mostly Science and Math). They are a starting list for drafting, not the answer.
- **Display:** already wired, behind `SHOW_PHENOMENA` in `build.py`: amber edges, a "Natural
  phenomena" section on the back (with *explained later*), and "Harnessed by" on a phenomenon card.
  Phenomenon cards now take the phenomenon type (amber tint, bolt icon).

## Steps

1. **Rules first.** As with the assembly lists, settle the rules before drafting (decisions below),
   then add them to `RULES.md` as rules 21 onward. This replaces rule 15, which put phenomena out of
   scope.
2. **Re-check the 155 drafted links** against those rules, by exception: one sheet tab listing only
   the links the rules would change, plus 15 spot checks.
3. **Draft the 349** in batches by area (the domains in `pilot_data.py`, then chemistry, medicine and
   biology for the materials and practices), seeded with the deck dependencies above. Each batch goes
   on the sheet with a "Looks right" column, as before: Claude proposes, Boris ticks or comments,
   Claude records what it changed.
4. **Move the data into `assemblies.json`:** a `phenomena` list per card (card ids, or the name of a
   phenomenon with no card), and any new phenomenon cards in `types`. `lists.py` reads it from there
   and `pilot_data.py` and `batches.py` can retire.
5. **Display: a switch.** "Harnesses" is a different kind of link from "part of" and about 100 more
   cards, so keep the parts board as the default and add a header switch (Parts / Parts + phenomena)
   that reloads with `#phenomena`. Both data sets ship with the build; the layout is computed once at
   load, so a reload is simpler than re-laying-out on the fly. Then set `SHOW_PHENOMENA` from the
   switch instead of at build time.

## Decisions needed before drafting

1. **What counts as a phenomenon card.** The drafted 59 mix four kinds:
   - natural effects: Electromagnetism, Latent heat, Piezoelectricity, Photoelectric effect, X-rays
   - laws describing an effect: Boyle's law, Charles's law, Gas laws, Ohm's law, Laws of motion
   - mathematics and theory: Geometry, Binary system, Symbolic logic, Fourier analysis, Maxwell's
     equations, Fermi-Dirac statistics, General relativity
   - other things: diseases (Scurvy, Rickets, Pellagra), Space flight, Steam engine efficiency,
     Molecular beams

   Suggested: effects only. A law folds into the effect it describes (Boyle's and Charles's laws into
   Gas laws), the way job wordings were merged. Mathematics and theory become a separate "explained
   by" link, out of scope for now like "revealed by". A disease is what an invention treats, not what
   it harnesses, so it's left off.
2. **Level.** List a phenomenon only on the card that uses it directly, not on everything built from
   that card: the steam engine harnesses latent heat; the locomotive gets it through its engine.
   This is what "at its own level" already means on the back; making it a rule keeps lists short.
3. **No card yet.** Use the same 3-or-more rule as parts (rule 16): Elasticity (2 uses) and Rolling
   friction (1) don't earn a card yet.
4. **Materials and practices.** Does a material harness anything (gunpowder: combustion; Portland
   cement: hydration), and a practice (vaccination: immunity; pasteurization: heat kills microbes)?
   Suggested yes, with the same "used directly" test, since that's where chemistry and biology come in.
5. **Dates.** Rule 20 applies: a phenomenon explained after the invention keeps its date and is marked
   *explained later* (the steam engine before thermodynamics).

## Types to check

The card types were assigned in one pass and haven't been reviewed. Default is object; these were
judgment calls:

- **Named as a process, typed as the material it yields** (by what they fill in other lists): Haber
  process, Coal hydrogenation, Vulcanization of rubber, Aluminum process; Oil wells and Coal mining
  (they stand for crude oil and coal).
- **Syntheses split by result:** a drug or nutrient made by synthesis is a material (Morphine,
  Oxytocin, Steroid, Quinine, Vitamin B-12 and E syntheses); building molecules as a technique is a
  practice (Gene, Protein, Chlorophyll, Strychnine synthesis; Synthetic peptides; Recombinant DNA).
- **Vaccines:** Salk, Sabin and Yellow fever vaccines are materials; Smallpox inoculation, Anthrax
  inoculation and Rabies are practices. Vaccination is now a phenomenon card (Nov 14).
- **Media and systems as practices:** Motion pictures, Talking pictures, Photography, Home
  photography, Holography, Alternating currents, Fiber optic communication, Frequency modulation,
  Radio waves and sound, Photocopying, Xerography, Block printing. Their devices stay objects
  (Camera, Holograms, Printing press).
- **Diagnostics:** Electrocardiogram and Electroencephalography are practices; CAT scan and
  Stethoscope are objects.
- **Others:** Horses are objects (they fill "provides power"); Animals domesticated and Plants
  domesticated are practices; Pottery is an object, Porcelain a material; Glass blowing is a practice;
  Reinforced concrete and Silver fillings are materials.

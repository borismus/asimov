# Assembly list rules

How the lists in `assemblies.json` are written: parts (a job and the card that does it) and natural
phenomena (an effect and the card that describes it). Copied from the Rules tab of the review sheet
("Asimov Cards — Assembly Audit"), so a session working in this repo has them. "Applies to" says
whether a rule is for parts, phenomena or both; rule numbers stay fixed because the sheet's history
cites them. "Who" says whether Boris set the rule or Claude proposed it and Boris accepted it.
Rules 21-28 came from the phenomena calibration (the Phenomena calibration and Effects tabs).

| # | Topic | Applies to | Rule | Example | Who |
|---|---|---|---|---|---|
| 1 | Parts | parts | One relation: part of. An object's parts are what's in it when it works, including what it uses up while working (fuel, gunpowder, film, ink). The material its body is made of has the job "forms the body"; a material doing something more specific gets that job (glass in a lens bends light). | Boiler ← Copper (shell); Four-stroke engine ← Gasoline (fuel) | Boris |
| 2 | Parts | parts | A material's parts are its ingredients: what ends up in it, or what it's refined or made from. Their job is "is an ingredient". Reagents that don't end up in it aren't parts. | Bronze ← Copper; Gasoline ← Oil wells (crude oil); Nitroglycerine ✗ Sulfuric acid | Boris |
| 3 | Parts | parts | A practice or method's parts are the techniques and devices it's carried out with. A practice can be made of another practice. | Dentistry ← Anesthesia; Heart transplants ← Heart-lung machine; Photography ← Camera | Boris |
| 4 | Scope | both | How something is produced isn't on the board, as a part or as a phenomenon: the heat, tools and machines used to make it, the rocket that launched it, the computer that designed it, the technique a product is grown with, how a raw material is extracted, and the reaction that makes a material. Parts of this kind are kept aside in the data (production), not shown. | Pottery ✗ Fire; Sputnik ✗ Liquid-fuel rockets; Salk vaccine ✗ Virus culture; Bessemer steel ✗ Combustion (the blast); Microchips ✗ photolithography | Boris |
| 5 | Slots | both | Borrowed or needed to know isn't a link. If a card only borrowed an idea or a kind of part from another card, that card isn't a slot; the borrowed part can be, and if 3 or more cards share it, it earns a supporting card that goes inside each. Likewise a phenomenon link means the card works by the effect, not that the effect had to be known first: theory that predicted or guided it, anatomy it needed, earlier steps toward an idea. | Analytical engine ✗ Jacquard loom; both ← Punched cards. Radio ✗ Maxwell's equations; Diesel engine ✗ Steam engine efficiency; Surgery ✗ Nerve fibers | Boris |
| 6 | Slots | parts | The same thing isn't a part. A card that is the other card organized, scaled up, commercialized or in routine use doesn't take it as a slot. | Artillery ✗ Cannons; Commercial comsats ✗ Communications satellites | Boris |
| 7 | Slots | parts | A whole earlier machine that is physically inside counts, even when the card is a refinement of it. | Practical steamboat ← River boats (hull); Ultramicroscope ← Microscope | Boris |
| 8 | Slots | parts | What a technique is used on isn't an input. | Zone refining ✗ Germanium | Claude |
| 9 | Slots | both | Use the card that's literally there. For a phenomenon, that's the card whose own text describes the effect: one card per effect, the one that states it most directly. That can be a card on the board as an invention: it keeps its type and also shows "Harnessed by". A card with no parts that's no one's part, whose text describes an effect that other cards link to, is a phenomenon card, not an invention. A card never links to itself, and a card that's already one of an invention's parts isn't also one of its phenomena. A close stand-in is fine when it's the only card of its kind; say so in a note. Otherwise leave it with no card yet (rule 16). | Color television ← Iconoscope (the only camera-tube card); Continuous maser ← energy levels: Quantized atom (theory standing in); Vitamin pills ← Vitamin concept, ✗ Scurvy (same effect); Photographic negative ← light darkens silver salts: Photography (a practice on the board); Salk vaccine ← the body learns to fight a germ: Vaccination (now a phenomenon card, like Torsion balance); Gas chromatography ← Chromatography (also now a phenomenon card); Pasteurization, Zone refining stay inventions (nothing links to them) | Claude |
| 10 | Jobs | both | A link's label says what the linked card does in that invention: a slot's job, or a phenomenon's effect. A card's own job is what it does by itself. They can differ, and the same card can carry different labels in different inventions. | Triode: controls the current; in a radio it amplifies a signal. X-rays: made by the Coolidge tube, passing through tissue in the CAT scan | Boris |
| 11 | Jobs | parts | Jobs are short, generic verb phrases shared across cards, chosen to answer "what else could fill this slot?" Don't merge jobs whose fillers can't stand in for each other. | Valve: controls flow; Transistor: controls the current (kept apart) | Boris |
| 12 | Jobs | both | One label for one meaning: merge job wordings, or effect wordings, that mean the same thing. | holds the gas, holds fuel, holds the food → holds the contents | Boris |
| 13 | Parts | parts | The part name is optional. Show it only when it says something the job and the filler card don't. | bends light: Glass (objective) | Boris |
| 14 | Time | both | A filler newer than the card: if an older card did the same job first, the older card fills the slot and the newer one shows after it as "later". Otherwise the newer card stays, marked "added later". A part used long before the deck's card explained it is the card's key part with no card. A phenomenon explained after the invention keeps its link, marked "explained later". | Steamship ← Waterwheels (paddle wheels), later Screw propeller; Wing ← Aluminum (added later); Gunpowder ← Saltpeter (no card); Sail ← lift: Aerodynamics (explained later) | Boris |
| 15 | Scope | both | Two kinds of link, both labelled: parts (a job and the card that does it) and natural phenomena (an effect and the card that describes it). "Revealed by", "version of", "needed to know" and links between phenomena are out of scope. | Four-stroke engine ← stores chemical energy: Gasoline; Sail ← lift: Aerodynamics | Boris |
| 16 | Slots | both | A part or effect with no card is listed only if 3 or more inventions would use it, which earns it a supporting card (for an effect, a new phenomenon card). Otherwise leave it off. Exception: a card's own key part or key effect stays even unshared, shown with no card. Links to cards that already exist don't need this. Supporting cards stay once made: they aren't removed for being outside Asimov's chronology or for dropping below 3 uses. | Escapement (5 clocks and watches) ✓; Wick ✗; Watt's separate condenser ✓ (key part); Archimedes' principle (6 uses) ✓; Microphone ← contact resistance (key effect, no card) | Boris |
| 17 | Jobs | parts | Jobs come from the shared list. Add a new one only if 3 or more cards or slots would use it; otherwise use the nearest broader job. Own jobs are broad. Effects aren't held to this: each is named by what its card describes, and nothing stands in for it. | makes textiles, not "spins thread" or "throws the shuttle"; trilateration (1 use) stays | Boris |
| 18 | Slots | parts | Folded into rules 3 and 4: a practice can be made of another practice; design tools are production. | Dentistry ← Anesthesia; Nuclear fusion bomb ✗ UNIVAC | Boris |
| 19 | Scope | both | Left out by name: the Great Wall, a specific named wonder rather than a technology. Ordinary structures stay. | Great Wall ✗; Stone monuments, Architectural arches ✓ | Boris |
| 20 | Time | both | Dates come from Asimov's chronology and stay fixed. A part or phenomenon newer than its card is handled in the list, never by changing a date. Supporting cards keep the date they were given. | Bicycle (1839) ← Rubber tire (1887): fix the slot, not the years | Boris |
| 21 | Phenomena | phenomena | A phenomenon card describes an effect. Left off: theories (unless the only card for their effect, rule 9), techniques, ideas, uses, anatomy, and the diseases an invention prevents or treats. | GPS ✗ General relativity; Atomic clock ✗ Molecular beams; Schmidt camera ✗ Stellar photography; Vitamin pills ✗ Rickets | Boris |
| 22 | Phenomena | phenomena | Maths counts when the invention's job carries it out. | GPS ← trilateration: Geometry; CAT scan ← reconstruction: Fourier analysis; Microchips ← Binary system, Symbolic logic | Boris |
| 23 | Phenomena | phenomena | Own level: an effect is listed only where it's used directly. One a part already has, at any depth, isn't repeated on the whole. A different effect of the same card is fine. | Radio ✗ Radio waves (through its Radio antennas); Improved steam locomotive gets latent heat through its boiler | Claude |
| 24 | Phenomena | phenomena | A material gets what it does in use, not how it's made (rule 4). An element or plain substance gets an effect only when it does it on its own, the same way in every use; when its jobs differ, or it's one ingredient of an alloy or compound, it gets none and the effect stays on the invention. | Gasoline, Kerosene ← burns with oxygen from the air; Vitamin B-12 synthesis ← the body needs trace nutrients; Bessemer steel: none (the blast is how it's made); Penicillin ← Chemotherapy; Hydrogen: none (lift gas, fuel, reactant); Cobalt: none (an ingredient of the magnet) | Boris |
| 25 | Phenomena | phenomena | Medicine: the body process a device or practice works with counts; the disease it treats doesn't. | Jarvik hearts ← Blood circulation; Heart transplants ← Tissue transplantation; Electroencephalography ← Electric nerve fibers | Boris |
| 26 | Phenomena | phenomena | What living things do anyway (grow, inherit) isn't harnessed. A less obvious effect a practice relies on is, and so is a need that an invention supplies. | Plants domesticated: none; Tissue culture ← cells live outside the body: Cell theory; Chemical fertilizer ← plants need nitrogen from the soil: Nitrogen fixation | Boris |
| 27 | Phenomena | phenomena | An environment counts when the invention works by it, not where it's used. | Radio ← the ionosphere reflects radio: Kennelly-heaviside layer; Sail ✗ Trade winds | Claude |
| 28 | Phenomena | phenomena | No nameable effect, no link. "None" is a fine answer; a general law with nothing specific to say is left off, and so is a material's property (hard, insulating, clear). | Stagecoach ✗ Laws of motion; Ballpoint pen ✗ gravity; Metal stirrups: none; Bakelite, Carborundum: none | Claude |

## Parts newer than the card (rule 14, settled)

The Date check tab on the sheet went through the 52 slots whose filler was newer than its card.
19 now have an older card with "later" for the newer one (a slot's `later` list in
`assemblies.json`), 3 became key parts with no card (saltpeter, yeast, plant fiber), 1 was dropped
(the Couched lance's Pike), and 28 stay "added later" because nothing older with a card did the job.

## One relation (rules 1-4)

Earlier lists had three kinds of slot: inside, runs on and made with. To keep the board about
assembly, they became one relation, part of. "Runs on" folded into parts (fuel is in the engine
while it runs). Of 87 "made with" slots, 55 stayed as parts (a material's ingredients, a practice's
techniques and devices) and 32 that only described production moved to `production`.

## The review workflow

The sheet holds the review history: Calibration (30 random cards), Full pass (only the decisions,
plus 20 spot checks), Missing parts, Job merges, Candidates, Summary and Cards. Claude proposes;
Boris ticks "Looks right" or leaves it unticked (unticked means it doesn't look right) and comments;
Claude records what it changed in the Changed column. `assemblies.json` is the source of truth once a
round is applied; `build.py` turns it into `site/`.

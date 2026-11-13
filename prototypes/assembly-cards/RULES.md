# Assembly list rules

How the lists in `assemblies.json` are written. Copied from the Rules tab of the review sheet
("Asimov Cards — Assembly Audit"), so a session working in this repo has them. "Who" says whether
Boris set the rule or Claude proposed it and Boris accepted it.

| # | Topic | Rule | Example | Who |
|---|---|---|---|---|
| 1 | Kinds | **Inside**: physically in the finished thing. Parts and materials alike. | Boiler ← Copper (shell); Telephone ← Microphone | Boris |
| 2 | Kinds | **Runs on**: used up while it works. | Diesel engine ← Kerosene; Home photography ← Celluloid film | Boris |
| 3 | Kinds | **Made with**: used to make it or do it, but not in the result, whether or not it gets used up. Tools, reagents, a process's inputs. | Nitroglycerine ← Sulfuric acid; Haber process ← Hydrogen | Boris |
| 4 | Kinds | A launch rocket is made with: it puts the craft in orbit but isn't part of it, reusable or not. A craft whose engines fly with it keeps them inside. | Sputnik ← Liquid-fuel rockets (made with); Space shuttle ← Liquid-fuel rockets (inside) | Boris |
| 5 | Slots | Borrowed isn't inside: if a card only borrowed an idea or a kind of part from another card, that card isn't a slot. But the borrowed part can be. If 3 or more cards share it, it earns a supporting card that goes inside each. | Analytical engine ✗ Jacquard loom; both ← Punched cards | Boris |
| 6 | Slots | The same thing isn't a part. A card that is the other card organized, scaled up, commercialized or in routine use doesn't take it as a slot. | Artillery ✗ Cannons; Commercial comsats ✗ Communications satellites | Boris |
| 7 | Slots | A whole earlier machine that is physically inside counts, even when the card is a refinement of it. | Practical steamboat ← River boats (hull); Ultramicroscope ← Microscope | Boris |
| 8 | Slots | What a technique is used on isn't an input. | Zone refining ✗ Germanium | Claude |
| 9 | Slots | Use the card that's literally there. A close stand-in is fine when it's the only card of its kind; say so in a note. Otherwise leave the slot with no card yet. | Color television ← Iconoscope (the only camera-tube card) | Claude |
| 10 | Jobs | A slot's job is what the part does in that machine. A card's own job is what it does by itself. They can differ. | Triode: controls the current; in a radio it amplifies a signal | Boris |
| 11 | Jobs | Jobs are short, generic verb phrases shared across cards, chosen to answer "what else could fill this slot?" Don't merge jobs whose fillers can't stand in for each other. | Valve: controls flow; Transistor: controls the current (kept apart) | Boris |
| 12 | Jobs | One job for one function: merge wordings that mean the same thing. | holds the gas, holds fuel, holds the food → holds the contents | Boris |
| 13 | Parts | The part name is optional. Show it only when it says something the job and the filler card don't. | bends light: Glass (objective) | Boris |
| 14 | Time | A filler newer than the card is fine. It shows as added later; links carry no dates. (Under review: see below.) | Wing ← Aluminum (added later) | Boris |
| 15 | Scope | Assemblies only for now. Natural phenomena, "revealed by" and "version of" links are out of scope. | | Boris |
| 16 | Slots | A part with no card gets a slot only if 3 or more inventions would use it, which earns it a supporting card. Otherwise leave it off. Exception: a card's own key part, the new thing it brought, stays even unshared. Links to cards that already exist don't need this. | Escapement (5 clocks and watches) ✓; Wick ✗; Watt's separate condenser ✓ (key part) | Boris |
| 17 | Jobs | Jobs come from the shared list. Add a new one only if 3 or more cards or slots would use it; otherwise use the nearest broader job. Own jobs are broad. | makes textiles, not "spins thread" or "throws the shuttle" | Boris |
| 18 | Slots | Design tools count as made with, and a practice can be made with another practice. | Nuclear fusion bomb ← UNIVAC; Dentistry ← Anesthesia | Boris |
| 19 | Scope | Left out by name: the Great Wall, a specific named wonder rather than a technology. Ordinary structures stay. Torsion balance is also left out, as a phenomenon. | Great Wall ✗; Stone monuments, Architectural arches ✓ | Boris |
| 20 | Time | Dates come from Asimov's chronology and stay fixed. A part newer than its card is handled in the list, never by changing a date. Supporting cards keep the date they were given. | Bicycle (1839) ← Rubber tire (1887): fix the slot, not the years | Boris |

## Under review: parts newer than the card (rule 14)

The proposals are on the sheet's Date check tab.

52 slots in 36 cards have a filler dated after the card (for example, Bicycle 1839 ← Rubber tire 1887).
Rule 14 shows these as "added later". The idea being considered instead: fill the slot with what the
first version actually used, an older card doing the same job, and show the newer card as a later swap.

- About 22 of the 52 already have an older card in the deck that does the same job (Steamship's
  screw propeller → Waterwheels as paddle wheels; insulated wire → Copper; Maxim gun's cordite → Gunpowder).
- One new supporting card would cover 5 more: an older plain bearing for "reduces friction"
  (Turbines, Bicycle, Electric motors, Electric generators, Gyroscope).
- A few are deck cards dated by a discovery, not first use (Paper ← Cellulose, Fermentation ← Yeast
  cells, Gunpowder ← Sodium and potassium).
- Dates don't change (rule 20), so supporting cards newer than their card stay "added later".
- The rest had no earlier part doing that job (the radio's triode, the first car's self-starter).

## The review workflow

The sheet holds the review history: Calibration (30 random cards), Full pass (only the decisions,
plus 20 spot checks), Missing parts, Job merges, Candidates, Summary and Cards. Claude proposes;
Boris ticks "Looks right" or leaves it unticked (unticked means it doesn't look right) and comments;
Claude records what it changed in the Changed column. `assemblies.json` is the source of truth once a
round is applied; `build.py` turns it into `site/`.

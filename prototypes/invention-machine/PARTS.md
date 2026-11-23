# Brief: parts and effects for new board cards

The "Assembly Cards" board links each invention to its parts (a job and the card that does it)
and the natural phenomena it works by (an effect and the card that describes it). You're writing
those lists for new cards Boris has approved. Their text is in your input file
(id, title, year, type, description).

Read first, in full:
- prototypes/assembly-cards/RULES.md: the board's rules 1–28. Follow them exactly; they're Boris's.
- prototypes/invention-machine/parts_examples.json: real entries from the board, in the format.
- prototypes/invention-machine/parts_ref.json: every card on the board (id, title, year, type,
  own job) and the shared job list, most used first. Search it for fillers; don't guess ids.

Canon: Asimov's cards are fixed. Use them as fillers and phenomenon cards freely, but never
propose changes to them.

Other new cards in this batch (all 126, listed in prototypes/invention-machine/cardtext_all.json)
may fill slots too; use their ids. They are dated as given there.

Output, a JSON object keyed by card id, written to your output file:
  "smartphone": {
    "job": "communicates",
    "slots": [{"part": null, "job": "computes", "fill": "microchips", "gap": null, "note": null}, ...],
    "phen": [{"effect": "a fingertip draws charge from the screen", "card": "touchscreen"} or
             {"effect": "...", "gap": "Name of the effect card it would need"}],
    "flag": ""
  }
- job: the card's own job, from the shared list (rule 17: add a new one only if 3+ cards need it;
  say so in flag).
- slots: what's in it when it works (rule 1), ingredients for a material (rule 2), techniques and
  devices for a practice (rule 3). Not how it's made (rule 4). Fill each with an existing card id
  ("fill") or, if no card does that job, name the part as a "gap" (rule 16: list a gap only if it's
  the card's own key part, or if 3+ new cards would share it). Use "part" only when it adds
  information (rule 13). Newer filler than the card: rule 14.
- phen: the effects it works by directly (rules 21–28; own level, rule 23: not one a part already
  has). Point at an existing phenomenon card by id where one states the effect; else name the gap.
  "None" (empty list) is fine (rule 28).
- flag: anything uncertain, any new job, any gap you think 3+ cards share.
Typical card: 2–5 slots, 0–2 effects. Be strict: fewer, right links beat many loose ones.
Save progress to the output file as you go.

Lessons from the first 126 (Boris caught "smartphone works by Hooke's law"):
- Rule 23 is strict: if a part does it (the accelerometer's spring, the screen's persistence of
  vision), the effect goes on the part's card, never on the whole.
- Rule 28: no general laws with nothing specific to say (friction for a tractor's grip, gravity for a
  missile's arc), and no material properties (a fibre's stretchiness).

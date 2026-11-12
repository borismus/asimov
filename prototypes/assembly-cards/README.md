# Assembly Cards (prototype)

A separate visualization of the deck where every invention is built from other cards.
It reuses the universe view, with three changes:

- **Tap a card to flip it.** The back lists:
  - **Assembly**: one bullet per slot (a part, ingredient or step), linking to the card that fills it.
    A part newer than the invention is marked *added later*; an empty slot is marked *no card yet*.
  - **Natural phenomena**: the phenomena the card uses at its own level, each linking to its card.
    One explained after the invention existed is marked *explained later*.
  - **Part of**: the inventions that use this card as a subassembly, and in which slot.
  - **Used by**: for phenomenon cards, the inventions that use them.
- **Tapping a bullet** jumps to that card and opens it on its back, so you can drill down the parts tree.
- **Jobs.** Every card and slot has a job ("provides thrust", "controls flow"). The wrench button lists all
  of them with counts; picking one, or tapping a slot name on a card's back, lights up every card that
  can do that job. Jobs are kept generic; a slot's specifics ("prevents scurvy") go in its note.
- **No pinning, no hover, no half cards.** Cards are always full size.

Edges: parts are solid, parts added later are dashed, phenomena are amber.

## Run it

```sh
uv run prototypes/assembly-cards/build.py
python3 -m http.server -d prototypes/assembly-cards/site 8000
# open http://localhost:8000
```

The build copies the site's `static/*.js` and `*.css`, applies small patches (each one must match
exactly, so a change to the site code fails the build loudly), and writes the pilot cards and their
images into `site/`, which is gitignored.

## Files

- `pilot_data.py`: the lists. For each invention: its job, its slots (label, job, filling card or
  missing card name, kind: part, ingredient or step, and an optional note), and its phenomena. Also the new
  supporting cards (Valve, Boiler, Gear train, GPS…) that aren't in Asimov's deck.
- `build.py`: builds `site/`. New cards get placeholder art.
- `card_back.js`, `card_back.css`: the back of the card and the flip animation, spliced into
  `card.js` and `card.css`.

## Scope

A pilot of 60 inventions (steam, engines, vehicles, flight, electricity and radio, a path to GPS,
and vitamin pills as a recipe) plus the 68 parts, materials and phenomena they reference: 128 cards.
The rest of the deck has no lists yet.

# Assembly Cards (prototype)

A separate visualization of the deck where every invention is built from other cards.
It reuses the universe view, with these changes:

- **Tap a card to pin it**, as on invention.cards: it comes to the front and its links light up.
  **Tap it again to flip it.** Tap the background, or press Escape, to unpin. Only the pinned card
  shows its back: moving or dropping the pin turns it face up again. The back lists:
  - **Inside**, **Runs on**, **Made with**: one bullet per slot, grouped by kind. Each bullet is the
    slot's job and the card that does it ("bends light: Glass"), plus the part's name when it adds
    something ("(objective)"). *Inside* is what's physically in it, parts and materials alike; *runs on*
    is what it uses up while working (fuel, propellant, film); *made with* is used to make it but isn't
    in the result. A filler newer than the invention is marked *added later*; an empty slot is marked
    *no card yet*.
  - **Natural phenomena**: the phenomena the card uses at its own level, each linking to its card.
    One explained after the invention existed is marked *explained later*.
  - **Used in**: the inventions where this card fills a slot, and the job it does there.
  - **Harnessed by**: for phenomenon cards, the inventions that use them.
- **Tapping a bullet** pins that card and opens it on its back, so you can drill down the parts tree.
- **Jobs.** Every card and slot has a job ("provides thrust", "controls flow"). The wrench button lists all
  of them with counts; picking one, or tapping a job on a card's back, lights up every card that
  can do that job. Jobs are kept generic; a slot's specifics ("prevents scurvy") go in its note.
- **Search** lists every match under the search bar, on screen or not; the one you picked is blue.
- **No hover, no half cards.** Cards are always full size.

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

- `pilot_data.py`: the pilot lists. For each invention: its job, its slots (part name, job, filling card or
  missing card name, kind: inside, runs on or made with, and an optional note; the part name is shown
  only when it isn't just the job or the filler's name), and its phenomena. Also the new
  supporting cards (Valve, Boiler, Gear train, GPS…) that aren't in Asimov's deck.
- `links.csv`: links between existing cards approved in the "Missing parts" audit (invention, job, part,
  filler, kind, note).
- `batches.py`: the deck's own inventions, added one area at a time. Each gets its slots from
  `links.csv`, plus its own job, slots for parts with no card yet, and its phenomena.
- `lists.py`: puts the pilot and the batches together for the build.
- `build.py`: builds `site/`. New cards get placeholder art.
- `card_back.js`, `card_back.css`: the back of the card and the flip animation, spliced into
  `card.js` and `card.css`.

## Scope

A pilot of 60 inventions (steam, engines, vehicles, flight, electricity and radio, a path to GPS,
and vitamin pills as a recipe), plus batches of the deck's own inventions:

1. Electricity and communication: 24 inventions, from Hauksbee's static generator to the LED.

With the parts, materials and phenomena they reference, that's 187 cards. The rest of the deck has
no lists yet.

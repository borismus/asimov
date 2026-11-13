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
    in the result. When a newer card later took over the job, it follows the first one ("absorbs
    shocks: Carriage springs, later Rubber tire"). A filler newer than the invention with nothing older
    before it is marked *added later*; a key part with no card is marked *its key part, no card*.
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
- **Phenomena are set aside for now** while the assemblies get to a good place. The lists are kept
  in the data; `SHOW_PHENOMENA` in `build.py` brings them back.

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

- `assemblies.json`: the source for every list: each invention's own job and slots (part name, job,
  filling card or the name of a key part with no card, kind, note), as reviewed in the sheet's
  Calibration and Full pass tabs, plus the supporting cards those lists brought in (`new_cards`).
- `pilot_data.py`, `batches.py`: the pilot and batch 1 as first drafted. They still hold the natural
  phenomena, which are set aside for now; their slots are superseded by `assemblies.json`.
- `links.csv`: the links between existing cards approved in the "Missing parts" audit.
- `lists.py`: puts `assemblies.json` and the phenomena together for the build.
- `build.py`: builds `site/`. New cards get placeholder art.
- `card_back.js`, `card_back.css`: the back of the card and the flip animation, spliced into
  `card.js` and `card.css`.

## Scope

Every invention in Asimov's deck has a list: 434 cards with lists, including 31 supporting cards
that aren't in the deck (Valve, Boiler, Escapement, Ink, Punched cards…). With the materials they
reference, the board shows 493 cards. The rules the lists follow are in `RULES.md` (copied from the sheet's Rules tab): a
part with no card is listed only if 3 or more inventions share it (then it gets a card), or if it is
the card's own key part, the new thing it brought. Left out: the Great Wall (a named wonder) and
the Torsion balance (a phenomenon).

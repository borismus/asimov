# Assembly Cards (prototype)

A separate visualization of the deck where every invention is built from other cards.
It reuses the universe view, with these changes:

- **Tap a card to pin it**, as on invention.cards: it comes to the front and its links light up.
  **Tap it again to flip it.** Tap the background, or press Escape, to unpin. Only the pinned card
  shows its back: moving or dropping the pin turns it face up again. The back lists:
  - **Parts**: the assembly, one bullet per part. Each bullet is the part's job and the card that
    does it ("bends light: Glass"), plus the part's name when it adds something ("(objective)"). An
    object's parts are what's in it when it works, including what it uses up (fuel, powder, film); a
    material's are its ingredients; a practice's are the techniques and devices it's carried out with.
    How something is produced (the kiln, the air pump, the launch rocket) isn't listed. When a newer
    card later took over a part's job, it follows the first one ("absorbs shocks: Carriage springs,
    later Rubber tire"). A part newer than the invention with nothing older before it is marked
    *added later*; a key part with no card is marked *its key part, no card*.
  - **Works by** (phenomena view): the effects the card uses at its own level, each with the card
    that describes it, or a name with "no card yet". One explained after the invention existed is
    marked *explained later*.
  - **Part of**: the inventions this card is a part of, and the job it does in each.
  - **Harnessed by** (phenomena view): the inventions that work by an effect this card describes,
    one bullet per effect.
- **Search** has its own close button. On a phone the results are a scrollable sheet that folds away
  once you pick one (tap the box to bring it back), and a tapped card slides fully into view.
- **Tapping a bullet** pins that card and opens it on its back, so you can drill down the parts tree.
- **Jobs.** Every card and slot has a job ("provides thrust", "controls flow"). The wrench button lists all
  of them with counts; picking one, or tapping a job on a card's back, lights up every card that
  can do that job. Jobs are kept generic; a slot's specifics ("prevents scurvy") go in its note.
- **Effects.** The same panel's Effects tab lists every effect, most used first, with the card that
  describes it; picking one lights up the cards that work by it and that card.
- **Search** takes `job:` and `effect:` filters that match part of a name (`job:energy`,
  `effect:light`); in quotes (`job:"cuts"`) they match exactly, which is what the panel and card
  backs send.
- **Search** lists every match under the search bar, on screen or not; the one you picked is blue.
- **No hover, no half cards.** Cards are always full size.
- **Card type instead of genre.** A card's tint and corner icon say what kind of card it is: object
  (blue, gear), material (red, ingots), practice (green, cycle) or phenomenon (amber, bolt). The
  back starts with the type. Types are in `assemblies.json` (`types`); a card reached only through a
  phenomenon list is a phenomenon.
- **Phenomena** are shown: the 88 phenomenon cards and their amber links. `?parts=1` opens a
  parts-only view of the board. A pinned card's
  links are labelled with the job or the effect. The phenomena are in `assemblies.json` under
  "phenomena"; how they were decided is in `PHENOMENA.md`.

Edges: parts are solid, parts added later are dashed, phenomena are amber (matching phenomenon cards).

## Run it

```sh
uv run prototypes/assembly-cards/build.py
python3 -m http.server -d prototypes/assembly-cards/site 8000
# open http://localhost:8000
```

To publish it next to invention.cards, at `invention.cards/assembly/`:

```sh
uv run prototypes/assembly-cards/build.py --deploy   # writes ~/Projects/invention.cards/assembly/
cd ~/Projects/invention.cards && git add assembly && git commit -m 'Assembly cards prototype' && git push
```

invention.cards is GitHub Pages serving `borismus/invention.cards` (branch `main`); the repo's
`deploy.sh` regenerates the site into that checkout and pushes it. `generate-site.py` only replaces
`static/` and the per-card pages, so `assembly/` survives later deploys (and `git add -A` there keeps
it). The deployed build loads card art from the live `/static/images/entries-v2/`, so it is 35 files
instead of ~500; it uses its own patched copy of the site's JS under `assembly/static/`, uses hash
navigation (no server paths), and is marked `noindex`.

The build copies the site's `static/*.js` and `*.css`, applies small patches (each one must match
exactly, so a change to the site code fails the build loudly), and writes the pilot cards and their
images into `site/`, which is gitignored.

## Files

- `assemblies.json`: the source for every list: each invention's own job and parts (part name, job,
  filling card or the name of a key part with no card, note, and `later`: newer cards that took
  over the job), as reviewed in the sheet's Calibration, Full pass, Date check and Audit tabs; the
  supporting cards those lists brought in (`new_cards`); and `production`, the "how it was made"
  links taken off the board (kilns, air pumps, launch rockets), kept in case they come back.
- `pilot_data.py`, `batches.py`: the pilot and batch 1 as first drafted. They still hold the natural
  phenomena, which are set aside for now; their slots are superseded by `assemblies.json`.
- `links.csv`: the links between existing cards approved in the "Missing parts" audit.
- `lists.py`: puts `assemblies.json` and the phenomena together for the build.
- `build.py`: builds `site/`. Cards with no deck art share one "art to come" image.
- `card_type.css`: the type colours (tint, timeline dots, header key); the type icons are drawn in
  `build.py`.
- `phone.css`, `theme.css`: the phone layout (search sheet, compact header) and light/dark themes.
- `card_back.js`, `card_back.css`: the back of the card and the flip animation, spliced into
  `card.js` and `card.css`.

## Scope

Every invention in Asimov's deck has a list: 432 cards with lists, including 32 supporting cards
that aren't in the deck (Valve, Boiler, Escapement, Ink, Punched cards…). With the materials they
reference, the board shows 491 cards. The rules the lists follow are in `RULES.md` (copied from the sheet's Rules tab): a
part with no card is listed only if 3 or more inventions share it (then it gets a card), or if it is
the card's own key part, the new thing it brought. Left out: the Great Wall (a named wonder), and
the Torsion balance, Vaccination, Chemotherapy and Chromatography (phenomena: no parts, and their text
describes an effect other cards link to).

## Where it stands, and what's next

The lists are reviewed and settled; `RULES.md` has the 20 rules. Next, roughly in order:

1. ~~**Card type instead of genre.**~~ Done. The types were assigned in one pass and haven't been
   reviewed; the judgment calls are listed in `PHENOMENA.md` under "Types to check".
2. **Bring the natural phenomena back.** The plan is in `PHENOMENA.md`.
3. ~~**Hosting.**~~ `build.py --deploy` (see "Run it"). Not pushed yet.
4. **Swaps over time.** The `later` data is in place: a job's view could list every card that did it,
   by year (oil lamps, gas lighting, the electric light).

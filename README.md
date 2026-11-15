Deployed at [https://invention.cards](https://invention.cards)

If there's an issue with the visualization or text you'd like addressed, please submit a [GH issue](https://github.com/borismus/asimov/issues).

## Editing the data

**The repo is the source of truth. The Google Sheet is no longer used for authoring** (retired
Nov 2026: it was meant for crowdsourcing, but few people used it and syncing from it caused
trouble). Edit these files directly and commit:

- [static/asimov.tsv](static/asimov.tsv) — every card, tab-separated, one row per card:
  `ID, Year, Title, Description, Inventor, Location, Dependencies, Field, Long Description, Kind`.
  `Description` is the text on the card; `Long Description` is the fuller paragraph shown on the
  card's no-JS page (for search engines). `Kind` is `legacy` (Asimov's book), `added` (gap-fillers
  and post-1993 entries) or `scenario-<slug>` (a speculative future); see
  [docs/card-kinds.md](docs/card-kinds.md). Keep tabs and line breaks out of cells.
- [static/stories.json](static/stories.json) — the stories: a list of
  `{slug, title, blurb, steps: [{id, edge_note}]}`, steps in timeline order. See
  [docs/stories.md](docs/stories.md) and [docs/stories-impl.md](docs/stories-impl.md).
- [prototypes/assembly-cards/assemblies.json](prototypes/assembly-cards/assemblies.json) — the
  assembly prototype's parts, phenomena, card types and its own new cards
  ([prototypes/assembly-cards/README.md](prototypes/assembly-cards/README.md)).

For a big round of edits that needs a second pair of eyes, put the proposals on a temporary review
sheet and bring the decisions back into these files (that's how the assembly lists were reviewed).

The [old Google Sheet](https://docs.google.com/spreadsheets/d/1hDNXas7DzwglB95HV2_2u1utWAwBZR2hQHlMPz-fj5A/edit)
stays up as a historical copy only: **edits made there won't reach the site**. `deploy.sh` no
longer fetches it. [scripts/fetch-tsv.py](scripts/fetch-tsv.py) is kept for a one-off pull, but
don't run it casually: it overwrites `static/asimov.tsv` and `static/stories.json` with whatever
the sheet holds.
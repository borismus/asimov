This is the source code to the Visual Chronology of Science & Discovery. It is [running live][demo]. Here is and [information about the project][blog].

Currently, the visualization covers the period up to 1850 CE according to
[Asimov's book][book]. The next step in the project is to summarize the contents
of the book from 1850 CE onward.

If there's an issue with the visualization or text you'd like addressed, please submit
a [GH issue][issue].

If you have questions, please [email Boris][email]

## Editing the data

The invention data lives in a [Google Sheet][sheet], one tab per kind:

- `Asimov Prehistory to 1993` — the legacy corpus from Asimov's book.
- `Boris additions` — gap-fillers and post-1993 entries that actually happened.
- `Speculative: <name>` — one tab per future scenario (a "cone of possibilities").

Each tab has the same columns (`ID, Year, Title, Description, Inventor, Location,
Dependencies, Field, URL`). Tabs are mapped to a `Kind` value by `TAB_KIND_MAP`
in [`scripts/fetch-tsv.py`](scripts/fetch-tsv.py); legacy and added are fixed,
each speculative tab is `scenario-<slug>`. See [docs/card-kinds.md](docs/card-kinds.md)
for the data model.

The same sheet also carries **stories** — curated narrative paths through the
tech tree, one tab per story prefixed `Story:`. See
[docs/stories.md](docs/stories.md) for the runtime architecture and
[docs/stories-impl.md](docs/stories-impl.md) for the authoring recipe.

To pull edits (cards + stories) from the sheet to the repo:

```sh
uv run scripts/fetch-tsv.py
```

This rewrites `static/asimov.tsv` (with a `Kind` column derived from the
source tab) and `static/stories.json`. `deploy.sh` runs this automatically
before generating the site.

[sheet]: https://docs.google.com/spreadsheets/d/1hDNXas7DzwglB95HV2_2u1utWAwBZR2hQHlMPz-fj5A/edit

[demo]: https://borismus.github.io/asimov/web/cross-shape/#steel
[blog]: https://smus.com/visual-chronology-science-discovery-v2/
[book]: https://drive.google.com/file/d/190RDAxrUzu5m0d_zxQi98euIguBDb0qf/view?usp=sharing
[issue]: https://github.com/borismus/asimov/issues
[spreadsheet-old]: https://docs.google.com/spreadsheets/d/1uDeBCfcaVUfZFEK-0WJIb43dT6cqHHq9o6Uxn6PihLY/edit#gid=0
[spreadsheet-new]: https://docs.google.com/spreadsheets/d/1uDeBCfcaVUfZFEK-0WJIb43dT6cqHHq9o6Uxn6PihLY/edit#gid=158368026
[email]: mailto:boris@smus.com

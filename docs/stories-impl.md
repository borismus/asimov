# Stories — curated narrative branches through the tech tree

## Context

The asimov tech tree shows ~1500 invention cards as a year-axis DAG. The interesting structure isn't any one card; it's the **contingent, unplanned chains** that run through them — domestication → bridles → stirrups → mounted shock combat; cannon-boring → pressure cylinders → piston steam engines → coal-pump killer-app → textile mills.

Right now the only way to follow a chain is to pin one card and read its direct neighbors, then re-pin and repeat. This plan adds a new overlay called a **story** that draws an authored ribbon through an ordered list of cards, dims the rest of the world, and exposes a stepper UX so the reader walks the narrative beat-by-beat — particularly the "greatness cannot be planned" character of discovery, where each invention turns out to be load-bearing for something its inventors never imagined.

This plan is the first slice: **ship one story end-to-end** (`horse-cavalry`), validate the rendering and stepper, then add more stories without further infrastructure work.

The full design (URL routing, SVG layers, banner UX, pin/hover coexistence) is described in [docs/stories.md](docs/stories.md). This file focuses on what's new since that plan was approved: **stories live in the same Google Sheet as cards, via a tab-name convention**, not in `static/stories.json` directly. The runtime still reads `static/stories.json` — it's now a derived artifact written by the fetch script.

---

## Decisions locked in (from clarifying questions)

- **Data model**: full shape — `slug`, `title`, `blurb`, `references[]`, `steps[]` where each step is `{id, note?}`. Per-step notes are how the "no one planned this" voice carries the narrative.
- **Storage**: same Google Sheet as cards. New tabs use a `Story: <name>` naming convention so the fetch script can tell them apart from invention tabs by prefix. Slug is derived from the tab name (drop prefix, kebab-case).
- **Per-tab layout**: two zones separated by a blank row. Top zone is key/value metadata. Bottom zone is tabular `id, note` steps in narrative order.
- **Discovery**: `STORY_TABS` list in `scripts/fetch-tsv.py` parallel to `TAB_KIND_MAP`. Adding a story = create the tab + add one line.
- **Runtime contract unchanged**: `static/stories.json` is the load target; the fetch script writes it from sheet content.
- **Starting story**: `horse-cavalry`. All five IDs (`animal-dom`, `horse`, `metal-stirrup`, `iron-horseshoes`, `horse-collar`) exist in the legacy TSV today — no card additions needed.

---

## Sheet-side setup (one-time, manual)

1. In the existing sheet, create a new tab named `Story: Horse cavalry`.
2. Inside it, lay out two zones separated by a blank row:

   ```
   title           From horse to heavy cavalry
   blurb           How taming a wild animal turned into the dominant battlefield unit of the Middle Ages.
   ref:1:title     (optional)
   ref:1:url       (optional)
                                                            ← blank row separates zones
   id              note
   animal-dom      First domesticated animals — dogs, then goats — set the precedent.
   horse           Tamed horses: strong like oxen, smart like donkeys.
   metal-stirrup   A stable platform turns the rider into a weapon. Often called one of the most consequential pre-gunpowder inventions in warfare.
   iron-horseshoes Hooves protected; horses can be worked harder, longer, on harder terrain.
   horse-collar    Pulling load shifts from windpipe to shoulders — 5x capacity. Power tilts northward in Europe.
   ```

3. Top-zone keys recognized by the fetch script:
   - `title` (required)
   - `blurb` (optional)
   - `ref:N:title` / `ref:N:url` for each reference, sparse-numbered (optional)
4. Bottom zone is a header row (`id`, `note`) followed by one row per step. Order = row order. Reordering = drag rows.

---

## File-level changes

**New files**
- [static/stories.js](static/stories.js) — module exporting `initStories`, `loadStories`, `enterStory`, `exitStory`, `renderStoryTrace`, `computeStoryFitTransform`, `renderStoriesMenu`, `renderStoryBanner`, `gotoStep`. Same surface as in [docs/stories.md](docs/stories.md).
- [static/stories.css](static/stories.css) — spotlight + ribbon + banner + menu styles.
- [static/stories.json](static/stories.json) — derived artifact written by `fetch-tsv.py`. Listed in `.gitignore`? No: keep it tracked so the deploy artifact is deterministic and the dev server has data to load before the first fetch. Fetch script overwrites it.

**Modified**
- [scripts/fetch-tsv.py](scripts/fetch-tsv.py) — adds `STORY_TABS` list and a `fetch_stories()` function that parses each story tab's two zones into a story object, then writes the merged list to `static/stories.json`.
- [static/universe.html](static/universe.html) — load stories.css; add `#action-stories` button to `.site-actions`; add `#stories-menu` and `#story-banner` containers.
- [static/routing.js](static/routing.js) — extend `parsePathPin` into `parsePath` returning `{kind:"pin"|"story", …}`. Keep `parsePathPin` as a shim for [static/mobile.js](static/mobile.js).
- [static/universe.js](static/universe.js) — wire `initStories`, add `gStoryDim` + `gStoryTrace` SVG layers, extend `state` with story fields, switch popstate handling to the new parser, hook the header button, gate `persistPin` while a story is active.

---

## Story tab parsing (in fetch-tsv.py)

```python
STORY_TAB_PREFIX = "Story: "
STORY_TABS = [
    "Story: Horse cavalry",
]

def slug_from_tab(name):
    rest = name.removeprefix(STORY_TAB_PREFIX).strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", rest).strip("-")

def parse_story_tab(name, body):
    """Two-zone parser. Top: key/value metadata (until first blank row).
    Bottom: tabular id, note steps."""
    rows = list(csv.reader(io.StringIO(body)))
    meta, steps = {}, []
    refs = {}  # by ref index
    in_steps = False
    seen_step_header = False
    for row in rows:
        if all((c or "").strip() == "" for c in row):
            in_steps = True
            continue
        if not in_steps:
            key = (row[0] or "").strip()
            val = (row[1] if len(row) > 1 else "").strip()
            if not key:
                continue
            if key.startswith("ref:"):
                _, idx, field = key.split(":", 2)
                refs.setdefault(idx, {})[field] = val
            else:
                meta[key] = val
        else:
            # First non-blank row in steps zone is the header.
            if not seen_step_header:
                seen_step_header = True
                continue
            sid = (row[0] or "").strip()
            if not sid:
                continue
            note = (row[1] if len(row) > 1 else "").strip()
            steps.append({"id": sid, "note": note or None})

    references = [
        {"title": refs[k].get("title", ""), "url": refs[k].get("url", "")}
        for k in sorted(refs.keys(), key=int)
        if refs[k].get("url")
    ]
    return {
        "slug": slug_from_tab(name),
        "title": meta.get("title", ""),
        "blurb": meta.get("blurb") or None,
        "references": references,
        "steps": steps,
    }
```

The existing `fetch_tab(name)` keeps working (gviz with `headers=1` returns CSV that `csv.reader` parses). Story parsing uses the same fetch helper but a different per-row processor.

The fetch script's `main()` grows a third section after the cards loop:

```python
stories = []
for tab_name in STORY_TABS:
    body = fetch_tab(tab_name)
    if body is None:
        continue
    stories.append(parse_story_tab(tab_name, body))

STORIES_OUT = OUT.parent / "stories.json"
STORIES_OUT.write_text(json.dumps(stories, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {len(stories)} stor{'y' if len(stories)==1 else 'ies'} to {STORIES_OUT}")
```

The duplicate-fallback detection from the cards path doesn't apply here — gviz fallback would return invention rows, and `parse_story_tab` would produce a malformed story (no recognized keys, no step header). To be robust: detect "tab returned no recognizable story data" and warn-skip.

---

## Runtime — unchanged from [docs/stories.md](docs/stories.md)

The full design is in that file. Key mechanics, summarized:

- **URL**: `/story/<slug>/` (path-based, deep-linkable). `parsePath` discriminates `{kind: "pin" | "story"}`. `parsePathPin` shim keeps mobile.js working.
- **State**: `state.storyId, storyNodes, storySteps, storyMissing, storyStep, stories, storiesById`.
- **SVG layers**: `gStoryDim` (full-viewport white wash) inserted between `gAxis` and `gDots`; `gStoryTrace` (rose ribbon path + numbered step markers) inserted between `gCards` and `gPinnedLines`.
- **Visual treatment**: rose-magenta ribbon (`#b8336a`) connects steps in narrative order regardless of canonical TSV deps. Non-story content dims (cards 25%, dots 40%, labels 35%, baseline canvas links 18%). Story-member cards/dots/labels get a `.story-member` class for the spotlight.
- **Banner**: title + blurb + step-prose + refs + `‹` `›` × controls. Stepper pans camera via existing `panToNode` from overlays.js. Esc closes.
- **Pin coexistence**: `enterStory` calls `unpin()`. While `state.storyId` is set, `persistPin` no-ops so click-to-pin works for inspection without changing the URL away from `/story/<slug>/`.
- **Initial fit**: `computeStoryFitTransform` over the bbox of resolved step nodes + 80px screen padding, k clamped to [0.08, 1.5].

`loadStories` is now a `fetch("/static/stories.json")` instead of a static import — `static/stories.json` is the build artifact.

---

## Implementation checklist

1. **Sheet setup (~5 min, user)** — create the `Story: Horse cavalry` tab with the two-zone content above.
2. **Fetch-script extension (~30 min)** — add `parse_story_tab`, `STORY_TABS`, story write to `fetch-tsv.py`. Verify against the new tab; check `static/stories.json` matches the expected JSON shape. Robust skip when a story tab is missing or returns gviz-fallback content.
3. **Routing (~10 min)** — `parsePath` discriminated union in `routing.js`; `parsePathPin` shim.
4. **Module skeleton (~30 min)** — `stories.js` with `loadStories` (fetches `/static/stories.json`), `initStories`, no-op `enterStory`/`exitStory` toggling `body.has-story`. Wire from `universe.js` after `loadGraph`. Add header button + dropdown shell.
5. **SVG layers + ribbon (~45 min)** — insert `gStoryDim` and `gStoryTrace` into the layer stack. `renderStoryTrace`: ribbon path + numbered step markers + `.story-member` tagging on cards/dots/labels. `stories.css` spotlight rules.
6. **Camera fit + popstate (~30 min)** — `computeStoryFitTransform`. Switch popstate handler to discriminated `parsePath`. Verify back/forward across `/`, `/horse/`, `/story/horse-cavalry/`.
7. **Banner + stepper (~40 min)** — `renderStoryBanner` + step controls + Esc-to-close. `gotoStep(i)` + `.story-current` glow.
8. **Pin coexistence (~15 min)** — `enterStory` unpins first; gate `persistPin` while story is active.

Total: ~3.5 hours focused work after the sheet-side setup.

---

## Verification

End-to-end browser tests with the dev server running, after the user has authored `Story: Horse cavalry` in the sheet and run `uv run scripts/fetch-tsv.py`:

- `static/stories.json` exists and contains one story object with the expected slug, title, blurb, 5 steps with notes, empty references list.
- Cold-load `/story/horse-cavalry/` → camera fits all 5 cards; rose ribbon visible; baseline content dimmed; banner shows title + blurb.
- Cold-load `/horse/` → still pins horse exactly as before.
- Click the new Stories button → menu opens listing one story → click "From horse to heavy cavalry" → camera animates, URL becomes `/story/horse-cavalry/`.
- Click `›` four times → camera pans through the steps; banner shows each step's `note`; `.story-current` glow on the focused card.
- Browser back → exits story cleanly; URL returns to previous state.
- While in a story, click a story-member card → pins it (steelblue + rose coexist); URL stays `/story/horse-cavalry/`.
- Add an unknown step ID to the sheet → `console.warn` at load; story renders with the step spliced out, indices renumber.
- Esc with story active → closes it; URL returns to `/`.
- Re-running `fetch-tsv.py` after editing the sheet → `git diff static/stories.json` shows exactly the changes made in the sheet.
- Adding a `Story: Steam engine arc` tab and one line to `STORY_TABS` → next fetch picks it up; menu lists two stories.

---

## Critical files

- [scripts/fetch-tsv.py](scripts/fetch-tsv.py) — `STORY_TABS`, `parse_story_tab`, write `stories.json`
- [static/routing.js](static/routing.js) — `parsePath` discriminated union
- [static/universe.js](static/universe.js) — wire-up, layer additions, popstate switch, persistPin gate
- [static/utils.js](static/utils.js) — read-only reference (no changes; the existing `state.nodesById` lookup is what stories resolve against)
- [static/overlays.js](static/overlays.js) — read-only reference; pin/hover behavior is unchanged. `panToNode` is reused by the stepper.
- [static/world.js](static/world.js) — read-only reference; bbox/layout unchanged
- [static/card.js](static/card.js) — read-only reference; existing `renderFullCard` is reused via the regular card layer (story-members get `.story-member` class on top)
- [static/universe.html](static/universe.html) — header button + banner DOM
- New: [static/stories.js](static/stories.js), [static/stories.css](static/stories.css), [static/stories.json](static/stories.json)
- Reference: [docs/stories.md](docs/stories.md) — earlier full plan; runtime sections still apply

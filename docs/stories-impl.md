# Stories — authoring workflow

**Status:** shipped.

**Source of truth:** the **Google Sheet** (same workbook as the cards). [static/stories.json](../static/stories.json) and [static/asimov.tsv](../static/asimov.tsv) are **exports** produced by `fetch-tsv.py`—edit the sheet, then run the script to refresh the repo; do not treat the committed TSV/JSON as something to hand-edit instead of the sheet.

Stories live in the same Google Sheet as the cards, one tab per story, prefixed `Story:`. The fetch script reads each story tab and writes [static/stories.json](../static/stories.json), which the runtime loads on startup.

For the runtime architecture (focus model, layers, rendering, etc.) see [stories.md](stories.md). This file is the **authoring** half: how to add or edit a story.

---

## Sheet-side recipe

1. Create a new tab named `Story: <Story title>`. The prefix is required; the slug is derived from the rest of the name (`Story: Horse cavalry` → `horse-cavalry`).
2. Lay out two zones in the tab, separated by a blank row.

   **Top zone — key/value metadata:**

   | key   | value                                                                   |
   |-------|-------------------------------------------------------------------------|
   | title | `Rise and fall of heavy cavalry`                                        |
   | blurb | `From a tame horse pulling a chariot to the salaried musketeer that…`   |

   `title` is required; `blurb` is optional.

   **Bottom zone — tabular `id, edge_note` rows:**

   First non-blank row is the header (`id`, `edge_note`); each subsequent row is a step in **timeline order** (non-decreasing by each card’s **Year** in the main corpus). The story ribbon follows the graph’s *x* axis; if years go backward, `fetch-tsv.py` prints a warning and the rose trace looks broken. Narrative detours still work—explain them in the `edge_note`, don’t reorder time.

   ```
   id              edge_note
   animal-dom
   cart            Domestication turned occasional drags into daily logistics…
   horse           The cart already posed “what pulls this?” — horses enter…
   ```

   For step index *i*, `edge_note` is the prose on the segment **into** that step (from step *i − 1*). Step 0 has no incoming edge, so its `edge_note` is **never shown** — leave that cell blank.

   **Reminder — what belongs in `edge_note`:** the reader sees the **card** next; the sticky’s job is only the **transition**. Explain how the previous step made this link inevitable (new bottleneck, unintended load-bearing, who paid for the work, why a non-obvious hop is in the path). Do **not** restate the destination card’s title or body, or summarize “what this invention is” — that’s duplicate UI.

3. Run `uv run scripts/fetch-tsv.py` to regenerate [static/stories.json](../static/stories.json) from the sheet. The script discovers every worksheet whose name matches `Story: <name>` (no manual list in code). Review the diff and commit.

   **Bulk paste into the sheet (optional):** the files under [scripts/sheet-paste/](../scripts/sheet-paste/) are clipboard helpers only—paste at **A1** on the matching **`Story: …`** tab in Google Sheets, then run `fetch-tsv.py` so the repo matches. Regenerate them from local JSON with `python3 scripts/story_tabs_for_sheet_paste.py` (e.g. after drafting in git); the sheet still wins on the next fetch unless you’ve pasted there first.

## Notes for authors

- **`edge_note` vs card copy:** cards carry definitions; edge notes carry **causality** (“why this edge exists”). If deleting the previous card would make the sentence nonsense, you’re on the right track.
- Stories are about **contingency**. Lean each edge prose into "the previous invention turned out to be load-bearing for something nobody intended." Cannon-boring → precision cylinders for Watt; stirrups → couched lance + feudalism; etc.
- Unknown step IDs are logged with `console.warn` at load and spliced out — the story still renders without them.
- The same card can appear in multiple stories; the reverse index (`storiesByCardId`) surfaces all of them in the "Explore the X story" chip when the card is pinned outside any story.

## Files

- [scripts/sheet-paste/](../scripts/sheet-paste/) — `story-tab-*.tsv` paste helpers (see README there); regenerate with [scripts/story_tabs_for_sheet_paste.py](../scripts/story_tabs_for_sheet_paste.py).
- [scripts/fetch-tsv.py](../scripts/fetch-tsv.py) — workbook tab discovery (`Story: …` prefix), `parse_story_tab`, `slug_from_tab`, `STORIES_OUT` write.
- [static/stories.json](../static/stories.json) — derived artifact. Committed for deterministic deploy + cold dev start.
- [static/stories.js](../static/stories.js) — runtime loader + everything downstream (see [stories.md](stories.md)).

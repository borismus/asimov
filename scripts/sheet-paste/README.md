# Story tab paste files

These files are **only** for pasting into the **Google Sheet** (the source of truth). Tab-separated (real tabs): open the matching `Story: …` tab, select **A1**, paste—columns **A** and **B** fill correctly.

| File | Google Sheet tab |
|------|------------------|
| [story-tab-horse-cavalry.tsv](story-tab-horse-cavalry.tsv) | `Story: Horse cavalry` |
| [story-tab-steam-diffusion.tsv](story-tab-steam-diffusion.tsv) | `Story: Steam diffusion` |

Workflow: **paste into the sheet →** `uv run scripts/fetch-tsv.py` **→** committed `static/stories.json` (and `asimov.tsv`) update. Do not rely on editing the repo JSON alone if you use fetch regularly.

Regenerate these helpers from local `static/stories.json` (e.g. after editing in git before mirroring to the sheet):

```bash
python3 scripts/story_tabs_for_sheet_paste.py
```

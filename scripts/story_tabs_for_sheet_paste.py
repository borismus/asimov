#!/usr/bin/env python3
"""Regenerate `scripts/sheet-paste/story-tab-<slug>.tsv` from `static/stories.json`.

These TSVs are for pasting into the **Google Sheet** (source of truth), not for
replacing `static/asimov.tsv`. After pasting on the matching `Story: …` tab at
cell A1, run `uv run scripts/fetch-tsv.py` to refresh committed exports.

Usage: from repo root, `python3 scripts/story_tabs_for_sheet_paste.py`
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "static" / "stories.json"
OUT_DIR = ROOT / "scripts" / "sheet-paste"


def story_tsv(story: dict) -> str:
    lines: list[str] = []
    lines.append("title\t" + str(story["title"]).replace("\t", " "))
    blurb = str(story.get("blurb") or "").replace("\t", " ")
    lines.append("blurb\t" + blurb)
    lines.append("\t")
    lines.append("id\tedge_note")
    for step in story["steps"]:
        sid = str(step["id"]).replace("\t", " ")
        note = step.get("edge_note")
        note_s = "" if note is None else str(note).replace("\t", " ").replace("\n", " ")
        lines.append(sid + "\t" + note_s)
    return "\n".join(lines) + "\n"


def main() -> int:
    stories = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for s in stories:
        slug = s["slug"]
        path = OUT_DIR / f"story-tab-{slug}.tsv"
        path.write_text(story_tsv(s), encoding="utf-8")
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

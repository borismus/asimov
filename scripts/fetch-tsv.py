#!/usr/bin/env python3
"""Pull the asimov inventions sheet to static/asimov.tsv (cards) and
static/stories.json (stories).

Card tabs are listed in TAB_KIND_MAP. Each card row is tagged with a
Kind column derived from its source tab. The merged TSV is consumed by
the runtime loader and by scripts/generate-site.py.

Story tabs are listed in STORY_TABS. Each story tab follows a two-zone
layout (key/value metadata + tabular id/edge_note steps, separated by a
blank row); parse_story_tab parses each into a story object and the
merged list is written as JSON.

Tabs that don't exist yet are skipped with a printed warning, so the
script is safe to run before the sheet has been fully set up.
"""
import csv
import io
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

SHEET_ID = "1hDNXas7DzwglB95HV2_2u1utWAwBZR2hQHlMPz-fj5A"

# Tab name (as it appears in the sheet) → Kind value.
# - "legacy" / "added" are fixed.
# - speculative tabs use "scenario-<slug>" so each future scenario is its
#   own kind. "is this card speculative?" is then kind.startsWith("scenario-").
# Iteration order is preserved in the merged TSV — list legacy first.
TAB_KIND_MAP = {
    "Asimov Prehistory to 1993": "legacy",
    "Boris additions":           "added",
    "Speculative: AGI-dominant": "scenario-agi-dominant",
    "Speculative: Fusion economy": "scenario-fusion",
}

# Story tabs — each follows the two-zone story-tab layout. Slug is derived
# from the tab name (drop the "Story: " prefix, kebab-case). Adding a new
# story = create the tab + add one entry here.
STORY_TAB_PREFIX = "Story: "
STORY_TABS = [
    "Story: Horse cavalry",
    "Story: Steam diffusion",
]

OUT = Path(__file__).resolve().parent.parent / "static" / "asimov.tsv"
STORIES_OUT = Path(__file__).resolve().parent.parent / "static" / "stories.json"


def parse_year_sort_key(raw):
    """Map sheet Year string to int for timeline ordering (lower = earlier).

    Corpus uses ``\\d+ BCE`` or CE ``\\d+`` only. Returns None if unparsable."""
    y = (raw or "").strip()
    if not y:
        return None
    m = re.match(r"^(\d+)\s*BCE\s*$", y, re.I)
    if m:
        return -int(m.group(1))
    m = re.match(r"^(\d+)\s*$", y)
    if m:
        return int(m.group(1))
    return None


def warn_non_chronological_stories(stories, rows_by_id):
    """Emit stderr warnings when a story's step order goes backward in time.

    Cards are laid on the graph by calendar year; non-monotonic story order
    makes the rose ribbon run backward along the x axis."""
    for story in stories:
        slug = story.get("slug", "")
        prev_key = None
        prev_id = None
        prev_raw = None
        for step in story.get("steps") or []:
            sid = (step.get("id") or "").strip()
            if not sid:
                continue
            row = rows_by_id.get(sid)
            if row is None:
                prev_key = prev_id = prev_raw = None
                continue
            raw = (row.get("Year") or "").strip()
            key = parse_year_sort_key(raw)
            if key is None:
                print(
                    f"    WARNING story {slug!r}: step {sid!r} has unparsable "
                    f"Year {raw!r} — skipping chronology check for this segment",
                    file=sys.stderr,
                )
                prev_key = prev_id = prev_raw = None
                continue
            if prev_key is not None and key < prev_key:
                print(
                    f"    WARNING story {slug!r}: non-chronological step order — "
                    f"after {prev_id!r} (Year {prev_raw!r}) comes {sid!r} "
                    f"(Year {raw!r}); ribbon will run backward in time on the graph",
                    file=sys.stderr,
                )
            prev_key, prev_id, prev_raw = key, sid, raw


def slug_from_tab(name):
    rest = name
    if rest.startswith(STORY_TAB_PREFIX):
        rest = rest[len(STORY_TAB_PREFIX):]
    rest = rest.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", rest).strip("-")


def parse_story_tab(name, body):
    """Two-zone parser. Top: key/value metadata. Bottom: tabular header
    row + step rows (`id, edge_note`). Zones are separated by either
    a blank row OR a row whose first cell is `id` (the steps-header row).
    gviz tends to strip blank rows from CSV output, so the `id` fallback
    is what makes most sheets parse correctly."""
    rows = list(csv.reader(io.StringIO(body)))
    meta = {}
    steps = []
    in_steps = False
    seen_step_header = False
    step_cols = ["id", "edge_note"]  # default if header is missing

    for row in rows:
        first = (row[0] or "").strip() if row else ""
        if all((c or "").strip() == "" for c in row):
            in_steps = True
            continue
        # `id` row marks the steps header — switch zones AND consume this
        # row as the header itself.
        if not in_steps and first.lower() == "id":
            in_steps = True
            seen_step_header = True
            step_cols = [(c or "").strip().lower() for c in row]
            continue
        if not in_steps:
            key = first
            val = (row[1] if len(row) > 1 else "").strip()
            if key:
                meta[key] = val
            continue
        # Bottom zone. The first non-blank row defines the column names.
        if not seen_step_header:
            seen_step_header = True
            step_cols = [(c or "").strip().lower() for c in row]
            continue
        sid = (row[0] or "").strip()
        if not sid:
            continue
        # `edge_note` is per-edge prose shown on a pink sticky between this
        # step and the previous one. Optional; any unrecognized columns are
        # ignored.
        edge_note = None
        for col_idx, col_name in enumerate(step_cols):
            if col_idx >= len(row):
                continue
            v = (row[col_idx] or "").strip()
            if not v:
                continue
            if col_name == "edge_note":
                edge_note = v
        steps.append({"id": sid, "edge_note": edge_note})

    return {
        "slug": slug_from_tab(name),
        "title": meta.get("title", "") or slug_from_tab(name),
        "blurb": meta.get("blurb") or None,
        "steps": steps,
    }


def fetch_tab(name):
    # gviz/tq accepts ?sheet=<tab-name> so we never need to look up gids.
    # tqx=out:csv returns CSV; headers=1 forces gviz to treat row 1 as headers
    # (without it, gviz tries to auto-detect data ranges and may collapse
    # whole columns into a single value when the sheet has trailing empties).
    encoded = urllib.parse.quote(name)
    url = (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq"
        f"?tqx=out:csv&headers=1&sheet={encoded}"
    )
    print(f"  fetching tab {name!r}")
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        print(f"    HTTP {e.code}: tab {name!r} not found — skipping")
        return None
    except urllib.error.URLError as e:
        print(f"    network error for {name!r}: {e} — skipping")
        return None


def main():
    rows_out = []
    header = None
    breakdown = Counter()
    # gviz silently falls back to the default (first) tab when the requested
    # tab name doesn't exist, returning the same body. Track first-row IDs
    # so we don't re-ingest a fallback as if it were the missing tab.
    seen_first_ids = set()

    for tab_name, kind in TAB_KIND_MAP.items():
        body = fetch_tab(tab_name)
        if body is None:
            continue
        reader = csv.DictReader(io.StringIO(body))  # gviz returns CSV
        rows = [r for r in reader if (r.get("ID") or "").strip()]
        if not rows:
            print(f"    tab {tab_name!r} has no data rows — skipping")
            continue
        first_id = rows[0].get("ID", "").strip()
        if first_id in seen_first_ids:
            print(
                f"    tab {tab_name!r} returned the same data as a prior tab "
                f"(first row id={first_id!r}) — likely a gviz fallback; skipping"
            )
            continue
        seen_first_ids.add(first_id)
        if header is None:
            header = list(reader.fieldnames or []) + ["Kind"]
        for row in rows:
            row["Kind"] = kind
            rows_out.append(row)
            breakdown[kind] += 1

    if not rows_out:
        print("no rows fetched — leaving static/asimov.tsv untouched", file=sys.stderr)
        return 1

    # TSV has no quoting convention, so any tab/newline embedded in a value
    # would corrupt the file. Collapse them to spaces. d3.tsv on the read
    # side doesn't support quoted multi-line fields either, so this matches
    # what the runtime expects.
    def sanitize(v):
        if v is None:
            return ""
        return str(v).replace("\t", " ").replace("\r", " ").replace("\n", " ")

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=header, delimiter="\t",
                            extrasaction="ignore", lineterminator="\n",
                            quoting=csv.QUOTE_NONE, escapechar="\\")
    writer.writeheader()
    for r in rows_out:
        writer.writerow({k: sanitize(v) for k, v in r.items()})
    OUT.write_text(buf.getvalue(), encoding="utf-8")

    print(f"wrote {len(rows_out)} rows to {OUT}")
    for k, n in breakdown.most_common():
        print(f"  {k:<28} {n}")

    # ---- stories ---------------------------------------------------------
    stories = []
    for tab_name in STORY_TABS:
        body = fetch_tab(tab_name)
        if body is None:
            continue
        story = parse_story_tab(tab_name, body)
        # gviz fallback heuristic: a missing story tab returns the legacy
        # cards body (which has no `title` metadata key in row 1, just an
        # `ID` column header). If the parsed story has no title and no
        # steps that look like story steps, skip it.
        if not story["title"] or not story["steps"]:
            print(f"    story tab {tab_name!r} returned no recognizable story data — skipping")
            continue
        # Extra safety: if step IDs match the legacy first-row IDs we just
        # fetched, this is the gviz fallback.
        first_step_id = story["steps"][0]["id"] if story["steps"] else None
        if first_step_id and first_step_id in seen_first_ids:
            # could be a real story whose first ID coincides with a card
            # tab's first row; very unlikely. Print and accept.
            pass
        stories.append(story)

    rows_by_id = {
        (r.get("ID") or "").strip(): r
        for r in rows_out
        if (r.get("ID") or "").strip()
    }
    warn_non_chronological_stories(stories, rows_by_id)

    STORIES_OUT.write_text(
        json.dumps(stories, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    suffix = "y" if len(stories) == 1 else "ies"
    print(f"wrote {len(stories)} stor{suffix} to {STORIES_OUT}")
    for s in stories:
        print(f"  {s['slug']:<28} {len(s['steps'])} steps")
    return 0


if __name__ == "__main__":
    sys.exit(main())

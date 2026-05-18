#!/usr/bin/env python3
"""Pull the asimov inventions sheet to static/asimov.tsv (cards) and
static/stories.json (stories).

Card tabs are listed in TAB_KIND_MAP. Each card row is tagged with a
Kind column derived from its source tab. The merged TSV is consumed by
the runtime loader and by scripts/generate-site.py.

Story tabs are discovered from the workbook: any worksheet whose name
matches ``Story: <name>`` (colon optional — ``Story <name>`` also matches
legacy tabs). Each story tab follows a two-zone layout (key/value
metadata + tabular id/edge_note steps, separated by a blank row);
parse_story_tab parses each into a story object and the merged list is
written as JSON.

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
import xml.etree.ElementTree as ET
import zipfile
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

# Worksheet names matching this pattern are ingested as stories (see
# discover_story_tabs). Prefer the documented ``Story: <name>`` form.
STORY_TAB_PREFIX = "Story: "
STORY_TAB_NAME_RE = re.compile(r"^Story:?\s+(.+)$", re.I)

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
    m = STORY_TAB_NAME_RE.match((name or "").strip())
    rest = m.group(1) if m else name
    rest = rest.strip().lower()
    return re.sub(r"[^a-z0-9]+", "-", rest).strip("-")


def list_workbook_tabs(sheet_id):
    """Return worksheet names in workbook order (public export, no API key)."""
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=xlsx"
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            data = resp.read()
    except urllib.error.HTTPError as e:
        print(f"    workbook export HTTP {e.code} — cannot list story tabs", file=sys.stderr)
        return []
    except urllib.error.URLError as e:
        print(f"    workbook export network error: {e}", file=sys.stderr)
        return []
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            root = ET.fromstring(zf.read("xl/workbook.xml"))
    except (zipfile.BadZipFile, KeyError, ET.ParseError) as e:
        print(f"    workbook export parse error: {e}", file=sys.stderr)
        return []
    # OOXML: sheets live under main namespace or unprefixed in some exports.
    ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    sheets = root.findall("main:sheets/main:sheet", ns)
    if not sheets:
        sheets = root.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet")
    return [(el.get("name") or "").strip() for el in sheets if (el.get("name") or "").strip()]


def discover_story_tabs(all_tab_names):
    """Filter workbook tab names to story worksheets, preserving order."""
    out = []
    for name in all_tab_names:
        m = STORY_TAB_NAME_RE.match(name)
        if not m or not m.group(1).strip():
            continue
        out.append(name)
    return out


def gviz_sheet_name(workbook_tab_name):
    """gviz ``?sheet=`` uses the documented ``Story: <name>`` form.

    The XLSX workbook export often drops the colon (``Story Horse cavalry``);
    requesting that string silently returns the first worksheet instead."""
    m = STORY_TAB_NAME_RE.match((workbook_tab_name or "").strip())
    if not m:
        return workbook_tab_name
    return f"{STORY_TAB_PREFIX}{m.group(1).strip()}"


def looks_like_card_corpus_fallback(story, seen_first_ids):
    """True when gviz returned a card tab instead of the story worksheet."""
    steps = story.get("steps") or []
    if len(steps) > 100:
        return True
    if not steps:
        return False
    first_id = (steps[0].get("id") or "").strip()
    return first_id in seen_first_ids


# Story tabs are authored in columns A–B only (title/blurb, then id/edge_note).
# Extra sheet columns (e.g. notes in C) are ignored so gviz export stays stable.
STORY_COLS = 2


def _story_row(row):
    return ((row or []) + ["", ""])[:STORY_COLS]


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
        row = _story_row(row)
        first = (row[0] or "").strip() if row else ""
        if all((c or "").strip() == "" for c in row):
            in_steps = True
            continue
        # `id` row marks the steps header — switch zones AND consume this
        # row as the header itself.
        if not in_steps and first.lower() == "id":
            in_steps = True
            seen_step_header = True
            step_cols = [
                (c or "").strip().lower()
                for c in row
                if (c or "").strip().lower() in ("id", "edge_note")
            ] or ["id", "edge_note"]
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
            step_cols = [
                (c or "").strip().lower()
                for c in row
                if (c or "").strip().lower() in ("id", "edge_note")
            ] or ["id", "edge_note"]
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


def fetch_tab(name, *, use_gviz_headers=True):
    # gviz/tq accepts ?sheet=<tab-name> so we never need to look up gids.
    # tqx=out:csv returns CSV. headers=1 suits card tabs (row 1 = ID, Year, …).
    # Story tabs use row 1 as data (title/blurb), so fetch them without it.
    encoded = urllib.parse.quote(name)
    headers_q = "&headers=1" if use_gviz_headers else ""
    url = (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq"
        f"?tqx=out:csv{headers_q}&sheet={encoded}"
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
    workbook_tabs = list_workbook_tabs(SHEET_ID)
    story_tab_names = discover_story_tabs(workbook_tabs)
    if workbook_tabs:
        print(
            f"discovered {len(story_tab_names)} story tab(s) "
            f"(prefix {STORY_TAB_PREFIX!r})"
        )
    else:
        print("could not list workbook tabs — no stories fetched", file=sys.stderr)

    stories = []
    for workbook_tab_name in story_tab_names:
        fetch_name = gviz_sheet_name(workbook_tab_name)
        body = fetch_tab(fetch_name, use_gviz_headers=False)
        if body is None:
            continue
        story = parse_story_tab(workbook_tab_name, body)
        if not story["steps"]:
            print(
                f"    story tab {workbook_tab_name!r} returned no steps — skipping"
            )
            continue
        if looks_like_card_corpus_fallback(story, seen_first_ids):
            print(
                f"    story tab {workbook_tab_name!r} (gviz sheet {fetch_name!r}) "
                f"looks like the card corpus fallback — skipping",
                file=sys.stderr,
            )
            continue
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

#!/usr/bin/env python3
"""Pull the asimov inventions sheet (one tab per kind) to static/asimov.tsv.

Each tab's rows are tagged with a Kind column derived from the tab name
via TAB_KIND_MAP. The merged result is written as a single TSV consumed
by the runtime loader and by scripts/generate-site.py.

Tabs that don't exist yet are skipped with a printed warning, so the
script is safe to run before the sheet has been fully set up.
"""
import csv
import io
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

OUT = Path(__file__).resolve().parent.parent / "static" / "asimov.tsv"


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
    return 0


if __name__ == "__main__":
    sys.exit(main())

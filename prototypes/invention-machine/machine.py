"""Invention machine, step 1: check candidates against the assembly graph.

  python3 machine.py            check gap_list.py against the 1990 graph, print a report
  python3 machine.py export     also write candidates.json (the seed for the curation tool)
  python3 machine.py tool       write tool/ref.json and tool/thumbs/ for the curation page

A candidate is a job + an effect + existing cards as parts. For each one this reports
whether the job exists, whether the effect is already in the graph, has a deck card
but no use yet, or needs a new phenomenon card, and whether the job + effect pairing
is new (Arthur's test for an invention rather than an improvement).
"""
import csv, json, sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
A = json.loads((HERE.parent / "assembly-cards" / "assemblies.json").read_text())
CARDS, PHEN = A["cards"], A["phenomena"]
DECK = {r["ID"]: r for r in csv.DictReader(open(ROOT / "static" / "asimov.tsv"), delimiter="\t")}
NEW_CARDS = A.get("new_cards", {})

def year(cid):
    r = DECK.get(cid)
    y = r["Year"] if r else (NEW_CARDS.get(cid) or [None, None])[1]
    if y is None: return None
    s = str(y).strip()
    return -int(s.split()[0]) if "BCE" in s else int(s.split()[0])

JOBS = {c["job"] for c in CARDS.values()} | {s["job"] for c in CARDS.values() for s in c["slots"]}
EFFECTS = {l["effect"] for v in PHEN.values() for l in v}
USED = defaultdict(set)                      # job -> effects the cards doing it work by
for cid, c in CARDS.items():
    for l in PHEN.get(cid, []): USED[c["job"]].add(l["effect"])
OWN_FX = {cid: {l["effect"] for l in v} for cid, v in PHEN.items()}

def gap():
    import gap_list
    return gap_list.ROWS, getattr(gap_list, "NEW_CARDS", {}), getattr(gap_list, "REVISIONS", {})

ROWS, GAP_CARDS, REVISIONS = gap()
CAND = {r[1]: r for r in ROWS}               # candidates can be parts of later candidates (rule r10)

def title(cid):
    return ((DECK.get(cid) or {}).get("Title") or (GAP_CARDS.get(cid) or [None])[0]
            or (NEW_CARDS.get(cid) or [None])[0] or (CAND[cid][2] if cid in CAND else cid))

def year_any(cid):
    if cid in GAP_CARDS: return GAP_CARDS[cid][1]
    return year(cid)

def check(row):
    yr, cid, name, job, fx, fxcard, parts, how, kind = row
    out = dict(id=cid, name=name, year=yr, job=job, effect=fx, effectCard=fxcard, how=how, kind=kind,
               parts=[], problems=[], path="gap", proposedBy="ai", status="proposed")
    if cid in CARDS or cid in DECK: out["problems"].append("already in the deck")
    out["jobNew"] = job not in JOBS
    for p in parts:
        if p in CARDS:
            out["parts"].append({"card": p, "t": title(p), "job": CARDS[p]["job"], "year": year(p)})
        elif p in CAND:
            out["parts"].append({"card": p, "t": CAND[p][2], "job": CAND[p][3], "year": CAND[p][0], "candidate": True})
        else:
            out["problems"].append(f"unknown part {p}")
    late = [p["card"] for p in out["parts"] if (p["year"] or 0) > yr]
    if late: out["problems"].append("part is later than the invention: " + ", ".join(late))
    if fx is None:
        out["effectStatus"] = "none"
    elif fx in EFFECTS:
        out["effectStatus"] = "in graph"
    elif fxcard and fxcard in DECK:
        out["effectStatus"] = "card, unused"
    else:
        out["effectStatus"] = "needs card"
    if fxcard and fxcard not in DECK and fxcard not in NEW_CARDS and fxcard not in GAP_CARDS:
        out["problems"].append(f"unknown effect card {fxcard}")
    out["effectYear"] = year_any(fxcard) if fxcard else None
    out["effectCardTitle"] = title(fxcard) if fxcard else None
    if fxcard in GAP_CARDS: out["effectCardNew"] = GAP_CARDS[fxcard][2]
    if cid in REVISIONS: out["revision"] = REVISIONS[cid]
    out["pairNew"] = bool(fx) and fx not in USED.get(job, set())
    out["inPart"] = [p["card"] for p in out["parts"] if fx and fx in OWN_FX.get(p["card"], set())]
    # Reachable from the 1990 graph: a new pairing whose effect card was in the deck by 1990.
    out["reachable1990"] = out["pairNew"] and fxcard in DECK and out["effectYear"] is not None and out["effectYear"] <= 1990 and not out["jobNew"]
    return out

def main():
    cands = [check(r) for r in ROWS]
    bad = [c for c in cands if c["problems"]]
    for c in bad: print("PROBLEM", c["id"], c["problems"])
    inv = [c for c in cands if c["kind"] == "invention"]
    by = defaultdict(list)
    for c in inv: by[c["effectStatus"]].append(c["id"])
    print(f"{len(cands)} candidates: {len(inv)} inventions, {len(cands) - len(inv)} improvements")
    for k in ("in graph", "card, unused", "needs card"): print(f"  effect {k}: {len(by[k])}")
    print("  reachable from the 1990 graph:", sum(c["reachable1990"] for c in inv))
    print("  pairing already used (not new):", [c["id"] for c in inv if not c["pairNew"]])
    print("  effect already in a part:", {c["id"]: c["inPart"] for c in inv if c["inPart"]})
    print("  new jobs:", {c["id"]: c["job"] for c in cands if c["jobNew"]})
    if sys.argv[1:] == ["export"]:
        (HERE / "candidates.json").write_text(json.dumps(cands, indent=1, ensure_ascii=False) + "\n")
        print("wrote candidates.json")

def tool():
    """Reference data and card thumbnails the curation page loads next to itself."""
    import subprocess
    cands = [check(r) for r in ROWS]
    fxcards = {l["effect"]: l["card"] for v in PHEN.values() for l in v if l.get("card")}
    ref = {
        "cards": {cid: {"t": title(cid), "y": year(cid), "job": c["job"]} for cid, c in CARDS.items()},
        "effects": {fx: {"card": fxcards.get(fx), "t": title(fxcards[fx]) if fx in fxcards else None} for fx in sorted(EFFECTS)},
        "jobs": sorted(JOBS),
        "deckCards": {cid: {"t": title(cid), "y": year_any(cid)} for cid in {c["effectCard"] for c in cands if c["effectCard"]}},
    }
    out = HERE / "tool"; (out / "thumbs").mkdir(parents=True, exist_ok=True)
    (out / "ref.json").write_text(json.dumps(ref, ensure_ascii=False, separators=(",", ":")))
    want = {p["card"] for c in cands for p in c["parts"]} | {c["effectCard"] for c in cands if c["effectCard"]}
    art = ROOT / "static" / "images" / "entries-v2"
    made = 0
    for cid in sorted(want):
        src, dst = art / f"{cid}.jpg", out / "thumbs" / f"{cid}.jpg"
        if src.exists() and not dst.exists():
            subprocess.run(["sips", "-Z", "240", "-s", "formatOptions", "70", str(src), "--out", str(dst)],
                           check=True, capture_output=True)
            made += 1
    print(f"ref.json: {len(ref['cards'])} cards, {len(ref['effects'])} effects; thumbs made {made}, missing",
          sorted(c for c in want if not (art / f"{c}.jpg").exists()))

if __name__ == "__main__":
    tool() if sys.argv[1:] == ["tool"] else main()

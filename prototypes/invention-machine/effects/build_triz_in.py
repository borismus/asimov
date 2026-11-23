"""Build inputs for the TRIZ-effects Future Technology round.

  python3 build_triz_in.py DB_DIR   DB_DIR holds the artifact db snapshot (effects/, candidates/)
Writes triz_effects.json (the kept effect cards), triz_in1-3.json (effect ids per agent)
and refreshes existing_names.json from the current candidates.
"""
import json, glob, os, sys
db = sys.argv[1]
E = [json.load(open(f)) for f in glob.glob(os.path.join(db, "effects/*.json"))]
SAMPLE_REVISED = {"sagnac-effect", "forced-convection", "flocculation", "hygroscopy"}  # revised per his notes, pick keep
keep = [e for e in E if e.get("status") == "kept" or e["id"] in SAMPLE_REVISED]
out = []
for e in sorted(keep, key=lambda e: (e.get("field") or "", e["title"])):
    out.append({"card": e["id"] if e.get("pick") != "link" else e.get("deckMatch"), "t": e["title"], "y": e.get("year"),
                "field": e.get("field"), "effect": e.get("effect"), "description": e.get("description"),
                "usedIn": e.get("usedIn") or [], "strength": e.get("strength"),
                "can": e.get("functions", [])[:12], "deckCard": e.get("deckMatch") if e.get("pick") == "link" else None})
json.dump(out, open("triz_effects.json", "w"), ensure_ascii=False, indent=1)
# three interleaved slices so each agent gets a mix of fields
for i in range(3):
    json.dump([x["card"] for x in out[i::3]], open(f"triz_in{i+1}.json", "w"))
C = [json.load(open(f)) for f in glob.glob(os.path.join(db, "candidates/*.json"))]
json.dump(sorted(c["name"] for c in C if c.get("name")), open("existing_names.json", "w"), ensure_ascii=False, indent=0)
print(len(out), "effects;", [len(out[i::3]) for i in range(3)], "slices;", len(C), "existing names")
import collections; print(collections.Counter(x["field"] for x in out).most_common())

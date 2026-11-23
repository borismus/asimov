"""Turn big_out*.json + bigchk_out*.json into candidate docs for the curation artifact.
Usage: python3 merge_big.py OUT_DIR GEN_SUFFIXES CHECK_SUFFIXES
  e.g. merge_big.py out 1,2,3 1a,1b,2   -> OUT_DIR/ft-*.json and OUT_DIR/writes.json (batches of <=50)."""
import json, sys, os
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
gens = sys.argv[2].split(",") if len(sys.argv) > 2 else ["1", "2", "3"]
chks = sys.argv[3].split(",") if len(sys.argv) > 3 else ["1a", "1b", "2"]
cards = sum((json.load(open(f"big_out{i}.json")) for i in gens), [])
chk = {c["id"]: c for i in chks for c in json.load(open(f"bigchk_out{i}.json"))}
board = {c["id"]: c for c in json.load(open("board_cards.json"))}
titles = {e["id"]: e["title"] for e in json.load(open("kept_effects.json"))}
for e in json.load(open("triz_effects.json")):
    titles.setdefault(e.get("card") or e.get("id"), e.get("t") or e.get("title"))
writes, missing = [], []
for c in cards:
    k = chk.get(c["id"])
    if not k: missing.append(c["id"]); continue
    v = k["verdict"]
    note = {"drop": f"Dropped ({k['rule']}): ", "pass": "Passes: ", "borderline": "Borderline: "}[v] + k["why"]
    doc = {
        "id": "ft-" + c["id"], "name": c["name"], "subtitle": c["subtitle"], "job": c["job"], "bigJob": c["bigJob"],
        "effects": [{"effect": e["effect"], "card": e.get("card"), **({"t": titles[e["card"]]} if e.get("card") in titles and titles[e["card"]] else {}), "newToJob": e.get("newToJob", True)} for e in c["effects"]],
        "parts": [{"card": p, "t": board[p]["t"], "job": board[p]["job"]} for p in c["parts"] if p in board],
        "how": c["how"], "obstacle": c["obstacle"], "why": c["why"], "tenX": c.get("tenX", ""), "evidence": c.get("evidence", ""),
        "familiar": k.get("familiar", c.get("familiar", False)), "plausibility": c.get("plausibility"),
        "real": k.get("found", ""), "realUrl": k.get("url", ""), "maturity": "paper", "ruleNote": note,
        "path": "future", "batch": "bigjobs", "kind": "invention", "proposedBy": "ai", "createdAt": 1795100000000,
        "status": "rejected" if v == "drop" else "proposed",
        **({"confirmedBy": "ai", "rule": k["rule"]} if v == "drop" else {}),
    }
    f = f"{out}/{doc['id']}.json"; json.dump(doc, open(f, "w"))
    writes.append({"op": "set", "collection": "candidates", "doc_id": doc["id"], "file_path": f})
json.dump(writes, open(f"{out}/writes.json", "w"))
from collections import Counter
print(len(writes), "docs; missing checks:", missing)
print(Counter(chk[c["id"]]["verdict"] for c in cards if c["id"] in chk))

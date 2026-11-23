"""Merge the TRIZ-round candidates (triz_out*.json) with their prior-art checks (triz_prior*.json).

  python3 merge_triz.py check        validate the generator outputs, write triz_check1-3.json for the checkers
  python3 merge_triz.py docs OPS_DIR  write triz_docs/*.json (not-yet-built only) and OPS_DIR/triz_ops_N.json

"built" candidates are kept out of the tool, like the earlier rounds; "studied" become maturity
"paper" and "none" become "idea".
"""
import csv, glob, json, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
L = lambda f: json.load(open(os.path.join(HERE, f)))
deck = {r["ID"]: r for r in csv.DictReader(open(os.path.join(ROOT, "static/asimov.tsv")), delimiter="\t")}
newc = json.load(open(os.path.join(ROOT, "prototypes/assembly-cards/assemblies.json")))["new_cards"]
def dyear(c):
    s = deck[c]["Year"] if c in deck else (newc.get(c) or [None, None])[1]
    if s in (None, ""): return None
    s = str(s).strip(); return -int(s.split()[0]) if "BCE" in s else int(s.split()[0])
def dtitle(c): return deck[c]["Title"] if c in deck else (newc.get(c) or [c])[0]

triz = {e["card"]: e for e in L("triz_effects.json")}
inv = {e["card"]: e for e in L("inventory.json")}
exist = {c for _, c in L("existing_effects.json") if c}
board = {c["id"]: c for c in L("board_cards.json")}
new_jobs = set(L("new_jobs.json"))
jobs = {c["job"] for c in board.values()} | new_jobs
names = {n.lower() for n in L("existing_names.json")}

out = [(i, x) for i in (1, 2, 3) for x in (json.load(open(os.path.join(HERE, f"triz_out{i}.json"))) if os.path.exists(os.path.join(HERE, f"triz_out{i}.json")) else [])]

def problems(x):
    p = []
    if x["job"] not in jobs: p.append(f"unknown job {x['job']}")
    for c in x.get("parts", []):
        if c not in board: p.append(f"unknown part {c}")
    for e in x.get("effects", []):
        if e["card"] not in triz and e["card"] not in inv and e["card"] not in exist and e["card"] not in deck and e["card"] not in newc:
            p.append(f"unknown effect card {e['card']}")
    if not any(e.get("triz") and e.get("newToJob") and e["card"] in triz for e in x.get("effects", [])): p.append("no new TRIZ effect")
    if x["name"].lower() in names: p.append("name already used")
    return p

ids = collections.Counter(x["id"] for _, x in out)
if sys.argv[1] == "check":
    bad = 0
    for i, x in out:
        p = problems(x) + (["duplicate id"] if ids[x["id"]] > 1 else [])
        if p: bad += 1; print(i, x["id"], p)
    print(len(out), "candidates;", bad, "with problems;", collections.Counter(i for i, _ in out))
    for i in (1, 2, 3):
        json.dump([{k: x[k] for k in ("id", "name", "subtitle", "job", "how", "effects", "searchQuery")} for j, x in out if j == i],
                  open(os.path.join(HERE, f"triz_check{i}.json"), "w"), ensure_ascii=False, indent=1)
    sys.exit()

prior = {p["id"]: p for f in sorted(glob.glob(os.path.join(HERE, "triz_prior*.json"))) for p in json.load(open(f))}
os.makedirs(os.path.join(HERE, "triz_docs"), exist_ok=True)
ops, tally, built = [], collections.Counter(), []
for i, x in out:
    pr = prior.get(x["id"])
    v = pr["verdict"] if pr else "unchecked"
    tally[v] += 1
    if v == "built": built.append((x["name"], pr.get("evidence"))); continue
    effs = []
    for e in x["effects"]:
        c = e["card"]
        if c in triz: t, y = triz[c]["t"], triz[c]["y"]
        elif c in inv: t, y = inv[c]["title"], inv[c]["year"]
        else: t, y = dtitle(c), dyear(c)
        effs.append({"effect": e["effect"], "card": c, "t": t, "y": y, "triz": bool(e.get("triz")), "newToJob": bool(e.get("newToJob"))})
    lead = next(e for e in effs if e["triz"] and e["newToJob"] and e["card"] in triz)
    did = "ft-" + x["id"]
    d = {"id": did, "name": x["name"], "subtitle": x["subtitle"], "job": x["job"], "jobNew": x["job"] in new_jobs,
         "effects": effs, "effect": lead["effect"], "effectCard": lead["card"],
         "parts": [{"card": c, "t": board[c]["t"], "job": board[c]["job"], "year": board[c]["y"]} for c in x["parts"] if c in board],
         "how": x["how"], "obstacle": x["obstacle"], "why": x.get("why", ""),
         "real": (pr or {}).get("evidence", ""), "realUrl": (pr or {}).get("url"),
         "maturity": {"studied": "paper", "none": "idea"}.get(v, "idea"), "plausibility": x.get("plausibility"),
         "batch": "triz", "path": "future", "kind": "invention", "pairNew": True, "inPart": [], "problems": problems(x),
         "proposedBy": "ai", "status": "proposed", "createdAt": 1794990000000, "year": None}
    p = os.path.join(HERE, "triz_docs", did + ".json"); json.dump(d, open(p, "w"), ensure_ascii=False)
    ops.append({"op": "set", "collection": "candidates", "doc_id": did, "file_path": p})
od = sys.argv[2]
for k in range(0, len(ops), 50):
    json.dump(ops[k:k + 50], open(os.path.join(od, f"triz_ops_{k // 50 + 1}.json"), "w"))
print(dict(tally), len(ops), "docs")
for n, ev in built: print("BUILT", n, "|", ev)

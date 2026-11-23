"""Merge the agents' effect-card outputs (edb_out*.json) into db docs (edb_docs2/) and a batch list.

Clear calls get a status from the rule that decided them (kept / rejected), so they don't need
review; borderline ones stay "proposed" for the curator.

  python3 merge_edb.py OPS_DIR    writes edb_docs2/*.json and OPS_DIR/edb_ops_N.json (50 writes each)
"""
import csv, glob, json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
rows = {r["ID"]: r for r in csv.DictReader(open(os.path.join(ROOT, "static/asimov.tsv")), delimiter="\t")}
new = json.load(open(os.path.join(ROOT, "prototypes/assembly-cards/assemblies.json")))["new_cards"]
known = set(rows) | set(new)
def ctitle(c): return rows[c]["Title"] if c in rows else new[c][0] if c in new else None
edb = {e["name"]: e for e in json.load(open(os.path.join(HERE, "edb_matched.json")))}
sample = {e["id"] for e in json.load(open(os.path.join(HERE, "edb_sample1.json")))}
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60]

out = [x for f in sorted(glob.glob(os.path.join(HERE, "edb_out*.json"))) for x in json.load(open(f))]

# Reconcile across batches. Families whose card already exists from the reviewed sample merge
# into that sample doc; merges whose target another batch dropped or matched to the deck follow it.
ALIAS = {"convection": "forced-convection", "coagulation": "flocculation",
         "mechanoluminescence": "triboluminescence", "bernoulli-effect": "bernoulli-principle"}
FIX = {"Flow Separation": {"verdict": "drop", "rule": "e1", "why": "Follows Boundary layer, which was dropped as a concept rather than an effect."},
       "London Dispersion Force": {"verdict": "in-deck", "card": "gas-laws", "rule": "e3", "why": "Follows Van der Waals force, which the deck's Gas laws card (van der Waals, 1873) already covers."},
       "Oblique Shock Wave": {"verdict": "in-deck", "card": "mach-number", "rule": "e3", "why": "A variant of the shock wave, which goes on the deck's Mach number card."},
       "Settling": {"verdict": "drop", "rule": "e1", "why": "Same as Sedimentation, dropped as an everyday process."},
       "Superdiamagnetism": {"verdict": "drop", "rule": "e2", "why": "Same as the Meissner effect: only in superconductors near absolute zero."}}
for x in out:
    if x["edb"] in FIX:
        x.update(FIX[x["edb"]]); x.pop("into", None); x["borderline"] = False
    if x.get("verdict") == "keep" and x.get("id") in ALIAS:
        x.update(verdict="merge", into=ALIAS[x["id"]], rule="e4", borderline=False, why="Same card as the one already reviewed in the sample.")
    if x.get("into") in ALIAS: x["into"] = ALIAS[x["into"]]
docs, problems, seen = {}, [], set()
keeps = {x["id"] for x in out if x.get("verdict") == "keep" and x.get("id")}
for x in out:
    e = edb.get(x["edb"])
    if not e: problems.append(f"unknown edb name {x['edb']}"); continue
    v = x["verdict"]
    did = x.get("id") if v == "keep" and x.get("id") else "edb-" + slug(x["edb"])
    if did in sample or did in seen or (v == "keep" and did in known):
        problems.append(f"id clash {did} ({x['edb']})"); did = "edb-" + slug(x["edb"])
    seen.add(did)
    card = x.get("card")
    if v in ("in-deck", "attach") and card not in known: problems.append(f"{x['edb']}: unknown deck card {card}"); card = None
    into = x.get("into")
    if v == "merge" and into and into not in keeps and into not in sample and into not in known:
        problems.append(f"{x['edb']}: merge target {into} has no keep")
    deps = [d for d in x.get("deps", []) if d in known]
    pick = {"keep": "keep", "drop": "drop", "merge": "merge", "in-deck": "in-deck", "attach": "link"}.get(v, "drop")
    status = "proposed" if x.get("borderline") else ("kept" if v in ("keep", "attach") else "rejected")
    d = {"id": did, "edb": x["edb"], "edbDesc": e["desc"], "wiki": e["wiki"],
         "functions": sorted({f"{y['function']} / {y['target']}" for y in e["does"]}),
         "title": x.get("title") or x["edb"], "year": x.get("year"), "inventor": x.get("inventor") or "",
         "location": x.get("location") or "", "field": x.get("field") or "", "deps": deps,
         "description": x.get("description") or "", "effect": x.get("effect") or "",
         "usedIn": x.get("usedIn") or [], "strength": x.get("strength") or "",
         "pick": pick, "pickWhy": ("Borderline: " if x.get("borderline") and not (x.get("why") or "").startswith("Borderline") else "") + (x.get("why") or ""),
         "rule": x.get("rule"), "borderline": bool(x.get("borderline")),
         "deckMatch": card, "deckMatchTitle": ctitle(card) if card else None, "mergeInto": into if v == "merge" else None,
         "source": "TRIZ Effects Database", "batch": "rules1", "status": status, "proposedBy": "ai",
         "decidedBy": None if x.get("borderline") else "rule", "createdAt": 1794900000000}
    docs[did] = d

os.makedirs(os.path.join(HERE, "edb_docs2"), exist_ok=True)
ops = []
for did, d in docs.items():
    p = os.path.join(HERE, "edb_docs2", did + ".json"); json.dump(d, open(p, "w"), ensure_ascii=False)
    ops.append({"op": "set", "collection": "effects", "doc_id": did, "file_path": p})
od = sys.argv[1] if len(sys.argv) > 1 else HERE
for i in range(0, len(ops), 50):
    json.dump(ops[i:i + 50], open(os.path.join(od, f"edb_ops_{i // 50 + 1}.json"), "w"))
c = collections.Counter((d["pick"], d["status"]) for d in docs.values())
print(len(docs), "docs;", dict(c))
print("borderline:", sum(d["borderline"] for d in docs.values()))
for p in problems: print("PROBLEM", p)

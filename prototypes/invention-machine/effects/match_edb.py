"""Match TRIZ Effects Database effects (edb.json) against the deck.

For each effect: is there a deck card for it (by title or Wikipedia link), and do any
deck cards already use it as an effect? Writes edb_matched.json and prints a summary.
"""
import csv, json, os, re, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
edb = json.load(open(os.path.join(HERE, "edb.json")))
rows = list(csv.DictReader(open(os.path.join(ROOT, "static/asimov.tsv")), delimiter="\t"))
asm = json.load(open(os.path.join(ROOT, "prototypes/assembly-cards/assemblies.json")))

def norm(s):
    s = re.sub(r"\(.*?\)", "", s.lower())
    s = re.sub(r"\b(effect|the|of|law|principle|phenomenon)\b", "", s)
    return re.sub(r"[^a-z0-9]", "", s)

deck = {}
for r in rows:
    deck.setdefault(norm(r["Title"]), r["ID"])
for cid, c in asm.get("new_cards", {}).items():
    deck.setdefault(norm(c[0]), cid)
uses = collections.Counter(l["card"] for v in asm["phenomena"].values() for l in v if l.get("card"))
wiki_ids = {}
for r in rows:  # deck rows may carry a Wikipedia URL in some column
    for v in r.values():
        if v and "wikipedia.org/wiki/" in v: wiki_ids[v.split("/wiki/")[-1].lower()] = r["ID"]

out = []
for e in edb:
    card = deck.get(norm(e["name"]))
    if not card and e["wiki"]: card = wiki_ids.get(e["wiki"].split("/wiki/")[-1].lower())
    out.append({**e, "card": card, "uses": uses.get(card, 0) if card else 0,
                "functions": sorted({d["function"] for d in e["does"]})})
json.dump(out, open(os.path.join(HERE, "edb_matched.json"), "w"), indent=1, ensure_ascii=False)
inc = [e for e in out if e["card"]]
print(f"{len(out)} effects; {len(inc)} have a deck card ({sum(1 for e in inc if e['uses'])} used as an effect by some card); "
      f"{len(out) - len(inc)} not in the deck")

"""Invention machine, step 2: propose job + effect pairs from the board alone, and backtest.

  python3 generator.py backtest [YEAR] [SPAN]   freeze the board at YEAR (default 1930), score every
                                                new job + effect pair, and check the scores against
                                                what was really invented in the next SPAN years (30)

Freezing at YEAR keeps only the cards dated YEAR or earlier, and only the effects whose
phenomenon card is that old. A pair is a candidate when the effect has never been used for
that job (rule r1). The truth set is the real cards from the next SPAN years that brought
such a new pair to a job that already existed.

The scorer here uses the board alone, with no outside knowledge: an effect scores high for a
job when jobs that resemble it already use that effect (they share other effects or parts).
It can't see effects that no card uses yet; those need a judge, see `fresh`.
"""
import sys
from collections import defaultdict
from machine import CARDS, PHEN, year, title

FX_CARD = {l["effect"]: l["card"] for v in PHEN.values() for l in v if l.get("card")}

def freeze(Y):
    cards = {c: v for c, v in CARDS.items() if (year(c) is not None and year(c) <= Y)}
    effects = {e: k for e, k in FX_CARD.items() if year(k) is not None and year(k) <= Y}
    used = defaultdict(set)                  # job -> effects already used for it
    parts = defaultdict(set)                 # job -> part jobs its cards are built from
    for c, v in cards.items():
        for l in PHEN.get(c, []):
            if l["effect"] in effects: used[v["job"]].add(l["effect"])
        for s in v["slots"]: parts[v["job"]].add(s["job"])
    return cards, effects, used, parts

def truth(Y, span, cards, effects, used):
    jobs = {v["job"] for v in cards.values()}
    out = defaultdict(list)                  # (job, effect) -> cards that really did it
    for c, v in CARDS.items():
        y = year(c)
        if y is None or not (Y < y <= Y + span) or v["job"] not in jobs: continue
        for l in PHEN.get(c, []):
            e = l["effect"]
            if e in effects and e not in used[v["job"]]: out[(v["job"], e)].append(c)
    return out

def score(cards, effects, used, parts):
    """Board-only scorer: job similarity (shared effects and shared part jobs) times use elsewhere."""
    jobs = sorted({v["job"] for v in cards.values()})
    def sim(a, b):
        ea, eb, pa, pb = used[a], used[b], parts[a], parts[b]
        je = len(ea & eb) / len(ea | eb) if ea | eb else 0
        jp = len(pa & pb) / len(pa | pb) if pa | pb else 0
        return je + 0.5 * jp
    S = {}
    for j in jobs:
        sims = [(o, sim(j, o)) for o in jobs if o != j]
        for e in effects:
            if e in used[j]: continue
            S[(j, e)] = sum(s for o, s in sims if e in used[o])
    return S

def backtest(Y=1930, span=30):
    cards, effects, used, parts = freeze(Y)
    T = truth(Y, span, cards, effects, used)
    S = score(cards, effects, used, parts)
    ranked = sorted(S, key=lambda k: -S[k])
    rank = {k: i + 1 for i, k in enumerate(ranked)}
    in_use = {e for es in used.values() for e in es}
    print(f"Frozen at {Y}: {len(cards)} cards, {len({v['job'] for v in cards.values()})} jobs, {len(effects)} effects "
          f"({len(effects) - len(in_use)} never used yet); {len(S)} candidate pairs")
    print(f"Real new pairs {Y + 1}-{Y + span}: {len(T)}")
    fresh = [k for k in T if k[1] not in in_use]
    moved = [k for k in T if k[1] in in_use]
    print(f"  effect already used for another job (the scorer can see these): {len(moved)}")
    for k in sorted(moved, key=lambda k: rank[k]):
        print(f"    rank {rank[k]:5d}/{len(S)}  {k[0]} + {k[1]}  <- {', '.join(title(c) for c in T[k])}")
    print(f"  effect never used before (needs a judge): {len(fresh)}")
    for k in fresh:
        print(f"    {k[0]} + {k[1]}  <- {', '.join(title(c) for c in T[k])}")
    n = len(S)
    for top in (50, 100, 250, 500):
        hit = sum(rank[k] <= top for k in moved)
        print(f"  top {top:4d} ({100 * top / n:.0f}% of pairs): {hit}/{len(moved)} of the visible ones")

if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "backtest":
        backtest(*(int(x) for x in a[1:3]))
    else:
        print(__doc__)

# All the lists the prototype shows. assemblies.json is the source: every invention's
# own job and slots, as reviewed in the sheet (Calibration and Full pass tabs), plus
# the supporting cards those lists brought in. A slot is (part, job, fill, gap, kind, note,
# later): later lists newer cards that took over the same job (the Date check tab). pilot_data.py and batches.py still hold
# the phenomena, which are set aside for now (SHOW_PHENOMENA in build.py).
import json, os

import pilot_data, batches

HERE = os.path.dirname(os.path.abspath(__file__))
A = json.load(open(os.path.join(HERE, 'assemblies.json')))

NEW_CARDS = {**pilot_data.NEW_CARDS, **batches.NEW_CARDS, **{k: tuple(v) for k, v in A['new_cards'].items()}}

PHEN = {cid: ph for cid, (j, sl, ph) in pilot_data.CARDS.items()}
PHEN.update({cid: ph for _, b in batches.BATCHES for cid, (j, ex, ph) in b.items()})
PHEN.update({cid: ph for cid, (j, sl, ph) in batches.SUPPORT.items()})

CARDS = {
    cid: (c['job'], [(s['part'], s['job'], s['fill'], s['gap'], s['kind'], s['note'], s.get('later', [])) for s in c['slots']], PHEN.get(cid, []))
    for cid, c in A['cards'].items()
}

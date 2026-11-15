# All the lists the prototype shows. assemblies.json is the source: every invention's
# own job and slots, as reviewed in the sheet (Calibration and Full pass tabs), plus
# the supporting cards those lists brought in. A slot is (part, job, fill, gap, kind, note,
# later): later lists newer cards that took over the same job (the Date check tab). Phenomena are
# in "phenomena": card -> [{effect, card | gap}], written by phenomena_effects.py export from the
# reviewed decisions; a card that isn't listed has none. Shown when SHOW_PHENOMENA is on in build.py.
import json, os

import pilot_data, batches

HERE = os.path.dirname(os.path.abspath(__file__))
A = json.load(open(os.path.join(HERE, 'assemblies.json')))

# What kind of card each one is: object, material or practice. Cards reached only through
# a phenomenon list aren't in it; the build types them as phenomena.
TYPES = A['types']

NEW_CARDS = {**pilot_data.NEW_CARDS, **batches.NEW_CARDS, **{k: tuple(v) for k, v in A['new_cards'].items()}}

# Every card's phenomena, including cards with no list of their own (Penicillin, the vitamins).
PHEN = A.get('phenomena', {})

CARDS = {
    cid: (c['job'], [(s['part'], s['job'], s['fill'], s['gap'], s['kind'], s['note'], s.get('later', [])) for s in c['slots']], PHEN.get(cid, []))
    for cid, c in A['cards'].items()
}

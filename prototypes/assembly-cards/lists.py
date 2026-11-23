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

# What the invention machine's curation added (written by prototypes/invention-machine/export_graph.py):
# the 1960-2020 gap inventions, the kept Future Technologies and the new effect cards that something on
# the board works by. Delete additions.json (or set NO_ADDITIONS=1) for the reviewed board alone.
_ADD = os.path.join(HERE, 'additions.json')
if os.path.exists(_ADD) and not os.environ.get('NO_ADDITIONS'):
    _a = json.load(open(_ADD))
    for _k in ('new_cards', 'cards', 'types'):
        A[_k] = {**A[_k], **_a[_k]}
    _ph = {k: list(v) for k, v in A.get('phenomena', {}).items()}
    for _r in _a['phenomena_replace']:
        _links = _ph.setdefault(_r['card'], [])
        _i = next((n for n, l in enumerate(_links) if _r['old'] in (l.get('card'), l.get('gap'))), None)
        if _i is None: _links.append(_r['new'])
        else: _links[_i] = _r['new']
    for _cid, _links in _a['phenomena_add'].items():
        _ph.setdefault(_cid, []).extend(l for l in _links if l not in _ph.get(_cid, []))
    A['phenomena'] = _ph
    # A supporting card that now fills a part listed as a gap on a board card (rule 16), e.g. Jet
    # planes' jet engine. Only the slot's filler changes; the card itself is untouched.
    for _f in _a.get('slot_fills', []):
        for _s in A['cards'].get(_f['card'], {}).get('slots', []):
            if not _s.get('fill') and (_s.get('gap') or '').lower() == _f['gap'].lower():
                _s['fill'], _s['gap'] = _f['fill'], None

# What kind of card each one is: object, material or practice. Cards reached only through
# a phenomenon list aren't in it; the build types them as phenomena.
TYPES = A['types']

NEW_CARDS = {**pilot_data.NEW_CARDS, **batches.NEW_CARDS, **{k: tuple(v[:3]) for k, v in A['new_cards'].items()}}
# Who a new card is associated with and where, when known (the phenomenon cards have them).
NEW_CARD_WHO = {k: (v[3], v[4]) for k, v in A['new_cards'].items() if len(v) >= 5}

# Every card's phenomena, including cards with no list of their own (Penicillin, the vitamins).
PHEN = A.get('phenomena', {})

CARDS = {
    cid: (c['job'], [(s['part'], s['job'], s['fill'], s['gap'], s['kind'], s['note'], s.get('later', [])) for s in c['slots']], PHEN.get(cid, []))
    for cid, c in A['cards'].items()
}

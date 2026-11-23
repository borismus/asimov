"""Turn what Boris vetted in the curation artifact into additions for the assembly graph.

Reads vetted.json (a snapshot of the artifact's kept effects, gap inventions and Future
Technologies) and link_out*.json (which board cards work by each new effect), and writes
prototypes/assembly-cards/additions.json, which lists.py layers over assemblies.json. Delete
additions.json to get the reviewed board back exactly.

    python3 prototypes/invention-machine/export_graph.py
"""
import csv, glob, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
A = json.load(open(f'{REPO}/prototypes/assembly-cards/assemblies.json'))
ROWS = {r['ID']: r for r in csv.DictReader(open(f'{REPO}/static/asimov.tsv'), delimiter='\t')}
V = json.load(open(f'{HERE}/vetted.json'))
sys.path.insert(0, f'{REPO}/prototypes/assembly-cards')
import pilot_data, batches  # the supporting cards (Boiler, Valve...) that aren't in the deck
SUPPORT = {**pilot_data.NEW_CARDS, **batches.NEW_CARDS, **A['new_cards']}
LINKS = {x['id']: x for f in sorted(glob.glob(f'{HERE}/link_out*.json')) for x in json.load(open(f))}

TYPES = {'kevlar': 'material', 'dna-sequencing': 'practice'}
# Where a new effect card states a gap invention's effect more directly than the card it was given
# (rule 9: one card per effect, the one that states it most directly).
BETTER = {
    'microwave-oven': ('water molecules soak up microwaves and heat up', 'dielectric-heating'),
    'induction-cooktop': ('currents stirred up inside a metal heat it', 'eddy-currents'),
    'hard-disk-drive': ('a magnetized spot stays magnetized', 'magnetic-hysteresis'),
    'video-tape-recorder': ('a magnetized spot stays magnetized', 'magnetic-hysteresis'),
}
FUTURE_YEAR = 2030

effects = {e['id']: e for e in V['effects'] if e['pick'] == 'keep'}
new_cards, cards, types, add, replace, problems = {}, {}, {}, {}, [], []
known = lambda i: i in ROWS or i in SUPPORT or i in new_cards or i in effects

# Inventions: the 1960-2020 gap ones, then the Future Technologies, numbered in the order kept.
fts = sorted(V['future'], key=lambda c: c.get('decidedAt') or 0)
for n, c in enumerate(V['gap'] + fts):
    fut = c['path'] == 'future'
    cid = c['id']
    num = n - len(V['gap']) + 1
    desc = (f'Future Technology {num}. ' if fut else '') + (c.get('how') or '')
    new_cards[cid] = [c['name'], FUTURE_YEAR if fut else c['year'], desc, '', '']
    types[cid] = TYPES.get(cid, 'object')
    slots = []
    for p in c.get('parts', []):
        if not known(p['card']): problems.append(f'{cid}: part {p["card"]} not in the deck'); continue
        slots.append({'part': p.get('t') or p['card'], 'job': p.get('job') or '', 'fill': p['card'], 'gap': None, 'kind': 'inside', 'note': None})
    cards[cid] = {'job': c['job'], 'slots': slots}
    fx = c.get('effects') or ([{'effect': c['effect'], 'card': c.get('effectCard')}] if c.get('effect') else [])
    if cid in BETTER: fx = [{'effect': BETTER[cid][0], 'card': BETTER[cid][1]}]
    links = []
    for e in fx:
        if e.get('card') and known(e['card']): links.append({'effect': e['effect'], 'card': e['card']})
        else: links.append({'effect': e['effect'], 'gap': e.get('t') or e['effect']})
    if links: add.setdefault(cid, []).extend(links)

# Effects: a card only when something works by it.
used = set()
for eid, L in LINKS.items():
    if eid not in effects: continue
    for l in L.get('links', []):
        if not known(l['card']):
            problems.append(f'{eid}: link to unknown card {l["card"]}'); continue
        link = {'effect': l['effect'], 'card': eid}
        if l.get('op') in ('replace', 'fillGap'): replace.append({'card': l['card'], 'old': l.get('replaces'), 'new': link})
        else: add.setdefault(l['card'], []).append(link)
        used.add(eid)
for cid, links in add.items():
    for l in links:
        if l.get('card') in effects: used.add(l['card'])
for eid in sorted(used):
    e, L = effects[eid], LINKS.get(eid, {})
    year = e['year'] if e['year'] is not None else L.get('year')
    if year is None: problems.append(f'{eid}: no year, left off'); continue
    new_cards[eid] = [e['title'], year, e['description'] or '', e.get('inventor') or L.get('inventor') or '', e.get('location') or L.get('location') or '']
    types[eid] = 'phenomenon'
# Links to an effect left off for want of a year fall back to a gap.
for cid, links in add.items():
    for l in links:
        if l.get('card') in effects and l['card'] not in new_cards:
            l['gap'] = effects[l.pop('card')]['title']
replace = [r for r in replace if r['new']['card'] in new_cards]

# Real inventions Boris kept on the artifact's Missing tab: their card text (cardtext_all.json),
# parts and effects (parts_all.json), and the supporting cards they earn under rule 16
# (support_cards.json), which fill the matching gaps wherever they appear.
MK, MP, MS = (f'{HERE}/{f}' for f in ('cardtext_all.json', 'parts_all.json', 'support_cards.json'))
n_missing = 0
if os.path.exists(MK) and os.path.exists(MP):
    sup = json.load(open(MS)) if os.path.exists(MS) else []
    gnorm = lambda s: {'phosphor screen': 'phosphor'}.get(s.lower().strip().rstrip('s'), s.lower().strip().rstrip('s'))
    gapcard = {s['gap']: s['id'] for s in sup}
    for c in json.load(open(MK)) + sup:
        new_cards[c['id']] = [c['title'], c['year'], c['description'], c.get('inventor', ''), c.get('location', '')]
        types[c['id']] = c['type'] if c['type'] in ('object', 'material', 'practice', 'phenomenon') else 'object'
    for cid, d in json.load(open(MP)).items():
        n_missing += 1
        slots = []
        for s in d.get('slots', []):
            fill, g = s.get('fill'), s.get('gap')
            if not fill and g and gnorm(g) in gapcard: fill, g = gapcard[gnorm(g)], None
            slot = {'part': s.get('part'), 'job': s.get('job') or '', 'fill': fill, 'gap': g, 'kind': 'inside', 'note': s.get('note')}
            if s.get('later'): slot['later'] = s['later']
            slots.append(slot)
        cards[cid] = {'job': d['job'], 'slots': slots}
        links = []
        for p in d.get('phen', []):
            if p.get('card'): links.append({'effect': p['effect'], 'card': p['card']})
            elif p.get('gap') and gnorm(p['gap']) in gapcard: links.append({'effect': p['effect'], 'card': gapcard[gnorm(p['gap'])]})
            elif p.get('gap'): links.append({'effect': p['effect'], 'gap': p['gap']})
        if links: add.setdefault(cid, []).extend(links)
    # Board cards whose effect gap a new supporting card now fills (rule 16).
    for cid, plist in A.get('phenomena', {}).items():
        for l in plist:
            if not l.get('card') and l.get('gap') and gnorm(l['gap']) in gapcard:
                replace.append({'card': cid, 'old': l['gap'], 'new': {'effect': l['effect'], 'card': gapcard[gnorm(l['gap'])]}})
print(f'{n_missing} missing inventions, {len(json.load(open(MS))) if os.path.exists(MS) else 0} supporting cards')

# Parts on board cards that a supporting card now fills, by Boris's say-so (he wants Asimov cards' own
# text left alone; this only names the filler of a part already listed as a gap).
SLOT_FILLS = [{'card': 'jet-planes', 'gap': 'Jet engine', 'fill': 'jet-engine'}]  # Boris, 2026-11-22

out = {'new_cards': new_cards, 'cards': cards, 'types': types, 'phenomena_add': add, 'phenomena_replace': replace,
       'slot_fills': [f for f in SLOT_FILLS if f['fill'] in new_cards]}
json.dump(out, open(f'{REPO}/prototypes/assembly-cards/additions.json', 'w'), indent=1, ensure_ascii=False)
print(f"{len(cards)} inventions ({len(V['gap'])} gap, {len(fts)} future), {len(used)} effect cards used of {len(effects)}, "
      f"{sum(len(v) for v in add.values())} links added, {len(replace)} replaced")
unused = sorted(set(effects) - used)
print(f'{len(unused)} effects with no board card that works by them yet (left off the board)')
for p in problems: print('  !', p)

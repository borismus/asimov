# All the lists the prototype shows: the pilot (pilot_data.py) plus the deck's own
# inventions, batch by batch (batches.py), whose slots come from links.csv.
import csv, os

import pilot_data, batches

HERE = os.path.dirname(os.path.abspath(__file__))

NEW_CARDS = {**pilot_data.NEW_CARDS, **batches.NEW_CARDS}
CARDS = dict(pilot_data.CARDS)
CARDS.update(batches.SUPPORT)

LINKS = {}
with open(os.path.join(HERE, 'links.csv'), newline='') as fh:
    for r in csv.DictReader(fh):
        slot = (r['part'], r['job'], r['filler'], None, r['kind']) + ((r['note'],) if r['note'] else ())
        LINKS.setdefault(r['invention'], []).append(slot)

BATCH_OF = {}
for name, batch in batches.BATCHES:
    for cid, (job, extra, phen) in batch.items():
        assert cid not in CARDS, f'{cid} is already in the pilot'
        CARDS[cid] = (job, LINKS.get(cid, []) + list(extra), phen)
        BATCH_OF[cid] = name

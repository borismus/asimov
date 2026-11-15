# The assembly board's cards that have no art yet (supporting cards and the new phenomenon
# cards, none of them in the deck TSV), written as the JSON scripts/regenerate-images.py reads
# with --cards-json. Field is set the way the deck sets it: Science for phenomena, Design for the rest.
#
#   python3 prototypes/assembly-cards/art_cards.py            # writes art_cards.json next to it
#   uv run scripts/regenerate-images.py --cards-json prototypes/assembly-cards/art_cards.json --dry-run
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, HERE)
from lists import NEW_CARDS, NEW_CARD_WHO, TYPES, PHEN  # noqa: E402

def year_raw(y):
    y = int(y)
    return f'{-y} BCE' if y < 0 else str(y)

on_board = set(TYPES) | {p['card'] for ph in PHEN.values() for p in ph if 'card' in p}
cards = []
for i in sorted(NEW_CARDS):
    if i not in on_board or os.path.exists(f'{REPO}/static/images/entries-v2/{i}.jpg'):
        continue
    title, year, text = NEW_CARDS[i]
    who, where = NEW_CARD_WHO.get(i, ('', ''))
    phenomenon = i not in TYPES
    cards.append({'id': i, 'year': year_raw(year), 'title': title, 'summary': text,
                  'inventor': who, 'location': where, 'field': 'Science' if phenomenon else 'Design'})
out = os.path.join(HERE, 'art_cards.json')
json.dump(cards, open(out, 'w'), ensure_ascii=False, indent=1)
print(f'{len(cards)} cards without art -> {os.path.relpath(out, REPO)}')

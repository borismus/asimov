# A contact sheet for art_candidates/: each card's versions side by side, with file names, so the
# one you don't want can be deleted. Rerun after deleting to see what's left.
#
#   python3 prototypes/assembly-cards/art_review.py   # writes art_candidates/index.html
import html, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, 'art_candidates')
cards = {c['id']: c for c in json.load(open(os.path.join(HERE, 'art_cards.json')))}
files = sorted((f for f in os.listdir(DIR) if f.endswith('.jpg')), key=lambda f: f[:-4])  # card.jpg before card-2.jpg
by_id = {}
for f in files:
    m = re.match(r'(.+?)(?:-(\d+))?\.jpg$', f)
    cid = m.group(1) if m.group(1) in cards else f[:-4]
    by_id.setdefault(cid, []).append(f)
rows = []
for cid in sorted(by_id, key=lambda i: (cards.get(i, {}).get('title', i)).lower()):
    c = cards.get(cid, {})
    figs = ''.join(f'<figure><img src="{html.escape(f)}" loading="lazy"><figcaption>{html.escape(f)}</figcaption></figure>' for f in by_id[cid])
    flag = '' if len(by_id[cid]) == 1 else ' <span class="todo">pick one</span>'
    rows.append(f'<section><h2>{html.escape(c.get("title", cid))} <small>{html.escape(c.get("year", ""))}</small>{flag}</h2>'
                f'<p>{html.escape(c.get("summary", ""))}</p><div class="pair">{figs}</div></section>')
left = sum(1 for v in by_id.values() if len(v) > 1)
page = f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Art candidates</title>
<style>
:root {{ color-scheme: light dark; --bg: #faf8f3; --fg: #222; --mute: #777; --card: #fff; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg: #1d1d1f; --fg: #eee; --mute: #999; --card: #2a2a2c; }} }}
body {{ background: var(--bg); color: var(--fg); font: 15px/1.4 system-ui, sans-serif; margin: 0 auto; max-width: 1120px; padding: 16px; }}
h1 {{ font-size: 20px; }} h2 {{ font-size: 17px; margin: 0 0 4px; }} small {{ color: var(--mute); font-weight: normal; }}
section {{ background: var(--card); border-radius: 8px; padding: 12px 14px; margin: 0 0 14px; }}
section p {{ color: var(--mute); margin: 0 0 8px; font-size: 13px; }}
.pair {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }}
figure {{ margin: 0; }} img {{ width: 100%; border-radius: 4px; display: block; }}
figcaption {{ font: 12px ui-monospace, monospace; color: var(--mute); margin-top: 4px; }}
.todo {{ font-size: 12px; background: #e9b44c; color: #222; border-radius: 4px; padding: 1px 6px; vertical-align: middle; }}
</style>
<h1>Art candidates: {len(by_id)} cards, {left} still with two versions</h1>
<p>Delete the file you don't want in this folder (Finder), then rerun art_review.py to refresh this page.</p>
{''.join(rows)}'''
open(os.path.join(DIR, 'index.html'), 'w').write(page)
print(f'{len(by_id)} cards, {left} with more than one version -> {os.path.relpath(os.path.join(DIR, "index.html"))}')

# Pick the art for cards that have more than one version in art_candidates/.
#
#   python3 prototypes/assembly-cards/art_review.py          # serves http://localhost:8001
#   python3 prototypes/assembly-cards/art_review.py --static # just writes art_candidates/index.html
#
# Click a picture to pick it: that version is copied to static/images/entries-v2/<id>.jpg (the
# deck's art) and the choice is saved in art_candidates/picks.json. Click the other one to change
# your mind. Nothing is deleted. "Rebuild the board" reruns build.py so localhost:8000 shows the picks.
import argparse, html, http.server, json, os, re, shutil, subprocess, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DIR = os.path.join(HERE, 'art_candidates')
DEST = os.path.join(REPO, 'static', 'images', 'entries-v2')
PICKS = os.path.join(DIR, 'picks.json')
REDO = os.path.join(DIR, 'redo.json')  # cards to redraw, with what's wrong


def load_picks():
    try:
        return json.load(open(PICKS))
    except (OSError, ValueError):
        return {}


def load_redo():
    try:
        return json.load(open(REDO))
    except (OSError, ValueError):
        return {}


def versions():
    # Titles and text from the board's cards, then art_cards.json (which only lists cards still missing art).
    cards = {r['ID']: {'id': r['ID'], 'title': r['Title'], 'year': r['Year'], 'summary': r['Description']}
             for r in json.load(open(os.path.join(HERE, 'site', 'static', 'cards-phen.json')))}
    cards.update({c['id']: c for c in json.load(open(os.path.join(HERE, 'art_cards.json')))})
    for name in ('cardtext_art.json', 'cardtext_art2.json', 'support_cards.json'):  # new cards not on the board yet
        extra = os.path.join(REPO, 'prototypes', 'invention-machine', name)
        if os.path.exists(extra):
            cards.update({c['id']: c for c in json.load(open(extra)) if c['id'] not in cards})
    files = sorted((f for f in os.listdir(DIR) if f.endswith('.jpg')), key=lambda f: f[:-4])  # card.jpg before card-2.jpg
    by_id = {}
    for f in files:
        m = re.match(r'(.+?)(?:-(\d+))?\.jpg$', f)
        cid = m.group(1) if m.group(1) in cards else f[:-4]
        by_id.setdefault(cid, []).append(f)
    return cards, by_id


def page(interactive):
    cards, by_id = versions()
    picks = load_picks()
    redo = load_redo()
    rows = []
    order = sorted(by_id, key=lambda i: (cards.get(i, {}).get('title', i)).lower())
    for cid in order:
        c = cards.get(cid, {})
        figs = ''.join(
            f'<figure class="{"picked" if picks.get(cid) == f else ""}" data-id="{html.escape(cid)}" data-file="{html.escape(f)}">'
            f'<img src="{html.escape(f)}" loading="lazy" alt=""><figcaption>{html.escape(f)}</figcaption></figure>'
            for f in by_id[cid])
        rows.append(f'<section data-id="{html.escape(cid)}" class="{"done" if cid in picks else ""}">'
                    f'<h2>{html.escape(c.get("title", cid))} <small>{html.escape(str(c.get("year", "")))}</small>'
                    f'<span class="todo">pick one</span><span class="ok">picked</span></h2>'
                    f'<p>{html.escape(c.get("summary", ""))}</p><div class="pair">{figs}</div>'
                    + (f'<div class="redo{" on" if cid in redo else ""}"><button type="button" class="redo-btn">{"Redo requested" if cid in redo else "Redo"}</button>'
                       f'<input class="redo-note" type="text" placeholder="What is wrong? (optional, goes into the new prompt)" value="{html.escape(redo.get(cid, ""))}"></div>' if interactive else '')
                    + '</section>')
    n = len(order)
    left = sum(1 for cid in order if cid not in picks)
    howto = ('Click the picture you want. It becomes the card\'s art right away (copied into static/images/entries-v2/); '
             'click the other one to change your mind. Keys: 1 or 2 picks for the next unpicked card.'
             if interactive else
             'Run <code>python3 prototypes/assembly-cards/art_review.py</code> and open http://localhost:8001 to pick by clicking.')
    tools = ('<div class="bar"><label><input type="checkbox" id="hide-done"> Hide picked</label>'
             '<button id="rebuild" type="button">Rebuild the board</button><span id="status" role="status"></span></div>'
             if interactive else '')
    return f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Art picker</title>
<style>
:root {{ color-scheme: light dark; --bg: #faf8f3; --fg: #222; --mute: #777; --card: #fff; --pick: #2e7d4f; --line: #ddd; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg: #1d1d1f; --fg: #eee; --mute: #999; --card: #2a2a2c; --pick: #5cc98a; --line: #444; }} }}
body {{ background: var(--bg); color: var(--fg); font: 15px/1.4 system-ui, sans-serif; margin: 0 auto; max-width: 1120px; padding: 16px; }}
h1 {{ font-size: 20px; margin: 0 0 4px; }} h2 {{ font-size: 17px; margin: 0 0 4px; }} small {{ color: var(--mute); font-weight: normal; }}
.lede {{ color: var(--mute); margin: 0 0 12px; }}
.bar {{ position: sticky; top: 0; z-index: 2; display: flex; gap: 14px; align-items: center; flex-wrap: wrap;
  background: var(--bg); padding: 8px 0; border-bottom: 1px solid var(--line); margin-bottom: 14px; }}
.bar button {{ font: inherit; padding: 5px 12px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--fg); cursor: pointer; }}
#status {{ color: var(--mute); font-size: 13px; }}
section {{ background: var(--card); border-radius: 8px; padding: 12px 14px; margin: 0 0 14px; }}
section p {{ color: var(--mute); margin: 0 0 8px; font-size: 13px; }}
.pair {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }}
figure {{ margin: 0; border-radius: 6px; padding: 3px; border: 3px solid transparent; position: relative; }}
img {{ width: 100%; border-radius: 4px; display: block; }}
figcaption {{ font: 12px ui-monospace, monospace; color: var(--mute); margin-top: 4px; }}
body.live figure {{ cursor: pointer; }}
body.live figure:hover {{ border-color: var(--line); }}
figure.picked {{ border-color: var(--pick); }}
figure.picked::after {{ content: "✓ picked"; position: absolute; top: 10px; left: 10px; background: var(--pick); color: #fff;
  font: 600 12px system-ui, sans-serif; padding: 2px 8px; border-radius: 4px; }}
section.done figure:not(.picked) img {{ opacity: 0.45; }}
.redo {{ display: flex; gap: 8px; margin-top: 8px; }}
.redo-btn {{ font: inherit; font-size: 13px; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--line); background: var(--card); color: var(--fg); cursor: pointer; white-space: nowrap; }}
.redo.on .redo-btn {{ background: #c0392b; color: #fff; border-color: #c0392b; }}
.redo-note {{ flex: 1; font: inherit; font-size: 13px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--line); background: transparent; color: var(--fg); }}
.todo, .ok {{ font-size: 12px; border-radius: 4px; padding: 1px 6px; margin-left: 8px; vertical-align: middle; font-weight: 600; }}
.todo {{ background: #e9b44c; color: #222; }} .ok {{ background: var(--pick); color: #fff; display: none; }}
section.done .todo {{ display: none; }} section.done .ok {{ display: inline; }}
body.hide-done section.done {{ display: none; }}
</style>
<body class="{"live" if interactive else ""}">
<h1>Art picker: <span id="left">{left}</span> of {n} cards still to pick</h1>
<p class="lede">{howto}</p>
{tools}
{''.join(rows)}
<script>
if (document.body.classList.contains("live")) {{
  const status = (t) => {{ document.getElementById("status").textContent = t; }};
  const left = () => {{ document.getElementById("left").textContent = document.querySelectorAll("section:not(.done)").length; }};
  async function pick(fig) {{
    const sec = fig.closest("section");
    const r = await fetch("/pick", {{ method: "POST", headers: {{ "Content-Type": "application/json" }},
      body: JSON.stringify({{ id: fig.dataset.id, file: fig.dataset.file }}) }});
    if (!r.ok) {{ status("Couldn't save: " + await r.text()); return; }}
    sec.querySelectorAll("figure").forEach((f) => f.classList.toggle("picked", f === fig));
    sec.classList.add("done");
    left();
    status("Picked " + fig.dataset.file + ".");
  }}
  document.addEventListener("click", (e) => {{ const fig = e.target.closest("figure[data-file]"); if (fig) pick(fig); }});
  async function redo(sec, on) {{
    const box = sec.querySelector(".redo"), note = box.querySelector(".redo-note").value.trim();
    const r = await fetch("/redo", {{ method: "POST", headers: {{ "Content-Type": "application/json" }}, body: JSON.stringify({{ id: sec.dataset.id, on, note }}) }});
    if (!r.ok) {{ status("Couldn't save: " + await r.text()); return; }}
    box.classList.toggle("on", on); box.querySelector(".redo-btn").textContent = on ? "Redo requested" : "Redo";
    status(on ? "Marked for a redraw." : "Redo cancelled.");
  }}
  document.addEventListener("click", (e) => {{ const b = e.target.closest(".redo-btn"); if (b) {{ const sec = b.closest("section"); redo(sec, !sec.querySelector(".redo").classList.contains("on")); }} }});
  document.addEventListener("change", (e) => {{ const i = e.target.closest(".redo-note"); if (i) redo(i.closest("section"), true); }});
  document.addEventListener("keydown", (e) => {{
    if (e.key !== "1" && e.key !== "2") return;
    const sec = document.querySelector("section:not(.done)");
    const fig = sec && sec.querySelectorAll("figure")[+e.key - 1];
    if (!fig) return;
    pick(fig).then(() => {{ const next = document.querySelector("section:not(.done)"); if (next) next.scrollIntoView({{ block: "start", behavior: "smooth" }}); }});
  }});
  const hide = document.getElementById("hide-done");
  try {{ hide.checked = localStorage.getItem("art-hide-done") === "1"; }} catch (e) {{}}
  const applyHide = () => {{ document.body.classList.toggle("hide-done", hide.checked); try {{ localStorage.setItem("art-hide-done", hide.checked ? "1" : "0"); }} catch (e) {{}} }};
  hide.addEventListener("change", applyHide); applyHide();
  document.getElementById("rebuild").addEventListener("click", async (e) => {{
    e.target.disabled = true; status("Rebuilding…");
    const r = await fetch("/rebuild", {{ method: "POST" }});
    status(r.ok ? "Rebuilt. Reload localhost:8000 to see the art." : "Rebuild failed: " + await r.text());
    e.target.disabled = false;
  }});
}}
</script>'''


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def log_message(self, *a):
        pass

    def reply(self, code, body, ctype='text/plain; charset=utf-8'):
        data = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if urllib.parse.urlparse(self.path).path in ('/', '/index.html'):
            return self.reply(200, page(True), 'text/html; charset=utf-8')
        return super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path == '/pick':
            try:
                req = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
                cid, f = req['id'], req['file']
            except (ValueError, KeyError):
                return self.reply(400, 'bad request')
            _, by_id = versions()
            if f not in by_id.get(cid, []):  # only files listed for that card: no paths from the request
                return self.reply(400, 'unknown file')
            os.makedirs(DEST, exist_ok=True)
            shutil.copyfile(os.path.join(DIR, f), os.path.join(DEST, f'{cid}.jpg'))
            picks = load_picks()
            picks[cid] = f
            json.dump(picks, open(PICKS, 'w'), indent=1, sort_keys=True)
            print(f'picked {f}', flush=True)
            return self.reply(200, 'ok')
        if path == '/redo':
            try:
                req = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))))
                cid, on, note = req['id'], bool(req.get('on')), str(req.get('note', ''))[:500]
            except (ValueError, KeyError):
                return self.reply(400, 'bad request')
            if cid not in versions()[1]:
                return self.reply(400, 'unknown card')
            redo = load_redo()
            if on: redo[cid] = note
            else: redo.pop(cid, None)
            json.dump(redo, open(REDO, 'w'), indent=1, sort_keys=True)
            print(f'redo {"on" if on else "off"}: {cid} {note}', flush=True)
            return self.reply(200, 'ok')
        if path == '/rebuild':
            r = subprocess.run([sys.executable, os.path.join(HERE, 'build.py')], capture_output=True, text=True, cwd=REPO)
            print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-500:], flush=True)
            return self.reply(200 if r.returncode == 0 else 500, r.stdout[-300:] if r.returncode == 0 else r.stderr[-800:])
        return self.reply(404, 'not found')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--static', action='store_true', help='only write art_candidates/index.html')
    ap.add_argument('--port', type=int, default=8001)
    args = ap.parse_args()
    if args.static:
        open(os.path.join(DIR, 'index.html'), 'w').write(page(False))
        print(f'wrote {os.path.relpath(os.path.join(DIR, "index.html"))}')
    else:
        print(f'art picker on http://localhost:{args.port}', flush=True)
        http.server.ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()

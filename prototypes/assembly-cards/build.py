"""Build the Assembly Cards prototype into ./site (gitignored).

A copy of the invention.cards universe view, patched so cards flip on tap and the
back lists the card's assembly, its natural phenomena, and where it is used as a part.
Data comes from pilot_data.py plus card text and images from the repo's static/.

  uv run prototypes/assembly-cards/build.py
  python3 -m http.server -d prototypes/assembly-cards/site 8000
"""
import csv, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, 'site')
sys.path.insert(0, HERE)
from pilot_data import NEW_CARDS, CARDS

shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(f'{OUT}/static/images/entries-v2')

rows = {r['ID']: r for r in csv.DictReader(open(f'{REPO}/static/asimov.tsv'), delimiter='\t')}

def patch(path, pairs):
    s = open(path).read()
    for a, b in pairs:
        n = s.count(a)
        if n != 1:
            raise SystemExit(f'{os.path.basename(path)}: expected 1 match, found {n}: {a[:70]!r}')
        s = s.replace(a, b)
    open(path, 'w').write(s)

# ---------- copy code ----------
for f in os.listdir(f'{REPO}/static'):
    if f.endswith(('.js', '.css')):
        s = open(f'{REPO}/static/{f}').read().replace('"/static/', '"static/').replace('`/static/', '`static/').replace("'/static/", "'static/").replace('(/static/', '(static/')
        open(f'{OUT}/static/{f}', 'w').write(s)
for d in ['fields', 'icons']:
    shutil.copytree(f'{REPO}/static/images/{d}', f'{OUT}/static/images/{d}')
open(f'{OUT}/static/stories.json', 'w').write('[]')

# ---------- data ----------
ids = set(CARDS)
for cid, (job, slots, ph) in CARDS.items():
    ids |= {s[2] for s in slots if s[2]}
    ids |= {p for p in ph if not isinstance(p, tuple)}

def fmt_year(y):
    y = int(y)
    return f'{-y} BCE' if y < 0 else str(y)

with open(f'{OUT}/static/asimov.tsv', 'w', newline='') as fh:
    w = csv.writer(fh, delimiter='\t', quoting=csv.QUOTE_MINIMAL, lineterminator='\n')
    w.writerow(['ID', 'Year', 'Title', 'Description', 'Inventor', 'Location', 'Dependencies', 'Field', 'URL', 'Kind'])
    for i in sorted(ids):
        deps = []
        if i in CARDS:
            job, slots, ph = CARDS[i]
            for d in [s[2] for s in slots if s[2]] + [p for p in ph if not isinstance(p, tuple)]:
                if d not in deps: deps.append(d)
        if i in NEW_CARDS:
            t, y, d = NEW_CARDS[i]
            w.writerow([i, fmt_year(y), t, d, '', '', ', '.join(deps), 'Design', '', 'added'])
        else:
            r = rows[i]
            w.writerow([i, r['Year'], r['Title'], r['Description'], r['Inventor'], r['Location'], ', '.join(deps), r['Field'], r['URL'], r.get('Kind', '') or 'legacy'])

# The artifact host won't serve .tsv, so ship the same rows as JSON.
with open(f'{OUT}/static/asimov.tsv') as fh:
    json.dump(list(csv.DictReader(fh, delimiter='\t')), open(f'{OUT}/static/cards.json', 'w'), ensure_ascii=False)
os.remove(f'{OUT}/static/asimov.tsv')

lists = {}
for cid, (job, slots, ph) in CARDS.items():
    lists[cid] = {
        'job': job,
        'listKind': 'recipe' if cid == 'vitamin-pills' else 'assembly',
        'slots': [{'label': s[0], 'job': s[1], 'fill': s[2], 'gap': s[3], 'type': s[4]} for s in slots],
        'phen': [{'gap': p[1]} if isinstance(p, tuple) else {'id': p} for p in ph],
    }
json.dump(lists, open(f'{OUT}/static/lists.json', 'w'), ensure_ascii=False)

# ---------- images ----------
from PIL import Image, ImageDraw, ImageFont
missing = []
for i in ids:
    src = f'{REPO}/static/images/entries-v2/{i}.jpg'
    if os.path.exists(src):
        shutil.copy(src, f'{OUT}/static/images/entries-v2/{i}.jpg')
    else:
        missing.append(i)
        title = NEW_CARDS[i][0] if i in NEW_CARDS else rows[i]['Title']
        im = Image.new('RGB', (624, 416), (236, 233, 226))
        dr = ImageDraw.Draw(im)
        for x in range(0, 624, 24):
            dr.line([(x, 0), (x, 416)], fill=(226, 222, 213))
        for y in range(0, 416, 24):
            dr.line([(0, y), (624, y)], fill=(226, 222, 213))
        try:
            f1 = ImageFont.load_default(size=40); f2 = ImageFont.load_default(size=20)
        except TypeError:  # Pillow < 10.1 has no sized default font
            f1 = f2 = ImageFont.load_default()
        tw = dr.textlength(title, font=f1)
        if tw > 580:
            try:
                f1 = ImageFont.load_default(size=int(40 * 580 / tw))
            except TypeError:
                pass
            tw = dr.textlength(title, font=f1)
        dr.text(((624 - tw) / 2, 170), title, font=f1, fill=(60, 60, 60))
        sub = 'supporting invention · art to come'
        dr.text(((624 - dr.textlength(sub, font=f2)) / 2, 230), sub, font=f2, fill=(120, 120, 120))
        im.save(f'{OUT}/static/images/entries-v2/{i}.jpg', quality=85)
print('placeholder images for', sorted(missing))

# ---------- patches ----------
S = f'{OUT}/static'

patch(f'{S}/routing.js', [(
    'export function isLocalhost() {\n',
    'export function isLocalhost() {\n  return true; // prototype: keep nav in the hash (no per-card server paths)\n',
)])

patch(f'{S}/utils.js', [
    ('  const rows = await d3.tsv(tsvUrl);', '  const rows = await (tsvUrl.endsWith(".json") ? d3.json(tsvUrl) : d3.tsv(tsvUrl));'),
    (
    '  console.log(`Found ${links.length} links.`);',
    '''  // Prototype: assembly + phenomenon lists, and a kind for every edge.
  try {
    const lists = await (await fetch("static/lists.json", { cache: "no-store" })).json();
    for (const n of nodes) if (lists[n.id]) Object.assign(n, lists[n.id]);
  } catch (e) {
    console.warn("lists.json missing", e);
  }
  for (const l of links) {
    l.type = (l.target.phen || []).some((p) => p.id === l.source.id) ? "phen" : "part";
    l.later = l.source.year > l.target.year;
  }
  console.log(`Found ${links.length} links.`);''',
)])

patch(f'{S}/world.js', [
    ('const NUM_COLS = 240;', 'let NUM_COLS = 240; // prototype: sized to the deck in layout()'),
    ('  const N = nodes.length;\n  state.maxYear', '  const N = nodes.length;\n  NUM_COLS = Math.max(8, Math.round(N / 5)); // keep ~5 cards per column, like the full deck\n  state.maxYear'),
    (
    '''  // Pass 1: stroke all line segments.
  ctx.beginPath();
  for (const link of visible) {
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
  }
  ctx.stroke();''',
    '''  // Pass 1 (prototype): parts solid, parts added later dashed, phenomena amber.
  const styles = [
    { f: (l) => l.type !== "phen" && !l.later, color: `rgba(0, 0, 0, ${opacity})`, dash: [] },
    { f: (l) => l.type !== "phen" && l.later, color: `rgba(0, 0, 0, ${opacity})`, dash: [6 / k, 5 / k] },
    { f: (l) => l.type === "phen", color: `rgba(184, 116, 26, ${opacity * 0.45})`, dash: [] },
  ];
  for (const st of styles) {
    ctx.strokeStyle = st.color;
    ctx.setLineDash(st.dash);
    ctx.beginPath();
    for (const link of visible) {
      if (!st.f(link)) continue;
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);''',
)])

patch(f'{S}/card.js', [(
    'let cardSerial = 0;',
    'let cardSerial = 0;\n' + open(os.path.join(HERE, 'card_back.js')).read(),
)])

patch(f'{S}/universe.js', [
    ('loadGraph("static/asimov.tsv")', 'loadGraph("static/cards.json")'),
    ('} from "./stories.js";', """} from "./stories.js";
import { addBackFace, flipCard } from "./card.js";

// ---- Prototype: tap flips a card; no pinning, no half cards ----
const flippedIds = new Set();
let partOf = null;
let capturedBy = null;
function backLookup() {
  if (!partOf) {
    partOf = {};
    capturedBy = {};
    for (const n of state.nodes) {
      for (const s of n.slots || []) if (s.fill) (partOf[s.fill] ||= []).push({ id: n.id, as: s.label });
      for (const p of n.phen || []) if (p.id) (capturedBy[p.id] ||= []).push(n.id);
    }
  }
  return {
    byId: state.nodesById,
    partOf,
    capturedBy,
    // A bullet jumps to its card and opens it on the back, so you can keep drilling down.
    onLink: (id) => {
      const n = state.nodesById[id];
      if (!n) return;
      flippedIds.add(id);
      centerOnNode(n, { animate: true });
      const g = gCards.selectAll("g.card").filter((x) => x.id === id);
      if (!g.empty()) flipCard(g, true);
    },
  };
}
function toggleFlip(event, d) {
  event.preventDefault();
  event.stopPropagation();
  const toBack = !flippedIds.has(d.id);
  if (toBack) flippedIds.add(d.id);
  else flippedIds.delete(d.id);
  flipCard(gCards.selectAll("g.card").filter((x) => x.id === d.id), toBack);
}
window.__centerOnNode = (d) => centerOnNode(d, { animate: true });"""),
    ('  return tier === TIER_FULL ? 1 : 0;', '  return 1; // prototype: cards never collapse into half cards'),
    ("""  const entered = renderFullCard(sel.enter(), foldForTier(state.tier));
  entered
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
    .on("click", (event, d) => onPinClick(event, d))
    .on("mouseenter", (event, d) => onHoverEnter(event, d))
    .on("mousemove", onHoverMove)
    .on("mouseleave", (event, d) => onHoverLeave(event, d));""",
     """  const entered = renderFullCard(sel.enter(), foldForTier(state.tier));
  entered
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
    .on("click", (event, d) => toggleFlip(event, d));
  addBackFace(entered, backLookup());
  entered.filter((d) => flippedIds.has(d.id)).each(function () {
    flipCard(d3.select(this), true, false);
  });"""),
    ("""    .attr("transform", (d) => `translate(${d.x}, ${d.y + 12})`)
    .style("--label-css-width", (d) => `${d.titleWidthCss + 24}px`)
    .on("click", (event, d) => onPinClick(event, d))
    .on("mouseenter", (event, d) => onHoverEnter(event, d))
    .on("mousemove", onHoverMove)
    .on("mouseleave", (event, d) => onHoverLeave(event, d));""",
     """    .attr("transform", (d) => `translate(${d.x}, ${d.y + 12})`)
    .style("--label-css-width", (d) => `${d.titleWidthCss + 24}px`)
    .on("click", (event, d) => { event.stopPropagation(); centerOnNode(d, { animate: true }); });"""),
    ("""      pin(node);
      centerOnNode(node, { animate: true });
    });
    searchResultsContainer.appendChild(chip);""",
     """      centerOnNode(node, { animate: true });
    });
    searchResultsContainer.appendChild(chip);"""),
    ("""  pin(next);
  centerOnNode(next, { animate: true });""", """  centerOnNode(next, { animate: true });"""),
    ("""        pin(node);
        centerOnNode(node, { animate: true });""", """        centerOnNode(node, { animate: true });"""),
    ('  if (pinnedNode) pin(pinnedNode);\n}', '}'),
])

patch(f'{S}/world.js', [(
    """    .on("mouseenter", handlers.onHoverEnter)
    .on("mousemove", handlers.onHoverMove)
    .on("mouseleave", handlers.onHoverLeave)
    .on("click", handlers.onPinClick);""",
    """    .on("click", (event, d) => { event.stopPropagation(); window.__centerOnNode && window.__centerOnNode(d); });""",
)])

open(f'{S}/card.css', 'a').write(open(os.path.join(HERE, 'card_back.css')).read())

for f in ['mobile.js', 'mobile.css', 'main.js', 'timeline.js']:
    os.remove(f'{S}/{f}')

# ---------- page ----------
html = open(f'{REPO}/universe.html').read()
html = html.replace('"/static/', '"static/')
html = html.replace('https://d3js.org/d3.v7.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js')
assert 'cdnjs.cloudflare.com/ajax/libs/d3/7.9.0' in html
html = re.sub(r'\s*<script async src="https://www.googletagmanager.com.*?</script>\s*<script>.*?</script>', '', html, flags=re.S)
html = html.replace(' media="(min-width: 721px)"', '')
html = re.sub(r'\s*<link rel="stylesheet" href="static/mobile.css"[^>]*>', '', html)
html = re.sub(r'<script type="module">.*?</script>', '<script type="module">import("./static/universe.js");</script>', html, flags=re.S)
html = re.sub(r'<title>.*?</title>', '<title>Assembly Cards</title>', html)
html = html.replace('<h1 class="site-title">Invention Cards</h1>', '<h1 class="site-title">Assembly Cards</h1>')
html = re.sub(r'<p class="site-subtitle">.*?</p>', '<p class="site-subtitle">Prototype. Tap a card to flip it: the back lists its parts and the natural phenomena it uses. Tap a bullet to jump to that card.</p>', html, count=1)
open(f'{OUT}/index.html', 'w').write(html)

files = sum(len(f) for _, _, f in os.walk(OUT))
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
print(f'{len(ids)} cards, {files} files, {size/1e6:.1f} MB')

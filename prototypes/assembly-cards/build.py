"""Build the Assembly Cards prototype into ./site (gitignored).

A copy of the invention.cards universe view, patched so cards flip on tap and the
back lists the card's assembly, its natural phenomena, and where it is used as a part.
Data comes from lists.py (pilot_data.py, batches.py, links.csv) plus card text and images from the repo's static/.

  uv run prototypes/assembly-cards/build.py
  python3 -m http.server -d prototypes/assembly-cards/site 8000
"""
import csv, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, 'site')
sys.path.insert(0, HERE)
from lists import NEW_CARDS, CARDS

# Phenomena are set aside while the assemblies get to a good place. The lists are kept in
# pilot_data.py and batches.py; set this to True to show them again.
SHOW_PHENOMENA = False
if not SHOW_PHENOMENA:
    CARDS = {cid: (job, slots, []) for cid, (job, slots, ph) in CARDS.items()}

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
    ids |= {l for s in slots for l in s[6]}
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
            for d in [s[2] for s in slots if s[2]] + [l for s in slots for l in s[6]] + [p for p in ph if not isinstance(p, tuple)]:
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

# A slot's job is its key. The part name ("barrel", "eyepiece") is kept only
# when it says something the job and the filler card don't.
GENERIC_PARTS = {'material', 'fuel', 'propellant', 'power', 'motive force', 'magnet', 'magnets', 'gears',
                 'oxidizer', 'thrust', 'explosive', 'steam', 'drive', 'motor', 'engine', 'generator', 'battery',
                 'amplifier', 'launcher', 'anesthetic', 'culture', 'conductor', 'insulation', 'base metal'}
def _stem(w):
    for suf in ('es', 's'):
        if w.endswith(suf) and len(w) > 4: return w[:-len(suf)]
    return w
def part_name(slot, filler_title):
    name = (slot[0] or '').strip()
    if not name: return None
    low = name.lower()
    if low in GENERIC_PARTS: return None
    toks = [_stem(t) for t in re.findall(r'[a-z]+', low)]
    if toks and all(t in filler_title.lower() for t in toks): return None
    if toks and all(t in slot[1].lower() for t in toks): return None
    return name

def card_title(i):
    return NEW_CARDS[i][0] if i in NEW_CARDS else rows[i]['Title']

lists = {}
for cid, (job, slots, ph) in CARDS.items():
    lists[cid] = {
        'job': job,
        'slots': [{'part': part_name(s, card_title(s[2]) if s[2] else (s[3] or '')), 'job': s[1], 'fill': s[2], 'gap': s[3], 'kind': s[4], 'note': s[5], **({'later': s[6]} if s[6] else {})} for s in slots],
        **({'phen': [{'gap': p[1]} if isinstance(p, tuple) else {'id': p} for p in ph]} if SHOW_PHENOMENA else {}),
    }
json.dump(lists, open(f'{OUT}/static/lists.json', 'w'), ensure_ascii=False)

# ---------- images ----------
# Cards with no deck art share one "art to come" image (the card frame already shows the title).
# One file instead of one per card keeps the artifact under its 512-file limit.
from PIL import Image, ImageDraw, ImageFont
missing = []
for i in ids:
    src = f'{REPO}/static/images/entries-v2/{i}.jpg'
    if os.path.exists(src):
        shutil.copy(src, f'{OUT}/static/images/entries-v2/{i}.jpg')
    else:
        missing.append(i)
im = Image.new('RGB', (624, 416), (236, 233, 226))
dr = ImageDraw.Draw(im)
for x in range(0, 624, 24):
    dr.line([(x, 0), (x, 416)], fill=(226, 222, 213))
for y in range(0, 416, 24):
    dr.line([(0, y), (624, y)], fill=(226, 222, 213))
try:
    f1 = ImageFont.load_default(size=34); f2 = ImageFont.load_default(size=20)
except TypeError:  # Pillow < 10.1 has no sized default font
    f1 = f2 = ImageFont.load_default()
for text, font, y, fill in (('supporting invention', f1, 172, (90, 90, 90)), ('art to come', f2, 226, (130, 130, 130))):
    dr.text(((624 - dr.textlength(text, font=font)) / 2, y), text, font=font, fill=fill)
im.save(f'{OUT}/static/images/entries-v2/_art-to-come.jpg', quality=85)
print('no art for', len(missing), 'cards:', sorted(missing))

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
    // Which jobs each card does as a part somewhere (for "job:" searches).
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    for (const n of nodes) {
      for (const s of n.slots || []) for (const f of [s.fill, ...(s.later || [])]) if (f && byId[f]) (byId[f].fillsJobs ||= new Set()).add(s.job);
    }
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
_cj = open(f'{S}/card.js').read()
_href = '.attr("href", (d) => `static/images/entries-v2/${d.id}.jpg`);'
assert _cj.count(_href) == 2, _cj.count(_href)
_cj = _cj.replace(_href, '.attr("href", (d) => NO_ART.has(d.id) ? "static/images/entries-v2/_art-to-come.jpg" : `static/images/entries-v2/${d.id}.jpg`);')
_cj = _cj.replace('let cardSerial = 0;', 'let cardSerial = 0;\nconst NO_ART = new Set(' + json.dumps(sorted(missing)) + ');', 1)
open(f'{S}/card.js', 'w').write(_cj)

patch(f'{S}/search.js', [(
    'export function searchHelper(node, query) {\n  const q = query.toLowerCase();',
    '''export function searchHelper(node, query) {
  // Prototype: "job:<job>" matches cards that do that job, as their own job or as a part.
  if (query.startsWith("job:")) {
    const job = query.slice(4).trim().toLowerCase();
    if (!job) return false;
    if ((node.job || "").toLowerCase() === job) return true;
    for (const j of node.fillsJobs || []) if (j.toLowerCase() === job) return true;
    return false;
  }
  const q = query.toLowerCase();''',
)])

patch(f'{S}/universe.js', [
    ('loadGraph("static/asimov.tsv")', 'loadGraph("static/cards.json")'),
    ('} from "./stories.js";', """} from "./stories.js";
import { addBackFace, flipCard } from "./card.js";

// ---- Prototype: tap pins a card, tap it again to flip it; no hover, no half cards ----
const flippedIds = new Set();
let partOf = null;
let capturedBy = null;
function backLookup() {
  if (!partOf) {
    partOf = {};
    capturedBy = {};
    for (const n of state.nodes) {
      for (const s of n.slots || []) for (const f of [s.fill, ...(s.later || [])]) if (f) (partOf[f] ||= []).push({ id: n.id, job: s.job, kind: s.kind });
      for (const p of n.phen || []) if (p.id) (capturedBy[p.id] ||= []).push(n.id);
    }
  }
  return {
    byId: state.nodesById,
    partOf,
    capturedBy,
    // A bullet jumps to its card and opens it on the back, so you can keep drilling down.
    onJob: (job) => showJob(job),
    onLink: (id) => {
      const n = state.nodesById[id];
      if (!n) return;
      flippedIds.add(id);
      pin(n);
      centerOnNode(n, { animate: true });
      flipAll(id, true);
    },
  };
}
// Flip every copy of a card: the one on the board and the pinned one drawn over it.
function flipAll(id, toBack, animate = true) {
  flipCard(d3.selectAll("g.card").filter((x) => x && x.id === id), toBack, animate);
}
function toggleFlip(d) {
  const toBack = !flippedIds.has(d.id);
  if (toBack) flippedIds.add(d.id);
  else flippedIds.delete(d.id);
  flipAll(d.id, toBack);
}
// The first tap pins a card: it comes to the front and its links light up. Tapping the
// pinned card flips it. Tapping the background (or Escape) unpins.
// A pinned card is drawn centred on its node at a fixed size. If the node sits near an
// edge or under the header, the card would only show as a chip at the edge (the way a
// pinned card you've panned away from does). So after a tap, slide the view just enough
// for the whole card to show, keeping the zoom.
function keepPinnedCardInView(d) {
  const t = state.transform;
  if (!t) return;
  let w = 300, h = 410;  // the pinned card's size on screen, if none is drawn yet
  const el = document.querySelector("g.pinned-cards g.card");
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height) { w = r.width; h = r.height; }
  }
  const pad = 16;
  const left = pad, right = window.innerWidth - pad;
  const top = (state.headerHeight || 0) + pad, bottom = window.innerHeight - pad;
  const sx = t.x + d.x * t.k, sy = t.y + d.y * t.k;
  const fit = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(Math.max(v, lo), hi));
  const nx = fit(sx, left + w / 2, right - w / 2);
  const ny = fit(sy, top + h / 2, bottom - h / 2);
  if (Math.abs(nx - sx) < 1 && Math.abs(ny - sy) < 1) return;
  svg.transition().duration(350)
    .call(zoom.transform, d3.zoomIdentity.translate(t.x + nx - sx, t.y + ny - sy).scale(t.k));
}
function onCardTap(event, d) {
  event.preventDefault();
  event.stopPropagation();
  if (state.pinnedId === d.id) toggleFlip(d);
  else {
    pin(d);
    keepPinnedCardInView(d);
  }
  // Tapping a card that matches the search makes it the active result.
  if (isActiveQuery() && searchHelper(d, state.searchQuery.trim())) {
    activeSearchId = d.id;
    renderSearchOffscreenIndicators();
  }
}
// overlays.js draws the pinned cards; these give them a back and the same tap.
window.__assembly = {
  onCardTap,
  // Only the pinned card shows its back: moving or dropping the pin turns the rest face up.
  unflipExcept(keep) {
    for (const id of [...flippedIds]) {
      if (id === keep) continue;
      flippedIds.delete(id);
      flipAll(id, false);
    }
  },
  decorate(sel) {
    addBackFace(sel, backLookup());
    sel.filter((d) => flippedIds.has(d.id)).each(function () { flipCard(d3.select(this), true, false); });
  },
};
document.addEventListener("click", (e) => {
  if (!state.pinnedId || !e.target.closest("svg")) return;
  if (e.target.closest("g.card, g.dag-label, circle")) return;
  unpin();
});
window.__centerOnNode = (d) => centerOnNode(d, { animate: true });

// Jobs panel: every job a card or slot does. Picking one lights up the cards that can do it,
// using the search highlight with a "job:" query (see search.js).
function jobIndex() {
  const jobs = new Map();
  const get = (j) => jobs.get(j) || jobs.set(j, { slots: 0, cards: new Set() }).get(j);
  for (const n of state.nodes) {
    if (n.job) get(n.job).cards.add(n.id);
    for (const s of n.slots || []) {
      const v = get(s.job);
      v.slots++;
      for (const f of [s.fill, ...(s.later || [])]) if (f) v.cards.add(f);
    }
  }
  return [...jobs.entries()].sort((a, b) => b[1].slots - a[1].slots || b[1].cards.size - a[1].cards.size || a[0].localeCompare(b[0]));
}
function showJob(job) {
  const input = document.getElementById("search-input");
  input.value = `job:${job}`;
  state.searchQuery = input.value;
  document.body.classList.add("searching", "search-active");
  document.getElementById("jobs-panel")?.setAttribute("hidden", "");
  scheduleRedraw();
}
function toggleJobsPanel(event) {
  event.stopPropagation();
  let panel = document.getElementById("jobs-panel");
  if (!panel) {
    const rows = jobIndex();
    const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
    panel = document.createElement("div");
    panel.id = "jobs-panel";
    panel.setAttribute("hidden", "");
    panel.innerHTML =
      `<div class="jobs-head"><b>${rows.length} jobs</b><span>Tap one to light up every card that can do it.</span></div>` +
      rows.map(([j, v]) => `<button type="button" class="job-row" data-job="${escapeHtml(j)}"><span>${escapeHtml(j)}</span><span class="job-n">${plural(v.slots, "slot")} · ${plural(v.cards.size, "card")}</span></button>`).join("");
    panel.addEventListener("click", (e) => {
      e.stopPropagation();
      const b = e.target.closest("[data-job]");
      if (b) showJob(b.getAttribute("data-job"));
    });
    document.body.appendChild(panel);
  }
  const header = document.getElementById("site-header");
  panel.style.top = `${(header ? header.getBoundingClientRect().bottom : 60) + 8}px`;
  if (panel.hasAttribute("hidden")) panel.removeAttribute("hidden");
  else panel.setAttribute("hidden", "");
}
document.getElementById("action-jobs")?.addEventListener("click", toggleJobsPanel);
document.addEventListener("click", (e) => {
  const panel = document.getElementById("jobs-panel");
  if (panel && !panel.hasAttribute("hidden") && !e.target.closest("#jobs-panel, #action-jobs")) panel.setAttribute("hidden", "");
});"""),
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
    .on("click", (event, d) => onCardTap(event, d));
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
    .on("click", (event, d) => onCardTap(event, d));"""),
])

patch(f'{S}/world.js', [(
    """    .on("mouseenter", handlers.onHoverEnter)
    .on("mousemove", handlers.onHoverMove)
    .on("mouseleave", handlers.onHoverLeave)
    .on("click", handlers.onPinClick);""",
    """    .on("click", (event, d) => window.__assembly.onCardTap(event, d));""",
)])

patch(f'{S}/overlays.js', [
  ("""export function pin(rootNode) {""", """export function pin(rootNode) {
  window.__assembly?.unflipExcept(rootNode.id);"""),
  ("""export function unpin() {""", """export function unpin() {
  window.__assembly?.unflipExcept(null);"""),
  (
    """  renderFullCard(sel.enter())
    .on("mouseenter", (event, n) => onHoverEnter(event, n))
    .on("mouseleave", () => onHoverLeave())
    .on("click", (event, n) => onPinClick(event, n));""",
    """  const enteredPinned = renderFullCard(sel.enter())
    .on("click", (event, n) => window.__assembly.onCardTap(event, n));
  window.__assembly.decorate(enteredPinned);""",
)])

# Search results: list every match, not just the off-screen ones, so the list stays put
# as you jump between results. The one you picked is marked; ones on screen are outlined.
patch(f'{S}/universe.js', [
    ("""  const offscreen = [];
  for (const n of state.nodes) {
    if (!searchHelper(n, q)) continue;
    const sx = tx + n.x * k;
    const sy = ty + n.y * k;
    const onScreen = sx >= 0 && sx <= w && sy >= 0 && sy <= h;
    if (!onScreen) offscreen.push(n);
  }

  const shown = offscreen.slice(0, MAX_SEARCH_PILLS);
  for (const node of shown) {
    const chip = document.createElement("button");
    chip.className = "offscreen-indicator search";""",
     """  if (q !== activeSearchQuery) { activeSearchQuery = q; activeSearchId = null; }
  const offscreen = [];  // every match, on screen or not
  const here = new Set();
  for (const n of state.nodes) {
    if (!searchHelper(n, q)) continue;
    const sx = tx + n.x * k;
    const sy = ty + n.y * k;
    if (sx >= 0 && sx <= w && sy >= 0 && sy <= h) here.add(n.id);
    offscreen.push(n);
  }

  const shown = offscreen.slice(0, MAX_SEARCH_PILLS);
  const picked = offscreen.find((n) => n.id === activeSearchId);
  if (picked && !shown.includes(picked)) shown.push(picked);
  for (const node of shown) {
    const chip = document.createElement("button");
    chip.className = "offscreen-indicator search"
      + (node.id === activeSearchId ? " active" : "")
      + (here.has(node.id) ? " here" : "");"""),
    ("""      if (state.story) exitStory({ keepUrl: true });
      pin(node);
      centerOnNode(node, { animate: true });
    });
    searchResultsContainer.appendChild(chip);""",
     """      if (state.story) exitStory({ keepUrl: true });
      activeSearchId = node.id;
      pin(node);
      centerOnNode(node, { animate: true });
      renderSearchOffscreenIndicators();
    });
    searchResultsContainer.appendChild(chip);"""),
    ("""function renderSearchOffscreenIndicators() {""",
     """let activeSearchId = null;
let activeSearchQuery = "";
function renderSearchOffscreenIndicators() {"""),
])

open(f'{S}/card.css', 'a').write(open(os.path.join(HERE, 'card_back.css')).read())
open(f'{S}/universe.css', 'a').write(open(os.path.join(HERE, 'phone.css')).read())
open(f'{S}/universe.css', 'a').write(open(os.path.join(HERE, 'theme.css')).read())
# Link lines take their colour from the theme (--ink-rgb in theme.css): dark on light, light on dark.
_w = open(f'{S}/world.js').read()
_anchor = '  const opacity = state.tier === TIER_LABEL ? 0.28 : 0.55;\n'
assert _w.count(_anchor) == 1 and _w.count('rgba(0, 0, 0, ${opacity})') == 4
_w = _w.replace(_anchor, _anchor + '  const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink-rgb").trim() || "0, 0, 0";\n')
_w = _w.replace('rgba(0, 0, 0, ${opacity})', 'rgba(${ink}, ${opacity})')
open(f'{S}/world.js', 'w').write(_w)

# Phones: a close button for search, a sheet of results that folds away after you pick one,
# a closer first view, and pinned cards centred below the header instead of under it.
patch(f'{S}/universe.js', [
    ('''function closeSearch() {
  state.searchQuery = "";''',
     '''const isPhone = () => window.matchMedia("(max-width: 720px)").matches;
function closeSearch() {
  document.body.classList.remove("search-collapsed");
  state.searchQuery = "";'''),
    ('''function openSearch() {
  document.body.classList.add("searching");''',
     '''function openSearch() {
  document.body.classList.remove("search-collapsed");
  document.body.classList.add("searching");'''),
    ('''searchInput.addEventListener("search", () => {
  if (!searchInput.value) closeSearch();
});''',
     '''searchInput.addEventListener("search", () => {
  if (!searchInput.value) closeSearch();
});
document.getElementById("search-close")?.addEventListener("click", (e) => {
  e.stopPropagation();
  closeSearch();
});
// On a phone, picking a result folds the list away so the card shows; tapping the
// box brings it back.
searchResultsContainer.addEventListener("click", (e) => {
  if (!isPhone() || !e.target.closest("button")) return;
  document.body.classList.add("search-collapsed");
  searchInput.blur();
}, true);  // capture: each result's own handler stops the click from bubbling
searchInput.addEventListener("focus", () => document.body.classList.remove("search-collapsed"));
// Redraw the link lines when the theme flips (the viewer's data-theme, or the system setting).
new MutationObserver(scheduleRedraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", scheduleRedraw);
searchInput.addEventListener("click", () => document.body.classList.remove("search-collapsed"));'''),
    ('''  const k = 1.4;
  const leftMargin = 40;''',
     '''  const k = window.matchMedia("(max-width: 720px)").matches ? 0.7 : 1.4;
  const leftMargin = 40;'''),
    ('''  const k = 1.5;
  const tx = window.innerWidth / 2 - node.x * k;
  const ty = window.innerHeight / 2 - node.y * k;''',
     '''  const k = 1.5;
  const tx = window.innerWidth / 2 - node.x * k;
  // Centre in the space below the header, so a tall card isn't tucked under it.
  const top = state.headerHeight || 0;
  const ty = top + (window.innerHeight - top) / 2 - node.y * k;'''),
])

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
search_btn = '<button id="action-search" class="site-action" type="button" title="Search" aria-label="Search">'
assert html.count(search_btn) == 1
html = html.replace(search_btn, '<button id="action-jobs" class="site-action" type="button" title="Jobs to be done" aria-label="Jobs to be done">\n          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>\n        </button>\n        ' + search_btn)
html = html.replace('<h1 class="site-title">Invention Cards</h1>', '<h1 class="site-title">Assembly Cards</h1>')
html = re.sub(r'<p class="site-subtitle">.*?</p>', '<p class="site-subtitle">Prototype. Tap a card to pin it and light up its links; tap it again to flip it. The back lists its parts. Tap a bullet to jump to that card, or a job to see every card that does it.</p>', html, count=1)
html = html.replace('</h1>', '</h1>\n        <p class="site-subtitle-short">Tap a card to pin it, tap again to flip it.</p>', 1)
search_in = '<input id="search-input"'
assert html.count(search_in) == 1
i = html.index(search_in); j = html.index('/>', i) + 2
html = html[:i] + '<div id="search-bar">' + html[i:j] + '<button id="search-close" type="button" aria-label="Close search" title="Close search">&times;</button></div>' + html[j:]
open(f'{OUT}/index.html', 'w').write(html)

files = sum(len(f) for _, _, f in os.walk(OUT))
size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
print(f'{len(ids)} cards, {files} files, {size/1e6:.1f} MB')

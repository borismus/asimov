import { loadGraph, formatField, formatYear } from "./utils.js";
import { cardWidth, cardHeight, fullCardHeight, renderMTGCard, renderFullCard } from "./card.js";

const KNOWN_FIELDS = new Set([
  "general",
  "geography",
  "culture",
  "war",
  "design",
  "math",
  "science",
  "space",
]);

const NUM_COLS = 240;
const COL_WIDTH = cardWidth + 280;
const ROW_STRIDE = cardHeight + 150;
const TOP_PAD = 200;
const LEFT_PAD = 60;
const X_JITTER = 220;
const Y_JITTER = 120;
// Target label density in labels per screen area at any zoom (Google-Maps-style:
// fewer labels when zoomed out, more as you zoom in, but on-screen text density
// stays roughly constant).
const LABEL_DENSITY = 140;

const TARGET_TICK_PX = 300;
const MIN_TICK_PX = 80;

const TIER_LABEL = 0;
const TIER_IMG = 1;
const TIER_FULL = 2;
const TIER_FADE_MS = 200;

// At low zoom, hover cards scale up so a card is never narrower than this many
// screen pixels — otherwise the title/image are too small to read.
const HOVER_MIN_PX = 240;

// Minimum query length before search starts matching — prevents thousands of
// labels lighting up while the user is still typing the first few characters.
const MIN_SEARCH_CHARS = 3;

function tierFor(k) {
  // LABEL: text labels with density control.
  // IMG:   image + title only (no body text, no metadata).
  // FULL:  full MTG card.
  if (k < 0.85) return TIER_LABEL;
  if (k < 1.6) return TIER_IMG;
  return TIER_FULL;
}

function labelThreshold(k) {
  // Density-target model: aim for LABEL_DENSITY labels in the viewport at
  // any zoom. Cards-in-viewport scales as (window / k)^2 / world_area, so the
  // probability of showing a given card's label scales as k^2.
  if (!state.bbox) return 0;
  const screenArea = window.innerWidth * window.innerHeight;
  const { minX, maxX, minY, maxY } = state.bbox;
  const worldArea = (maxX - minX) * (maxY - minY);
  const t =
    (LABEL_DENSITY * worldArea * k * k) / (state.nodes.length * screenArea);
  return Math.min(1, Math.max(0, t));
}

const state = {
  nodes: [],
  links: [],
  worldWidth: 0,
  worldHeight: 0,
  transform: null,
  tier: TIER_LABEL,
  rafPending: false,
  hoverId: null,
  hoverNeighbors: [],
  hoverLayout: new Map(),
  // At LABEL tier we delay the full-card expand so quick scanning over dots
  // doesn't trigger heavy renders. False = label-only state, true = full card.
  hoverExpanded: false,
  // Accumulating list of nodes that have ever been hovered at LABEL tier;
  // their labels persist in gStickyLabels until the page reloads.
  stickyLabels: [],
  // Pinned chain: clicking a hover-expanded card pins it + its full transitive
  // ancestors and descendants. Only one chain can be pinned at a time.
  pinnedId: null,
  pinnedChain: [],
  pinnedLayout: new Map(),
  // Live search query (empty / under MIN_SEARCH_CHARS = inactive).
  searchQuery: "",
  nodesById: {},
};

// Case-insensitive substring match against title, description, id, inventor,
// location, year — same predicate as searchHelper in static/main.js.
function searchHelper(node, query) {
  const q = query.toLowerCase();
  return (
    node.title.toLowerCase().includes(q) ||
    node.description.toLowerCase().includes(q) ||
    String(node.year).includes(q) ||
    node.id.includes(q) ||
    (node.inventor && node.inventor.toLowerCase().includes(q)) ||
    (node.location && node.location.toLowerCase().includes(q))
  );
}

function isActiveQuery() {
  return state.searchQuery.trim().length >= MIN_SEARCH_CHARS;
}

// Debounce hover-leave so a quick cursor transition from a small dot/label onto
// the (much larger) hover card doesn't tear the card down before the card
// itself reports mouseenter. 50ms is enough for the next mouseenter to fire on
// the overlapping hover-card group.
let hoverLeaveTimeout = null;
// Delay before the hovered dot's full card pops up at LABEL tier; resets on
// mousemove so it only fires once the cursor settles.
let hoverExpandTimer = null;
const HOVER_EXPAND_DELAY_MS = 300;

const canvas = document.getElementById("links-canvas");
const ctx = canvas.getContext("2d");
const offscreenContainer = document.getElementById("offscreen-indicators");

const container = d3.select("#container");
const svg = container
  .append("svg")
  .attr("width", window.innerWidth)
  .attr("height", window.innerHeight);

// Reusable arrowhead marker for hover lines. markerUnits="strokeWidth" scales
// the marker with the line's stroke-width (which we already keep ~3 screen px),
// so the head looks consistent at any zoom level.
const defs = svg.append("defs");
defs
  .append("marker")
  .attr("id", "hover-arrow")
  .attr("viewBox", "0 0 10 10")
  .attr("refX", 9)
  .attr("refY", 5)
  .attr("markerWidth", 4)
  .attr("markerHeight", 4)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,0 L10,5 L0,10 Z")
  .attr("fill", "goldenrod");
defs
  .append("marker")
  .attr("id", "pinned-arrow")
  .attr("viewBox", "0 0 10 10")
  .attr("refX", 9)
  .attr("refY", 5)
  .attr("markerWidth", 4)
  .attr("markerHeight", 4)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,0 L10,5 L0,10 Z")
  .attr("fill", "steelblue");

const gRoot = svg.append("g").attr("class", "world");
const gAxis = gRoot.append("g").attr("class", "axis");
const gDots = gRoot.append("g").attr("class", "dots");
const gLabels = gRoot.append("g").attr("class", "labels");
// Sticky labels: every node the user has hovered gets its title pinned here
// for the rest of the session, hidden only when its expanded card is on top.
const gStickyLabels = gRoot.append("g").attr("class", "sticky-labels");
// Search labels: matching nodes' titles appear here while a query is active.
const gSearchLabels = gRoot.append("g").attr("class", "search-labels");
const gCards = gRoot.append("g").attr("class", "cards");
// Pinned artifacts sit between the baseline cards and the hover artifacts so an
// active hover always paints over the pinned chain, but the pinned chain paints
// over baseline dots/labels/cards.
const gPinnedLines = gRoot.append("g").attr("class", "pinned-lines");
const gPinnedCards = gRoot.append("g").attr("class", "pinned-cards");
// Hover lines render between baseline cards (below) and the hover-expanded
// versions (above), so a hovered card sits over its outgoing/incoming arrows
// while non-hovered cards stay beneath them.
const gHoverLines = gRoot.append("g").attr("class", "hover-lines");
const gHoverCards = gRoot.append("g").attr("class", "hover-cards");

const zoom = d3
  .zoom()
  .scaleExtent([0.02, 3])
  .on("zoom", onZoom);

svg.call(zoom);

const VIEW_STORAGE_KEY = "universe-view";
let saveViewTimeout = null;

function onZoom({ transform }) {
  state.transform = transform;
  gRoot.attr("transform", transform);
  document.documentElement.style.setProperty("--zoom", transform.k);
  scheduleRedraw();

  // Debounced persist so quick wheel/pan bursts don't write on every frame.
  if (saveViewTimeout) clearTimeout(saveViewTimeout);
  saveViewTimeout = setTimeout(() => {
    saveViewTimeout = null;
    try {
      localStorage.setItem(
        VIEW_STORAGE_KEY,
        JSON.stringify({ x: transform.x, y: transform.y, k: transform.k })
      );
    } catch (e) {
      // localStorage unavailable / full — silently ignore.
    }
  }, 200);
}

function scheduleRedraw() {
  if (state.rafPending) return;
  state.rafPending = true;
  requestAnimationFrame(() => {
    state.rafPending = false;
    if (!state.transform) return;
    renderAxis();
    drawLinks();
    const newTier = tierFor(state.transform.k);
    if (newTier !== state.tier) {
      if (state.tier === TIER_LABEL) {
        gLabels.selectAll("*").interrupt()
          .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();
      }
      if (newTier === TIER_LABEL) {
        gCards.selectAll("*").interrupt()
          .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();
      }
      state.tier = newTier;
    }
    if (newTier === TIER_LABEL) {
      renderLabels(labelThreshold(state.transform.k));
    } else {
      renderCards();
    }
    renderSearchLabels();
    // Pinned chain re-tracks the viewport on pan/zoom just like hover. Update
    // it before hover so hover paints over the latest pinned positions.
    if (state.pinnedId) {
      updatePinnedArtifacts();
      renderPinnedOffscreenIndicators();
    }
    // Recompute hover layout / card transforms / line endpoints / off-screen
    // chips every frame while a hover is active so they track pan + zoom.
    if (state.hoverId) {
      updateHoverArtifacts();
      renderOffscreenIndicators();
    }
  });
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  svg.attr("width", w).attr("height", h);
}

init();

async function init() {
  resizeCanvas();
  window.addEventListener("resize", () => {
    resizeCanvas();
    scheduleRedraw();
  });

  const { nodes, links } = await loadGraph("/static/asimov.tsv");
  state.nodes = nodes;
  state.links = links;
  for (const n of nodes) state.nodesById[n.id] = n;

  // Each card gets a stable random priority in [0, 1]. Labels render when
  // priority <= threshold(k), and threshold scales with k^2 so on-screen
  // label density stays roughly constant as you zoom.
  for (const n of nodes) n.labelPriority = (hashUnit(n.id + "label") + 1) / 2;

  // Measure each title's screen-space width once. Labels render rect + text;
  // the rect's CSS-pixel width comes from this, divided by --zoom.
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {}
  }
  const measureCtx = document.createElement("canvas").getContext("2d");
  measureCtx.font = '13px "DM Serif Display", serif';
  for (const n of nodes) {
    n.titleWidthCss = Math.ceil(measureCtx.measureText(n.title).width);
  }

  layout();
  renderDots();
  initialCenter();
  scheduleRedraw();
}

function hashUnit(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

function bucketIndexForYear(year) {
  // Returns the bucket index whose year range contains `year`, clamped to [0, NUM_COLS-1].
  const buckets = state.buckets;
  let lo = 0;
  let hi = buckets.length - 1;
  if (year <= buckets[0].yearMin) return 0;
  if (year >= buckets[hi].yearMax) return hi;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const b = buckets[mid];
    if (year < b.yearMin) hi = mid - 1;
    else if (year > b.yearMax) lo = mid + 1;
    else return mid;
  }
  return Math.max(0, Math.min(buckets.length - 1, lo));
}

function xForBucket(bucketIdx) {
  return LEFT_PAD + bucketIdx * COL_WIDTH + COL_WIDTH / 2;
}

function layout() {
  const nodes = state.nodes;
  const N = nodes.length;
  state.maxYear = d3.max(nodes, (n) => n.year);
  state.minYear = d3.min(nodes, (n) => n.year);

  for (const n of nodes) {
    const key = formatField(n.field);
    n.fieldKey = KNOWN_FIELDS.has(key) ? key : "general";
  }

  const sortedByYear = nodes.slice().sort((a, b) => a.year - b.year);
  const buckets = [];
  for (let b = 0; b < NUM_COLS; b++) {
    const from = Math.floor((b * N) / NUM_COLS);
    const to = Math.floor(((b + 1) * N) / NUM_COLS);
    const bucketNodes = sortedByYear.slice(from, to);
    buckets.push({
      index: b,
      nodes: bucketNodes,
      yearMin: bucketNodes.length ? bucketNodes[0].year : 0,
      yearMax: bucketNodes.length ? bucketNodes[bucketNodes.length - 1].year : 0,
    });
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const b of buckets) {
    const centerX = xForBucket(b.index);
    for (let r = 0; r < b.nodes.length; r++) {
      const n = b.nodes[r];
      n.bucketIdx = b.index;
      n.rowIdx = r;
      n.x = centerX + hashUnit(n.id) * X_JITTER;
      n.y =
        TOP_PAD + r * ROW_STRIDE + ROW_STRIDE / 2 + hashUnit(n.id + "y") * Y_JITTER;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    }
  }

  state.buckets = buckets;
  state.bbox = { minX, maxX, minY, maxY };
  state.worldWidth = LEFT_PAD + NUM_COLS * COL_WIDTH + LEFT_PAD;
  state.worldHeight =
    TOP_PAD + Math.max(...buckets.map((b) => b.nodes.length)) * ROW_STRIDE + 120;

  const cardsPerBucket = buckets.map((b) => b.nodes.length);
  console.log(
    "universe layout:",
    `${Math.round(maxX - minX)}×${Math.round(maxY - minY)}`,
    "bbox",
    `world ${state.worldWidth}×${state.worldHeight}`,
    "per-bucket:",
    cardsPerBucket
  );
}

// Pick a "nice" round step (1, 2, 5 × 10^n) that roughly matches the requested
// magnitude — used so axis ticks land on round years as you zoom.
function pickNiceStep(rough) {
  if (rough <= 0) return 1;
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const norm = rough / base;
  let nice;
  if (norm < 1.5) nice = 1;
  else if (norm < 3.5) nice = 2;
  else if (norm < 7.5) nice = 5;
  else nice = 10;
  return nice * base;
}

function renderAxis() {
  if (!state.transform || !state.buckets) return;

  const { k, x: tx } = state.transform;
  const w = window.innerWidth;
  const viewLeft = -tx / k;
  const viewRight = viewLeft + w / k;

  let bMin = Math.floor((viewLeft - LEFT_PAD) / COL_WIDTH);
  let bMax = Math.floor((viewRight - LEFT_PAD) / COL_WIDTH);
  bMin = Math.max(0, Math.min(state.buckets.length - 1, bMin));
  bMax = Math.max(0, Math.min(state.buckets.length - 1, bMax));

  // Walk the visible buckets at a uniform stride so tick screen-spacing is
  // ~constant. Quantile buckets warp years (sparse at the start, dense at the
  // end), so stepping by year would clump ticks where the data is dense and
  // strand them where it's sparse — stepping by bucket avoids both.
  const visibleBuckets = bMax - bMin + 1;
  const targetTicks = Math.max(4, Math.floor(w / TARGET_TICK_PX));
  const bucketStep = Math.max(1, Math.floor(visibleBuckets / targetTicks));

  const candidates = [];
  for (let bIdx = bMin; bIdx <= bMax; bIdx += bucketStep) {
    const bucket = state.buckets[bIdx];
    if (!bucket.nodes.length) continue;
    candidates.push({
      bucketIdx: bIdx,
      year: (bucket.yearMin + bucket.yearMax) / 2,
    });
  }

  // Snap each candidate's year to a nice round step so labels stay readable.
  if (candidates.length >= 2) {
    const yearRange =
      candidates[candidates.length - 1].year - candidates[0].year;
    const step = pickNiceStep(Math.max(1, yearRange / candidates.length));
    for (const c of candidates) {
      c.year = Math.round(c.year / step) * step;
    }
  }

  // Dedupe by year (rounding can collapse adjacent ticks) and by screen-x
  // distance for safety.
  const seenYears = new Set();
  const placed = [];
  for (const c of candidates) {
    if (seenYears.has(c.year)) continue;
    const screenX = tx + xForBucket(c.bucketIdx) * k;
    if (placed.some((p) => Math.abs(p.screenX - screenX) < MIN_TICK_PX)) continue;
    seenYears.add(c.year);
    placed.push({ year: c.year, bucketIdx: c.bucketIdx, screenX });
  }

  const sel = gAxis.selectAll("g.dag-tick").data(placed, (d) => d.year);
  sel.exit().remove();

  const entered = sel.enter().append("g").attr("class", "dag-tick");
  entered
    .append("line")
    .attr("class", "dag-axis-tick")
    .attr("y1", TOP_PAD - 40)
    .attr("y2", state.worldHeight);
  entered
    .append("text")
    .attr("class", "dag-axis-label")
    .text((d) => formatYear(d.year));

  // Pin labels to the top of the viewport when their natural world-y scrolls
  // off-screen, so the year is always readable.
  const ty = state.transform.y;
  const screenTopWorld = -ty / k;
  const labelPadWorld = 30 / k; // 30 screen px below the top edge
  const labelY = Math.max(TOP_PAD - 60, screenTopWorld + labelPadWorld);

  // Position lines + labels for both new and existing ticks (bucketIdx can
  // change between renders as the user pans).
  const all = entered.merge(sel);
  all.select("line.dag-axis-tick")
    .attr("x1", (d) => xForBucket(d.bucketIdx))
    .attr("x2", (d) => xForBucket(d.bucketIdx));
  all.select("text.dag-axis-label").attr(
    "transform",
    (d) => `translate(${xForBucket(d.bucketIdx)}, ${labelY}) rotate(-25)`
  );
}

function initialTransform() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { minX, minY, maxY } = state.bbox;
  // Fit vertically (show all rows + the axis band); let horizontal overflow so
  // the user pans to explore the width.
  const top = minY - (TOP_PAD - 20);
  const pad = 0.04;
  const contentH = (maxY - top) * (1 + pad * 2);
  const k = h / contentH;
  const cy = (top + maxY) / 2;
  // Start the camera at the left edge of the content with a small left margin.
  const leftMargin = 40;
  const tx = leftMargin - (minX - COL_WIDTH / 2) * k;
  const ty = h / 2 - cy * k;
  return d3.zoomIdentity.translate(tx, ty).scale(k);
}

function initialCenter() {
  let transform = null;
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    if (raw) {
      const { x, y, k } = JSON.parse(raw);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(k)) {
        transform = d3.zoomIdentity.translate(x, y).scale(k);
      }
    }
  } catch (e) {
    // Bad JSON / unavailable storage — fall through to computed initial.
  }
  svg.call(zoom.transform, transform || initialTransform());
}

function renderDots() {
  const dots = gDots
    .selectAll("circle.dag-dot")
    .data(state.nodes, (d) => d.id);
  dots
    .enter()
    .append("circle")
    .attr("class", (d) => `dag-dot field-${d.fieldKey}`)
    .attr("data-id", (d) => d.id)
    .attr("cx", (d) => d.x)
    .attr("cy", (d) => d.y)
    .on("mouseenter", onHoverEnter)
    .on("mousemove", onHoverMove)
    .on("mouseleave", onHoverLeave)
    .on("click", onPinClick);
}

function drawLinks() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  ctx.clearRect(0, 0, w, h);
  if (!state.transform) return;

  const { k, x: tx, y: ty } = state.transform;
  ctx.save();
  ctx.setTransform(
    (window.devicePixelRatio || 1) * k,
    0,
    0,
    (window.devicePixelRatio || 1) * k,
    (window.devicePixelRatio || 1) * tx,
    (window.devicePixelRatio || 1) * ty
  );

  // Cull links whose bounding box doesn't intersect the viewport.
  const viewLeft = (-tx) / k;
  const viewTop = (-ty) / k;
  const viewRight = viewLeft + w / k;
  const viewBottom = viewTop + h / k;

  const opacity =
    state.tier === TIER_LABEL ? 0.28 : state.tier === TIER_IMG ? 0.4 : 0.55;
  ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
  ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
  ctx.lineWidth = 1 / k;

  // Pre-collect visible links so we don't iterate twice.
  const visible = [];
  for (const link of state.links) {
    const s = link.source;
    const t = link.target;
    const minX = Math.min(s.x, t.x);
    const maxX = Math.max(s.x, t.x);
    const minY = Math.min(s.y, t.y);
    const maxY = Math.max(s.y, t.y);
    if (maxX < viewLeft || minX > viewRight) continue;
    if (maxY < viewTop || minY > viewBottom) continue;
    visible.push(link);
  }

  // Pass 1: stroke all line segments.
  ctx.beginPath();
  for (const link of visible) {
    ctx.moveTo(link.source.x, link.source.y);
    ctx.lineTo(link.target.x, link.target.y);
  }
  ctx.stroke();

  // Pass 2: filled arrowhead triangles at the target end (predecessor → successor).
  const headLen = 8 / k;
  const headW = 4 / k;
  const minLen = 24 / k; // skip very short links
  ctx.beginPath();
  for (const link of visible) {
    const x1 = link.source.x;
    const y1 = link.source.y;
    const x2 = link.target.x;
    const y2 = link.target.y;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < minLen) continue;
    const ux = dx / len;
    const uy = dy / len;
    const bx = x2 - headLen * ux;
    const by = y2 - headLen * uy;
    const px = -uy;
    const py = ux;
    ctx.moveTo(x2, y2);
    ctx.lineTo(bx + headW * px, by + headW * py);
    ctx.lineTo(bx - headW * px, by - headW * py);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

function visibleCardBounds(margin = 0) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { k, x: tx, y: ty } = state.transform;
  const left = (-tx) / k - margin;
  const top = (-ty) / k - margin;
  const right = left + w / k + margin * 2;
  const bottom = top + h / k + margin * 2;
  return { left, top, right, bottom };
}

function nodesInView(margin = 0) {
  const b = visibleCardBounds(margin);
  const out = [];
  for (const n of state.nodes) {
    const cx = n.x;
    const cy = n.y;
    if (cx < b.left || cx > b.right) continue;
    if (cy < b.top || cy > b.bottom) continue;
    out.push(n);
  }
  return out;
}

function renderLabels(threshold) {
  const visible = nodesInView(cardWidth).filter(
    (n) => n.labelPriority <= threshold
  );
  appendLabels(gLabels, visible);
}

// Show titles for all nodes matching the active search query (anywhere in
// world coords, not just in the viewport). Cleared when no query is active.
function renderSearchLabels() {
  if (!isActiveQuery()) {
    gSearchLabels.selectAll("g.dag-label").remove();
    return;
  }
  const q = state.searchQuery.trim();
  const matches = state.nodes.filter((n) => searchHelper(n, q));
  appendLabels(gSearchLabels, matches);
}

function appendLabels(group, nodes) {
  const sel = group.selectAll("g.dag-label").data(nodes, (d) => d.id);
  sel.exit().remove();
  const entered = sel
    .enter()
    .append("g")
    .attr("class", "dag-label")
    .attr("transform", (d) => `translate(${d.x}, ${d.y + 12})`)
    .style("--label-css-width", (d) => `${d.titleWidthCss + 24}px`)
    .on("click", (event, d) => onPinClick(event, d))
    .on("mouseenter", (event, d) => onHoverEnter(event, d))
    .on("mousemove", onHoverMove)
    .on("mouseleave", (event, d) => onHoverLeave(event, d));
  entered.append("rect").attr("class", "dag-label-bg");
  entered.append("text").attr("class", "dag-label-text").text((d) => d.title);
  entered.style("opacity", 0).transition().duration(TIER_FADE_MS).style("opacity", 1);
}

function renderCards() {
  const visible = nodesInView(cardWidth);
  const sel = gCards.selectAll("g.card").data(visible, (d) => d.id);
  sel.exit()
    .interrupt()
    .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();

  const entered = renderMTGCard(sel.enter())
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
    .on("click", (event, d) => onPinClick(event, d))
    .on("mouseenter", (event, d) => onHoverEnter(event, d))
    .on("mousemove", onHoverMove)
    .on("mouseleave", (event, d) => onHoverLeave(event, d))
    .style("opacity", 0);
  entered.transition().duration(TIER_FADE_MS).style("opacity", 1);

  // Goldenrod glow on cards whose node matches the active search query.
  const q = state.searchQuery.trim();
  const active = isActiveQuery();
  gCards.selectAll("g.card")
    .classed("search-match", (n) => active && searchHelper(n, q));
}

// Returns the per-frame scale that keeps a hover card at least HOVER_MIN_PX
// wide on screen — at zooms above the threshold this collapses to 1.
function hoverScale() {
  const k = state.transform ? state.transform.k : 1;
  return Math.max(1, HOVER_MIN_PX / cardWidth / k);
}

// Hover-card transform: translate to the laid-out world position (or the
// node's original world coords if it isn't in the layout) then counter-scale.
function hoverCardTransform(n) {
  const s = hoverScale();
  const pos = state.hoverLayout.get(n.id) || { x: n.x, y: n.y };
  return `translate(${pos.x}, ${pos.y}) scale(${s})`;
}

// Push (cx,cy) outward along the segment toward (tx,ty) until it touches the
// rect of half-extent (halfW, halfH) centered on (cx,cy). Used to start/end
// hover lines on the card edge instead of its center.
function clipToCardEdge(cx, cy, tx, ty, halfW, halfH) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = Math.abs(dx) > 0 ? halfW / Math.abs(dx) : Infinity;
  const sy = Math.abs(dy) > 0 ? halfH / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy, 1);
  return { x: cx + dx * s, y: cy + dy * s };
}

// Hover layout: cards keep their natural world positions whenever possible
// and only get nudged apart when the (zoom-inflated) bounding boxes would
// overlap. Focused card is pinned. Pairwise iterative resolution along the
// shorter overlap axis converges in <30 iterations for typical neighbor counts.
function computeHoverLayout(focused, layoutNeighbors) {
  const layout = new Map();
  layout.set(focused.id, { x: focused.x, y: focused.y });
  for (const nb of layoutNeighbors) {
    layout.set(nb.node.id, { x: nb.node.x, y: nb.node.y });
  }
  if (!state.transform || layoutNeighbors.length === 0) return layout;

  const s = hoverScale();
  const cardWw = cardWidth * s;
  const cardHw = fullCardHeight * s;
  const gap = Math.min(cardWw, cardHw) * 0.05;
  const minDx = cardWw + gap;
  const minDy = cardHw + gap;
  const ids = [focused.id, ...layoutNeighbors.map((nb) => nb.node.id)];

  for (let iter = 0; iter < 30; iter++) {
    let moved = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = layout.get(ids[i]);
        const b = layout.get(ids[j]);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const overlapX = minDx - Math.abs(dx);
        const overlapY = minDy - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        const aFocused = ids[i] === focused.id;
        const bFocused = ids[j] === focused.id;
        if (overlapX < overlapY) {
          const sign = dx >= 0 ? 1 : -1;
          if (aFocused) b.x += sign * overlapX;
          else if (bFocused) a.x -= sign * overlapX;
          else { a.x -= (sign * overlapX) / 2; b.x += (sign * overlapX) / 2; }
        } else {
          const sign = dy >= 0 ? 1 : -1;
          if (aFocused) b.y += sign * overlapY;
          else if (bFocused) a.y -= sign * overlapY;
          else { a.y -= (sign * overlapY) / 2; b.y += (sign * overlapY) / 2; }
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  return layout;
}

// Re-evaluates the hover state every frame. At LABEL tier the hover starts in
// a "label only" pre-expand state — we hold off creating the heavy hover-card
// + line + chip artifacts until the user has settled on the dot for ~1s.
function updateHoverArtifacts() {
  if (!state.hoverId || !state.transform) return;
  const hovered = state.nodesById[state.hoverId];
  if (!hovered) return;

  // Pre-expand at LABEL tier: just keep the hovered node's sticky label
  // visible. Don't bind any cards or lines yet, and clear anything left over.
  if (!state.hoverExpanded) {
    gHoverCards.selectAll("g.card").interrupt()
      .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();
    gHoverLines.selectAll("line").remove();
    gStickyLabels.selectAll("g.dag-label").style("opacity", 1);
    return;
  }

  const w = window.innerWidth, h = window.innerHeight, pad = 18;
  const { k, x: tx, y: ty } = state.transform;
  const onScreen = (n) => {
    const sx = tx + n.x * k, sy = ty + n.y * k;
    return sx >= pad && sx <= w - pad && sy >= pad && sy <= h - pad;
  };
  const layoutNeighbors = state.hoverNeighbors.filter((nb) => onScreen(nb.node));
  // Anything already shown by the pinned chain is excluded from the hover
  // copies — otherwise hovering a pinned-chain card would render a duplicate
  // on top of the existing pinned card (and same for the lines between them).
  const pinnedDisplayed = new Set(state.pinnedLayout.keys());
  const allHoverNodes = [hovered, ...layoutNeighbors.map((nb) => nb.node)];
  const cardNodes = allHoverNodes.filter((n) => !pinnedDisplayed.has(n.id));

  // Hover-card data binding: enter newly on-screen, exit those that panned/
  // zoomed off — so chips ↔ cards swap automatically as the viewport changes
  // mid-hover.
  const hoverSel = gHoverCards.selectAll("g.card").data(cardNodes, (n) => n.id);
  hoverSel.exit().interrupt()
    .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();
  const enteredHover = renderFullCard(hoverSel.enter())
    .style("opacity", 0)
    .on("mouseenter", (event, n) => onHoverEnter(event, n))
    .on("mouseleave", () => onHoverLeave())
    .on("click", (event, n) => onPinClick(event, n));
  enteredHover.transition().duration(TIER_FADE_MS).style("opacity", 1);
  // Sync pin badges across all hover cards (entered + existing) so a click
  // that pins/unpins flips the badge immediately, not after hover-out.
  syncPinBadges(gHoverCards.selectAll("g.card"));

  // Hover-line data binding: skip any link that's already drawn by gPinnedLines
  // (both endpoints in the pinned set) so we don't stack two lines.
  const related = state.links.filter(
    (l) =>
      (l.source.id === hovered.id || l.target.id === hovered.id) &&
      !(pinnedDisplayed.has(l.source.id) && pinnedDisplayed.has(l.target.id))
  );
  const lineSel = gHoverLines.selectAll("line")
    .data(related, (l) => l.source.id + "->" + l.target.id);
  lineSel.exit().remove();
  lineSel.enter()
    .append("line")
    .attr("class", "highlight")
    .attr("stroke", "goldenrod")
    .attr("marker-end", "url(#hover-arrow)");

  state.hoverLayout = computeHoverLayout(hovered, layoutNeighbors);

  gHoverCards.selectAll("g.card").attr("transform", hoverCardTransform);

  const s = hoverScale();
  const halfW = (cardWidth / 2) * s;
  const halfH = (fullCardHeight / 2) * s;
  const endpointFor = (node) =>
    state.hoverLayout.get(node.id) || { x: node.x, y: node.y };

  // Hold the edge:card screen-size ratio constant across zoom levels (R=1/80).
  // Derivation: edge_screen / card_screen = R → stroke_attr*k / (cardW*s*k)
  //   = R → stroke_attr = R * cardW * s. With R = 3/240, stroke = 3*s.
  // Use .style() not .attr() so the value beats style.css's `line` rule
  // (SVG presentation attributes lose to any CSS selector).
  gHoverLines.selectAll("line")
    .style("stroke-width", 3 * s)
    .each(function (l) {
      const sp = endpointFor(l.source);
      const tp = endpointFor(l.target);
      const a = clipToCardEdge(sp.x, sp.y, tp.x, tp.y, halfW, halfH);
      const b = clipToCardEdge(tp.x, tp.y, sp.x, sp.y, halfW, halfH);
      d3.select(this)
        .attr("x1", a.x).attr("y1", a.y)
        .attr("x2", b.x).attr("y2", b.y);
    });

  // Suppress baseline cards/labels for anything that has a hover OR pinned
  // copy on top — so the duplicates don't show through.
  const expandSet = new Set(state.hoverLayout.keys());
  for (const id of state.pinnedLayout.keys()) expandSet.add(id);
  if (state.tier !== TIER_LABEL) {
    gCards.selectAll("g.card")
      .style("opacity", (n) => (expandSet.has(n.id) ? 0 : 1));
  }
  gStickyLabels.selectAll("g.dag-label")
    .style("opacity", (d) => (expandSet.has(d.id) ? 0 : 1));
}

// Schedules the LABEL-tier hover to expand from "just the label" into the
// full card view after HOVER_EXPAND_DELAY_MS without movement. Resets each
// time the cursor moves, so the card only fires once the cursor settles.
function scheduleHoverExpand() {
  if (hoverExpandTimer) clearTimeout(hoverExpandTimer);
  hoverExpandTimer = setTimeout(() => {
    hoverExpandTimer = null;
    state.hoverExpanded = true;
    updateHoverArtifacts();
    renderOffscreenIndicators();
  }, HOVER_EXPAND_DELAY_MS);
}

function onHoverEnter(event, d) {
  // Cancel any pending hover-leave so a quick traversal from a small dot to the
  // overlapping hover card doesn't tear everything down.
  if (hoverLeaveTimeout) {
    clearTimeout(hoverLeaveTimeout);
    hoverLeaveTimeout = null;
  }

  const sameNode = state.hoverId === d.id;
  state.hoverId = d.id;
  const related = state.links.filter(
    (l) => l.source.id === d.id || l.target.id === d.id
  );

  state.hoverNeighbors = [];
  for (const l of related) {
    if (l.source.id === d.id) {
      state.hoverNeighbors.push({ node: l.target, kind: "child" });
    } else {
      state.hoverNeighbors.push({ node: l.source, kind: "parent" });
    }
  }

  if (state.tier === TIER_LABEL) {
    // Pin this node's label in gStickyLabels so it shows immediately and
    // stays after hover ends. Skip the re-add if it's already pinned.
    if (!sameNode) {
      state.hoverExpanded = false;
      if (!state.stickyLabels.some((n) => n.id === d.id)) {
        state.stickyLabels.push(d);
        appendLabels(gStickyLabels, state.stickyLabels);
      }
    }
    scheduleHoverExpand();
  } else {
    state.hoverExpanded = true;
  }

  updateHoverArtifacts();
  renderOffscreenIndicators();
}

function onHoverMove() {
  // Any movement before the card has appeared resets the timer so the user
  // can scan dots without firing the heavier expand each time.
  if (state.tier === TIER_LABEL && state.hoverId && !state.hoverExpanded) {
    scheduleHoverExpand();
  }
}

function onHoverLeave() {
  // Cancel any pending pre-expand timer; a hover that just barely happened
  // shouldn't pop a card open after the cursor has already left.
  if (hoverExpandTimer) {
    clearTimeout(hoverExpandTimer);
    hoverExpandTimer = null;
  }
  // Debounce: cursor moving from a small dot/label onto the overlapping hover
  // card briefly leaves the original element before mouseenter fires on the
  // card. The hover-card's mouseenter cancels this pending teardown.
  if (hoverLeaveTimeout) clearTimeout(hoverLeaveTimeout);
  hoverLeaveTimeout = setTimeout(() => {
    hoverLeaveTimeout = null;
    state.hoverId = null;
    state.hoverNeighbors = [];
    state.hoverLayout = new Map();
    state.hoverExpanded = false;
    gHoverLines.selectAll("line").remove();
    gHoverCards.selectAll("*").interrupt()
      .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();
    // Keep pinned cards' baseline copies hidden — only the hover-only
    // suppressions revert to opacity 1.
    const pinnedSet = new Set(state.pinnedLayout.keys());
    gCards.selectAll("g.card")
      .interrupt()
      .transition().duration(TIER_FADE_MS)
      .style("opacity", (n) => (pinnedSet.has(n.id) ? 0 : 1));
    gStickyLabels.selectAll("g.dag-label")
      .style("opacity", (d) => (pinnedSet.has(d.id) ? 0 : 1));
    // Only remove hover chips; pinned chips persist.
    offscreenContainer
      .querySelectorAll(".offscreen-indicator:not(.pinned)")
      .forEach((el) => el.remove());
  }, 50);
}

// Returns the on-viewport intersection point of the segment from inside-point
// (hx, hy) to outside-point (nx, ny). `pad` is an inset so the chip doesn't
// sit exactly on the screen edge. Returns null if no valid intersection.
function lineRectIntersection(hx, hy, nx, ny, w, h, pad) {
  const dx = nx - hx;
  const dy = ny - hy;
  const tValues = [];
  if (dx !== 0) {
    tValues.push((pad - hx) / dx); // left edge
    tValues.push((w - pad - hx) / dx); // right edge
  }
  if (dy !== 0) {
    tValues.push((pad - hy) / dy); // top edge
    tValues.push((h - pad - hy) / dy); // bottom edge
  }
  let bestT = Infinity;
  for (const t of tValues) {
    if (t <= 0 || t > 1) continue;
    const x = hx + t * dx;
    const y = hy + t * dy;
    if (x < pad - 0.5 || x > w - pad + 0.5) continue;
    if (y < pad - 0.5 || y > h - pad + 0.5) continue;
    if (t < bestT) bestT = t;
  }
  if (!isFinite(bestT)) return null;
  return { x: hx + bestT * dx, y: hy + bestT * dy };
}

function renderOffscreenIndicators() {
  // Only clear hover chips — pinned chips live in the same container and have
  // their own lifecycle in renderPinnedOffscreenIndicators.
  offscreenContainer
    .querySelectorAll(".offscreen-indicator:not(.pinned)")
    .forEach((el) => el.remove());
  if (!state.hoverId || !state.transform) return;
  const hovered = state.nodesById[state.hoverId];
  if (!hovered) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const pad = 18;
  const { k, x: tx, y: ty } = state.transform;
  const hx = tx + hovered.x * k;
  const hy = ty + hovered.y * k;

  for (const { node, kind } of state.hoverNeighbors) {
    const nx = tx + node.x * k;
    const ny = ty + node.y * k;
    const onScreen =
      nx >= pad && nx <= w - pad && ny >= pad && ny <= h - pad;
    if (onScreen) continue;
    const exit = lineRectIntersection(hx, hy, nx, ny, w, h, pad);
    if (!exit) continue;

    // Anchor the chip to the *inside* of whichever screen edge it sits on so
    // its full text stays on-screen instead of extending past the edge.
    let ax = -50, ay = -50;
    const eps = 1;
    if (Math.abs(exit.x - pad) < eps) ax = 0;
    else if (Math.abs(exit.x - (w - pad)) < eps) ax = -100;
    if (Math.abs(exit.y - pad) < eps) ay = 0;
    else if (Math.abs(exit.y - (h - pad)) < eps) ay = -100;

    const chip = document.createElement("button");
    chip.className = `offscreen-indicator ${kind}`;
    chip.style.left = `${exit.x}px`;
    chip.style.top = `${exit.y}px`;
    chip.style.transform = `translate(${ax}%, ${ay}%)`;
    chip.title = node.title;
    chip.innerHTML = `<span class="label">${escapeHtml(node.title)}</span>`;
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onPinClick(e, node);
    });
    offscreenContainer.appendChild(chip);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// Walk state.links transitively in one direction. "up" follows links where
// target.id === current.id (so the source is a parent); "down" follows links
// where source.id === current.id (so the target is a child).
// Pin = "remember the current hover" — so the chain is just the root's direct
// neighbors (same set hover uses), not the transitive ancestor/descendant
// closure. Otherwise pinning Steel pulls in 150 cards and pinning Fire pulls
// in nearly the entire graph.
function computePinnedChain(rootNode) {
  const out = [];
  for (const l of state.links) {
    if (l.source.id === rootNode.id) {
      out.push({ node: l.target, kind: "child" });
    } else if (l.target.id === rootNode.id) {
      out.push({ node: l.source, kind: "parent" });
    }
  }
  return out;
}

// "primary" = the actively pinned root (blue badge);
// "secondary" = a direct neighbor of the primary (green badge);
// null = not pinned. Click semantics: primary → unpin, secondary → re-pin
// with that node as the new primary, none → pin.
function pinKind(id) {
  if (state.pinnedId === id) return "primary";
  for (const nb of state.pinnedChain) if (nb.node.id === id) return "secondary";
  return null;
}

function isPinned(id) {
  return pinKind(id) !== null;
}

function onPinClick(event, d) {
  event.preventDefault();
  event.stopPropagation();
  // Primary → unpin everything. Secondary or unpinned → pin this node as the
  // new primary (which automatically demotes the previous primary).
  if (pinKind(d.id) === "primary") {
    unpin();
  } else {
    pin(d);
  }
}

function pin(rootNode) {
  // "Pin new" replaces any existing pin in one shot — clear first so
  // updatePinnedArtifacts re-binds against an empty selection.
  if (state.pinnedId) clearPinnedDom();
  state.pinnedId = rootNode.id;
  state.pinnedChain = computePinnedChain(rootNode);
  state.pinnedLayout = new Map();
  updatePinnedArtifacts();
  renderPinnedOffscreenIndicators();
  // If the click happened on a hover card, refresh hover cards so the pin
  // badge flips on/off without waiting for hover-out.
  if (state.hoverId) updateHoverArtifacts();
}

function unpin() {
  state.pinnedId = null;
  state.pinnedChain = [];
  state.pinnedLayout = new Map();
  clearPinnedDom();
  // The baseline cards/labels for ex-pinned nodes were hidden — restore them.
  // Hover (if any) re-runs and will re-suppress whatever it needs.
  gCards.selectAll("g.card").style("opacity", 1);
  gStickyLabels.selectAll("g.dag-label").style("opacity", 1);
  if (state.hoverId) updateHoverArtifacts();
}

function clearPinnedDom() {
  gPinnedCards.selectAll("*").remove();
  gPinnedLines.selectAll("*").remove();
  offscreenContainer
    .querySelectorAll(".offscreen-indicator.pinned")
    .forEach((el) => el.remove());
}

function pinnedCardTransform(n) {
  const s = hoverScale();
  const pos = state.pinnedLayout.get(n.id) || { x: n.x, y: n.y };
  return `translate(${pos.x}, ${pos.y}) scale(${s})`;
}

// Top-left blue pin glyph appended to each pinned full card. The card-inner
// group is translated by (-W/2, -H/2) in renderFullCard, so (8, 8) sits inside
// the title bar mirroring the field icon on the right.
const PRIMARY_PIN_COLOR = "steelblue";
const SECONDARY_PIN_COLOR = "#2a9d8f";

function appendPinBadge(cardSel) {
  const g = cardSel
    .select("g.card-inner")
    .append("g")
    .attr("class", "pin-badge")
    .attr("transform", "translate(8, 8)")
    .attr("pointer-events", "none");
  g.append("circle")
    .attr("r", 6)
    .attr("fill", (d) =>
      pinKind(d.id) === "primary" ? PRIMARY_PIN_COLOR : SECONDARY_PIN_COLOR
    )
    .attr("stroke", "white")
    .attr("stroke-width", 1);
  g.append("circle").attr("r", 1.8).attr("fill", "white");
}

// Keep pin badges in sync with the live pinned state on an arbitrary card
// selection — strip whatever's there and re-add only on currently pinned
// nodes. Used after pin/unpin so the visual flips while the user is still
// hovering the card.
function syncPinBadges(cardSel) {
  cardSel.select("g.pin-badge").remove();
  appendPinBadge(cardSel.filter((n) => isPinned(n.id)));
}

function updatePinnedArtifacts() {
  if (!state.pinnedId || !state.transform) return;
  const root = state.nodesById[state.pinnedId];
  if (!root) return;

  const w = window.innerWidth, h = window.innerHeight, pad = 18;
  const { k, x: tx, y: ty } = state.transform;
  const onScreen = (n) => {
    const sx = tx + n.x * k, sy = ty + n.y * k;
    return sx >= pad && sx <= w - pad && sy >= pad && sy <= h - pad;
  };

  // Both the root and the chain members get the same treatment: render as a
  // full card if on-screen, render as an offscreen chip otherwise.
  const layoutNeighbors = state.pinnedChain.filter((nb) => onScreen(nb.node));
  const cardNodes = onScreen(root)
    ? [root, ...layoutNeighbors.map((nb) => nb.node)]
    : layoutNeighbors.map((nb) => nb.node);

  const sel = gPinnedCards.selectAll("g.card").data(cardNodes, (n) => n.id);
  sel.exit().remove();
  renderFullCard(sel.enter())
    .on("mouseenter", (event, n) => onHoverEnter(event, n))
    .on("mouseleave", () => onHoverLeave())
    .on("click", (event, n) => onPinClick(event, n));
  // Sync (not append) so re-pinning a secondary recolors the existing badges
  // instead of stacking new ones.
  syncPinBadges(gPinnedCards.selectAll("g.card"));

  // Lines: any link both of whose endpoints are in the pinned set (root +
  // chain), regardless of whether they're on screen — same data model as hover.
  const pinnedIds = new Set([root.id, ...state.pinnedChain.map((nb) => nb.node.id)]);
  const related = state.links.filter(
    (l) => pinnedIds.has(l.source.id) && pinnedIds.has(l.target.id)
  );
  const lineSel = gPinnedLines.selectAll("line")
    .data(related, (l) => l.source.id + "->" + l.target.id);
  lineSel.exit().remove();
  lineSel.enter()
    .append("line")
    .attr("class", "highlight pinned")
    .attr("stroke", "steelblue")
    .attr("marker-end", "url(#pinned-arrow)");

  // Layout reuse: feed only on-screen neighbors so off-screen ones don't
  // distort the resolver. Off-screen members are represented by chips.
  state.pinnedLayout = computeHoverLayout(root, layoutNeighbors);

  gPinnedCards.selectAll("g.card").attr("transform", pinnedCardTransform);

  const s = hoverScale();
  const halfW = (cardWidth / 2) * s;
  const halfH = (fullCardHeight / 2) * s;
  const endpointFor = (node) =>
    state.pinnedLayout.get(node.id) || { x: node.x, y: node.y };

  gPinnedLines.selectAll("line")
    .style("stroke-width", 3 * s)
    .each(function (l) {
      const sp = endpointFor(l.source);
      const tp = endpointFor(l.target);
      const a = clipToCardEdge(sp.x, sp.y, tp.x, tp.y, halfW, halfH);
      const b = clipToCardEdge(tp.x, tp.y, sp.x, sp.y, halfW, halfH);
      d3.select(this)
        .attr("x1", a.x).attr("y1", a.y)
        .attr("x2", b.x).attr("y2", b.y);
    });

  // Hide baseline copies of pinned nodes so the pinned full card isn't
  // shadowed by a smaller one underneath. updateHoverArtifacts unions the same
  // sets when a hover is also active.
  if (!state.hoverId) {
    const expandSet = new Set(state.pinnedLayout.keys());
    if (state.tier !== TIER_LABEL) {
      gCards.selectAll("g.card")
        .style("opacity", (n) => (expandSet.has(n.id) ? 0 : 1));
    }
    gStickyLabels.selectAll("g.dag-label")
      .style("opacity", (d) => (expandSet.has(d.id) ? 0 : 1));
  }
}

function renderPinnedOffscreenIndicators() {
  // Clear pinned chips only — hover chips have their own lifecycle.
  offscreenContainer
    .querySelectorAll(".offscreen-indicator.pinned")
    .forEach((el) => el.remove());
  if (!state.pinnedId || !state.transform) return;
  const root = state.nodesById[state.pinnedId];
  if (!root) return;

  const w = window.innerWidth;
  const h = window.innerHeight;
  const pad = 18;
  const { k, x: tx, y: ty } = state.transform;
  // Anchor offscreen chips to the root's screen position; if the root itself
  // is off-screen we fall back to the viewport center so chips still resolve.
  const rootOnScreen =
    tx + root.x * k >= pad && tx + root.x * k <= w - pad &&
    ty + root.y * k >= pad && ty + root.y * k <= h - pad;
  const hx = rootOnScreen ? tx + root.x * k : w / 2;
  const hy = rootOnScreen ? ty + root.y * k : h / 2;

  // Include the root in the chip set when it has panned off-screen — the user
  // needs a way to find their way back to it (and to unpin via its chip).
  const candidates = rootOnScreen
    ? state.pinnedChain
    : [{ node: root, kind: "root" }, ...state.pinnedChain];

  for (const { node, kind } of candidates) {
    const nx = tx + node.x * k;
    const ny = ty + node.y * k;
    const onScreen =
      nx >= pad && nx <= w - pad && ny >= pad && ny <= h - pad;
    if (onScreen) continue;
    const exit = lineRectIntersection(hx, hy, nx, ny, w, h, pad);
    if (!exit) continue;

    let ax = -50, ay = -50;
    const eps = 1;
    if (Math.abs(exit.x - pad) < eps) ax = 0;
    else if (Math.abs(exit.x - (w - pad)) < eps) ax = -100;
    if (Math.abs(exit.y - pad) < eps) ay = 0;
    else if (Math.abs(exit.y - (h - pad)) < eps) ay = -100;

    // The root candidate (kind="root") is the active primary; chain members
    // (kind="parent"|"child") are secondaries the user can promote by click.
    const pinClass = kind === "root" ? "primary" : "secondary";
    const chip = document.createElement("button");
    chip.className = `offscreen-indicator pinned ${pinClass} ${kind}`;
    chip.style.left = `${exit.x}px`;
    chip.style.top = `${exit.y}px`;
    chip.style.transform = `translate(${ax}%, ${ay}%)`;
    chip.title = node.title;
    chip.innerHTML = `<span class="label">${escapeHtml(node.title)}</span>`;
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (pinClass === "primary") {
        unpin();
      } else {
        pin(node);
      }
    });
    offscreenContainer.appendChild(chip);
  }
}

// Cmd+F / Ctrl+F search overlay.
const searchInput = document.getElementById("search-input");
window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "f") {
    e.preventDefault();
    document.body.classList.add("searching");
    searchInput.focus();
    searchInput.select();
  }
});
searchInput.addEventListener("input", () => {
  state.searchQuery = searchInput.value;
  scheduleRedraw();
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    state.searchQuery = "";
    searchInput.value = "";
    document.body.classList.remove("searching");
    searchInput.blur();
    scheduleRedraw();
  }
});

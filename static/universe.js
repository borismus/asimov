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
  nodesById: {},
};

// Debounce hover-leave so a quick cursor transition from a small dot/label onto
// the (much larger) hover card doesn't tear the card down before the card
// itself reports mouseenter. 50ms is enough for the next mouseenter to fire on
// the overlapping hover-card group.
let hoverLeaveTimeout = null;

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
svg
  .append("defs")
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

const gRoot = svg.append("g").attr("class", "world");
const gAxis = gRoot.append("g").attr("class", "axis");
const gDots = gRoot.append("g").attr("class", "dots");
const gLabels = gRoot.append("g").attr("class", "labels");
const gCards = gRoot.append("g").attr("class", "cards");
// Hover lines render between baseline cards (below) and the hover-expanded
// versions (above), so a hovered card sits over its outgoing/incoming arrows
// while non-hovered cards stay beneath them.
const gHoverLines = gRoot.append("g").attr("class", "hover-lines");
const gHoverCards = gRoot.append("g").attr("class", "hover-cards");
const gHoverLabels = gRoot.append("g").attr("class", "hover-labels");

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
    .on("mouseleave", onHoverLeave)
    .on("click", onClick);
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

function appendLabels(group, nodes) {
  const sel = group.selectAll("g.dag-label").data(nodes, (d) => d.id);
  sel.exit().remove();
  const entered = sel
    .enter()
    .append("g")
    .attr("class", "dag-label")
    .attr("transform", (d) => `translate(${d.x}, ${d.y + 12})`)
    .style("--label-css-width", (d) => `${d.titleWidthCss + 24}px`)
    .on("click", (event, d) => onClick(event, d))
    .on("mouseenter", (event, d) => onHoverEnter(event, d))
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
    .on("click", (event, d) => onClick(event, d))
    .on("mouseenter", (event, d) => onHoverEnter(event, d))
    .on("mouseleave", (event, d) => onHoverLeave(event, d))
    .style("opacity", 0);
  entered.transition().duration(TIER_FADE_MS).style("opacity", 1);
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

// Re-evaluates the hover state every frame: which neighbors are on screen,
// how the cards lay out, and where the lines connect. This is the single
// source of truth for the hover view, so cards "expand" into existence as
// they pan/zoom into view (and collapse to chips when they leave).
function updateHoverArtifacts() {
  if (!state.hoverId || !state.transform) return;
  const hovered = state.nodesById[state.hoverId];
  if (!hovered) return;

  const w = window.innerWidth, h = window.innerHeight, pad = 18;
  const { k, x: tx, y: ty } = state.transform;
  const onScreen = (n) => {
    const sx = tx + n.x * k, sy = ty + n.y * k;
    return sx >= pad && sx <= w - pad && sy >= pad && sy <= h - pad;
  };
  const layoutNeighbors = state.hoverNeighbors.filter((nb) => onScreen(nb.node));
  const expandNodes = [hovered, ...layoutNeighbors.map((nb) => nb.node)];

  // Update hover-card data binding: enter newly on-screen, exit those that
  // panned/zoomed off — so chips ↔ cards swap automatically as the viewport
  // changes mid-hover.
  const hoverSel = gHoverCards.selectAll("g.card").data(expandNodes, (n) => n.id);
  hoverSel.exit().interrupt()
    .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();
  renderFullCard(hoverSel.enter())
    .style("opacity", 0)
    .on("mouseenter", (event, n) => onHoverEnter(event, n))
    .on("mouseleave", () => onHoverLeave())
    .on("click", (event, n) => onClick(event, n))
    .transition().duration(TIER_FADE_MS).style("opacity", 1);

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

  if (state.tier !== TIER_LABEL) {
    const expandSet = new Set(state.hoverLayout.keys());
    gCards.selectAll("g.card")
      .style("opacity", (n) => (expandSet.has(n.id) ? 0 : 1));
  }
}

function onHoverEnter(event, d) {
  // Cancel any pending hover-leave so a quick traversal from a small dot to the
  // overlapping hover card doesn't tear everything down.
  if (hoverLeaveTimeout) {
    clearTimeout(hoverLeaveTimeout);
    hoverLeaveTimeout = null;
  }

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

  // Build line elements (positions get set in updateHoverArtifacts below).
  const lineSel = gHoverLines.selectAll("line")
    .data(related, (l) => l.source.id + "->" + l.target.id);
  lineSel.exit().remove();
  lineSel.enter()
    .append("line")
    .attr("class", "highlight")
    .attr("stroke", "goldenrod")
    .attr("marker-end", "url(#hover-arrow)");

  updateHoverArtifacts();
  renderOffscreenIndicators();
}

function onHoverLeave() {
  // Debounce: cursor moving from a small dot/label onto the overlapping hover
  // card briefly leaves the original element before mouseenter fires on the
  // card. The hover-card's mouseenter cancels this pending teardown.
  if (hoverLeaveTimeout) clearTimeout(hoverLeaveTimeout);
  hoverLeaveTimeout = setTimeout(() => {
    hoverLeaveTimeout = null;
    state.hoverId = null;
    state.hoverNeighbors = [];
    state.hoverLayout = new Map();
    gHoverLines.selectAll("line").remove();
    gHoverLabels.selectAll("*").remove();
    gHoverCards.selectAll("*").interrupt()
      .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();
    gCards.selectAll("g.card")
      .interrupt()
      .transition().duration(TIER_FADE_MS)
      .style("opacity", 1);
    offscreenContainer.replaceChildren();
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
  offscreenContainer.replaceChildren();
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
      zoomToCard(node);
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

function onClick(event, d) {
  event.preventDefault();
  event.stopPropagation();
  zoomToCard(d);
}

function zoomToCard(d) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const k = 1.6;
  const cx = d.x;
  const cy = d.y;
  const target = d3.zoomIdentity
    .translate(w / 2 - cx * k, h / 2 - cy * k)
    .scale(k);
  svg.transition().duration(750).call(zoom.transform, target);
}

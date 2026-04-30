// World rendering: node positioning, axis ticks, dots, link strokes, and
// viewport culling. Shares state + a few d3 selections with universe.js, set
// once at boot via initWorld().

import { formatField, formatYear } from "./utils.js";
import { cardWidth, cardHeight } from "./card.js";

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
export const COL_WIDTH = cardWidth + 280;
export const ROW_STRIDE = cardHeight + 150;
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

let state, gAxis, gDots, ctx, handlers, TIER_LABEL;

export function initWorld(deps) {
  ({ state, gAxis, gDots, ctx, handlers, TIER_LABEL } = deps);
}

// Aim for ~LABEL_DENSITY labels visible at any zoom. Cards-in-viewport scales
// as (window / k)² / worldArea, so the per-label probability scales as k².
export function labelThreshold(k) {
  if (!state.bbox) return 0;
  const screenArea = window.innerWidth * window.innerHeight;
  const { minX, maxX, minY, maxY } = state.bbox;
  const worldArea = (maxX - minX) * (maxY - minY);
  const t =
    (LABEL_DENSITY * worldArea * k * k) / (state.nodes.length * screenArea);
  return Math.min(1, Math.max(0, t));
}

function hashUnit(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

function xForBucket(bucketIdx) {
  return LEFT_PAD + bucketIdx * COL_WIDTH + COL_WIDTH / 2;
}

export function layout() {
  const nodes = state.nodes;
  const N = nodes.length;
  state.maxYear = d3.max(nodes, (n) => n.year);
  state.minYear = d3.min(nodes, (n) => n.year);

  for (const n of nodes) {
    const key = formatField(n.field);
    n.fieldKey = KNOWN_FIELDS.has(key) ? key : "general";
    // Stable random priority in [0, 1]; renderLabels filters by labelThreshold.
    n.labelPriority = (hashUnit(n.id + "label") + 1) / 2;
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

export function renderAxis() {
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
  // distance for safety. worldX = xForBucket(bucketIdx) is cached on each
  // placed entry so the header label can be re-projected synchronously
  // in onZoom (no rAF lag when the SVG transform updates live but the
  // labels' left would otherwise wait for renderAxis to run).
  const seenYears = new Set();
  const placed = [];
  for (const c of candidates) {
    if (seenYears.has(c.year)) continue;
    const worldX = xForBucket(c.bucketIdx);
    const screenX = tx + worldX * k;
    if (placed.some((p) => Math.abs(p.screenX - screenX) < MIN_TICK_PX)) continue;
    seenYears.add(c.year);
    placed.push({ year: c.year, bucketIdx: c.bucketIdx, worldX, screenX });
  }

  const sel = gAxis.selectAll("g.dag-tick").data(placed, (d) => d.year);
  sel.exit().remove();

  // Only the dashed line lives in the SVG — the year label is drawn in
  // the page header (handlers.onAxisRendered) so it can stay above the
  // SVG region with crisp HTML rendering, and so it never gets clipped
  // by the header backdrop.
  const entered = sel.enter().append("g").attr("class", "dag-tick");
  entered
    .append("line")
    .attr("class", "dag-axis-tick")
    .attr("y2", state.worldHeight);

  // Pin the dashed-line top just below the site header so it appears to
  // descend from the year label in the header.
  const ty = state.transform.y;
  const headerH = state.headerHeight || 0;
  const screenTopWorld = (-ty + headerH) / k;
  const lineTopY = screenTopWorld;

  const all = entered.merge(sel);
  all.select("line.dag-axis-tick")
    .attr("x1", (d) => xForBucket(d.bucketIdx))
    .attr("x2", (d) => xForBucket(d.bucketIdx))
    .attr("y1", lineTopY);

  // Hand off to whoever's painting the matching year labels in the
  // header. screenX is already computed above (per-tick); pass it on
  // so the label can sit directly above the dashed line.
  if (handlers && handlers.onAxisRendered) {
    handlers.onAxisRendered(placed);
  }
}

export function renderDots() {
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
    .on("mouseenter", handlers.onHoverEnter)
    .on("mousemove", handlers.onHoverMove)
    .on("mouseleave", handlers.onHoverLeave)
    .on("click", handlers.onPinClick);
}

export function drawLinks() {
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

  const opacity = state.tier === TIER_LABEL ? 0.28 : 0.55;
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

export function nodesInView(margin = 0) {
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

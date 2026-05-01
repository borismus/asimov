import { loadGraph, formatYear } from "./utils.js";
import {
  cardWidth,
  cardHeight,
  fullCardHeight,
  cardScreenScale,
  cardFixedZoom,
  renderFullCard,
  foldPanelTransform,
  foldContainerHeight,
  foldClipHeight,
  foldInnerY,
} from "./card.js";

// Push the screen-size multiplier and the fixed-size zoom cap into CSS
// so card.css's card-scaler can read them. card-scaler counter-scales
// content by --card-screen-scale / min(--zoom, --card-fixed-zoom) — so
// below the cap, cards stay constant size; above it, they grow with k.
document.documentElement.style.setProperty("--card-screen-scale", cardScreenScale);
document.documentElement.style.setProperty("--card-fixed-zoom", cardFixedZoom);
import {
  initWorld,
  layout,
  renderAxis,
  renderDots,
  drawLinks,
  nodesInView,
  labelThreshold,
  COL_WIDTH,
  ROW_STRIDE,
} from "./world.js";
import {
  initOverlays,
  onHoverEnter,
  onHoverMove,
  onHoverLeave,
  onPinClick,
  updateHoverArtifacts,
  updatePinnedArtifacts,
  renderOffscreenIndicators,
  renderPinnedOffscreenIndicators,
  pin,
  unpin,
  panToNode,
  escapeHtml,
} from "./overlays.js";
import { searchHelper } from "./search.js";
import { parsePathPin, pushPath } from "./routing.js";

const TIER_LABEL = 0;
const TIER_IMG = 1;
const TIER_FULL = 2;
const TIER_FADE_MS = 200;
const TIER_HOLD_MS = 300;
const FOLD_MS = 140;

// Minimum query length before search starts matching — prevents thousands of
// labels lighting up while the user is still typing the first few characters.
const MIN_SEARCH_CHARS = 3;
// Off-screen search-result pills are capped before collapsing into "+N more".
const MAX_SEARCH_PILLS = 24;

// LABEL = density-controlled text labels; IMG = folded MTG card (image+title
// only); FULL = full MTG card with body text + inventor + footer.
//
// Thresholds are tied to on-screen font sizes. Labels use
// `font-size: calc(13px / var(--zoom))` (universe.css), so after the SVG
// zoom transform their screen size is a constant 13px. Card title text is
// `font-size: 13` in card-local coords with no inverse-zoom compensation, so
// its screen size is 13·k. The LABEL→IMG handoff is therefore at k=1.0,
// where the card title matches the label exactly. Body text on cards is
// `font-size: 9` so its screen size is 9·k; we hold off on the FULL tier
// until k=1.5 so body text reads at ≥13.5px before it appears.
function tierFor(k) {
  if (k < 1.0) return TIER_LABEL;
  if (k < 1.5) return TIER_IMG;
  return TIER_FULL;
}

function foldForTier(tier) {
  return tier === TIER_FULL ? 1 : 0;
}

// Read the current fold value (0..1) off a card's DOM. Lets a new tween
// pick up smoothly from wherever a previous (interrupted) tween left off.
const PANEL_SLIDE = fullCardHeight - (cardHeight - 20 /* approx imageBottomY */);
function readCurrentFold(cardEl) {
  const panel = cardEl.querySelector("g.fold-panel");
  if (!panel) return 1;
  const t = panel.getAttribute("transform") || "";
  const m = /translate\(\s*0\s*,\s*(-?\d*\.?\d+)\s*\)/.exec(t);
  if (!m) return 1;
  // foldPanelTransform(sy) = translate(0, -(1-sy)*PANEL_SLIDE) → sy = 1 + ty/SLIDE
  const ty = parseFloat(m[1]);
  const slide = PANEL_SLIDE > 0 ? PANEL_SLIDE : 1;
  return Math.max(0, Math.min(1, 1 + ty / slide));
}

// Animate a selection of cards from their current fold state to `toFold`.
// Tweens the four fold-driven attributes that the card-rendering helpers
// compute so the body+footer panel slides up behind the image as fold goes
// 1→0 (and back as it goes 0→1). Reading from the DOM means an
// interruption (re-hover, tier-flip mid-fold) resumes from the current
// pose instead of snapping back to the start.
function tweenFold(cardSel, toFold) {
  return cardSel.transition("fold")
    .duration(FOLD_MS)
    .ease(d3.easeCubicInOut)
    .tween("fold", function () {
      const inner = this.querySelector(".card-inner");
      const container = this.querySelector("rect.container");
      const clipRect = this.querySelector("clipPath > rect");
      const panel = this.querySelector("g.fold-panel");
      if (!inner || !container || !clipRect || !panel) return () => {};
      const fromFold = readCurrentFold(this);
      return (t) => {
        const sy = fromFold + (toFold - fromFold) * t;
        inner.setAttribute("transform", `translate(${-cardWidth / 2}, ${foldInnerY(sy)})`);
        container.setAttribute("height", foldContainerHeight(sy));
        clipRect.setAttribute("height", foldClipHeight(sy));
        panel.setAttribute("transform", foldPanelTransform(sy));
        panel.style.opacity = sy;
      };
    });
}

const state = {
  nodes: [],
  links: [],
  worldWidth: 0,
  worldHeight: 0,
  transform: null,
  tier: TIER_LABEL,
  // Timestamp (performance.now) before which card rendering is suppressed
  // after a LABEL → IMG transition, so the labels-fade and cards-fade
  // don't collide in the same frame.
  cardsHiddenUntil: 0,
  rafPending: false,
  hoverId: null,
  hoverNeighbors: [],
  hoverLayout: new Map(),
  // hoverExpanded gates whether hover cards exist at all (always true now once
  // a hover starts). hoverFoldOpen gates whether they're at fold=0 (image-only)
  // or fold=1 (full): LABEL tier hover starts folded then opens after a linger
  // delay; IMG tier hover starts folded then opens on the next frame; FULL
  // tier hover opens immediately.
  hoverExpanded: false,
  hoverFoldOpen: false,
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

function isActiveQuery() {
  return state.searchQuery.trim().length >= MIN_SEARCH_CHARS;
}

// Suppresses the default card fade-in on the renderCards() right after a
// tier change, so LABEL → FULL feels instant.
let pendingNoFade = false;

// True until the very first scheduleRedraw resolves the initial transform's
// tier. Skips the LABEL → IMG hold on initial load so users land directly
// on the right view (instead of waiting 300ms for cards to appear).
let firstTierResolve = true;

const canvas = document.getElementById("links-canvas");
const ctx = canvas.getContext("2d");
const offscreenContainer = document.getElementById("offscreen-indicators");
const searchResultsContainer = document.getElementById("search-results");

const container = d3.select("#container");
const svg = container
  .append("svg")
  .attr("width", window.innerWidth)
  .attr("height", window.innerHeight);

const defs = svg.append("defs");
const addArrow = (id, fill) =>
  defs.append("marker")
    .attr("id", id)
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 9).attr("refY", 5)
    .attr("markerWidth", 4).attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path").attr("d", "M0,0 L10,5 L0,10 Z").attr("fill", fill);
addArrow("hover-arrow", "goldenrod");
addArrow("pinned-arrow", "steelblue");

// Layer order matters: hover overlays paint over pinned, which paints over
// baseline cards/labels/dots.
const gRoot = svg.append("g").attr("class", "world");
const gAxis = gRoot.append("g").attr("class", "axis");
const gDots = gRoot.append("g").attr("class", "dots");
const gLabels = gRoot.append("g").attr("class", "labels");
const gStickyLabels = gRoot.append("g").attr("class", "sticky-labels");
const gSearchLabels = gRoot.append("g").attr("class", "search-labels");
const gCards = gRoot.append("g").attr("class", "cards");
const gPinnedLines = gRoot.append("g").attr("class", "pinned-lines");
const gPinnedCards = gRoot.append("g").attr("class", "pinned-cards");
const gHoverLines = gRoot.append("g").attr("class", "hover-lines");
const gHoverCards = gRoot.append("g").attr("class", "hover-cards");

const zoom = d3
  .zoom()
  .scaleExtent([0.02, 3])
  .on("zoom", onZoom);

svg.call(zoom);

const VIEW_STORAGE_KEY = "universe-view";
let saveViewTimeout = null;

// Path is the source of truth for the pinned invention: /<id>/ pins that node.
// Hash carries view state (x/y/k) only; localStorage backs both up between visits.

function serializeViewHash() {
  const t = state.transform;
  if (!t) return "";
  return [
    `x=${t.x.toFixed(2)}`,
    `y=${t.y.toFixed(2)}`,
    `k=${t.k.toFixed(4)}`,
  ].join("&");
}

function parseViewHash(hash) {
  if (!hash || hash.length <= 1) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const x = parseFloat(params.get("x"));
  const y = parseFloat(params.get("y"));
  const k = parseFloat(params.get("k"));
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(k)) return null;
  return { x, y, k };
}

// replaceState (not pushState) so the back button doesn't track every wheel tick.
function persistView() {
  if (saveViewTimeout) clearTimeout(saveViewTimeout);
  saveViewTimeout = setTimeout(() => {
    saveViewTimeout = null;
    const hash = serializeViewHash();
    try {
      const target = window.location.pathname + (hash ? `#${hash}` : "");
      history.replaceState(null, "", target);
    } catch (e) {}
    try {
      const t = state.transform;
      if (t) {
        localStorage.setItem(
          VIEW_STORAGE_KEY,
          JSON.stringify({ x: t.x, y: t.y, k: t.k, pinnedId: state.pinnedId })
        );
      }
    } catch (e) {}
  }, 200);
}

// pushState (not replaceState) so back/forward navigates between pinned inventions.
function persistPin() {
  pushPath(state.pinnedId ? `/${state.pinnedId}` : "/");
}

initWorld({
  state,
  gAxis,
  gDots,
  ctx,
  handlers: {
    onHoverEnter,
    onHoverMove,
    onHoverLeave,
    onPinClick,
    onAxisRendered: renderHeaderAxisLabels,
  },
  TIER_LABEL,
});

initOverlays({
  state,
  gCards,
  gHoverCards,
  gHoverLines,
  gPinnedCards,
  gPinnedLines,
  gStickyLabels,
  offscreenContainer,
  svg,
  zoom,
  persistView,
  persistPin,
  tweenFold,
  appendLabels,
  TIER_LABEL,
  TIER_IMG,
  TIER_FULL,
  TIER_FADE_MS,
});

function onZoom({ transform }) {
  state.transform = transform;
  gRoot.attr("transform", transform);
  document.documentElement.style.setProperty("--zoom", transform.k);
  // The SVG content moved synchronously above — keep the header's year
  // labels in sync the same frame so the dashed lines and the labels
  // stay welded together (otherwise the labels lag by 1 rAF).
  syncHeaderAxisLabels();
  scheduleRedraw();
  persistView();
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
      const oldTier = state.tier;
      if (newTier === TIER_LABEL) {
        // IMG/FULL → LABEL: fade cards out, render labels normally.
        gCards.selectAll("*").interrupt()
          .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();
      } else if (oldTier === TIER_LABEL) {
        // LABEL → IMG/FULL: fade labels out, then hold for a beat before
        // bringing cards in so the two transitions don't collide. Skipped
        // on first resolve so the initial page load lands instantly.
        gLabels.selectAll("*").interrupt()
          .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();
        if (!firstTierResolve) {
          state.cardsHiddenUntil = performance.now() + TIER_HOLD_MS;
          setTimeout(scheduleRedraw, TIER_HOLD_MS);
        }
      } else {
        // IMG ↔ FULL: tween fold on existing cards. New cards entering on the
        // ensuing renderCards() use the new tier's initialFold.
        tweenFold(gCards.selectAll("g.card"), foldForTier(newTier));
      }
      state.tier = newTier;
    }
    firstTierResolve = false;

    if (state.tier === TIER_LABEL) {
      renderLabels(labelThreshold(state.transform.k));
    } else if (
      state.cardsHiddenUntil &&
      performance.now() < state.cardsHiddenUntil
    ) {
      // Within the post-LABEL delay window — keep the card layer empty.
      // The setTimeout above will trigger another redraw when it expires.
    } else {
      state.cardsHiddenUntil = 0;
      renderCards();
    }
    renderSearchHighlights();
    renderSearchLabels();
    renderSearchOffscreenIndicators();
    // Pinned before hover so hover paints over the latest pinned positions.
    if (state.pinnedId) {
      updatePinnedArtifacts();
      renderPinnedOffscreenIndicators();
    }
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

  // Browser back/forward between /<id> and / drives pin/unpin to match the path.
  // pin()/unpin() will call persistPin, but it no-ops when the URL already
  // matches (which it does post-popstate), so no extra history entry is pushed.
  // Animate-center on the new pin so the user lands on the card they navigated to.
  window.addEventListener("popstate", () => {
    const id = parsePathPin(window.location.pathname);
    if (id === state.pinnedId) return;
    if (id && state.nodesById[id]) {
      const node = state.nodesById[id];
      pin(node);
      centerOnNode(node, { animate: true });
    } else if (state.pinnedId) {
      unpin();
    }
  });

  const { nodes, links } = await loadGraph("/static/asimov.tsv");
  state.nodes = nodes;
  state.links = links;
  for (const n of nodes) state.nodesById[n.id] = n;

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
  measureHeader();
  window.addEventListener("resize", measureHeader);
  // Custom zoom constraint. Replaces the default `translateExtent`-based
  // clamp because that one's "padding" is in world units — at high zoom
  // it lets the user pan far enough off the data that nothing is visible.
  // This version keeps at least RESERVE_X / RESERVE_Y world units of
  // data on screen when zoomed in, and centers the data with a bit of
  // pixel-space slack when zoomed out enough that everything fits.
  zoom.constrain((transform, viewport) => {
    if (!state.bbox) return transform;
    const k = transform.k;
    const w = viewport[1][0] - viewport[0][0];
    const h = viewport[1][1] - viewport[0][1];
    const { minX, maxX, minY, maxY } = state.bbox;
    const dataW = maxX - minX;
    const dataH = maxY - minY;
    const viewW = w / k;
    const viewH = h / k;
    const reserveX = COL_WIDTH;
    const reserveY = ROW_STRIDE;
    const slackPx = 80;

    let tx, ty;
    if (viewW >= dataW) {
      const center = (w - k * (minX + maxX)) / 2;
      tx = Math.max(center - slackPx, Math.min(center + slackPx, transform.x));
    } else {
      const txMin = -k * (maxX - reserveX);
      const txMax = w - k * (minX + reserveX);
      tx = Math.max(txMin, Math.min(txMax, transform.x));
    }
    if (viewH >= dataH) {
      const center = (h - k * (minY + maxY)) / 2;
      ty = Math.max(center - slackPx, Math.min(center + slackPx, transform.y));
    } else {
      const tyMin = -k * (maxY - reserveY);
      const tyMax = h - k * (minY + reserveY);
      ty = Math.max(tyMin, Math.min(tyMax, transform.y));
    }
    return d3.zoomIdentity.translate(tx, ty).scale(k);
  });
  renderDots();
  initialCenter();
  scheduleRedraw();
}

// Cache the header's rendered height into both state (read by renderAxis
// in world.js to push the year-axis labels below the header) and the
// --header-h CSS variable (read by .css rules that need to inset content).
function measureHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;
  const h = Math.ceil(header.getBoundingClientRect().height);
  state.headerHeight = h;
  document.documentElement.style.setProperty("--header-h", h + "px");
  scheduleRedraw();
}

// Render the year labels into #site-timeline (the bottom row of the
// header), one per axis tick passed up from world.js renderAxis. Each
// label is positioned at the tick's screen-X so it sits directly above
// the dashed line that extends down from there. world.js no longer
// renders text in the SVG — the labels live in HTML so they stay
// crisp and never get clipped by the header background.
function renderHeaderAxisLabels(placed) {
  state.placedTicks = placed;
  const slot = document.getElementById("site-timeline");
  if (!slot) return;
  const sel = d3
    .select(slot)
    .selectAll("span.axis-label")
    .data(placed, (d) => d.year);
  sel.exit().remove();
  sel
    .enter()
    .append("span")
    .attr("class", "axis-label")
    .merge(sel)
    .style("left", (d) => d.screenX + "px")
    .text((d) => formatYear(d.year));
}

// Re-project the cached tick positions through the latest transform
// without waiting for renderAxis to fire on the next rAF. Called
// synchronously from onZoom so the header labels track the SVG
// transform 1:1 — without this they lag the dashed lines below by
// one frame, which reads as the lines moving but the labels not.
function syncHeaderAxisLabels() {
  if (!state.placedTicks || !state.transform) return;
  const { x: tx, k } = state.transform;
  d3.select("#site-timeline")
    .selectAll("span.axis-label")
    .style("left", function (d) {
      return tx + d.worldX * k + "px";
    });
}

// Center `node` in the viewport at FULL-tier zoom — used when arriving via
// /<id> (fresh load or popstate). k=1.5 is the LABEL/IMG → FULL threshold so
// the full card renders with readable body text on first paint.
function centerOnNode(node, { animate = false } = {}) {
  const k = 1.5;
  const tx = window.innerWidth / 2 - node.x * k;
  const ty = window.innerHeight / 2 - node.y * k;
  const target = d3.zoomIdentity.translate(tx, ty).scale(k);
  if (animate) svg.transition().duration(500).call(zoom.transform, target);
  else svg.call(zoom.transform, target);
}

function initialTransform() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { minX, minY, maxY } = state.bbox;
  // Fit vertically (show all rows + the axis band); let horizontal overflow so
  // the user pans to explore the width.
  const TOP_PAD_VISUAL = 200; // matches world.js TOP_PAD; only used here for framing
  const top = minY - (TOP_PAD_VISUAL - 20);
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
  // Pin: pathname (canonical) → localStorage → random fallback. View: hash →
  // localStorage → centered-on-pin → computed. Hitting / with nothing saved
  // should drop the user on a random card so the page always feels alive.
  let transform = null;
  const pathPin = parsePathPin(window.location.pathname);
  let pinnedId = pathPin;

  const fromHash = parseViewHash(window.location.hash);
  if (fromHash) {
    transform = d3.zoomIdentity.translate(fromHash.x, fromHash.y).scale(fromHash.k);
  } else {
    try {
      const raw = localStorage.getItem(VIEW_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const { x, y, k } = saved;
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(k)) {
          transform = d3.zoomIdentity.translate(x, y).scale(k);
        }
        if (!pinnedId && saved.pinnedId) pinnedId = saved.pinnedId;
      }
    } catch (e) {
      // Bad JSON / unavailable storage — fall through to computed initial.
    }
  }

  // Nothing told us where to go → pick a random invention. Drop any saved
  // transform too; it won't match a random card's location.
  if (!pinnedId && state.nodes.length) {
    pinnedId = state.nodes[Math.floor(Math.random() * state.nodes.length)].id;
    transform = null;
  }

  const pinnedNode = pinnedId ? state.nodesById[pinnedId] : null;
  if (pinnedNode && !transform) {
    centerOnNode(pinnedNode);
  } else {
    svg.call(zoom.transform, transform || initialTransform());
  }

  if (pinnedNode) pin(pinnedNode);
}

function renderLabels(threshold) {
  // Margin is in world units; with cards at fixed screen size, convert
  // a card-screen-width margin into world units via the current zoom.
  const margin = cardWidth * cardScreenScale / (state.transform?.k || 1);
  const visible = nodesInView(margin).filter(
    (n) => n.labelPriority <= threshold
  );
  appendLabels(gLabels, visible);
}

// Show titles for matched nodes that are currently on-screen at TIER_LABEL —
// where the dot has no built-in label. At card tiers the card itself prints
// the title, so an extra search label would just be a duplicate. Off-screen
// matches go to the pill list under the search bar instead.
function renderSearchLabels() {
  if (!isActiveQuery() || state.tier !== TIER_LABEL || !state.transform) {
    gSearchLabels.selectAll("g.dag-label").remove();
    return;
  }
  const q = state.searchQuery.trim();
  const inView = new Set(nodesInView(0).map((n) => n.id));
  const matches = state.nodes.filter(
    (n) => inView.has(n.id) && searchHelper(n, q)
  );
  appendLabels(gSearchLabels, matches);
}

// Goldenrod fill on every matched dot. Dots aren't viewport-culled, so this
// covers all tiers — at TIER_LABEL the highlight is the user's only signal,
// at card tiers it sits under the card glow without showing through.
function renderSearchHighlights() {
  const active = isActiveQuery();
  const q = state.searchQuery.trim();
  const matchSet = active
    ? new Set(state.nodes.filter((n) => searchHelper(n, q)).map((n) => n.id))
    : null;
  gDots
    .selectAll("circle.dag-dot")
    .classed("search-match", (n) => !!matchSet && matchSet.has(n.id));
}

// Pills under the search bar for every off-screen match. Click pans to the
// node. Caps at MAX_SEARCH_PILLS with a "+N more" tail so a broad query
// doesn't paint hundreds of chips.
function renderSearchOffscreenIndicators() {
  searchResultsContainer.innerHTML = "";
  if (!isActiveQuery() || !state.transform) return;
  const q = state.searchQuery.trim();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const { k, x: tx, y: ty } = state.transform;

  const offscreen = [];
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
    chip.className = "offscreen-indicator search";
    chip.title = node.title;
    chip.innerHTML = `<span class="label">${escapeHtml(node.title)}</span>`;
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      panToNode(node);
    });
    searchResultsContainer.appendChild(chip);
  }
  if (offscreen.length > MAX_SEARCH_PILLS) {
    const more = document.createElement("span");
    more.className = "more";
    more.textContent = `+${offscreen.length - MAX_SEARCH_PILLS} more`;
    searchResultsContainer.appendChild(more);
  }
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
  // Margin in world units. Below cardFixedZoom the rendered card is a
  // fixed cardWidth*cardScreenScale screen-px, so divide by k. Above it
  // the card grows with k, so we cap k at cardFixedZoom — otherwise the
  // margin shrinks past the visible card's actual size and entries pop
  // in late at the screen edge.
  const k = state.transform?.k || 1;
  const margin = cardWidth * cardScreenScale / Math.min(k, cardFixedZoom);
  const visible = nodesInView(margin);
  const sel = gCards.selectAll("g.card").data(visible, (d) => d.id);
  sel.exit()
    .interrupt()
    .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();

  const noFade = pendingNoFade;
  pendingNoFade = false;
  const entered = renderFullCard(sel.enter(), foldForTier(state.tier));
  entered
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
    .on("click", (event, d) => onPinClick(event, d))
    .on("mouseenter", (event, d) => onHoverEnter(event, d))
    .on("mousemove", onHoverMove)
    .on("mouseleave", (event, d) => onHoverLeave(event, d));
  if (!noFade) {
    entered.style("opacity", 0)
      .transition().duration(TIER_FADE_MS).style("opacity", 1);
  }

  // Goldenrod glow on cards whose node matches the active search query.
  const q = state.searchQuery.trim();
  const active = isActiveQuery();
  gCards.selectAll("g.card")
    .classed("search-match", (n) => active && searchHelper(n, q));
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
  document.body.classList.toggle("search-active", isActiveQuery());
  if (isActiveQuery()) {
    // Clear pinned hover labels — otherwise they linger over the search
    // results and read as duplicate matches.
    state.stickyLabels = [];
    gStickyLabels.selectAll("g.dag-label").remove();
  }
  scheduleRedraw();
});
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    e.preventDefault();
    state.searchQuery = "";
    searchInput.value = "";
    document.body.classList.remove("searching");
    document.body.classList.remove("search-active");
    searchInput.blur();
    scheduleRedraw();
  }
});

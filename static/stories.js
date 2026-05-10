// Stories overlay. A "story" is a curated, ordered path of invention IDs
// through the tech tree, authored in the same Google Sheet as the cards
// (one tab per story, named `Story: <name>`). The fetch script writes
// stories.json; this module loads it at startup and exposes:
//   - enterStory(slug)/exitStory()
//   - renderStoryTrace() — ribbon path + .story-member tagging on baseline
//   - renderStoryCards() — full cards for story members on a dedicated
//     layer (visible at every zoom tier, mirrors the pinned-overlay pattern)
//   - renderStoriesMenu() — dropdown of available stories
//   - renderStoryBanner() — banner with title/blurb/step prose/refs
//   - gotoStep(i) — pan to step i and update banner + .story-current
// Baseline copies of story members are hidden via CSS so we don't render
// the same node twice when zoomed in.

import { renderFullCard } from "./card.js";

let state, gStoryDim, gStoryTrace, gStoryCards, gStoryStickies, gStoryCurrentCard, svg, zoom;
let panToNode, scheduleRedraw, pushPath, isLocalhost, unpinFn;
let onPinClickFn, onHoverEnterFn, onHoverMoveFn, onHoverLeaveFn;

const HEADER_PAD = 12; // breathing room between banner and the fitted bbox

export function initStories(deps) {
  ({
    state, gStoryDim, gStoryTrace, gStoryCards, gStoryStickies, gStoryCurrentCard, svg, zoom,
    panToNode, scheduleRedraw, pushPath, isLocalhost,
    unpin: unpinFn,
    onPinClick: onPinClickFn,
    onHoverEnter: onHoverEnterFn,
    onHoverMove: onHoverMoveFn,
    onHoverLeave: onHoverLeaveFn,
  } = deps);

  // Keyboard handling. Esc closes the active story; ←/→ step through it.
  // All gated on storyId being set and focus NOT being in a text input.
  window.addEventListener("keydown", (e) => {
    if (!state.storyId) return;
    const ae = document.activeElement;
    const tag = ae && ae.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (ae && ae.isContentEditable)) return;

    if (e.key === "Escape") {
      e.preventDefault();
      exitStory();
      return;
    }
    if (e.key === "ArrowRight") { e.preventDefault(); stepBy(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); stepBy(-1); }
  });

  // On-screen prev/next buttons share the same stepBy helper. They live
  // at the viewport edges (CSS positions them) and are visible only when
  // body.has-story is set.
  const prevBtn = document.getElementById("story-prev-btn");
  const nextBtn = document.getElementById("story-next-btn");
  if (prevBtn) prevBtn.addEventListener("click", () => stepBy(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => stepBy(1));

  // Header button toggles the dropdown.
  const btn = document.getElementById("action-stories");
  const menu = document.getElementById("stories-menu");
  if (btn && menu) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = menu.dataset.open === "true";
      menu.dataset.open = open ? "false" : "true";
    });
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.dataset.open = "false";
      }
    });
  }
}

export async function loadStories(url = "/static/stories.json") {
  let data = [];
  try {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.json();
  } catch (e) {
    console.warn("loadStories: failed to fetch", url, e);
    data = [];
  }
  state.stories = [];
  state.storiesById = {};
  for (const raw of data) {
    if (!raw || !raw.slug) continue;
    const story = normalizeStory(raw);
    state.stories.push(story);
    state.storiesById[story.slug] = story;
  }
  console.log(`Loaded ${state.stories.length} stor${state.stories.length === 1 ? "y" : "ies"}.`);
  renderStoriesMenu();
}

// Resolve step IDs against state.nodesById; drop missing IDs with a warning.
// Result: story.resolvedSteps = [{node, edgeNote}], story.missingIds.
// `edgeNote` is per-edge prose shown on a sticky note between consecutive
// cards (describing the edge from N-1 → N).
function normalizeStory(raw) {
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  const resolvedSteps = [];
  const missingIds = [];
  for (const s of steps) {
    const id = typeof s === "string" ? s : s && s.id;
    const edgeNote =
      typeof s === "string" ? null : (s && (s.edge_note || s.edgeNote)) || null;
    if (!id) continue;
    const node = state.nodesById[id];
    if (!node) {
      missingIds.push(id);
      continue;
    }
    resolvedSteps.push({ node, edgeNote });
  }
  if (missingIds.length) {
    console.warn(
      `Story ${raw.slug}: ${missingIds.length} unknown step id(s) — splicing out:`,
      missingIds
    );
  }
  return {
    slug: raw.slug,
    title: raw.title || raw.slug,
    blurb: raw.blurb || null,
    resolvedSteps,
    missingIds,
  };
}

// ---- enter / exit ---------------------------------------------------------

export function enterStory(slug, { animate = false, keepUrl = false } = {}) {
  if (state.storyId === slug) return;
  const story = state.storiesById[slug];
  if (!story) {
    console.warn(`enterStory: unknown slug "${slug}"`);
    return;
  }

  // Two heavy overlays on the same cards is just noise — drop the pin first.
  if (state.pinnedId && unpinFn) unpinFn();

  state.storyId = slug;
  state.storyNodes = story.resolvedSteps.map((s) => s.node);
  state.storySteps = story.resolvedSteps;
  state.storyMissing = story.missingIds;
  // storyStep is derived from camera position on every redraw — see
  // syncCurrentStep at the top of renderStoryTrace. enterStory leaves it
  // null until the first redraw resolves it.
  state.storyStep = null;
  document.body.classList.add("has-story");

  renderStoryBanner();
  // Close the dropdown if it's open.
  const menu = document.getElementById("stories-menu");
  if (menu) menu.dataset.open = "false";

  // Camera fit, then redraw so trace + spotlight render against the new view.
  if (state.storyNodes.length) {
    const target = computeStoryFitTransform(state.storyNodes);
    if (target) {
      const sel = animate ? svg.transition().duration(700) : svg;
      sel.call(zoom.transform, target);
    }
  }
  scheduleRedraw();

  if (!keepUrl && pushPath && !isLocalhost()) {
    pushPath(`/story/${slug}`);
  }
}

export function exitStory({ keepUrl = false } = {}) {
  if (!state.storyId) return;
  state.storyId = null;
  state.storyNodes = [];
  state.storySteps = [];
  state.storyMissing = [];
  state.storyStep = null;
  document.body.classList.remove("has-story");

  // Clear ribbon + story cards; .story-member classes are re-applied on
  // every render so they'll fall away on the next redraw.
  gStoryTrace.selectAll("*").remove();
  gStoryCards.selectAll("*").remove();
  renderStoryBanner();
  scheduleRedraw();

  if (!keepUrl && pushPath && !isLocalhost()) {
    pushPath("/");
  }
}

// ---- step navigation ------------------------------------------------------

export function gotoStep(i) {
  if (!state.storyId) return;
  const n = state.storyNodes.length;
  if (!n) return;
  const clamped = Math.max(0, Math.min(n - 1, i));
  state.storyStep = clamped;
  if (panToNode) panToNode(state.storyNodes[clamped]);
  renderStoryBanner();
  scheduleRedraw();
}

// Step ±1 from the currently-derived storyStep, clamped to the ends. Shared
// by the keyboard handler and the on-screen ‹ › buttons.
function stepBy(delta) {
  if (!state.storyId) return;
  const total = state.storyNodes.length;
  if (!total) return;
  const cur = state.storyStep == null ? 0 : state.storyStep;
  const next = Math.max(0, Math.min(total - 1, cur + delta));
  if (next === cur) return;
  gotoStep(next);
}

// Disable prev at step 0 and next at the last step. Re-evaluated on every
// redraw so the ends reflect manual pans, not just explicit step presses.
function updateStoryNavButtons() {
  const prev = document.getElementById("story-prev-btn");
  const next = document.getElementById("story-next-btn");
  if (!prev || !next) return;
  const total = state.storyNodes.length;
  const cur = state.storyStep == null ? 0 : state.storyStep;
  prev.disabled = !state.storyId || cur <= 0;
  next.disabled = !state.storyId || cur >= total - 1;
}

// Set state.storyStep to whichever story node is closest (in screen px) to
// the viewport center. Runs at the top of every story render so the
// .story-current glow tracks the camera in real time — including during
// the gotoStep animation, where the "current" naturally transitions as
// the camera passes the midpoint between adjacent cards.
function syncCurrentStep() {
  if (!state.storyId || !state.storyNodes.length || !state.transform) return;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const { k, x: tx, y: ty } = state.transform;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < state.storyNodes.length; i++) {
    const n = state.storyNodes[i];
    const sx = tx + n.x * k;
    const sy = ty + n.y * k;
    const d2 = (sx - cx) * (sx - cx) + (sy - cy) * (sy - cy);
    if (d2 < bestDist) { bestDist = d2; bestIdx = i; }
  }
  state.storyStep = bestIdx;
}


// ---- camera fit -----------------------------------------------------------

export function computeStoryFitTransform(nodes) {
  if (!nodes || !nodes.length) return null;
  if (nodes.length === 1) {
    const k = 1.5;
    const n = nodes[0];
    return d3.zoomIdentity
      .translate(window.innerWidth / 2 - n.x * k, window.innerHeight / 2 - n.y * k)
      .scale(k);
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Top inset accounts for the header + banner so the bbox isn't covered.
  const banner = document.getElementById("story-banner");
  const bannerH = banner ? banner.getBoundingClientRect().height : 0;
  const topInset = (state.headerHeight || 0) + bannerH + HEADER_PAD;
  const padPx = 80;
  const usableW = Math.max(50, w - 2 * padPx);
  const usableH = Math.max(50, h - topInset - padPx);
  const dataW = Math.max(1, maxX - minX);
  const dataH = Math.max(1, maxY - minY);
  let k = Math.min(usableW / dataW, usableH / dataH, 1.5);
  k = Math.max(0.08, k);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const tx = w / 2 - cx * k;
  // Push the camera down so the bbox center sits in the usable region (below
  // the banner), not the geometric viewport center.
  const ty = topInset + usableH / 2 - cy * k;
  return d3.zoomIdentity.translate(tx, ty).scale(k);
}

// ---- render: ribbon + .story-member tagging ----------------------------

export function renderStoryTrace() {
  // Derive storyStep from camera before tagging so .story-current tracks
  // pan/zoom (including mid-gotoStep animation) without needing explicit
  // updates from the navigation entry points.
  syncCurrentStep();
  updateStoryNavButtons();

  // Always re-tag — fresh card/dot/label entries from the regular pipeline
  // need the .story-member class added; exits take care of removal.
  const memberIds = new Set(state.storyId ? state.storyNodes.map((n) => n.id) : []);
  const currentId = state.storyStep != null && state.storyNodes[state.storyStep]
    ? state.storyNodes[state.storyStep].id
    : null;

  d3.selectAll("g.cards > g.card")
    .classed("story-member", (n) => memberIds.has(n.id))
    .classed("story-current", (n) => n.id === currentId);
  d3.selectAll(".dots circle.dag-dot").classed("story-member", (n) => memberIds.has(n.id));
  d3.selectAll(".labels g.dag-label, .sticky-labels g.dag-label, .search-labels g.dag-label")
    .classed("story-member", (d) => memberIds.has(d.id));

  if (!state.storyId || !state.storyNodes.length) {
    gStoryTrace.selectAll("*").remove();
    return;
  }

  // Ribbon: a single <path> through every step's world coords. Connects
  // consecutive pairs regardless of canonical TSV deps — that's the point.
  const d = state.storyNodes
    .map((n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`)
    .join(" ");
  let ribbon = gStoryTrace.select("path.story-trace-ribbon");
  if (ribbon.empty()) {
    ribbon = gStoryTrace.append("path").attr("class", "story-trace-ribbon");
  }
  ribbon.attr("d", d);
}

// Stable [-1, 1] hash for sticky-note jitter rotation. Same algorithm as
// world.js so identical input strings give identical angles.
function hashUnit(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
const STICKY_TILT_DEG = 2.5;

// ---- render: sticky notes (cards + edges, both in gStoryStickies) -------

// Stickies live in their own gStoryStickies layer (not inside cards). Each
// sticky has a .sticky-scaler that counters world zoom, so foreignObject
// content renders at constant screen size at any zoom. Layout solver runs
// every redraw, pushing stickies apart from each other and away from the
// story cards. All math happens in screen-pixel space (where extents are
// constant); world-coord transforms are derived at the end.
const STICKY_CARD_W = 220;
const STICKY_CARD_H = 110;
const STICKY_EDGE_W = 240;
const STICKY_EDGE_H = 110;
// Cards render at fold=1 (full) at constant screen size = cardScreenScale * card-local size.
const CARD_W_SCREEN = 240 * 1.2;       // cardWidth * cardScreenScale
const CARD_H_SCREEN = 316.667 * 1.2;   // fullCardHeight * cardScreenScale (approx)
const STICKY_GAP = 12;
const STICKY_MAX_ITER = 60;

function rectOverlap(a, b) {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const minDx = (a.w + b.w) / 2 + STICKY_GAP;
  const minDy = (a.h + b.h) / 2 + STICKY_GAP;
  return {
    overlapX: minDx - Math.abs(dx),
    overlapY: minDy - Math.abs(dy),
    dx, dy,
  };
}

// Returns layout in screen coords; consumer converts back to world for the
// SVG transform via state.transform. Bail to [] when no story is active.
function layoutStickies() {
  if (!state.transform || !state.storyId) return [];
  const k = state.transform.k;
  const tx = state.transform.x;
  const ty = state.transform.y;

  const items = [];
  // Edge stickies — anchored to each segment midpoint. (Card stickies
  // were removed in v3.1: too noisy alongside the cards' own descriptions
  // plus the edge labels.)
  for (let i = 0; i < state.storyNodes.length - 1; i++) {
    const a = state.storyNodes[i];
    const b = state.storyNodes[i + 1];
    const step = state.storySteps[i + 1];
    if (!step || !step.edgeNote) continue;
    const mx = tx + ((a.x + b.x) / 2) * k;
    const my = ty + ((a.y + b.y) / 2) * k;
    items.push({
      id: `edge-${a.id}-${b.id}`,
      type: "edge",
      note: step.edgeNote,
      cx: mx, cy: my,
      w: STICKY_EDGE_W, h: STICKY_EDGE_H,
      // Click on this edge sticky → goto its destination step (the step
      // whose edge_note this prose describes).
      destStepIndex: i + 1,
    });
  }

  // Cards are static obstacles — bbox computed in screen coords using
  // their constant on-screen size.
  const cardBoxes = state.storyNodes.map((n) => ({
    cx: tx + n.x * k,
    cy: ty + n.y * k,
    w: CARD_W_SCREEN,
    h: CARD_H_SCREEN,
  }));

  for (let iter = 0; iter < STICKY_MAX_ITER; iter++) {
    let moved = false;

    // Pairwise sticky vs sticky — move both by half the overlap on the
    // shorter overlap axis.
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const o = rectOverlap(a, b);
        if (o.overlapX <= 0 || o.overlapY <= 0) continue;
        if (o.overlapX < o.overlapY) {
          const sign = o.dx >= 0 ? 1 : -1;
          a.cx -= (sign * o.overlapX) / 2;
          b.cx += (sign * o.overlapX) / 2;
        } else {
          const sign = o.dy >= 0 ? 1 : -1;
          a.cy -= (sign * o.overlapY) / 2;
          b.cy += (sign * o.overlapY) / 2;
        }
        moved = true;
      }
    }

    // Sticky vs card — card stays put, sticky takes the full displacement
    // away from the card on the shorter overlap axis.
    for (const sticky of items) {
      for (const c of cardBoxes) {
        const o = rectOverlap(sticky, c);
        if (o.overlapX <= 0 || o.overlapY <= 0) continue;
        if (o.overlapX < o.overlapY) {
          // dx = card.cx - sticky.cx; if positive, card is right of sticky,
          // so sticky needs to move left (away).
          const sign = o.dx >= 0 ? -1 : 1;
          sticky.cx += sign * o.overlapX;
        } else {
          const sign = o.dy >= 0 ? -1 : 1;
          sticky.cy += sign * o.overlapY;
        }
        moved = true;
      }
    }

    if (!moved) break;
  }

  // Convert resolved screen coords back to world for the SVG transform.
  for (const item of items) {
    item.worldX = (item.cx - tx) / k;
    item.worldY = (item.cy - ty) / k;
    item.tilt = hashUnit(item.id) * STICKY_TILT_DEG;
  }
  return items;
}

export function renderStickies() {
  if (!state.storyId) {
    gStoryStickies.selectAll("*").remove();
    return;
  }
  const items = layoutStickies();
  const sel = gStoryStickies.selectAll("g.story-sticky").data(items, (d) => d.id);
  sel.exit().remove();

  const entered = sel.enter().append("g")
    .attr("class", (d) => `story-sticky story-sticky-${d.type}`);
  const scaler = entered.append("g").attr("class", "sticky-scaler");
  scaler.append("foreignObject")
    .attr("x", (d) => -d.w / 2)
    .attr("y", (d) => -d.h / 2)
    .attr("width", (d) => d.w)
    .attr("height", (d) => d.h)
    .append("xhtml:div").attr("class", (d) => `sticky-note ${d.type}`);

  const merged = entered.merge(sel);
  merged.attr("transform", (d) => `translate(${d.worldX}, ${d.worldY}) rotate(${d.tilt})`);
  merged.select(".sticky-note").text((d) => d.note);
}

// ---- render: full cards for story members (always at fold=1) ------------

// Split rendering across two layers so the active step always sits visually
// on top of edge stickies. Non-current story cards live in gStoryCards
// (below stickies); the single current card is rendered into
// gStoryCurrentCard (above stickies). On every redraw both layers are
// data-bound — d3.exit cleans up cards that switch teams.
function bindStoryCards(layer, nodes, isCurrent) {
  const sel = layer.selectAll("g.card").data(nodes, (n) => n.id);
  sel.exit().remove();
  renderFullCard(sel.enter(), 1)
    .on("click", (event, n) => onPinClickFn && onPinClickFn(event, n))
    .on("mouseenter", (event, n) => onHoverEnterFn && onHoverEnterFn(event, n))
    .on("mousemove", () => onHoverMoveFn && onHoverMoveFn())
    .on("mouseleave", (event, n) => onHoverLeaveFn && onHoverLeaveFn(event, n));
  layer.selectAll("g.card")
    .attr("transform", (n) => `translate(${n.x}, ${n.y})`)
    .classed("story-member", true)
    .classed("story-current", isCurrent);
}

export function renderStoryCards() {
  if (!state.storyId || !state.storyNodes.length) {
    gStoryCards.selectAll("*").remove();
    if (gStoryCurrentCard) gStoryCurrentCard.selectAll("*").remove();
    return;
  }
  const currentId = state.storyStep != null && state.storyNodes[state.storyStep]
    ? state.storyNodes[state.storyStep].id
    : null;
  const nonCurrent = state.storyNodes.filter((n) => n.id !== currentId);
  const current = state.storyNodes.filter((n) => n.id === currentId);

  bindStoryCards(gStoryCards, nonCurrent, false);
  if (gStoryCurrentCard) bindStoryCards(gStoryCurrentCard, current, true);
}

// ---- render: stories menu (dropdown) ------------------------------------

export function renderStoriesMenu() {
  const menu = document.getElementById("stories-menu");
  if (!menu) return;
  menu.innerHTML = "";
  if (!state.stories.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No stories yet.";
    menu.appendChild(empty);
    return;
  }
  for (const story of state.stories) {
    const btn = document.createElement("button");
    btn.className = "story-link";
    btn.type = "button";
    btn.textContent = story.title;
    if (story.blurb) {
      const blurb = document.createElement("span");
      blurb.className = "story-link-blurb";
      blurb.textContent = story.blurb;
      btn.appendChild(blurb);
    }
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      enterStory(story.slug, { animate: true });
    });
    menu.appendChild(btn);
  }
}

// ---- render: banner (title + blurb + ×) ---------------------------------

export function renderStoryBanner() {
  const banner = document.getElementById("story-banner");
  if (!banner) return;
  banner.innerHTML = "";
  if (!state.storyId) return;

  const story = state.storiesById[state.storyId];
  if (!story) return;

  const head = document.createElement("div");
  head.className = "story-head";
  const title = document.createElement("h2");
  title.className = "story-title";
  title.textContent = story.title;
  head.appendChild(title);
  const close = document.createElement("button");
  close.className = "story-close";
  close.type = "button";
  close.textContent = "×";
  close.title = "Close (Esc)";
  close.addEventListener("click", () => exitStory());
  head.appendChild(close);
  banner.appendChild(head);

  if (story.blurb) {
    const blurb = document.createElement("p");
    blurb.className = "story-blurb";
    blurb.textContent = story.blurb;
    banner.appendChild(blurb);
  }
}

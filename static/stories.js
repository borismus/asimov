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

import { renderFullCard, cardWidth, cardHeight, fullCardHeight, cardScreenScale, cardFixedZoom } from "./card.js";
import { initConfirm, showConfirm, isConfirmOpen } from "./confirm.js";

let state, gStoryDim, gStoryTrace, gStoryCards, gStoryStickies, gStoryStickiesFocused, gStoryCurrentCard, svg, zoom;
let panToNode, scheduleRedraw, pushPath, unpinFn, dismissHoverFn;
let onPinClickFn, onHoverEnterFn, onHoverMoveFn, onHoverLeaveFn;
let TIER_LABEL_VAL, TIER_FULL_VAL;

const HEADER_PAD = 12; // breathing room between banner and the fitted bbox

export function initStories(deps) {
  ({
    state, gStoryDim, gStoryTrace, gStoryCards, gStoryStickies, gStoryStickiesFocused, gStoryCurrentCard, svg, zoom,
    panToNode, scheduleRedraw, pushPath,
    unpin: unpinFn,
    dismissHover: dismissHoverFn,
    onPinClick: onPinClickFn,
    onHoverEnter: onHoverEnterFn,
    onHoverMove: onHoverMoveFn,
    onHoverLeave: onHoverLeaveFn,
    TIER_LABEL: TIER_LABEL_VAL,
    TIER_FULL: TIER_FULL_VAL,
  } = deps);

  // Keyboard handling. Esc closes the active story (via the confirm popover);
  // ←/→ step through it. All gated on an active story session and focus NOT being
  // in a text input. If the confirm popover is open, its own Esc handler
  // owns the key — bail so we don't double-handle.
  window.addEventListener("keydown", (e) => {
    if (!state.story) return;
    if (isConfirmOpen()) return;
    const ae = document.activeElement;
    const tag = ae && ae.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (ae && ae.isContentEditable)) return;

    if (e.key === "Escape") {
      e.preventDefault();
      requestExitStory();
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

  initConfirm("app-confirm");

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
  buildStoriesByCardId();
  console.log(`Loaded ${state.stories.length} stor${state.stories.length === 1 ? "y" : "ies"}.`);
  renderStoriesMenu();
  // Cold-load may have already restored a pin before stories arrived; if
  // that card turns out to be a story member, surface its chip now.
  renderStoryCardChip();
}

// Reverse index card id → story[]. Built once after loadStories; the click
// handler reads from it on every card click, so a per-click scan over
// state.stories would otherwise be wasted work.
function buildStoriesByCardId() {
  const idx = new Map();
  for (const story of state.stories) {
    for (const step of story.resolvedSteps) {
      const cardId = step.node && step.node.id;
      if (!cardId) continue;
      let bucket = idx.get(cardId);
      if (!bucket) { bucket = []; idx.set(cardId, bucket); }
      bucket.push(story);
    }
  }
  state.storiesByCardId = idx;
}

// Returns the stories that contain the given card id, or [] if none.
export function getStoriesForCard(cardId) {
  return state.storiesByCardId.get(cardId) || [];
}

// "Explore the <story name> story" chips below every story-member card
// visible at IMG / FULL tier, plus below the pinned card at any tier
// (pinned overlay always shows a full card). Hidden when a story is
// already active. Called from overlays.js's updatePinnedArtifacts every
// redraw so chip positions track pan/zoom, and once explicitly from
// loadStories so cold-load with a pre-pinned card doesn't miss it.
export function renderStoryCardChip() {
  const container = document.getElementById("story-card-chip");
  if (!container) return;

  if (state.story || !state.transform) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  // Chips appear only on cards the user is actively engaging with — the
  // pinned card (steady state) and the hovered card (transient). Decorating
  // every visible story-member card cluttered the canvas and meant the chip
  // never "hid on hover out" because something always claimed it.
  const cardIds = new Set();
  if (state.pinnedId && state.storiesByCardId.has(state.pinnedId)) {
    cardIds.add(state.pinnedId);
  }
  if (state.hoverId && state.hoverExpanded && state.storiesByCardId.has(state.hoverId)) {
    cardIds.add(state.hoverId);
  }
  if (cardIds.size === 0) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  const { k, x: tx, y: ty } = state.transform;
  const fullH = fullCardHeight * cardScreenScale;
  const foldedH = cardHeight * cardScreenScale;
  const GAP = 2;

  container.innerHTML = "";
  for (const cardId of cardIds) {
    const node = state.nodesById[cardId];
    if (!node) continue;
    const stories = state.storiesByCardId.get(cardId);
    if (!stories || !stories.length) continue;

    // Pinned overlay always paints a full card; hover overlay opens to full
    // once the fold animation completes (state.hoverFoldOpen). Before that
    // it's image-only — chip sits closer.
    const isPinned = cardId === state.pinnedId;
    const isHovered = cardId === state.hoverId;
    const showsFull = isPinned || (isHovered && state.hoverFoldOpen);
    const cardScreenH = showsFull ? fullH : foldedH;

    const sx = tx + node.x * k;
    const sy = ty + node.y * k;

    const group = document.createElement("div");
    group.className = "story-chip-group";
    group.style.left = `${sx}px`;
    group.style.top = `${sy + cardScreenH / 2 + GAP}px`;
    // Bridge hit area (stories.css) covers the gap to the card so hover
    // doesn't collapse in the dead zone between SVG card and HTML chip.
    group.addEventListener("mouseenter", () => {
      if (onHoverEnterFn) onHoverEnterFn(null, node);
    });
    group.addEventListener("mouseleave", () => {
      if (onHoverLeaveFn) onHoverLeaveFn();
    });

    for (const s of stories) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "story-chip-link";
      btn.textContent = `Explore the ${s.title} story`;
      btn.title = `Open the "${s.title}" story`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        // Keep the current zoom; show the full story overlay and focus this
        // card. anchorNodeId pins its storyY to baseline y.
        enterStory(s.slug, { keepCamera: true, anchorNodeId: cardId });
      });
      group.appendChild(btn);
    }
    container.appendChild(group);
  }
  container.hidden = false;
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

// ---- story-aligned coordinates -------------------------------------------

// Story members get a virtual y near a shared band so the story reads as a
// clean horizontal arc. We don't pin them to a single y — close-x neighbors
// would stack on top of each other in dense eras — so each member gets a
// stable hash-based offset within ±BAND_Y_JITTER. x stays at baseline
// (already year-monotonic at the world layer).
const BAND_Y_JITTER = 350;  // world units

// `anchorNodeId`: pin this node's storyY to its baseline y (zero jitter)
// and use that y as the band center for the rest. The card the user
// clicked to enter the story stays exactly where it was on screen — no
// jump, no duplicate-then-snap. Without an anchor we fall back to the
// mean of baseline y's.
function buildStoryCoords(nodes, anchorNodeId = null) {
  if (!nodes.length) return {};
  let y0;
  const anchor = anchorNodeId
    ? nodes.find((n) => n.id === anchorNodeId)
    : null;
  if (anchor) {
    y0 = anchor.y;
  } else {
    let sumY = 0;
    for (const n of nodes) sumY += n.y;
    y0 = sumY / nodes.length;
  }
  const out = {};
  for (const n of nodes) {
    const jitter = (anchor && n.id === anchor.id)
      ? 0
      : hashUnit(n.id + "storyY") * BAND_Y_JITTER;
    out[n.id] = { x: n.x, y: y0 + jitter };
  }
  return out;
}

function storyCoord(n) {
  if (state.story) {
    const c = state.story.coordsById && state.story.coordsById[n.id];
    if (c) return c;
  }
  return { x: n.x, y: n.y };
}

// World-space endpoints for the ribbon segment between two story nodes.
// Anchors sit on the midpoint of the card edge facing the neighbor so the
// ribbon enters and exits each card silhouette cleanly, without stubs
// dangling off in empty space. When consecutive cards overlap on screen
// (band-cluster: close in x with band-y jitter scattering them on y), the
// edge anchors would cross over each other and look broken — fall back to
// plain center-to-center in that case.
function edgeAnchors(a, b) {
  const k = (state.transform && state.transform.k) || 1;
  const ek = Math.min(k, cardFixedZoom);
  const halfW = (cardWidth * cardScreenScale) / 2 / ek;
  const halfH = (fullCardHeight * cardScreenScale) / 2 / ek;
  const ca = storyCoord(a);
  const cb = storyCoord(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const xGapScreen = (Math.abs(dx) - 2 * halfW) * ek;
  const yGapScreen = (Math.abs(dy) - 2 * halfH) * ek;
  if (xGapScreen < 0 && yGapScreen < 0) {
    return { a: { x: ca.x, y: ca.y }, b: { x: cb.x, y: cb.y } };
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    const sgn = dx >= 0 ? 1 : -1;
    return {
      a: { x: ca.x + sgn * halfW, y: ca.y },
      b: { x: cb.x - sgn * halfW, y: cb.y },
    };
  }
  const sgn = dy >= 0 ? 1 : -1;
  return {
    a: { x: ca.x, y: ca.y + sgn * halfH },
    b: { x: cb.x, y: cb.y - sgn * halfH },
  };
}

// ---- enter / exit ---------------------------------------------------------

export function enterStory(slug, { animate = false, keepUrl = false, keepCamera = false, anchorNodeId = null, step = null } = {}) {
  if (state.story && state.story.id === slug) return;
  const story = state.storiesById[slug];
  if (!story) {
    console.warn(`enterStory: unknown slug "${slug}"`);
    return;
  }

  // Two heavy overlays on the same cards is just noise — drop the pin first.
  if (state.pinnedId && unpinFn) unpinFn();
  if (dismissHoverFn) dismissHoverFn();
  if (state.hoverId) state.hoverId = null;

  // Single-shot session record so every story-state field moves together.
  // `step` changes only via gotoStep (clicks, arrows, URL seed) — not pan/zoom.
  // `anchorNodeId` (when set) keeps that card's storyY = baselineY so the
  // entry point doesn't visibly jump as the band-jitter takes effect.
  const nodes = story.resolvedSteps.map((s) => s.node);
  // Snap the URL-provided step to a valid half-integer in [0, N-1] so a
  // stale or hand-edited URL can't put us out of range.
  let initialStep = null;
  if (step != null && Number.isFinite(step) && nodes.length) {
    const snapped = Math.round(step * 2) / 2;
    initialStep = Math.max(0, Math.min(nodes.length - 1, snapped));
  }
  if (initialStep == null && anchorNodeId && nodes.length) {
    const anchorIdx = nodes.findIndex((n) => n.id === anchorNodeId);
    if (anchorIdx >= 0) initialStep = anchorIdx;
  }
  if (initialStep == null && nodes.length) initialStep = 0;
  const fitTarget =
    !keepCamera && nodes.length ? computeStoryFitTransform(nodes) : null;
  state.story = {
    id: slug,
    nodes,
    steps: story.resolvedSteps,
    step: initialStep,
    coordsById: buildStoryCoords(nodes, anchorNodeId),
    // Pan-only navigation (←/→, prev/next) always uses this scale until the
    // user zooms manually (wheel / pinch updates it via onStoryUserZoom).
    navZoomK: fitTarget
      ? fitTarget.k
      : state.transform
        ? state.transform.k
        : null,
    anchorNodeId,
    cardLook: null,
  };
  syncStoryCardLook(state.transform?.k ?? 0);
  document.body.classList.add("has-story");

  renderStoryBanner();
  renderStoryCards();
  // Close the dropdown if it's open.
  const menu = document.getElementById("stories-menu");
  if (menu) menu.dataset.open = "false";

  // Camera fit, then redraw so trace + spotlight render against the new view.
  // Skipped when keepCamera is set (URL reload with an explicit transform).
  const focusStep = () => {
    if (!state.story || initialStep == null) return;
    gotoStep(initialStep, { preserveZoom: keepCamera || !!fitTarget });
  };
  if (fitTarget) {
    const sel = animate ? svg.transition().duration(700) : svg;
    if (initialStep != null && animate) {
      sel.call(zoom.transform, fitTarget).on("end", focusStep);
    } else {
      sel.call(zoom.transform, fitTarget);
      if (initialStep != null) requestAnimationFrame(focusStep);
    }
  } else if (initialStep != null) {
    requestAnimationFrame(focusStep);
  }
  scheduleRedraw();

  if (!keepUrl && pushPath) {
    pushPath(`/story/${slug}`);
  }
}

export function exitStory({ keepUrl = false } = {}) {
  if (!state.story) return;
  state.story = null;
  // Force the next redraw to run a LABEL → IMG/FULL transition so labels
  // fade out and cards fade in cleanly. (During the story, state.tier was
  // tracking k as usual but labels were being rendered regardless; setting
  // tier back to LABEL here makes the standard transition logic fire.)
  state.tier = TIER_LABEL_VAL;
  document.body.classList.remove("has-story");

  // Clear ribbon + story cards; .story-member classes are re-applied on
  // every render so they'll fall away on the next redraw.
  gStoryTrace.selectAll("*").remove();
  gStoryCards.selectAll("*").remove();
  if (gStoryStickiesFocused) gStoryStickiesFocused.selectAll("*").remove();
  renderStoryBanner();
  scheduleRedraw();

  if (!keepUrl && pushPath) {
    pushPath("/");
  }
}

// ---- step navigation ------------------------------------------------------

// state.story.step uses half-integers: 0, 0.5, 1, 1.5, ..., N-1. Integers
// focus a node; halves focus the edge between node i (floor) and node
// i+1. The user can step ←/→ through every focus point in sequence
// (node → edge → node → edge ...) and click stickies / cards to jump.
function isNodeStep(s) { return s != null && Number.isInteger(s); }
function isEdgeStep(s) { return s != null && !Number.isInteger(s); }
function edgeIdxOf(s) { return isEdgeStep(s) ? Math.floor(s) : null; }

function stepTargetCoord(step) {
  if (isNodeStep(step)) {
    return storyCoord(state.story.nodes[step]);
  }
  const i = edgeIdxOf(step);
  const a = storyCoord(state.story.nodes[i]);
  const b = storyCoord(state.story.nodes[i + 1]);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

let storyCameraLockId = 0;

// Wheel / pinch updates this; arrow / prev-next always pan at this scale.
export function onStoryUserZoom(k) {
  if (!state.story || !Number.isFinite(k)) return;
  state.story.navZoomK = k;
  syncStoryCardLook(k);
}

export function gotoStep(step, { preserveZoom = true } = {}) {
  if (!state.story) return;
  const n = state.story.nodes.length;
  if (!n) return;
  // Snap to nearest valid half-step and clamp to [0, n-1].
  const snapped = Math.round(step * 2) / 2;
  const clamped = Math.max(0, Math.min(n - 1, snapped));
  state.story.step = clamped;
  renderStoryBanner();
  // Move the focused card layer before the camera — otherwise we pan to the
  // new storyCoord while the old card is still on screen for one frame.
  renderStoryCards();
  zoomToStep(stepTargetCoord(clamped), { preserveZoom });
  scheduleRedraw();
}

// Step the camera to the step that holds the given card id, if it's a
// member of the active story. Used by the in-story click on a baseline
// dot (story member cards themselves are handled by the story-overlay's
// own click handler).
export function gotoCardInStory(cardId) {
  if (!state.story) return false;
  const idx = state.story.nodes.findIndex((n) => n.id === cardId);
  if (idx < 0) return false;
  gotoStep(idx);
  return true;
}

// While a story is open, allow panning so any step can reach the focus
// point in the viewport. The global zoom.constrain centers the whole graph
// when it fits on screen (±80px slack), which blocks centering individual
// story nodes when zoomed out.
export function constrainTransformInStory(transform, viewport) {
  if (!state.story || !state.story.nodes.length) return null;
  const lock = state.story.cameraLock;
  // During arrow/prev-next pans, pin scale but let tx/ty interpolate.
  const k =
    lock && lock.panOnly && performance.now() < lock.until ? lock.k : transform.k;
  if (lock && !lock.panOnly && performance.now() < lock.until) {
    return d3.zoomIdentity.translate(lock.tx, lock.ty).scale(lock.k);
  }
  const { cx, cy } = storyFocusCenterScreen();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of state.story.nodes) {
    const c = storyCoord(n);
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  // tx = cx - x*k places world x at screen cx; same for y.
  const txMin = cx - maxX * k;
  const txMax = cx - minX * k;
  const tyMin = cy - maxY * k;
  const tyMax = cy - minY * k;
  const tx = Math.max(txMin, Math.min(txMax, transform.x));
  const ty = Math.max(tyMin, Math.min(tyMax, transform.y));
  return d3.zoomIdentity.translate(tx, ty).scale(k);
}

// Screen-space center for story step focus (below header + story banner).
function storyFocusCenterScreen() {
  const banner = document.getElementById("story-banner");
  const bannerH = banner ? banner.getBoundingClientRect().height : 0;
  const topInset = (state.headerHeight || 0) + bannerH + HEADER_PAD;
  return {
    cx: window.innerWidth / 2,
    cy: topInset + (window.innerHeight - topInset) / 2,
  };
}

// Pan so the focused story card's on-screen center lands in the focus region
// (below the banner). Uses the rendered card bbox when available so counter-
// scaling and full-fold geometry don't skew the anchor math.
function panToCenterStoryFocus(coord, k) {
  const focus = storyFocusCenterScreen();
  const cardEl = document.querySelector(".story-current-card g.card");
  if (cardEl && isNodeStep(state.story?.step) && state.transform) {
    const r = cardEl.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const k0 = state.transform.k;
      const wx = (r.left + r.width / 2 - state.transform.x) / k0;
      const wy = (r.top + r.height / 2 - state.transform.y) / k0;
      return {
        tx: focus.cx - wx * k,
        ty: focus.cy - wy * k,
        k,
      };
    }
  }
  return {
    tx: focus.cx - coord.x * k,
    ty: focus.cy - coord.y * k,
    k,
  };
}

// Pan to a story step. Clicks may bump zoom into the full-card band when the
// user is still at overview. Arrow / on-screen prev-next animate pan at navZoomK.
function zoomToStep(coord, { preserveZoom = false } = {}) {
  if (!state.transform || !svg || !zoom) return;
  let k;
  if (preserveZoom) {
    if (state.story.navZoomK == null) {
      state.story.navZoomK = state.transform.k;
    }
    k = state.story.navZoomK;
  } else {
    k = Math.max(state.transform.k, STORY_NAV_MIN_K);
    state.story.navZoomK = k;
    state.story.cardLook = "full";
  }
  const { tx, ty } = panToCenterStoryFocus(coord, k);
  const target = d3.zoomIdentity.translate(tx, ty).scale(k);
  if (
    Math.abs(tx - state.transform.x) < 0.5 &&
    Math.abs(ty - state.transform.y) < 0.5 &&
    Math.abs(k - state.transform.k) < 1e-6
  ) {
    return;
  }
  const duration = 500;
  const lockId = ++storyCameraLockId;
  if (preserveZoom) {
    state.story.cameraLock = {
      k,
      panOnly: true,
      until: performance.now() + duration + 100,
      id: lockId,
    };
  } else {
    state.story.cameraLock = {
      tx,
      ty,
      k,
      panOnly: false,
      until: performance.now() + duration + 100,
      id: lockId,
    };
  }
  svg.interrupt();
  svg.transition()
    .duration(duration)
    .on("end", () => {
      if (state.story?.cameraLock?.id === lockId) state.story.cameraLock = null;
    })
    .call(zoom.transform, target);
}

// Step ±1 focus point — half-integer increments so each press cycles
// node → edge → node → edge. Clamped to [0, N-1].
function stepBy(delta) {
  if (!state.story) return;
  const total = state.story.nodes.length;
  if (!total) return;
  const cur = state.story.step == null ? 0 : state.story.step;
  const next = Math.max(0, Math.min(total - 1, cur + delta * 0.5));
  if (next === cur) return;
  gotoStep(next, { preserveZoom: true });
}

// Disable prev at step 0 and next at the last step. Re-evaluated on every
// redraw so the ends reflect manual pans, not just explicit step presses.
function updateStoryNavButtons() {
  const prev = document.getElementById("story-prev-btn");
  const next = document.getElementById("story-next-btn");
  if (!prev || !next) return;
  if (!state.story) {
    prev.disabled = true;
    next.disabled = true;
    return;
  }
  const total = state.story.nodes.length;
  const cur = state.story.step == null ? 0 : state.story.step;
  prev.disabled = cur <= 0;
  next.disabled = cur >= total - 1;
}

// ---- camera fit -----------------------------------------------------------

export function computeStoryFitTransform(nodes) {
  if (!nodes || !nodes.length) return null;
  if (nodes.length === 1) {
    const k = 1.5;
    const c = storyCoord(nodes[0]);
    return d3.zoomIdentity
      .translate(window.innerWidth / 2 - c.x * k, window.innerHeight / 2 - c.y * k)
      .scale(k);
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const c = storyCoord(n);
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
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
  updateStoryNavButtons();

  // Always re-tag — fresh card/dot/label entries from the regular pipeline
  // need the .story-member class added; exits take care of removal. Node
  // focus drives .story-current on the matching card; edge focus leaves
  // all cards uncurrent (the sticky carries the highlight instead).
  const session = state.story;
  const memberIds = new Set(session ? session.nodes.map((n) => n.id) : []);
  const currentId = session && isNodeStep(session.step) && session.nodes[session.step]
    ? session.nodes[session.step].id
    : null;

  d3.selectAll("g.cards > g.card")
    .classed("story-member", (n) => memberIds.has(n.id))
    .classed("story-current", (n) => n.id === currentId);
  d3.selectAll(".dots circle.dag-dot").classed("story-member", (n) => memberIds.has(n.id));
  d3.selectAll(".labels g.dag-label, .sticky-labels g.dag-label, .search-labels g.dag-label")
    .classed("story-member", (d) => memberIds.has(d.id));

  if (!state.story || !state.story.nodes.length) {
    gStoryTrace.selectAll("*").remove();
    return;
  }

  // Ribbon: a single continuous polyline through every story node's
  // center. Independent corner-offset segments leave visible gaps at each
  // card — at zoomed-out band-cluster views the user sees only the long
  // segments between separated cards and the cluster pairs look
  // disconnected. A through-center polyline reads as one continuous
  // arc; the ribbon paints above the story cards (see universe.js layer
  // order) so cluster-internal connections are visible too.
  const d = state.story.nodes
    .map((n, i) => {
      const c = storyCoord(n);
      return `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`;
    })
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
const STICKY_EDGE_W = 240;
const STICKY_EDGE_H = 110;
const STICKY_GAP = 12;
const STICKY_MAX_ITER = 60;

// Screen-space rect representing where edge labels are allowed to sit.
// Top edge respects header + story banner; the rest is window bounds with
// a small padding so labels don't crowd the screen edge.
function viewportRect() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const banner = document.getElementById("story-banner");
  const bannerH = banner ? banner.getBoundingClientRect().height : 0;
  const topInset = (state.headerHeight || 0) + bannerH + HEADER_PAD;
  const PAD = 8;
  return { x0: PAD, y0: topInset + PAD, x1: w - PAD, y1: h - PAD };
}

// Clip segment (x1,y1)-(x2,y2) against rect. Returns the entry point (where
// the segment first crosses into the rect from outside), with the inward
// unit-normal so callers can pull a label off the screen edge. Returns null
// if the segment doesn't intersect the rect.
function clipSegmentToRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tEnter = 0;
  let tExit = 1;
  let enterAxis = null; // "x" or "y" for the side that determined tEnter
  const sides = [
    { p: -dx, q: x1 - rect.x0, axis: "x", inward: 1 },  // left   (x >= x0)
    { p:  dx, q: rect.x1 - x1, axis: "x", inward: -1 }, // right  (x <= x1)
    { p: -dy, q: y1 - rect.y0, axis: "y", inward: 1 },  // top    (y >= y0)
    { p:  dy, q: rect.y1 - y1, axis: "y", inward: -1 }, // bottom (y <= y1)
  ];
  let inwardX = 0, inwardY = 0;
  for (const s of sides) {
    if (s.p === 0) {
      if (s.q < 0) return null; // parallel and outside
      continue;
    }
    const t = s.q / s.p;
    if (s.p < 0) {
      if (t > tEnter) {
        tEnter = t;
        enterAxis = s.axis;
        inwardX = s.axis === "x" ? s.inward : 0;
        inwardY = s.axis === "y" ? s.inward : 0;
      }
    } else {
      if (t < tExit) tExit = t;
    }
  }
  if (tEnter > tExit) return null;
  // tEnter === 0 means (x1, y1) is already inside; no edge crossing.
  if (tEnter <= 0 || enterAxis == null) return null;
  return {
    x: x1 + dx * tEnter,
    y: y1 + dy * tEnter,
    inwardX,
    inwardY,
  };
}

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
  if (!state.transform || !state.story) return [];
  const k = state.transform.k;
  const tx = state.transform.x;
  const ty = state.transform.y;

  const items = [];
  // Edge stickies — anchored at the midpoint of the corner-offset ribbon
  // segment. If the natural midpoint would land the sticky bbox even
  // partly off-screen, slide along the segment to the closest t where the
  // entire bbox fits. The valid t-range comes from intersecting the
  // segment with the rectangle of allowed sticky centers (viewport inset
  // by half-sticky); snap t=0.5 to that range. If no t works (segment
  // doesn't pass through the safe area), skip the sticky entirely.
  const vp = viewportRect();
  const xMin = vp.x0 + STICKY_EDGE_W / 2;
  const xMax = vp.x1 - STICKY_EDGE_W / 2;
  const yMin = vp.y0 + STICKY_EDGE_H / 2;
  const yMax = vp.y1 - STICKY_EDGE_H / 2;
  for (let i = 0; i < state.story.nodes.length - 1; i++) {
    const a = state.story.nodes[i];
    const b = state.story.nodes[i + 1];
    const step = state.story.steps[i + 1];
    if (!step || !step.edgeNote) continue;
    const { a: ea, b: eb } = edgeAnchors(a, b);
    const ax = tx + ea.x * k;
    const ay = ty + ea.y * k;
    const bx = tx + eb.x * k;
    const by = ty + eb.y * k;
    const dx = bx - ax;
    const dy = by - ay;
    let tLo = 0, tHi = 1;
    if (dx !== 0) {
      const t1 = (xMin - ax) / dx;
      const t2 = (xMax - ax) / dx;
      tLo = Math.max(tLo, Math.min(t1, t2));
      tHi = Math.min(tHi, Math.max(t1, t2));
    } else if (ax < xMin || ax > xMax) {
      continue;
    }
    if (dy !== 0) {
      const t1 = (yMin - ay) / dy;
      const t2 = (yMax - ay) / dy;
      tLo = Math.max(tLo, Math.min(t1, t2));
      tHi = Math.min(tHi, Math.max(t1, t2));
    } else if (ay < yMin || ay > yMax) {
      continue;
    }
    if (tLo > tHi) continue;
    const t = Math.max(tLo, Math.min(tHi, 0.5));
    const midX = ax + t * dx;
    const midY = ay + t * dy;
    items.push({
      id: `edge-${a.id}-${b.id}`,
      type: "edge",
      note: step.edgeNote,
      cx: midX, cy: midY,
      w: STICKY_EDGE_W, h: STICKY_EDGE_H,
      // Click on this edge sticky → goto its destination step.
      destStepIndex: i + 1,
    });
  }

  // Sticky-vs-sticky collision avoidance — push apart on the shorter
  // overlap axis. We deliberately do NOT push stickies away from cards:
  // the rule the user wants is "label always overlaps its edge", which
  // outranks "never touch a card". Stickies stay anchored on the edge.
  for (let iter = 0; iter < STICKY_MAX_ITER; iter++) {
    let moved = false;
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

const STICKY_MINI_W = 28;
const STICKY_MINI_H = 28;

export function renderStickies() {
  if (!state.story) {
    gStoryStickies.selectAll("*").remove();
    if (gStoryStickiesFocused) gStoryStickiesFocused.selectAll("*").remove();
    return;
  }
  // Base layer: mini squares when zoomed out, full notes when zoomed in.
  // Focused edge (gStoryStickiesFocused): always full prose at any zoom.
  syncStoryCardLook(state.transform?.k ?? 0);
  const baseMode = storyCardsAreThumb() ? "mini" : "full";
  const isFocusedEdge = (d) => {
    if (d.type !== "edge" || !isEdgeStep(state.story.step)) return false;
    return edgeIdxOf(state.story.step) === d.destStepIndex - 1;
  };
  const fullItems = layoutStickies();
  const baseItems = (baseMode === "mini" ? layoutMiniStickies() : fullItems)
    .filter((d) => !isFocusedEdge(d));
  const focusedItems = fullItems.filter(isFocusedEdge);

  if (gStoryStickies.attr("data-mode") !== baseMode) {
    gStoryStickies.selectAll("*").remove();
    gStoryStickies.attr("data-mode", baseMode);
  }
  if (gStoryStickiesFocused && gStoryStickiesFocused.attr("data-mode") !== "full") {
    gStoryStickiesFocused.selectAll("*").remove();
    gStoryStickiesFocused.attr("data-mode", "full");
  }

  bindStickyLayer(gStoryStickies, baseItems, baseMode, false);
  if (gStoryStickiesFocused) {
    bindStickyLayer(gStoryStickiesFocused, focusedItems, "full", true);
  }
}

// Shared bind for both sticky layers. `focusedLayer` is purely a class
// hint — both layers carry identical markup, but only items in the
// focused layer get the .story-current class (and thus the rose glow).
function bindStickyLayer(layer, items, mode, focusedLayer) {
  const sel = layer.selectAll("g.story-sticky").data(items, (d) => d.id);
  sel.exit().remove();

  const entered = sel.enter().append("g")
    .attr("class", (d) => `story-sticky story-sticky-${d.type}${mode === "mini" ? " story-sticky-mini" : ""}`);
  const scaler = entered.append("g").attr("class", "sticky-scaler");
  scaler.append("foreignObject")
    .attr("x", (d) => -d.w / 2)
    .attr("y", (d) => -d.h / 2)
    .attr("width", (d) => d.w)
    .attr("height", (d) => d.h)
    .append("xhtml:div").attr("class", (d) => `sticky-note ${d.type}`);

  const merged = entered.merge(sel);
  merged.attr("transform", (d) => `translate(${d.worldX}, ${d.worldY}) rotate(${d.tilt})`);
  // In mini mode the square has no text; in full mode the prose fills it.
  merged.select(".sticky-note").text(mode === "mini" ? "" : (d) => d.note);
  // Only the focused-layer stickies get the highlight class.
  merged.classed("story-current", focusedLayer);
  // Click a sticky → focus that edge (camera centers between its cards).
  merged.style("cursor", "pointer");
  merged.on("click", (event, d) => {
    if (d.type !== "edge" || typeof d.destStepIndex !== "number") return;
    event.stopPropagation();
    gotoStep(d.destStepIndex - 0.5);
  });
}

// Mini-sticky layout: small marker at the edge midpoint, but only when the
// edge's segment actually crosses the viewport. Off-screen edges get
// nothing — at overview zoom the marker only carries "there's prose here"
// signal, and that signal is meaningless if the edge can't be reached
// from where the user is looking.
function layoutMiniStickies() {
  if (!state.transform || !state.story) return [];
  const k = state.transform.k;
  const tx = state.transform.x;
  const ty = state.transform.y;
  const vp = viewportRect();
  const items = [];
  for (let i = 0; i < state.story.nodes.length - 1; i++) {
    const a = state.story.nodes[i];
    const b = state.story.nodes[i + 1];
    const step = state.story.steps[i + 1];
    if (!step || !step.edgeNote) continue;
    const { a: ea, b: eb } = edgeAnchors(a, b);
    const ax = tx + ea.x * k;
    const ay = ty + ea.y * k;
    const bx = tx + eb.x * k;
    const by = ty + eb.y * k;
    // Skip if the segment doesn't cross the viewport.
    if (!segmentIntersectsRect(ax, ay, bx, by, vp)) continue;
    const cx = (ax + bx) / 2;
    const cy = (ay + by) / 2;
    // Even if the segment touches the viewport, the midpoint might land
    // outside it. Skip in that case — the marker should sit on the
    // ribbon, not at a clipped position with a misleading anchor.
    if (cx < vp.x0 || cx > vp.x1 || cy < vp.y0 || cy > vp.y1) continue;
    items.push({
      id: `edge-${a.id}-${b.id}`,
      type: "edge",
      note: step.edgeNote,
      cx, cy,
      w: STICKY_MINI_W, h: STICKY_MINI_H,
      worldX: (cx - tx) / k,
      worldY: (cy - ty) / k,
      tilt: 0,
      destStepIndex: i + 1,
    });
  }
  return items;
}

// Test whether the segment (x1,y1)–(x2,y2) intersects rect vp. Uses a
// Liang–Barsky parametric clip: any non-empty t-range in [0, 1] within
// all four half-plane constraints means there's overlap.
function segmentIntersectsRect(x1, y1, x2, y2, vp) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - vp.x0, vp.x1 - x1, y1 - vp.y0, vp.y1 - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
      continue;
    }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > tMin) tMin = t; }
    else          { if (t < tMax) tMax = t; }
    if (tMin > tMax) return false;
  }
  return true;
}

// ---- render: cards / thumbnails for story members ----------------------

// Non-focused story cards / edge stickies use thumb vs full with hysteresis so
// k hovering near one threshold (especially during step pans at ~0.3) does not
// tear down and rebuild every card each frame.
const STORY_ENTER_THUMB_K = 0.26;
const STORY_ENTER_FULL_K = 0.34;
const STORY_NAV_MIN_K = STORY_ENTER_FULL_K;

function syncStoryCardLook(k) {
  if (!state.story || !Number.isFinite(k)) return;
  let look = state.story.cardLook;
  if (look == null) {
    look = k >= STORY_ENTER_FULL_K ? "full" : "thumb";
  } else if (look === "full" && k < STORY_ENTER_THUMB_K) {
    look = "thumb";
  } else if (look === "thumb" && k > STORY_ENTER_FULL_K) {
    look = "full";
  }
  state.story.cardLook = look;
}

function storyCardsAreThumb() {
  return state.story?.cardLook === "thumb";
}
// Track the last "look" rendered per layer so we can detect thumb↔full
// transitions and force a clean re-enter. A d3 key function alone is not
// enough — the key is computed with the *current* closure for both old and
// new bound data, so existing cards get reused with their stale initial
// fold even after isThumb flips.
const lastLook = new WeakMap();
function bindStoryCards(layer, nodes, isCurrent) {
  const isThumb = !isCurrent && storyCardsAreThumb();
  const fold = isThumb ? 0 : 1;
  const wantLook = isThumb ? "thumb" : "full";
  const layerNode = layer.node();
  if (lastLook.get(layerNode) !== wantLook) {
    layer.selectAll("g.card").remove();
    lastLook.set(layerNode, wantLook);
  }
  const sel = layer.selectAll("g.card").data(nodes, (n) => n.id);
  sel.exit().remove();
  renderFullCard(sel.enter(), fold)
    .on("click", (event, n) => {
      // Story-mode click: navigate to this step instead of toggling a pin
      // (pinning is disabled in story mode — see overlays.js onPinClick).
      event.preventDefault();
      event.stopPropagation();
      if (!state.story) return;
      const idx = state.story.nodes.findIndex((sn) => sn.id === n.id);
      if (idx >= 0) gotoStep(idx);
    })
    .on("mouseenter", (event, n) => onHoverEnterFn && onHoverEnterFn(event, n))
    .on("mousemove", () => onHoverMoveFn && onHoverMoveFn())
    .on("mouseleave", (event, n) => onHoverLeaveFn && onHoverLeaveFn(event, n));
  layer.selectAll("g.card")
    .attr("transform", (n) => {
      const c = storyCoord(n);
      return `translate(${c.x}, ${c.y})`;
    })
    .classed("story-member", true)
    .classed("story-current", isCurrent)
    .classed("story-thumb", isThumb);
}

export function renderStoryCards() {
  if (!state.story || !state.story.nodes.length) {
    gStoryCards.selectAll("*").remove();
    if (gStoryCurrentCard) gStoryCurrentCard.selectAll("*").remove();
    return;
  }
  syncStoryCardLook(state.transform?.k ?? 0);
  // Edge focus has no "current node" — all cards render in gStoryCards.
  const currentId = isNodeStep(state.story.step) && state.story.nodes[state.story.step]
    ? state.story.nodes[state.story.step].id
    : null;
  const nonCurrent = currentId == null
    ? state.story.nodes
    : state.story.nodes.filter((n) => n.id !== currentId);
  const current = currentId == null
    ? []
    : state.story.nodes.filter((n) => n.id === currentId);

  gStoryCards.selectAll("g.story-cards-visible, g.story-cards-away").remove();
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
  if (!state.story) return;

  const story = state.storiesById[state.story.id];
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
  close.addEventListener("click", () => requestExitStory());
  head.appendChild(close);
  banner.appendChild(head);

  if (story.blurb) {
    const blurb = document.createElement("p");
    blurb.className = "story-blurb";
    blurb.textContent = story.blurb;
    banner.appendChild(blurb);
  }
}

// Public entry point for "leave the current story?" — used by Esc, the
// banner ×, and the in-story click on a card outside the story. Always
// goes through the confirm; only popstate / programmatic exits call
// exitStory() directly.
export function requestExitStory() {
  if (!state.story) return;
  const story = state.storiesById[state.story.id];
  const title = (story && story.title) || "this story";
  showConfirm({
    title: `Leave "${title}"?`,
    actions: [
      { label: "Leave story", primary: true, onClick: () => exitStory() },
      { label: "Stay", primary: false, onClick: () => {} },
    ],
    onDismiss: () => {},
  });
}

// Orchestrates the story-aware behavior of a baseline card/dot click.
// Returns true when the story system has consumed the click (either
// jumped, opened a prompt, or otherwise handled it); the caller should
// fall through to its default pin behavior only when this returns false.
//
//   pinFn — callback invoked if the user picks "Just pin" from an
//   outside-story prompt. The caller passes its own pin/unpin closure so
//   stories.js doesn't need to know about pin internals.
export function handleCardClickInStoryContext(node, pinFn) {
  // --- Inside a story -----------------------------------------------------
  if (state.story) {
    // Member of the current story → jump to its step. No prompt.
    if (gotoCardInStory(node.id)) return true;

    // Not a member. What other stories is this card in?
    const others = getStoriesForCard(node.id).filter((s) => s.slug !== state.story);
    if (others.length > 0) {
      // anchorNodeId so the card the user clicked stays put when the new
      // story's band-y kicks in (others jitter around it instead).
      const actions = others.map((s) => ({
        label: `Switch to "${s.title}"`,
        primary: others.length === 1,
        onClick: () => enterStory(s.slug, { animate: true, anchorNodeId: node.id }),
      }));
      actions.push({ label: "Stay", primary: false, onClick: () => {} });
      showConfirm({
        title: others.length === 1
          ? `This card is part of a different story.`
          : `This card is part of ${others.length} other stories.`,
        actions,
        onDismiss: () => {},
      });
      return true;
    }

    // Not in any other story → offer to leave the current one. Use the
    // card's name in the title so the user knows exactly what they
    // clicked, and pin the card on "Leave" (no point leaving the story
    // only to be dropped at no pin — the user's intent was clearly to
    // inspect THIS card).
    const cur = state.storiesById[state.story.id];
    const curTitle = (cur && cur.title) || "this story";
    const cardName = node.title || node.id;
    showConfirm({
      title: `${cardName} isn't part of "${curTitle}". Leave the story?`,
      actions: [
        {
          label: "Leave the story",
          primary: true,
          onClick: () => {
            exitStory();
            if (typeof pinFn === "function") pinFn();
          },
        },
        { label: "Stay", primary: false, onClick: () => {} },
      ],
      onDismiss: () => {},
    });
    return true;
  }

  // --- Outside a story ----------------------------------------------------
  // No modal here — the click pins as usual. If the pinned card is a story
  // member, a "Part of the X" chip surfaces underneath it (see
  // renderStoryCardChip). That keeps card inspection unobstructed while
  // still surfacing the story as an opt-in next step.
  return false;
}

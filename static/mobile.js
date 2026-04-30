import { loadGraph, formatField, formatYear } from "./utils.js";
import { cardWidth, fullCardHeight, renderFullCard } from "./card.js";
import { searchHelper } from "./search.js";
import { parsePathPin, pushPath } from "./routing.js";


const DECK_DEPTH = 4;
const SEARCH_MIN_CHARS = 2;
const SEARCH_MAX_RESULTS = 30;

// Number of era ticks on the timeline. Stops are derived at init from the
// data — placed at evenly-spaced percentiles of the chronological sort so the
// bar always reads as "uniformly distributed inventions." 5 ticks at 0/25/
// 50/75/100% gives readable labels without crowding.
const ERA_TICK_COUNT = 5;
const SWIPE_DIST = 80;
const SWIPE_MAX_VERT = 60;
const TAP_MAX_MOVE = 8;
const TRANSITION_MS = 320;
const ROTATE_PER_PX = 0.05;
const DRAG_DIP_PER_PX = 0.04;
const DRAG_PROGRESS_RANGE = 200;

// Depth poses must mirror the CSS depth tiers (.slot[data-depth="N"]) in
// mobile.css. We re-encode them here so JS can interpolate between tiers
// during a drag, when CSS transitions are disabled (.slot.dragging).
const DEPTH_POSE = [
  { ty: 0, scale: 1, opacity: 1 },
  { ty: 14, scale: 0.955, opacity: 0.96 },
  { ty: 28, scale: 0.91, opacity: 0.88 },
  { ty: 42, scale: 0.865, opacity: 0.78 },
];
// Off-screen poses for cards introduced mid-drag (mirror the CSS classes
// .entering-bottom and .enter-from-right/left).
const ENTERING_BOTTOM_POSE = { ty: 80, scale: 0.8, opacity: 0 };
const ENTERING_FROM_RIGHT_POSE = { txPct: 130, ty: -8, rot: 14, scale: 0.94, opacity: 0 };
const ENTERING_FROM_LEFT_POSE = { txPct: -130, ty: -8, rot: -14, scale: 0.94, opacity: 0 };

const state = {
  nodes: [],
  // null = all fields. When set (e.g. "space"), state.sorted is filtered to
  // that field. The deck is always chronological.
  fieldFilter: null,
  fieldOptions: [],
  sorted: [],
  index: 0,
  // Total count of nodes in the dataset — used to normalize the timeline
  // marker's position. Marker uses each node's chronoIndex so the dot moves
  // by an equal step per swipe regardless of how clustered the years are.
  chronoTotal: 0,
};

let deckEl = null;
let drag = null;
let committing = false;
let topWithHandlers = null;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

function lerpPose(from, to, t) {
  return {
    tx: lerp(from.tx ?? 0, to.tx ?? 0, t),
    txPct: lerp(from.txPct ?? 0, to.txPct ?? 0, t),
    ty: lerp(from.ty ?? 0, to.ty ?? 0, t),
    rot: lerp(from.rot ?? 0, to.rot ?? 0, t),
    scale: lerp(from.scale ?? 1, to.scale ?? 1, t),
    opacity: lerp(from.opacity ?? 1, to.opacity ?? 1, t),
  };
}

function applyPose(slot, p) {
  const tx = p.tx ?? 0;
  const txPct = p.txPct ?? 0;
  const ty = p.ty ?? 0;
  const rot = p.rot ?? 0;
  const scale = p.scale ?? 1;
  slot.style.transform =
    `translate(calc(${txPct}% + ${tx}px), ${ty}px) rotate(${rot}deg) scale(${scale})`;
  slot.style.opacity = String(p.opacity ?? 1);
}

function clearInlinePose(slot) {
  slot.style.transform = "";
  slot.style.opacity = "";
}

function compareYear(a, b) {
  return a.year - b.year || a.id.localeCompare(b.id);
}

// Apply the active field filter (if any). The mobile deck always reads
// chronologically — randomness is now a dedicated button (which sets index)
// rather than a sort mode.
function deriveSorted() {
  const pool = state.fieldFilter
    ? state.nodes.filter((n) => formatField(n.field) === state.fieldFilter)
    : state.nodes;
  return pool.slice().sort(compareYear);
}

// Compact year label for tick + counter use. Avoids "4,000,000 BCE" eating the
// whole tick column when years go deep into prehistory.
function formatYearShort(y) {
  if (y <= -1000000) return Math.round(y / 1000000) + "M";
  if (y <= -1000) return Math.round(y / 1000) + "K";
  if (y < 0) return Math.abs(y) + " BCE";
  return String(y);
}

// In a sorted-by-year list, find the index of the entry closest to `node`'s
// year. Same id wins when present; otherwise minimum |year difference|.
// Linear scan over <2k items is fine, no need for a binary search.
function nearestIndexByYear(node, list) {
  if (!list.length) return 0;
  if (!node) return 0;
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === node.id) return i;
    const d = Math.abs(list[i].year - node.year);
    if (d < bestDelta) {
      bestDelta = d;
      best = i;
    }
  }
  return best;
}

// Selector value encoding: "all" = no filter, "field:<name>" = filter to that
// field. Single flat list — no sort option since the deck is always
// chronological and randomness is a separate button.
function selectorValue() {
  return state.fieldFilter ? `field:${state.fieldFilter}` : "all";
}

function applySelectorValue(value) {
  if (value.startsWith("field:")) {
    state.fieldFilter = value.slice("field:".length);
  } else {
    state.fieldFilter = null;
  }
}

function parseHash() {
  const h = location.hash.replace(/^#/, "");
  if (!h) return null;
  const params = new URLSearchParams(h);
  const field = params.get("field");
  const i = parseInt(params.get("i") || "", 10);
  const out = {};
  if (field) out.fieldFilter = field;
  if (Number.isFinite(i) && i >= 0) out.index = i;
  return out;
}

function writeHash() {
  const params = new URLSearchParams();
  if (state.fieldFilter) params.set("field", state.fieldFilter);
  params.set("i", String(state.index));
  const next = "#" + params.toString();
  if (next !== location.hash) history.replaceState(null, "", next);
}

// pushState the canonical /<id> path for the currently visible card so
// back/forward navigates between visited cards, and reload restores you.
function pushCurrentPath() {
  const node = state.sorted[state.index];
  if (node) pushPath(`/${node.id}`);
}

// Position the timeline marker on a specific node — independent of
// state.index so the scrubber can drive it during a drag without a full
// deck rebuild on every pointermove.
function updateMarkerForNode(node) {
  const marker = document.getElementById("mobile-timeline-marker");
  if (!marker || !node) return;
  const pct = state.chronoTotal > 1
    ? (node.chronoIndex / (state.chronoTotal - 1)) * 100
    : 0;
  marker.style.left = pct + "%";
  const mlabel = marker.querySelector(".marker-label");
  if (!mlabel) return;
  mlabel.textContent = formatYearShort(node.year);
  // Edge-anchor the label when the dot is near 0% or 100% so the text doesn't
  // get clipped off the side of the timeline.
  if (pct < 8) {
    mlabel.style.left = "0";
    mlabel.style.right = "auto";
    mlabel.style.transform = "translateX(-4px)";
  } else if (pct > 92) {
    mlabel.style.left = "auto";
    mlabel.style.right = "0";
    mlabel.style.transform = "translateX(4px)";
  } else {
    mlabel.style.left = "50%";
    mlabel.style.right = "auto";
    mlabel.style.transform = "translateX(-50%)";
  }
}

function updateCounter() {
  const node = state.sorted[state.index];
  if (node) updateMarkerForNode(node);
}

function buildBar() {
  const bar = document.createElement("div");
  bar.id = "mobile-bar";

  // Flat one-level list: "All" (no filter) followed by each field. Picking a
  // field filters the deck; the deck always reads chronologically.
  const select = document.createElement("select");
  select.id = "mobile-sort";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All";
  select.appendChild(allOpt);
  for (const f of state.fieldOptions) {
    const o = document.createElement("option");
    o.value = `field:${f}`;
    // Capitalize the field name for display; underlying value stays lowercase.
    o.textContent = f.charAt(0).toUpperCase() + f.slice(1);
    select.appendChild(o);
  }
  select.value = selectorValue();
  select.addEventListener("change", () => {
    if (committing) return;
    // Preserve location across filter/sort changes: same card if it's in the
    // new view; otherwise the closest neighbor by year. Jumping to index 0 on
    // every category change loses the user's place in time, which is what
    // they care about — antiquity vs. modernity is the axis they're navigating.
    const currentNode = state.sorted[state.index] || null;
    applySelectorValue(select.value);
    state.sorted = deriveSorted();
    state.index = nearestIndexByYear(currentNode, state.sorted);
    writeHash();
    pushCurrentPath();
    rebuildDeck();
  });
  bar.appendChild(select);

  // Spacer to push the action buttons to the right end of the bar.
  const spacer = document.createElement("span");
  spacer.className = "spacer";
  bar.appendChild(spacer);

  const randomBtn = document.createElement("button");
  randomBtn.className = "random-button";
  randomBtn.type = "button";
  randomBtn.setAttribute("aria-label", "Random card");
  randomBtn.innerHTML =
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
       <rect x="3" y="3" width="18" height="18" rx="3"/>
       <circle cx="8" cy="8" r="1.2" fill="#444"/>
       <circle cx="16" cy="16" r="1.2" fill="#444"/>
       <circle cx="16" cy="8" r="1.2" fill="#444"/>
       <circle cx="8" cy="16" r="1.2" fill="#444"/>
     </svg>`;
  randomBtn.addEventListener("click", jumpToRandom);
  bar.appendChild(randomBtn);

  const searchBtn = document.createElement("button");
  searchBtn.className = "search-toggle";
  searchBtn.type = "button";
  searchBtn.setAttribute("aria-label", "Search");
  // Inline magnifier SVG so the button has no external asset dependency.
  searchBtn.innerHTML =
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
       <circle cx="11" cy="11" r="7"/>
       <line x1="16.5" y1="16.5" x2="21" y2="21"/>
     </svg>`;
  searchBtn.addEventListener("click", openSearch);
  bar.appendChild(searchBtn);

  document.body.insertBefore(bar, document.body.firstChild);

  // Timeline strip underneath the bar: era ticks for orientation, plus a
  // movable marker that shows the current card's year. Position is by year
  // across the full dataset (piecewise-linear over ERA_STOPS) so it's
  // independent of sort/filter — antiquity vs. modernity at a glance.
  const tl = document.createElement("div");
  tl.id = "mobile-timeline";
  // Inner wrapper has horizontal margin so 0% and 100% positions land slightly
  // inside the screen edges — keeps the leftmost/rightmost tick labels from
  // clipping. All children position against this wrapper.
  const inner = document.createElement("div");
  inner.className = "inner";
  tl.appendChild(inner);
  const track = document.createElement("div");
  track.className = "track";
  inner.appendChild(track);
  for (const stop of state.eraStops) {
    const tick = document.createElement("div");
    tick.className = "tick";
    tick.style.left = stop.pct + "%";
    const tlabel = document.createElement("span");
    tlabel.className = "tick-label";
    tlabel.textContent = stop.label;
    tick.appendChild(tlabel);
    inner.appendChild(tick);
  }
  const marker = document.createElement("div");
  marker.id = "mobile-timeline-marker";
  const mlabel = document.createElement("span");
  mlabel.className = "marker-label";
  marker.appendChild(mlabel);
  inner.appendChild(marker);
  // Mount at the end of the body so the body's flex-column lays it out below
  // the card container — feels more like the deck "advances along" the
  // timeline beneath it than a chrome strip pushing the deck down.
  document.body.appendChild(tl);
}

let searchInputEl = null;
let searchResultsEl = null;

function initSearch() {
  searchInputEl = document.getElementById("search-input");
  searchResultsEl = document.getElementById("search-results");
  if (!searchInputEl || !searchResultsEl) return;
  searchInputEl.addEventListener("input", renderSearchResults);
  searchInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
    }
  });
  // Tap outside the results / input to dismiss. Listening on results' parent
  // would miss the "tap on faded deck" case, so we listen on the document and
  // gate on whether the target is inside the search UI.
  document.addEventListener("click", (e) => {
    if (!document.body.classList.contains("mobile-searching")) return;
    if (
      e.target === searchInputEl ||
      searchInputEl.contains(e.target) ||
      searchResultsEl.contains(e.target) ||
      e.target.closest(".search-toggle")
    ) return;
    closeSearch();
  });
}

function openSearch() {
  if (!searchInputEl) return;
  document.body.classList.add("mobile-searching");
  searchInputEl.value = "";
  renderSearchResults();
  // Defer focus until the input is actually display:block — focus on a hidden
  // input is a no-op on iOS Safari.
  requestAnimationFrame(() => searchInputEl.focus());
}

function closeSearch() {
  if (!searchInputEl) return;
  document.body.classList.remove("mobile-searching");
  searchInputEl.value = "";
  searchInputEl.blur();
  searchResultsEl.innerHTML = "";
}

function renderSearchResults() {
  if (!searchResultsEl || !searchInputEl) return;
  const q = searchInputEl.value.trim();
  searchResultsEl.innerHTML = "";
  if (q.length < SEARCH_MIN_CHARS) return;

  const matches = [];
  for (const n of state.nodes) {
    if (searchHelper(n, q)) {
      matches.push(n);
      if (matches.length >= SEARCH_MAX_RESULTS) break;
    }
  }
  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mobile-result empty";
    empty.textContent = "No matches.";
    searchResultsEl.appendChild(empty);
    return;
  }
  for (const n of matches) {
    const row = document.createElement("div");
    row.className = "mobile-result";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = n.title;
    const meta = document.createElement("div");
    meta.className = "meta";
    const fieldLabel = formatField(n.field);
    meta.textContent = `${formatYear(n.year)} · ${fieldLabel}`;
    row.appendChild(title);
    row.appendChild(meta);
    row.addEventListener("click", () => jumpToNode(n));
    searchResultsEl.appendChild(row);
  }
}

// Drag-to-scrub on the timeline. The dot follows the finger; on release we
// commit the deck to the chosen card. We don't rebuild the deck mid-drag —
// rendering 4 SVG cards every pointermove would jank — so the marker label
// is the live preview during the gesture.
let scrubbing = false;
let scrubbedIndex = -1;
let scrubInner = null;

function attachTimelineScrubber() {
  const inner = document.querySelector("#mobile-timeline .inner");
  if (!inner) return;
  scrubInner = inner;
  inner.style.touchAction = "none";
  inner.addEventListener("pointerdown", onScrubDown);
}

function onScrubDown(e) {
  if (committing) return;
  e.preventDefault();
  scrubbing = true;
  scrubbedIndex = -1;
  scrubInner.setPointerCapture?.(e.pointerId);
  document.body.classList.add("mobile-scrubbing");
  scrubInner.addEventListener("pointermove", onScrubMove);
  scrubInner.addEventListener("pointerup", onScrubUp);
  scrubInner.addEventListener("pointercancel", onScrubCancel);
  onScrubMove(e);
}

function onScrubMove(e) {
  if (!scrubbing || !state.sorted.length) return;
  const rect = scrubInner.getBoundingClientRect();
  if (rect.width <= 0) return;
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  // Map screen position → chronoIndex of full dataset → nearest card in the
  // current filtered + sorted view. Filter-aware: scrubbing inside Field —
  // Space lands on space cards.
  const target = pct * (state.chronoTotal - 1);
  let best = 0;
  let bestDelta = Infinity;
  for (let i = 0; i < state.sorted.length; i++) {
    const d = Math.abs(state.sorted[i].chronoIndex - target);
    if (d < bestDelta) {
      bestDelta = d;
      best = i;
    }
  }
  scrubbedIndex = best;
  updateMarkerForNode(state.sorted[scrubbedIndex]);
}

function onScrubUp() {
  detachScrub();
  if (scrubbedIndex >= 0 && scrubbedIndex !== state.index) {
    state.index = scrubbedIndex;
    writeHash();
    pushCurrentPath();
    rebuildDeck();
  } else {
    // No-op release (didn't move): snap marker back to authoritative state.
    updateCounter();
  }
  scrubbedIndex = -1;
}

function onScrubCancel() {
  detachScrub();
  scrubbedIndex = -1;
  updateCounter();
}

function detachScrub() {
  scrubbing = false;
  document.body.classList.remove("mobile-scrubbing");
  if (!scrubInner) return;
  scrubInner.removeEventListener("pointermove", onScrubMove);
  scrubInner.removeEventListener("pointerup", onScrubUp);
  scrubInner.removeEventListener("pointercancel", onScrubCancel);
}

// Pick a uniform random card within the current view (filter respected).
function jumpToRandom() {
  if (committing || !state.sorted.length) return;
  let next = Math.floor(Math.random() * state.sorted.length);
  if (state.sorted.length > 1 && next === state.index) {
    // Avoid the no-op "random" that lands on the card you're already viewing.
    next = (next + 1) % state.sorted.length;
  }
  state.index = next;
  writeHash();
  pushCurrentPath();
  rebuildDeck();
}

// Jumping to a result drops any active field filter when the target falls
// outside it — same logic as init's path-vs-filter reconciliation.
function jumpToNode(node) {
  if (state.fieldFilter && formatField(node.field) !== state.fieldFilter) {
    state.fieldFilter = null;
    state.sorted = deriveSorted();
    syncSelectorUI();
  }
  const idx = state.sorted.findIndex((n) => n.id === node.id);
  if (idx < 0) return;
  state.index = idx;
  closeSearch();
  writeHash();
  pushCurrentPath();
  rebuildDeck();
}

function syncSelectorUI() {
  const sel = document.getElementById("mobile-sort");
  if (sel) sel.value = selectorValue();
}

function buildDeck() {
  const container = document.getElementById("container");
  deckEl = document.createElement("div");
  deckEl.id = "deck";
  // Aspect ratio mirrors the card geometry so the deck box matches the
  // SVG viewBox without letterboxing — keep it in sync with card.js.
  deckEl.style.aspectRatio = `${cardWidth} / ${fullCardHeight}`;
  container.appendChild(deckEl);
}

function makeSlot(node, depth) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.dataset.depth = String(depth);

  const svg = d3
    .select(slot)
    .append("svg")
    .attr("class", "mobile-card")
    .attr("viewBox", `0 0 ${cardWidth} ${fullCardHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
  const stage = svg
    .append("g")
    .attr("transform", `translate(${cardWidth / 2}, ${fullCardHeight / 2})`);
  const enter = stage.selectAll("g.card").data([node]).enter();
  renderFullCard(enter, 1);

  return slot;
}

function rebuildDeck() {
  if (!deckEl) return;
  detachDragHandlers();
  deckEl.innerHTML = "";
  for (let d = 0; d < DECK_DEPTH; d++) {
    const idx = state.index + d;
    if (idx >= state.sorted.length) break;
    deckEl.appendChild(makeSlot(state.sorted[idx], d));
  }
  attachDragHandlers();
  updateCounter();
}

function attachDragHandlers() {
  detachDragHandlers();
  const top = deckEl?.querySelector('.slot[data-depth="0"]');
  if (!top) return;
  top.addEventListener("pointerdown", onPointerDown);
  topWithHandlers = top;
}

// After a commit's CSS transition finishes the in-DOM slots are already at the
// right depths (we promote/demote during the transition). Just drop the slot
// that's now off-deck and re-bind drag handlers — no full rebuild, so the new
// top card keeps the same <image> element it had at depth=1 and doesn't blink.
function cleanupAfterCommit(disposed) {
  if (disposed && disposed.parentNode) disposed.remove();
  detachDragHandlers();
  attachDragHandlers();
  updateCounter();
}

function detachDragHandlers() {
  if (!topWithHandlers) return;
  topWithHandlers.removeEventListener("pointerdown", onPointerDown);
  topWithHandlers = null;
}

// All slots that aren't drag-spawned (no data-role), ordered by depth.
function realSlotsByDepth() {
  return [...deckEl.querySelectorAll(".slot:not([data-role])")].sort(
    (a, b) => Number(a.dataset.depth) - Number(b.dataset.depth)
  );
}

function onPointerDown(e) {
  if (!e.isPrimary || drag || committing) return;
  const slot = e.currentTarget;
  drag = {
    slot,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
    direction: 0, // +1 forward, -1 backward (set on first move past TAP_MAX_MOVE)
    enteringBottom: null,
    prev: null,
  };
  slot.setPointerCapture?.(e.pointerId);
  slot.addEventListener("pointermove", onPointerMove);
  slot.addEventListener("pointerup", onPointerUp);
  slot.addEventListener("pointercancel", onPointerCancel);
}

// On the first pointermove past the tap threshold, lock the drag direction
// and pre-spawn the card that should be coming into view from off-screen
// (next card from below for forward, previous card from the right for
// backward) so it can track the finger live during the drag instead of
// only appearing on commit.
function lockDragDirection(dx) {
  drag.direction = dx < 0 ? +1 : -1;
  // Disable transitions on every existing slot so they all track the
  // finger 1:1 during the drag.
  for (const s of deckEl.querySelectorAll(".slot")) {
    s.classList.add("dragging");
  }
  if (drag.direction > 0) {
    const newIdx = state.index + DECK_DEPTH;
    if (newIdx < state.sorted.length) {
      const n = makeSlot(state.sorted[newIdx], DECK_DEPTH - 1);
      n.classList.add("entering-bottom", "dragging");
      n.dataset.role = "entering-bottom";
      // Force this below the existing deepest slot during the drag —
      // both share the same CSS z-index from .slot[data-depth="N"], and
      // DOM order would otherwise paint the new (later-inserted) one on
      // top. z-index 0 sits below depth-3's CSS z-index 1. Cleared on
      // commit so the standard deepest-tier z-index from CSS takes back
      // over.
      n.style.zIndex = "0";
      deckEl.appendChild(n);
      applyPose(n, ENTERING_BOTTOM_POSE);
      drag.enteringBottom = n;
    }
  } else {
    if (state.index > 0) {
      const p = makeSlot(state.sorted[state.index - 1], 0);
      p.classList.add("enter-from-left", "dragging");
      p.dataset.role = "prev";
      p.style.zIndex = "5";
      deckEl.appendChild(p);
      applyPose(p, ENTERING_FROM_LEFT_POSE);
      drag.prev = p;
    }
  }
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) > TAP_MAX_MOVE) {
    drag.moved = true;
    lockDragDirection(dx);
  }
  if (!drag.moved) return;

  const absDx = Math.abs(dx);
  const t = easeOut(Math.min(1, absDx / DRAG_PROGRESS_RANGE));

  if (drag.direction > 0) {
    // FORWARD: top tracks finger; cards beneath rise toward the next tier.
    const rot = dx * ROTATE_PER_PX;
    const dip = absDx * DRAG_DIP_PER_PX;
    drag.slot.style.transform = `translate(${dx}px, ${dip}px) rotate(${rot}deg)`;
    drag.slot.style.opacity = "";

    const real = realSlotsByDepth();
    for (let i = 1; i < real.length; i++) {
      applyPose(real[i], lerpPose(DEPTH_POSE[i], DEPTH_POSE[i - 1], t));
    }
    if (drag.enteringBottom) {
      applyPose(
        drag.enteringBottom,
        lerpPose(ENTERING_BOTTOM_POSE, DEPTH_POSE[DECK_DEPTH - 1], t)
      );
    }
  } else {
    // BACKWARD: previous card slides in from off-screen-right; top
    // sinks toward depth-1 with a damped horizontal follow so it
    // doesn't feel pinned.
    if (drag.prev) {
      applyPose(drag.prev, lerpPose(ENTERING_FROM_LEFT_POSE, DEPTH_POSE[0], t));
    }
    const sinkPose = lerpPose(DEPTH_POSE[0], DEPTH_POSE[1], t);
    const fingerDx = dx * 0.5;
    const rot = dx * ROTATE_PER_PX * 0.4;
    drag.slot.style.transform =
      `translate(${fingerDx}px, ${sinkPose.ty}px) rotate(${rot}deg) scale(${sinkPose.scale})`;
    drag.slot.style.opacity = String(sinkPose.opacity);
  }
}

function detachPointerHandlers(slot) {
  slot.removeEventListener("pointermove", onPointerMove);
  slot.removeEventListener("pointerup", onPointerUp);
  slot.removeEventListener("pointercancel", onPointerCancel);
}

function snapBackAndCleanup() {
  for (const s of deckEl.querySelectorAll(".slot")) {
    s.classList.remove("dragging");
    if (!s.dataset.role) {
      clearInlinePose(s);
    }
  }
  // Drag-spawned slots: clear inline so the .entering-bottom /
  // .enter-from-right CSS class re-takes the off-screen pose, then
  // remove after the transition completes.
  if (drag?.enteringBottom) {
    const el = drag.enteringBottom;
    clearInlinePose(el);
    setTimeout(() => el.remove(), TRANSITION_MS);
  }
  if (drag?.prev) {
    const el = drag.prev;
    clearInlinePose(el);
    setTimeout(() => el.remove(), TRANSITION_MS);
  }
}

function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const slot = drag.slot;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  const wasTap = !drag.moved;
  detachPointerHandlers(slot);

  if (wasTap) {
    drag = null;
    const rect = slot.getBoundingClientRect();
    const xRel = e.clientX - rect.left;
    if (xRel < rect.width / 2) tapCommit(-1, "right");
    else tapCommit(+1, "left");
    return;
  }

  const horizontalSwipe =
    Math.abs(dx) >= SWIPE_DIST && Math.abs(dy) <= SWIPE_MAX_VERT;
  if (!horizontalSwipe) {
    snapBackAndCleanup();
    drag = null;
    return;
  }

  const direction = dx < 0 ? +1 : -1;
  // If the user reversed direction past threshold from the locked one,
  // snap back rather than commit a confused state.
  if (drag.direction !== 0 && drag.direction !== direction) {
    snapBackAndCleanup();
    drag = null;
    return;
  }
  finalizeDragCommit(direction, dx < 0 ? "left" : "right");
}

function onPointerCancel() {
  if (!drag) return;
  detachPointerHandlers(drag.slot);
  snapBackAndCleanup();
  drag = null;
}

function finalizeDragCommit(direction, exitSide) {
  if (committing) {
    snapBackAndCleanup();
    drag = null;
    return;
  }
  if (direction > 0 && state.index >= state.sorted.length - 1) {
    snapBackAndCleanup();
    drag = null;
    return;
  }
  if (direction < 0 && state.index <= 0) {
    snapBackAndCleanup();
    drag = null;
    return;
  }
  committing = true;
  const snap = drag;
  drag = null;
  if (direction > 0) commitForward(exitSide, snap);
  else commitBackward(exitSide, snap);
}

function tapCommit(direction, exitSide) {
  if (committing) return;
  if (direction > 0 && state.index >= state.sorted.length - 1) return;
  if (direction < 0 && state.index <= 0) return;
  committing = true;
  if (direction > 0) commitForward(exitSide, null);
  else commitBackward(exitSide, null);
}

function nextFrame(fn) {
  return requestAnimationFrame(() => requestAnimationFrame(fn));
}

function commitForward(exitSide, snap) {
  // Re-enable transitions across the deck, then steer each slot to its
  // final pose. CSS transitions on .slot animate from the current
  // computed style (whatever the drag interpolation last set) to the
  // new resting pose.
  for (const s of deckEl.querySelectorAll(".slot")) {
    s.classList.remove("dragging");
  }

  const real = realSlotsByDepth();
  const top = real[0];

  const exitDx =
    (exitSide === "left" ? -1 : 1) * Math.max(window.innerWidth, 600) * 1.1;
  const exitRot = exitSide === "left" ? -16 : 16;
  top.style.transform = `translate(${exitDx}px, -10px) rotate(${exitRot}deg)`;
  top.style.opacity = "0";

  for (let i = 1; i < real.length; i++) {
    clearInlinePose(real[i]);
    real[i].dataset.depth = String(i - 1);
  }

  if (snap?.enteringBottom) {
    const e = snap.enteringBottom;
    e.classList.remove("entering-bottom");
    delete e.dataset.role;
    e.dataset.depth = String(DECK_DEPTH - 1);
    e.style.zIndex = "";
    clearInlinePose(e);
  } else {
    const newIdx = state.index + DECK_DEPTH;
    if (newIdx < state.sorted.length) {
      const newSlot = makeSlot(state.sorted[newIdx], DECK_DEPTH - 1);
      newSlot.classList.add("entering-bottom");
      deckEl.appendChild(newSlot);
      nextFrame(() => newSlot.classList.remove("entering-bottom"));
    }
  }

  setTimeout(() => {
    state.index += 1;
    writeHash();
    pushCurrentPath();
    cleanupAfterCommit(top);
    committing = false;
  }, TRANSITION_MS);
}

function commitBackward(_enterSide, snap) {
  // Backward always brings the previous card in from off-screen-left
  // (the side it was thrown to on its forward exit).
  for (const s of deckEl.querySelectorAll(".slot")) {
    s.classList.remove("dragging");
  }

  const real = realSlotsByDepth();
  // The deepest slot gets pushed out of the deck and faded; capture it so we
  // can drop it after the transition without rebuilding the rest.
  const exiting = real[real.length - 1];
  for (let i = 0; i < real.length; i++) {
    clearInlinePose(real[i]);
    const newDepth = i + 1;
    if (newDepth >= DECK_DEPTH) {
      real[i].classList.add("exit-bottom");
    } else {
      real[i].dataset.depth = String(newDepth);
    }
  }

  if (snap?.prev) {
    const p = snap.prev;
    p.classList.remove("enter-from-right", "enter-from-left");
    delete p.dataset.role;
    p.dataset.depth = "0";
    p.style.zIndex = "";
    clearInlinePose(p);
  } else {
    const newIdx = state.index - 1;
    if (newIdx >= 0) {
      const newSlot = makeSlot(state.sorted[newIdx], 0);
      newSlot.classList.add("enter-from-left");
      deckEl.appendChild(newSlot);
      nextFrame(() => newSlot.classList.remove("enter-from-left"));
    }
  }

  setTimeout(() => {
    state.index -= 1;
    writeHash();
    pushCurrentPath();
    cleanupAfterCommit(exiting);
    committing = false;
  }, TRANSITION_MS);
}

function attachKeyboard() {
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      tapCommit(+1, "left");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      tapCommit(-1, "right");
    }
  });
}

async function init() {
  const { nodes } = await loadGraph("/static/asimov.tsv");
  state.nodes = nodes;

  const fromHash = parseHash();
  if (fromHash?.fieldFilter) state.fieldFilter = fromHash.fieldFilter;

  // Field options come from the data so they're always in sync — no hardcoded
  // list to drift. Sorted alphabetically so the optgroup reads predictably.
  state.fieldOptions = [...new Set(state.nodes.map((n) => formatField(n.field)))]
    .filter((f) => f && f !== "unknown")
    .sort();

  // Each node's chronoIndex is its rank in the chronologically-sorted full
  // dataset. The timeline marker uses this so consecutive swipes always move
  // the dot by exactly 1/(N-1) of the bar — regardless of sort/filter.
  const byYear = state.nodes.slice().sort(compareYear);
  byYear.forEach((n, i) => { n.chronoIndex = i; });
  state.chronoTotal = byYear.length;

  // Era ticks derived from the data, at evenly-spaced percentile points. The
  // tick years come straight out of the chronological sort, so e.g. the 50%
  // tick is the year of the median invention — labels never crowd because
  // their bar positions are 0/25/50/75/100% by construction.
  state.eraStops = [];
  for (let i = 0; i < ERA_TICK_COUNT; i++) {
    const t = i / (ERA_TICK_COUNT - 1);
    const idx = Math.min(byYear.length - 1, Math.round(t * (byYear.length - 1)));
    state.eraStops.push({
      year: byYear[idx].year,
      label: formatYearShort(byYear[idx].year),
      pct: t * 100,
    });
  }
  // If the hash asked for a filter that doesn't actually exist in the data,
  // drop it rather than rendering an empty deck.
  if (state.fieldFilter && !state.fieldOptions.includes(state.fieldFilter)) {
    state.fieldFilter = null;
  }

  state.sorted = deriveSorted();

  // Path is canonical: /<id> jumps to that card; hash index is the fallback.
  // If a field filter is active and the path points to a card outside it, drop
  // the filter so the user lands on the card they explicitly navigated to.
  const pathId = parsePathPin(window.location.pathname);
  if (pathId && state.fieldFilter) {
    const inFilter = state.sorted.some((n) => n.id === pathId);
    if (!inFilter && state.nodes.some((n) => n.id === pathId)) {
      state.fieldFilter = null;
      state.sorted = deriveSorted();
    }
  }
  const pathIdx = pathId ? state.sorted.findIndex((n) => n.id === pathId) : -1;
  if (pathIdx >= 0) {
    state.index = pathIdx;
  } else if (fromHash?.index != null) {
    state.index = Math.min(
      Math.max(0, fromHash.index),
      state.sorted.length - 1
    );
  } else if (state.sorted.length) {
    // Nothing pointed us at a card → land somewhere random so / always feels
    // alive. The path push at the end of init reflects the choice in the URL.
    state.index = Math.floor(Math.random() * state.sorted.length);
  }

  buildBar();
  buildDeck();
  initSearch();
  attachKeyboard();
  attachTimelineScrubber();
  rebuildDeck();
  writeHash();
  pushCurrentPath();

  // Browser back/forward navigates between visited cards. Find the path's id
  // in the current sorted view; if it's not there (filter excluded it), drop
  // the filter so the URL still resolves. No pushPath here — popstate already
  // moved us to that URL.
  window.addEventListener("popstate", () => {
    const id = parsePathPin(window.location.pathname);
    if (!id) return;
    const currentId = state.sorted[state.index]?.id || null;
    if (id === currentId) return;
    let idx = state.sorted.findIndex((n) => n.id === id);
    if (idx < 0 && state.fieldFilter && state.nodes.some((n) => n.id === id)) {
      state.fieldFilter = null;
      state.sorted = deriveSorted();
      syncSelectorUI();
      idx = state.sorted.findIndex((n) => n.id === id);
    }
    if (idx < 0) return;
    state.index = idx;
    writeHash();
    rebuildDeck();
  });
}

init();

import { loadGraph, formatField, formatYear } from "./utils.js";
import { cardWidth, fullCardHeight, renderFullCard } from "./card.js";

const SORT_OPTIONS = [
  { key: "year", label: "Chronological" },
  { key: "field", label: "By field" },
  { key: "random", label: "Random" },
];

const DECK_DEPTH = 4;
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
  sortKey: "year",
  sorted: [],
  index: 0,
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

function compareField(a, b) {
  return (
    formatField(a.field).localeCompare(formatField(b.field)) ||
    compareYear(a, b)
  );
}

function shuffled(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function sortNodes(key) {
  if (key === "field") return state.nodes.slice().sort(compareField);
  if (key === "random") return shuffled(state.nodes);
  return state.nodes.slice().sort(compareYear);
}

function parseHash() {
  const h = location.hash.replace(/^#/, "");
  if (!h) return null;
  const params = new URLSearchParams(h);
  const sort = params.get("sort");
  const i = parseInt(params.get("i") || "", 10);
  const out = {};
  if (sort && SORT_OPTIONS.some((o) => o.key === sort)) out.sortKey = sort;
  if (Number.isFinite(i) && i >= 0) out.index = i;
  return out;
}

function writeHash() {
  const params = new URLSearchParams();
  params.set("sort", state.sortKey);
  params.set("i", String(state.index));
  const next = "#" + params.toString();
  if (next !== location.hash) history.replaceState(null, "", next);
}

function updateCounter() {
  const node = state.sorted[state.index];
  const counter = document.getElementById("mobile-counter");
  if (!counter || !node) return;
  counter.textContent = `${state.index + 1} / ${state.sorted.length} · ${formatYear(node.year)}`;
}

function buildBar() {
  const bar = document.createElement("div");
  bar.id = "mobile-bar";

  const select = document.createElement("select");
  select.id = "mobile-sort";
  for (const opt of SORT_OPTIONS) {
    const o = document.createElement("option");
    o.value = opt.key;
    o.textContent = opt.label;
    select.appendChild(o);
  }
  select.value = state.sortKey;
  select.addEventListener("change", () => {
    if (committing) return;
    state.sortKey = select.value;
    state.sorted = sortNodes(state.sortKey);
    state.index = 0;
    writeHash();
    rebuildDeck();
  });
  bar.appendChild(select);

  const counter = document.createElement("span");
  counter.className = "counter";
  counter.id = "mobile-counter";
  bar.appendChild(counter);

  document.body.insertBefore(bar, document.body.firstChild);
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
    rebuildDeck();
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
    rebuildDeck();
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
  if (fromHash?.sortKey) state.sortKey = fromHash.sortKey;
  state.sorted = sortNodes(state.sortKey);

  // Path is canonical: /<id> jumps to that card; hash index is the fallback.
  const pathId = window.location.pathname.replace(/^\/+|\/+$/g, "");
  const pathIdx = pathId ? state.sorted.findIndex((n) => n.id === pathId) : -1;
  if (pathIdx >= 0) {
    state.index = pathIdx;
  } else if (fromHash?.index != null) {
    state.index = Math.min(
      Math.max(0, fromHash.index),
      state.sorted.length - 1
    );
  }

  buildBar();
  buildDeck();
  attachKeyboard();
  rebuildDeck();
  writeHash();
}

init();

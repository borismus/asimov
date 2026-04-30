// Hover + pin overlays. Both render full cards on top of the baseline graph
// with edge-clipped connector lines, and both manage their own off-screen
// chips. They share five private helpers (clipToCardEdge,
// overlayCardPos/Transform, layoutOverlayLines, lineRectIntersection,
// makeOffscreenChip), which is why they live in the same module.

import { cardWidth, fullCardHeight, cardScreenScale, renderFullCard } from "./card.js";

const HOVER_EXPAND_DELAY_MS = 300;
// All hover overlays (focused card + neighbors + sticky label at LABEL tier)
// wait this long after enter before appearing — quick scanning across dots
// or cards never fires anything; a deliberate linger reveals everything
// at once.
const HOVER_PROMOTE_DELAY_MS = 300;
let hoverLeaveTimeout = null;
let hoverExpandTimer = null;
let hoverPromoteTimer = null;

function clearHoverPromoteTimer() {
  if (hoverPromoteTimer) {
    clearTimeout(hoverPromoteTimer);
    hoverPromoteTimer = null;
  }
}

function clearHoverExpandTimer() {
  if (hoverExpandTimer) {
    clearTimeout(hoverExpandTimer);
    hoverExpandTimer = null;
  }
}

// Reverse-fold + remove the current hover overlay and restore baselines, the
// same dance onHoverLeave's debounce does. Pulled out so node-switching
// (onHoverEnter on a different id) can run the same cleanup synchronously
// instead of relying on the debounced leave path that gets cancelled.
function dismissHoverOverlay() {
  state.hoverNeighbors = [];
  state.hoverLayout = new Map();
  state.hoverExpanded = false;
  state.hoverFoldOpen = false;
  gHoverLines.selectAll("line").remove();

  const pinnedSet = new Set(state.pinnedLayout.keys());
  const restoreBaselines = () => {
    gCards.selectAll("g.card")
      .interrupt()
      .style("opacity", (n) => (pinnedSet.has(n.id) ? 0 : 1));
    gStickyLabels.selectAll("g.dag-label")
      .style("opacity", (d) => (pinnedSet.has(d.id) ? 0 : 1));
  };

  const hoverCards = gHoverCards.selectAll("g.card");
  if (hoverCards.empty()) {
    restoreBaselines();
  } else if (state.tier === TIER_FULL) {
    // Full and baseline overlap pixel-for-pixel; snap-remove avoids a flash.
    gHoverCards.selectAll("*").interrupt().interrupt("fold").remove();
    restoreBaselines();
  } else if (state.tier === TIER_IMG) {
    // Reverse the fold-open animation symmetrically with the enter expand.
    // Killing any prior "fold" tween via the new transition's name reuse means
    // partially-open cards pick up cleanly mid-animation.
    tweenFold(hoverCards, 0)
      .on("end", () => {
        gHoverCards.selectAll("*").interrupt().interrupt("fold").remove();
        restoreBaselines();
      })
      .on("interrupt", () => {
        gHoverCards.selectAll("*").interrupt().interrupt("fold").remove();
        restoreBaselines();
      });
  } else {
    gHoverCards.selectAll("*").interrupt().interrupt("fold")
      .transition().duration(TIER_FADE_MS).style("opacity", 0).remove()
      .on("end", restoreBaselines).on("interrupt", restoreBaselines);
  }
  offscreenContainer
    .querySelectorAll(".offscreen-indicator:not(.pinned)")
    .forEach((el) => el.remove());
}

let state, gCards, gHoverCards, gHoverLines, gPinnedCards, gPinnedLines;
let gStickyLabels, offscreenContainer, svg, zoom;
let persistView, persistPin, tweenFold, appendLabels;
let TIER_LABEL, TIER_IMG, TIER_FULL, TIER_FADE_MS;

export function initOverlays(deps) {
  ({
    state, gCards, gHoverCards, gHoverLines, gPinnedCards, gPinnedLines,
    gStickyLabels, offscreenContainer, svg, zoom,
    persistView, persistPin, tweenFold, appendLabels,
    TIER_LABEL, TIER_IMG, TIER_FULL, TIER_FADE_MS,
  } = deps);
}

// Card-position helpers for hover + pin overlays. Both grab a node's laid-out
// position out of the supplied layout map, falling back to the node's natural
// world coords when the node isn't in the layout (off-screen neighbors).
const overlayCardPos = (layout, n) =>
  layout.get(n.id) || { x: n.x, y: n.y };
const overlayCardTransform = (layout) => (n) => {
  const p = overlayCardPos(layout, n);
  return `translate(${p.x}, ${p.y})`;
};

// Clip the segment from (cx,cy) toward (tx,ty) to a rect of half-extent
// (halfW, halfH) centered at (cx,cy). Used so overlay lines start/end on the
// card edge instead of poking out from the center.
function clipToCardEdge(cx, cy, tx, ty, halfW, halfH) {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = Math.abs(dx) > 0 ? halfW / Math.abs(dx) : Infinity;
  const sy = Math.abs(dy) > 0 ? halfH / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy, 1);
  return { x: cx + dx * s, y: cy + dy * s };
}

// Position overlay lines (hover or pin) onto the edges of their endpoint
// cards. .style (not .attr) so stroke-width beats style.css's `line` rule.
// Cards render at a fixed screen size (counter-scaled by 1/zoom), so their
// world-space half-extents are cardWidth/(2k) × fullCardHeight/(2k).
function layoutOverlayLines(linesSel, layout) {
  const k = (state.transform && state.transform.k) || 1;
  const halfW = cardWidth * cardScreenScale / 2 / k;
  const halfH = fullCardHeight * cardScreenScale / 2 / k;
  // Stroke width in world units; divided by k so it lands at 3 screen px
  // regardless of zoom (matching the fixed screen size of the cards). The
  // SVG marker auto-scales with stroke-width (markerUnits='strokeWidth').
  linesSel.style("stroke-width", 3 / k).each(function (l) {
    const sp = overlayCardPos(layout, l.source);
    const tp = overlayCardPos(layout, l.target);
    const a = clipToCardEdge(sp.x, sp.y, tp.x, tp.y, halfW, halfH);
    const b = clipToCardEdge(tp.x, tp.y, sp.x, sp.y, halfW, halfH);
    d3.select(this)
      .attr("x1", a.x).attr("y1", a.y)
      .attr("x2", b.x).attr("y2", b.y);
  });
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

  // Cards render at cardWidth * cardScreenScale screen pixels (counter-scaled
  // by 1/k); divide by k to get the equivalent world-space dimensions.
  const k = state.transform.k || 1;
  const wWorld = cardWidth * cardScreenScale / k;
  const hWorld = fullCardHeight * cardScreenScale / k;
  const gap = Math.min(wWorld, hWorld) * 0.05;
  const minDx = wWorld + gap;
  const minDy = hWorld + gap;
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

// Re-evaluated every frame while a hover is active. At LABEL tier we hold off
// creating any cards/lines/chips until scheduleHoverExpand fires.
export function updateHoverArtifacts() {
  if (!state.hoverId || !state.transform) return;
  const hovered = state.nodesById[state.hoverId];
  if (!hovered) return;

  if (!state.hoverExpanded) {
    // .interrupt() only kills the default transition — kill "fold" too so a
    // mid-tween card doesn't keep folding while it fades. Without this, IMG-
    // tier handoffs leave the body content animating on a card that should
    // already be unwinding.
    gHoverCards.selectAll("g.card").interrupt().interrupt("fold")
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
  // Skip nodes the pinned chain is already drawing — avoids stacked duplicates.
  const pinnedDisplayed = new Set(state.pinnedLayout.keys());
  const cardNodes = [hovered, ...layoutNeighbors.map((nb) => nb.node)]
    .filter((n) => !pinnedDisplayed.has(n.id));

  const hoverSel = gHoverCards.selectAll("g.card").data(cardNodes, (n) => n.id);
  hoverSel.exit().interrupt().interrupt("fold")
    .transition().duration(TIER_FADE_MS).style("opacity", 0).remove();
  // Fade newly entered hover overlays at LABEL tier (smooth dot → card
  // reveal); snap at FULL tier where the baseline is already a card.
  const enteredHover = renderFullCard(hoverSel.enter(), state.hoverFoldOpen ? 1 : 0)
    .on("mouseenter", (event, n) => onHoverEnter(event, n))
    .on("mouseleave", () => onHoverLeave())
    .on("click", (event, n) => onPinClick(event, n));
  if (state.tier === TIER_LABEL) {
    enteredHover.style("opacity", 0)
      .transition().duration(TIER_FADE_MS).style("opacity", 1);
  }
  syncPinBadges(gHoverCards.selectAll("g.card"));

  // Skip links the pinned chain already draws (both endpoints pinned).
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
  gHoverCards.selectAll("g.card").attr("transform", overlayCardTransform(state.hoverLayout));
  layoutOverlayLines(gHoverLines.selectAll("line"), state.hoverLayout);

  // Hide baseline copies of anything the hover OR pinned overlay is drawing.
  const expandSet = new Set([...state.hoverLayout.keys(), ...state.pinnedLayout.keys()]);
  if (state.tier !== TIER_LABEL) {
    gCards.selectAll("g.card")
      .style("opacity", (n) => (expandSet.has(n.id) ? 0 : 1));
  }
  gStickyLabels.selectAll("g.dag-label")
    .style("opacity", (d) => (expandSet.has(d.id) ? 0 : 1));
}

// Schedules the hover overlay's fold-open animation. At LABEL tier the
// linger delay ensures the cursor has settled (so quick scanning over dots
// doesn't fire it). At IMG tier the delay is 0 so the fold animation
// kicks in on the next frame. Sets hoverFoldOpen=true and tweens existing
// hover cards from fold 0 → 1.
function scheduleHoverExpand(delayMs = HOVER_EXPAND_DELAY_MS) {
  if (hoverExpandTimer) clearTimeout(hoverExpandTimer);
  hoverExpandTimer = setTimeout(() => {
    hoverExpandTimer = null;
    if (state.hoverFoldOpen) return;
    state.hoverFoldOpen = true;
    tweenFold(gHoverCards.selectAll("g.card"), 1);
    renderOffscreenIndicators();
  }, delayMs);
}

export function onHoverEnter(event, d) {
  // Cancel any pending hover-leave so a quick traversal from a small dot to the
  // overlapping hover card doesn't tear everything down.
  if (hoverLeaveTimeout) {
    clearTimeout(hoverLeaveTimeout);
    hoverLeaveTimeout = null;
  }

  const sameNode = state.hoverId === d.id;
  state.hoverId = d.id;

  // sameNode means we're re-entering the same logical node — typically
  // the cursor crossing between a dot and its overlapping sticky label
  // (or hover card). The promote timer is already counting toward this
  // node, so leave it running and let the staging continue.
  if (sameNode) return;

  // Switching to a new node: kill BOTH the promote and the expand timers so
  // a stale "open the fold" callback from the previous hover can't fire
  // mid-handoff and force the new card into the wrong fold state.
  clearHoverPromoteTimer();
  clearHoverExpandTimer();
  // Tear down the previous hover overlay properly — at IMG tier this means
  // a reverse-fold animation, not just a fade. Without this, the previous
  // card stays at fold=1 while fading, then snaps closed when the baseline
  // pops back; with this the transition reads as a clean handoff.
  dismissHoverOverlay();
  renderOffscreenIndicators();

  hoverPromoteTimer = setTimeout(() => {
    hoverPromoteTimer = null;
    if (state.hoverId !== d.id) return;

    // Populate neighbors now (deferred so the offscreen chips and the
    // overlay cards appear together). When a card is pinned, the user
    // already has a focused chain in view; adding hover neighbors on
    // top is noisy, so hover stays a single-card preview.
    state.hoverNeighbors = [];
    if (!state.pinnedId) {
      for (const l of state.links) {
        if (l.source.id === d.id) {
          state.hoverNeighbors.push({ node: l.target, kind: "child" });
        } else if (l.target.id === d.id) {
          state.hoverNeighbors.push({ node: l.source, kind: "parent" });
        }
      }
    }

    // At LABEL tier, surface the dot's text label too (sticky so it
    // persists after the hover ends).
    if (state.tier === TIER_LABEL) {
      if (!state.stickyLabels.some((n) => n.id === d.id)) {
        state.stickyLabels.push(d);
        appendLabels(gStickyLabels, state.stickyLabels);
      }
    }

    state.hoverExpanded = true;
    if (state.tier === TIER_IMG) {
      // Render folded first, then animate fold open on the next tick.
      state.hoverFoldOpen = false;
      updateHoverArtifacts();
      scheduleHoverExpand(0);
    } else {
      state.hoverFoldOpen = true;
      updateHoverArtifacts();
    }
    renderOffscreenIndicators();
  }, HOVER_PROMOTE_DELAY_MS);
}

export function onHoverMove() {
  // No-op: hover expansion is immediate at IMG/FULL tiers; LABEL tier
  // is staged and driven by timers in onHoverEnter.
}

export function onHoverLeave() {
  // Debounce — when the hover overlay renders on top of the baseline card,
  // the browser fires baseline-mouseleave + overlay-mouseenter back-to-back.
  // The sameNode mouseenter cancels this leave timeout, so any timers
  // (promote, expand) keep ticking and the overlay opens normally. Do NOT
  // clear hoverExpandTimer outside the setTimeout — at IMG tier the expand
  // timer is set with delay 0 right after promote, and if we kill it here
  // before the sameNode mouseenter rescues us, the new card never opens.
  if (hoverLeaveTimeout) clearTimeout(hoverLeaveTimeout);
  hoverLeaveTimeout = setTimeout(() => {
    hoverLeaveTimeout = null;
    clearHoverPromoteTimer();
    clearHoverExpandTimer();
    state.hoverId = null;
    dismissHoverOverlay();
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

// Build a chip anchored to the screen edge where the line from (hx,hy) to
// `node`'s screen position exits the viewport. Returns null when the node is
// already on-screen or no exit point exists.
function makeOffscreenChip(node, hx, hy, classes, onClick) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pad = 18;
  const { k, x: tx, y: ty } = state.transform;
  const nx = tx + node.x * k;
  const ny = ty + node.y * k;
  if (nx >= pad && nx <= w - pad && ny >= pad && ny <= h - pad) return null;
  const exit = lineRectIntersection(hx, hy, nx, ny, w, h, pad);
  if (!exit) return null;

  // Anchor the chip to the inside of the screen edge so its label doesn't
  // extend past the viewport.
  let ax = -50, ay = -50;
  const eps = 1;
  if (Math.abs(exit.x - pad) < eps) ax = 0;
  else if (Math.abs(exit.x - (w - pad)) < eps) ax = -100;
  if (Math.abs(exit.y - pad) < eps) ay = 0;
  else if (Math.abs(exit.y - (h - pad)) < eps) ay = -100;

  const chip = document.createElement("button");
  chip.className = `offscreen-indicator ${classes}`;
  chip.style.left = `${exit.x}px`;
  chip.style.top = `${exit.y}px`;
  chip.style.transform = `translate(${ax}%, ${ay}%)`;
  chip.title = node.title;
  chip.innerHTML = `<span class="label">${escapeHtml(node.title)}</span>`;
  chip.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(e);
  });
  return chip;
}

export function renderOffscreenIndicators() {
  // Pinned chips share the container but have their own lifecycle.
  offscreenContainer
    .querySelectorAll(".offscreen-indicator:not(.pinned)")
    .forEach((el) => el.remove());
  if (!state.hoverId || !state.transform) return;
  const hovered = state.nodesById[state.hoverId];
  if (!hovered) return;
  const { k, x: tx, y: ty } = state.transform;
  const hx = tx + hovered.x * k;
  const hy = ty + hovered.y * k;
  for (const { node, kind } of state.hoverNeighbors) {
    const chip = makeOffscreenChip(node, hx, hy, kind, (e) => onPinClick(e, node));
    if (chip) offscreenContainer.appendChild(chip);
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

// Pinned chain = root's direct neighbors only (same set hover uses), not the
// transitive closure — otherwise pinning Steel pulls in 150 cards.
function computePinnedChain(rootNode) {
  const out = [];
  for (const l of state.links) {
    if (l.source.id === rootNode.id) out.push({ node: l.target, kind: "child" });
    else if (l.target.id === rootNode.id) out.push({ node: l.source, kind: "parent" });
  }
  return out;
}

// "primary" = the active root (blue badge); "secondary" = a direct neighbor
// (green badge); null = not pinned. Click semantics: primary → unpin,
// secondary → re-pin with this node as the new primary, none → pin.
function pinKind(id) {
  if (state.pinnedId === id) return "primary";
  for (const nb of state.pinnedChain) if (nb.node.id === id) return "secondary";
  return null;
}

const isPinned = (id) => pinKind(id) !== null;

export function onPinClick(event, d) {
  event.preventDefault();
  event.stopPropagation();
  if (pinKind(d.id) === "primary") unpin();
  else pin(d);
}

export function pin(rootNode) {
  // Replace any existing pin in one shot — clear first so updatePinnedArtifacts
  // re-binds against an empty selection.
  if (state.pinnedId) clearPinnedDom();
  state.pinnedId = rootNode.id;
  state.pinnedChain = computePinnedChain(rootNode);
  state.pinnedLayout = new Map();
  updatePinnedArtifacts();
  renderPinnedOffscreenIndicators();
  // Refresh hover cards so the pin badge flips immediately on click.
  if (state.hoverId) updateHoverArtifacts();
  persistPin();
  persistView();
}

export function unpin() {
  state.pinnedId = null;
  state.pinnedChain = [];
  state.pinnedLayout = new Map();
  clearPinnedDom();
  // The baseline cards/labels for ex-pinned nodes were hidden — restore them.
  // Hover (if any) re-runs and will re-suppress whatever it needs.
  gCards.selectAll("g.card").style("opacity", 1);
  gStickyLabels.selectAll("g.dag-label").style("opacity", 1);
  if (state.hoverId) {
    updateHoverArtifacts();
    // Snap any newly entered hover overlay to full opacity. Otherwise the
    // unpinned root's hover card would fade in over 200ms with nothing
    // visible at the position in the meantime — reads as a blink.
    gHoverCards.selectAll("g.card").interrupt().style("opacity", 1);
  }
  persistPin();
  persistView();
}

function clearPinnedDom() {
  gPinnedCards.selectAll("*").remove();
  gPinnedLines.selectAll("*").remove();
  offscreenContainer
    .querySelectorAll(".offscreen-indicator.pinned")
    .forEach((el) => el.remove());
}

// Top-left pin glyph mirrors the field icon's position in the title bar.
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

export function updatePinnedArtifacts() {
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

  // Off-screen neighbors don't go in the layout — they ride as chips, and
  // would otherwise distort the overlap resolver.
  state.pinnedLayout = computeHoverLayout(root, layoutNeighbors);
  gPinnedCards.selectAll("g.card").attr("transform", overlayCardTransform(state.pinnedLayout));
  layoutOverlayLines(gPinnedLines.selectAll("line"), state.pinnedLayout);

  // Hide baseline copies of pinned nodes (when no hover is active —
  // updateHoverArtifacts handles the union when both are live).
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

// Smooth pan to center `node` in the viewport without changing zoom. Used by
// off-screen pinned chips so the user can jump to a pinned card they've
// scrolled away from.
export function panToNode(node) {
  if (!state.transform) return;
  const k = state.transform.k;
  const tx = window.innerWidth / 2 - node.x * k;
  const ty = window.innerHeight / 2 - node.y * k;
  svg.transition()
    .duration(500)
    .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(k));
}

export function renderPinnedOffscreenIndicators() {
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
  // Anchor on the root's screen position; fall back to the viewport center
  // when the root itself has panned off-screen (so chips still resolve).
  const rootOnScreen =
    tx + root.x * k >= pad && tx + root.x * k <= w - pad &&
    ty + root.y * k >= pad && ty + root.y * k <= h - pad;
  const hx = rootOnScreen ? tx + root.x * k : w / 2;
  const hy = rootOnScreen ? ty + root.y * k : h / 2;

  // Include the root in the chip set when it's off-screen — the user needs
  // a way to navigate back to it (and to unpin via its chip).
  const candidates = rootOnScreen
    ? state.pinnedChain
    : [{ node: root, kind: "root" }, ...state.pinnedChain];

  for (const { node, kind } of candidates) {
    const cls = `pinned ${kind === "root" ? "primary" : "secondary"} ${kind}`;
    const chip = makeOffscreenChip(node, hx, hy, cls, () => panToNode(node));
    if (chip) offscreenContainer.appendChild(chip);
  }
}

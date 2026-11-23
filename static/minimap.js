// Minimap in the bottom-right corner: the whole timeline in one row, always fully
// zoomed out, at the board's own proportions (one scale for x and y), so the rectangle
// showing the screen has the window's shape. The timeline is ~50x wider than tall,
// so the row is thin and wide, with year labels underneath and a small marker
// under the rectangle so it's easy to spot.
// Click or drag on it to move there; scroll on it to zoom. Search matches and the
// pinned card light up.
import { formatYear } from "./utils.js";

const PAD = 4;              // CSS px of margin around the dots
const MIN_ROW = 10;         // CSS px: the dots area is never thinner than this
const AXIS_H = 18;          // CSS px under the dots for the marker and year labels
const mapWidth = () => Math.round(Math.max(320, Math.min(900, window.innerWidth * 0.5)));

let ctx = null;             // { svg, zoom, state, isActiveQuery, searchHelper }
let root, canvas, g, base, baseG;
let mapW = 400, mapH = 40;
let L = null;               // { s, rowH, ox, oy }: minimap = o + board * s
let dragging = false;

export function initMinimap(opts) {
  ctx = opts;
  root = document.createElement("div");
  root.id = "minimap";
  root.innerHTML = `<canvas aria-label="Minimap: click or drag to move around the timeline" role="img"></canvas>`;
  document.body.appendChild(root);
  canvas = root.querySelector("canvas");
  g = canvas.getContext("2d");
  base = document.createElement("canvas");
  baseG = base.getContext("2d");

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    moveTo(e);
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", (e) => { if (dragging) moveTo(e); });
  const end = () => { dragging = false; };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    ctx.svg.call(ctx.zoom.scaleBy, Math.pow(2, -e.deltaY * (e.deltaMode ? 0.05 : 0.002)));
  }, { passive: false });

  // Rebuild when the window or the theme changes (dot colours come from CSS).
  window.addEventListener("resize", rebuild);
  new MutationObserver(rebuild).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", rebuild);
  document.getElementById("search-input")?.addEventListener("input", () => requestAnimationFrame(updateMinimap));

  rebuild();
}

// Board point -> minimap point.
const toMap = (wx, wy) => ({ x: L.ox + wx * L.s, y: L.oy + wy * L.s });

// Minimap pointer -> board point, then centre the view on it.
function moveTo(e) {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left, py = Math.min(e.clientY - rect.top, L.rowH);
  ctx.svg.call(ctx.zoom.translateTo, (px - L.ox) / L.s, (py - L.oy) / L.s);
}

// The class string that decides a dot's colour, minus transient states.
const colorKey = (el) => el.getAttribute("class").replace(/\b(search-match|is-pinned|is-hover\w*)\b/g, "").trim();

function rebuild() {
  if (!ctx || !ctx.state.bbox) return;
  const { minX, maxX, minY, maxY } = ctx.state.bbox;
  const worldW = Math.max(1, maxX - minX), worldH = Math.max(1, maxY - minY);
  mapW = mapWidth();
  const s = (mapW - 2 * PAD) / worldW;
  const rowH = Math.max(MIN_ROW, worldH * s) + 2 * PAD;
  L = { s, rowH, ox: PAD - minX * s, oy: rowH / 2 - ((minY + maxY) / 2) * s };
  mapH = Math.ceil(rowH + AXIS_H);

  const dpr = window.devicePixelRatio || 1;
  for (const c of [canvas, base]) { c.width = mapW * dpr; c.height = mapH * dpr; }
  canvas.style.width = mapW + "px";
  canvas.style.height = mapH + "px";
  baseG.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  baseG.clearRect(0, 0, mapW, mapH);

  const ink = getComputedStyle(root).getPropertyValue("--minimap-ink").trim() || "#6b6b6b";
  // Every card as a dot, in the colour the stylesheet gives its real dot. Drawn once;
  // the overlay blits it each frame.
  const colors = new Map();
  const dotR = Math.max(0.8, Math.min(1.6, s * 60));
  for (const el of document.querySelectorAll("circle.dag-dot")) {
    const n = ctx.state.nodesById[el.getAttribute("data-id")];
    if (!n) continue;
    const key = colorKey(el);
    if (!colors.has(key)) colors.set(key, getComputedStyle(el).fill);
    baseG.globalAlpha = el.classList.contains("is-speculative") ? 0.45 : 0.9;
    baseG.fillStyle = colors.get(key) || "#888";
    const p = toMap(n.x, n.y);
    baseG.beginPath();
    baseG.arc(p.x, p.y, dotR, 0, Math.PI * 2);
    baseG.fill();
  }
  baseG.globalAlpha = 1;

  // Year labels: the card nearest each of a few evenly spaced points along the row
  // (the timeline isn't linear in time, so labels come from real cards).
  baseG.fillStyle = ink;
  baseG.font = "10px system-ui, sans-serif";
  baseG.textBaseline = "top";
  const byX = ctx.state.nodes.filter((n) => n.year != null).sort((a, b) => a.x - b.x);
  const ticks = Math.max(3, Math.floor(mapW / 110));
  let lastRight = -Infinity;
  for (let i = 0; i < ticks && byX.length; i++) {
    const wx = minX + (i / (ticks - 1)) * worldW;
    let lo = 0, hi = byX.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (byX[mid].x < wx) lo = mid + 1; else hi = mid; }
    const best = lo > 0 && Math.abs(byX[lo - 1].x - wx) < Math.abs(byX[lo].x - wx) ? byX[lo - 1] : byX[lo];
    const label = String(formatYear(best.year));
    const tx = toMap(best.x, 0).x;
    const w = baseG.measureText(label).width;
    const left = Math.max(2, Math.min(mapW - w - 2, tx - w / 2));
    if (left < lastRight + 8) continue;
    lastRight = left + w;
    baseG.globalAlpha = 0.5;
    baseG.fillRect(tx, rowH - 2, 1, 3);
    baseG.globalAlpha = 1;
    baseG.fillText(label, left, rowH + 6);
  }
  updateMinimap();
}

export function updateMinimap() {
  if (!ctx || !g || !L || !ctx.state.transform) return;
  const { state } = ctx;
  const css = getComputedStyle(root);
  const searching = ctx.isActiveQuery();
  g.clearRect(0, 0, mapW, mapH);
  // While searching, the other cards fade so the matches stand out.
  if (searching) {
    const dpr = base.width / mapW;  // source rects are in the base canvas's device pixels
    g.globalAlpha = 0.3;
    g.drawImage(base, 0, 0, base.width, L.rowH * dpr, 0, 0, mapW, L.rowH);
    g.globalAlpha = 1;
    g.drawImage(base, 0, L.rowH * dpr, base.width, (mapH - L.rowH) * dpr, 0, L.rowH, mapW, mapH - L.rowH);
  } else {
    g.drawImage(base, 0, 0, mapW, mapH);
  }

  // Search matches: bright ringed dots on top, so you can see where they cluster.
  if (searching) {
    const q = state.searchQuery.trim();
    g.fillStyle = css.getPropertyValue("--minimap-match").trim() || "goldenrod";
    g.strokeStyle = css.getPropertyValue("--minimap-ink").trim() || "#444";
    g.lineWidth = 0.75;
    for (const n of state.nodes) {
      if (!ctx.searchHelper(n, q)) continue;
      const p = toMap(n.x, n.y);
      g.beginPath();
      g.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }
  // The pinned card: a ring.
  const pinned = state.pinnedId && state.nodesById[state.pinnedId];
  if (pinned) {
    const p = toMap(pinned.x, pinned.y);
    g.strokeStyle = css.getPropertyValue("--minimap-pin").trim() || "steelblue";
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(p.x, p.y, 4, 0, Math.PI * 2);
    g.stroke();
  }

  // The screen, at its real proportions (scaled up to a few px if it's smaller, so it
  // stays visible), plus a small marker under it pointing up at it.
  const { k, x, y } = state.transform;
  const a = toMap(-x / k, -y / k);
  let vw = (window.innerWidth / k) * L.s, vh = (window.innerHeight / k) * L.s;
  let vx = a.x, vy = a.y;
  const MIN = 5;
  if (vw < MIN) {
    const grow = MIN / vw;
    vx -= (vw * grow - vw) / 2; vy -= (vh * grow - vh) / 2;
    vw *= grow; vh *= grow;
  }
  const stroke = css.getPropertyValue("--minimap-view").trim() || "steelblue";
  g.save();
  g.beginPath(); g.rect(0, 0, mapW, L.rowH); g.clip();
  g.fillStyle = css.getPropertyValue("--minimap-view-fill").trim() || "rgba(70,130,180,.12)";
  g.strokeStyle = stroke;
  g.lineWidth = 1.25;
  g.fillRect(vx, vy, vw, vh);
  g.strokeRect(vx + 0.6, vy + 0.6, Math.max(0, vw - 1.2), Math.max(0, vh - 1.2));
  g.restore();
  const mx = Math.max(4, Math.min(mapW - 4, vx + vw / 2));
  g.fillStyle = stroke;
  g.beginPath();
  g.moveTo(mx, L.rowH + 0.5); g.lineTo(mx - 4, L.rowH + 5.5); g.lineTo(mx + 4, L.rowH + 5.5);
  g.closePath(); g.fill();
}

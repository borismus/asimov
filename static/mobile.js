import { loadGraph, formatField, formatYear } from "./utils.js";
import { cardWidth, fullCardHeight, renderFullCard } from "./card.js";

const SORT_OPTIONS = [
  { key: "year", label: "Chronological" },
  { key: "field", label: "By field" },
  { key: "random", label: "Random" },
];

const SWIPE_DIST = 60;
const SWIPE_MAX_VERT = 50;
const TAP_MAX_MOVE = 8;

const state = {
  nodes: [],
  sortKey: "year",
  sorted: [],
  index: 0,
};

function compareYear(a, b) {
  return a.year - b.year || a.id.localeCompare(b.id);
}

function compareField(a, b) {
  const fa = formatField(a.field);
  const fb = formatField(b.field);
  return fa.localeCompare(fb) || compareYear(a, b);
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
  if (next !== location.hash) {
    history.replaceState(null, "", next);
  }
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
    state.sortKey = select.value;
    state.sorted = sortNodes(state.sortKey);
    state.index = 0;
    render();
    writeHash();
  });
  bar.appendChild(select);

  const counter = document.createElement("span");
  counter.className = "counter";
  counter.id = "mobile-counter";
  bar.appendChild(counter);

  document.body.insertBefore(bar, document.body.firstChild);
}

function updateCounter() {
  const node = state.sorted[state.index];
  const counter = document.getElementById("mobile-counter");
  if (!counter || !node) return;
  counter.textContent = `${state.index + 1} / ${state.sorted.length} · ${formatYear(node.year)}`;
}

let svg, stage;

function mountSvg() {
  const container = document.getElementById("container");
  svg = d3
    .select(container)
    .append("svg")
    .attr("class", "mobile-card")
    .attr("viewBox", `0 0 ${cardWidth} ${fullCardHeight}`)
    .attr("preserveAspectRatio", "xMidYMid meet");
  stage = svg
    .append("g")
    .attr("transform", `translate(${cardWidth / 2}, ${fullCardHeight / 2})`);
}

function render() {
  if (!stage) return;
  const node = state.sorted[state.index];
  if (!node) return;
  stage.selectAll("*").remove();
  const enter = stage.selectAll("g.card").data([node]).enter();
  renderFullCard(enter, 1);
  updateCounter();
}

function go(delta) {
  const next = state.index + delta;
  if (next < 0 || next >= state.sorted.length) return;
  state.index = next;
  render();
  writeHash();
}

function attachGestures() {
  const container = document.getElementById("container");
  let active = null;

  container.addEventListener("pointerdown", (e) => {
    if (!e.isPrimary) return;
    active = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      moved: false,
    };
    container.setPointerCapture?.(e.pointerId);
  });

  container.addEventListener("pointermove", (e) => {
    if (!active || e.pointerId !== active.id) return;
    active.lastX = e.clientX;
    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;
    if (!active.moved && Math.hypot(dx, dy) > TAP_MAX_MOVE) {
      active.moved = true;
      svg?.classed("dragging", true);
    }
    if (active.moved && Math.abs(dx) > Math.abs(dy)) {
      const damp = Math.sign(dx) * Math.min(Math.abs(dx), 120);
      svg?.style("transform", `translateX(${damp}px)`);
    }
  });

  function settle() {
    if (!svg) return;
    svg.classed("dragging", false);
    svg.style("transform", null);
  }

  container.addEventListener("pointerup", (e) => {
    if (!active || e.pointerId !== active.id) return;
    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;
    const wasTap = !active.moved;
    active = null;
    settle();

    if (wasTap) {
      const rect = container.getBoundingClientRect();
      const xRel = e.clientX - rect.left;
      if (xRel < rect.width / 2) go(-1);
      else go(1);
      return;
    }

    if (Math.abs(dx) >= SWIPE_DIST && Math.abs(dy) <= SWIPE_MAX_VERT) {
      go(dx < 0 ? 1 : -1);
    }
  });

  container.addEventListener("pointercancel", () => {
    active = null;
    settle();
  });
}

function attachKeyboard() {
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") go(1);
    else if (e.key === "ArrowLeft") go(-1);
  });
}

async function init() {
  const { nodes } = await loadGraph("/static/asimov.tsv");
  state.nodes = nodes;

  const fromHash = parseHash();
  if (fromHash?.sortKey) state.sortKey = fromHash.sortKey;
  state.sorted = sortNodes(state.sortKey);
  if (fromHash?.index != null) {
    state.index = Math.min(fromHash.index, state.sorted.length - 1);
  }

  buildBar();
  mountSvg();
  attachGestures();
  attachKeyboard();
  render();
  writeHash();
}

init();

import { isMobile, loadGraph } from "./utils.js";
import { cardWidth, cardHeight, renderCard, renderMTGCard } from "./card.js";
import "./timeline.js";

const cardPaddingX = 100;
const cardPaddingY = 20;
const cardOffsetX = cardWidth + cardPaddingX;
const cardOffsetY = cardHeight + cardPaddingY;
const cardOverlapPercent = 0.12;

const width = window.innerWidth;
const height = window.innerHeight;
const svg = d3
  .select("#container")
  .append("svg")
  .attr("width", width)
  .attr("viewBox", [0, 0, width, height]);

const g = svg.append("g").attr("class", "cards-and-nodes");
const background = g.append("g").attr("class", "background");

for (let i = 0; i < 10; i++) {
  addCircle(10 - i - 1);
}

// Render a compass rose.
const compassSize = isMobile() ? 150 : 200;
const compass = background
  .append("image")
  .attr("x", width / 2 - compassSize / 2)
  .attr("y", height / 2 + cardHeight / 2)
  .attr("width", compassSize)
  .attr("height", compassSize)
  .attr("href", "images/icons/compass.svg");

const links = g.append("g").attr("class", "links");
const nodes = g.append("g").attr("class", "nodes");

function addCircle(index) {
  const fill = index % 2 === 0 ? "#fdfdfd" : "white";
  background
    .append("circle")
    .attr("cx", width / 2)
    .attr("cy", height / 2)
    .attr("r", (index + 1) * 200)
    .attr("stroke", "#f5f5f5")
    .attr("fill", fill);
}

// Enable zoom and pan.
const zoom = d3
  .zoom()
  .scaleExtent(isMobile() ? [0.1, 2] : [0.3, 2])
  .on("zoom", ({ transform }) => {
    g.attr("transform", transform);
    resetZoomEl.className = "visible";
    // gtag("event", "zoom");
  });

svg.call(zoom);

const resetZoomEl = document.querySelector("#reset-zoom");
resetZoomEl.addEventListener("click", resetZoom);

const timelineEl = document.querySelector("asimov-timeline");
timelineEl.addEventListener("filter", onFilter);

let data;
let currentId;

const cardById = {};
let visibleNodes = [];

async function onLoad() {
  data = await loadGraph("./asimov-1850.tsv");

  for (let [index, card] of data.nodes.entries()) {
    card.index = index;
    cardById[card.id] = card;
  }
  updateVisibleNodes(data.nodes);

  window.addEventListener("keyup", onKeyUp);
  if (window.location.hash) {
    onHashChange();
  } else {
    location.replace(`#${randomCardWithDeps().id}`);
  }
}

function randomCardWithDeps() {
  const cardsWithDeps = data.nodes.filter((n) => n.deps && n.deps.length > 0);
  const randomIndex = Math.floor(Math.random() * cardsWithDeps.length);
  return cardsWithDeps[randomIndex];
}

function updateVisibleNodes(newVisibleNodes) {
  timelineEl.setAttribute("nodes", JSON.stringify(newVisibleNodes));
  visibleNodes = newVisibleNodes;

  if (newVisibleNodes.length === 0) {
    console.error(`No visible nodes.`);
    renderErrorCard("No cards found with current filters.");
    return;
  }

  // If there's no current ID, no worries whether it is visible or not.
  if (!currentId) {
    return;
  }

  // Check if this ID is still in the visible nodes.
  if (visibleNodes.find((n) => n.id === currentId)) {
    console.log(`Focused card ${currentId} still visible.`);
    renderWithFocus(currentId);
  } else {
    const newId = getVisibleCardNearestYear(cardById[currentId].year);
    console.warn(
      `Focused card ${currentId} not visible. Navigating to visible card ${newId}.`
    );
    changeFocusId(newId, "navigate_to_visible");
  }
}

function getVisibleCardNearestYear(year) {
  let closest = Infinity;
  let closestId = -1;
  for (const [index, node] of visibleNodes.entries()) {
    const dist = Math.abs(node.year - year);
    if (dist < closest) {
      closest = dist;
      closestId = node.id;
    }
  }
  return closestId;
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  svg.attr("width", width).attr("viewBox", [0, 0, width, height]);

  renderWithFocus(currentId);
}

function searchHelper(card, query) {
  const queryLower = query.toLowerCase();
  return (
    card.title.toLowerCase().includes(queryLower) ||
    card.description.toLowerCase().includes(queryLower)
  );
}

function onHashChange() {
  const id = window.location.hash.substring(1);
  currentId = id;
  console.log(`onHashChange: #${id}`);
  renderWithFocus(id);
  timelineEl.setAttribute("focus", id);
  const card = cardById[id];
  if (card) {
    timelineEl.setAttribute("focusNode", JSON.stringify(card));
    document.title = `${card.title} | Visual Chronology of Science & Discovery`;
  } else {
    renderErrorCard(`No card found for id "${id}".`);
  }

  gtag("event", "select_content", {
    content_type: "Card",
    content_id: nextCard.id,
  });
}

/**
 * Get all cards that are currently visible, given the focus card, and depth
 * from it. If depth is zero, only show the focus card. If it's one, show
 * next, previous, any parents and children. If it's two, show next and
 * next-next, previous and previous-previous, parents and grandparents, children
 * and grandchildren.
 *
 * Assign each card optional dx, dy attributes which determines where in the
 * grid the card should go (0,0) is center of screen, (1,0) is to the right and
 * may be shared by multiple cards, in which case they will fan out in the
 * y-axis.
 */
function getVisibleCardsId(focusId, depth = 0) {
  const cards = visibleNodes;

  // Reset dx and dy on all card data.
  cards.map((card) => {
    card.dx = 0;
    card.dy = 0;
    card.role = "";
  });
  let visible = [];

  const focusCard = cards.find((card) => card.id === focusId);
  if (!focusCard) {
    return visible;
  }

  focusCard.offset = 0;
  focusCard.role = "focus";

  // console.log(`Focusing on ${focusCard.id}.`);
  visible.push(focusCard);

  if (depth === 0) {
    return visible;
  }

  // Get all parents and children recursively to a certain depth.
  const ancestors = getAncestors(focusCard, depth);
  visible = visible.concat(ancestors);
  const descendants = getDescendants(focusCard, depth);
  visible = visible.concat(descendants);

  // Get descendants of parents.
  const parents = getParents(focusCard);
  const visibleIds = visible.map((card) => card.id);
  let siblings = [];
  for (const parent of parents) {
    // None of the currently visible cards should be included.
    const localSibs = getChildren(parent).filter(
      (sib) => !visibleIds.includes(sib.id)
    );
    siblings.push(...localSibs);
  }
  siblings.map((sib) => {
    sib.role = "sibling";
    sib.offset = 0;
  });

  // console.log(
  // `Found ${siblings.length} siblings: ${siblings.map((s) => s.id)}.`
  // );
  visible = visible.concat(siblings);
  visible = [...new Set(visible)];

  // Set positions for all visible cards based on their depth.
  for (const card of visible) {
    // console.log(`Offset of ${card.id} is ${card.offset}.`);
    card.dx = card.offset;
    card.isStacked = false;
  }

  // Get cards by generation.
  const offsets = visible.map((card) => card.offset);
  const minOffset = Math.min(...offsets);
  const maxOffset = Math.max(...offsets);
  for (let offset = minOffset; offset <= maxOffset; offset++) {
    const generation = visible.filter(
      (card) => card.offset === offset && card.role !== "focus"
    );
    generation.sort((a, b) => d3.ascending(a.index, b.index));

    for (const [index, card] of generation.entries()) {
      if (card.role === "sibling") {
        card.dy = 1.5 + index * cardOverlapPercent;
      } else {
        card.dy = getDy(index, generation.length, cardOverlapPercent);
      }

      if (generation.length >= 2 && index !== generation.length - 1) {
        card.isStacked = true;
      }
    }
  }

  return visible;
}

function getAncestors(card, depth, offset = 0) {
  // Base case.
  if (offset === depth) {
    return [];
  }
  let ancestors = [];
  for (const parent of getParents(card)) {
    // parent.dx = -offset - 1;
    parent.offset = -offset - 1;
    ancestors.push(parent);
    ancestors = ancestors.concat(getAncestors(parent, depth, offset + 1));
  }
  // Make sure we don't have dupes.
  ancestors = [...new Set(ancestors)];

  return ancestors;
}

function getDescendants(card, depth, offset = 0) {
  // Base case.
  if (offset === depth) {
    return [];
  }
  let descendants = [];
  for (const child of getChildren(card)) {
    // child.dx = offset + 1;
    // child.dy += card.dy;
    child.offset = offset + 1;
    descendants.push(child);
    descendants = descendants.concat(getDescendants(child, depth, offset + 1));
  }
  // Make sure we don't have dupes.
  descendants = [...new Set(descendants)];
  return descendants;
}

function getParents(card) {
  const cards = data.nodes;
  const parents = [];
  for (const potentialParent of cards) {
    if (card.deps.includes(potentialParent.id)) {
      parents.push(potentialParent);
    }
  }
  return parents;
}

function getChildren(card) {
  const cards = data.nodes;
  const children = [];
  for (const potentialChild of cards) {
    if (potentialChild.deps.includes(card.id)) {
      children.push(potentialChild);
    }
  }
  return children;
}

/** Given an index and the total number, get the position in the grid. For
 * example, with index=0, total=1 => 0. index=0, total=2 => -0.5. index=1,
 * total=3 => 0. */
function getDy(index, total, spacing = 1) {
  if (total === 0) {
    return 0;
  }
  if (total === 1) {
    return 0;
  }
  const width = spacing * (total - 1);
  const position = index * spacing - width / 2;
  return position;
}

function renderWithFocus(id) {
  const visible = getVisibleCardsId(id, 8);
  // DEBUG.
  window.visible = visible;
  update(visible);
}

function renderErrorCard(message) {
  const errorCard = {
    id: "error",
    title: "Error",
    description: message,
    field: "general",
    year: -1e6,
    dx: 0,
    dy: 0,
    offset: 0,
    role: "focus",
  };
  update([errorCard]);
}

function update(visibleNodes) {
  updateLinks(visibleNodes);
  updateNodes(visibleNodes);
}

function updateLinks(visibleNodes) {
  // Filter all links to just include the ones between the visible cards.
  const ids = visibleNodes.map((d) => d.id);
  const visibleLinks = data.links.filter(
    (link) => ids.includes(link.source.id) && ids.includes(link.target.id)
  );

  const cardLinks = links
    .selectAll("line")
    .data(visibleLinks, (d) => d.source.id + d.target.id);

  cardLinks
    .enter()
    .append("line")
    .attr("x1", (d) => getX(d.source))
    .attr("y1", (d) => getY(d.source) + cardHeaderOffset)
    .attr("x2", (d) => getX(d.target))
    .attr("y2", (d) => getY(d.target) + cardHeaderOffset)
    .attr("class", (d) =>
      d.source.field === d.target.field ? "same-field" : "cross-field"
    )
    .merge(cardLinks);

  cardLinks
    .transition()
    .duration(250)
    .attr("x1", (d) => getX(d.source))
    .attr("y1", (d) => getY(d.source) + cardHeaderOffset)
    .attr("x2", (d) => getX(d.target))
    .attr("y2", (d) => getY(d.target) + cardHeaderOffset);

  cardLinks.exit().remove();
}

function updateNodes(visibleNodes) {
  // Ensure the focus node is first, but otherwise sort by index.
  visibleNodes.sort((a, b) => d3.ascending(a.index, b.index));

  // Important: the following data call binds the data and assigns a key (in
  // this case, the index), so that d3 knows which card is old and which is new,
  // and keeps them in the right order.
  const cards = nodes.selectAll("g.card").data(visibleNodes, (d) => d.index);

  // Render new cards.
  const cardsEnter = cards.enter();

  renderCrossCards(cardsEnter);

  // Update existing cards.
  cards
    .transition()
    .duration(250)
    .attr("transform", (d) => getCardTransform(d));

  cards.classed("focus", (d) => d.role == "focus");
  cards.classed("lastFocus", (d) => d.role == "lastFocus");

  // Remove old cards.
  // cards.exit().style("animation", "fadeout 0.5s").transition().remove();
  cards.exit().remove();

  // Make sure everything is ordered correctly.
  // cards.order();

  // DEBUG.
  window.cards = cards;
}

function renderCrossCards(cardsEnter) {
  // const cards = renderCard(cardsEnter);
  const cards = renderMTGCard(cardsEnter);

  cards.on("click", onCardClick);
  cards.attr("transform", (d) => getCardTransform(d));
  cards.style("animation", "fadein 0.25s");
  cards.classed("focus", (d) => d.role == "focus");

  // Move stacked cards up.
  cards.on("mouseenter", function (event, d) {
    const inbound = data.links.filter((link) => d.id === link.target.id);
    const outbound = data.links.filter((link) => d.id === link.source.id);
    console.log(
      `Found ${inbound.length} inbound and ${outbound.length} outbound links for #${d.id}.`
    );

    const inboundLinks = links
      .selectAll("line")
      .data(inbound, (d) => d.source.id + d.target.id);

    const outboundLinks = links
      .selectAll("line")
      .data(outbound, (d) => d.source.id + d.target.id);

    outboundLinks.classed("highlight", true);
    inboundLinks.classed("highlight", true);

    // Also highlight the neighbor cards.
    let neighborIds = [];
    neighborIds = neighborIds.concat(inbound.map((link) => link.source.id));
    neighborIds = neighborIds.concat(outbound.map((link) => link.target.id));
    const neighbors = data.nodes.filter((node) =>
      neighborIds.includes(node.id)
    );
    const neighborCards = nodes
      .selectAll("g.card")
      .data(neighbors, (d) => d.index);

    neighborCards.classed("highlight", true);

    if (!d.isStacked) {
      return;
    }
    d3.select(this)
      .transition()
      .duration(250)
      .attr("transform", getCardTransformReveal(d));

    // Update edges to also move.
    inboundLinks
      .transition()
      .attr("x1", (d) => getX(d.source))
      .attr("y1", (d) => getY(d.source) + cardHeaderOffset)
      .attr("x2", (d) => getX(d.target))
      .attr("y2", (d) => getYHover(d.target) + cardHeaderOffset);

    outboundLinks
      .transition()
      .attr("x1", (d) => getX(d.source))
      .attr("y1", (d) => getYHover(d.source) + cardHeaderOffset)
      .attr("x2", (d) => getX(d.target))
      .attr("y2", (d) => getY(d.target) + cardHeaderOffset);
  });
  cards.on("mouseleave", function (event, d) {
    const inout = data.links.filter(
      (link) => d.id === link.target.id || d.id === link.source.id
    );

    const inOutLinks = links
      .selectAll("line")
      .data(inout, (d) => d.source.id + d.target.id);

    inOutLinks.classed("highlight", false);

    let neighborIds = [];
    neighborIds = neighborIds.concat(inout.map((link) => link.source.id));
    neighborIds = neighborIds.concat(inout.map((link) => link.target.id));
    const neighbors = data.nodes.filter((node) =>
      neighborIds.includes(node.id)
    );
    const neighborCards = nodes
      .selectAll("g.card")
      .data(neighbors, (d) => d.index);

    neighborCards.classed("highlight", false);

    if (!d.isStacked) {
      return;
    }
    d3.select(this)
      .transition()
      .duration(250)
      .attr("transform", getCardTransform(d));

    // Update edges to also move.
    inOutLinks
      .transition()
      .attr("x1", (d) => getX(d.source))
      .attr("y1", (d) => getY(d.source) + cardHeaderOffset)
      .attr("x2", (d) => getX(d.target))
      .attr("y2", (d) => getY(d.target) + cardHeaderOffset);
  });
}

function onCardClick(event, card) {
  event.preventDefault();
  event.stopPropagation();
  changeFocusId(card.id, "click");
}

function changeFocusId(nextId, navigationMethod) {
  if (!visibleNodes.map((n) => n.id).includes(nextId)) {
    // This card is not visible.
    console.warn(
      `Card ${nextId} is not visible with current filters. Resetting them.`
    );
    timelineEl.resetFilters();
    updateVisibleNodes(data.nodes);
  }
  const nextCard = cardById[nextId];
  if (!nextCard) {
    console.warn(`Invalid id ${nextId}.`);
    return;
  }
  if (lastChild) {
    lastChild.role = "";
  }
  if (lastParent) {
    lastParent.role = "";
  }
  lastChild = null;
  lastParent = null;

  const focusCard = cardById[currentId];
  if (focusCard.deps.includes(nextCard.id)) {
    // Navigating from a child to its parent.
    lastChild = focusCard;
    lastChild.role = "lastFocus";
  }
  if (nextCard.deps.includes(focusCard.id)) {
    // Navigating from a parent to its child.
    lastParent = focusCard;
    lastParent.role = "lastFocus";
  }

  // TODO: Decide whether we want to reset the zoom every time.
  // resetZoom();

  gtag("event", "navigation", {
    method: navigationMethod,
  });
  window.location.hash = nextCard.id;
}

function resetZoom() {
  // Reset the zoom and pan.
  resetZoomEl.className = "";
  svg
    .transition()
    .duration(500)
    .call(zoom.transform, d3.zoomIdentity)
    .on("end", () => (resetZoomEl.className = ""));

  gtag("event", "zoom_reset");
}

function getCardTransform(card) {
  return `translate(${getX(card)}, ${getY(card)})`;
}

function getCardTransformReveal(card) {
  return `translate(${getX(card)}, ${getYHover(card)})`;
}

function getX(card) {
  const cx = width / 2;
  return cx + card.dx * cardOffsetX;
}

function getY(card) {
  const cy = height / 2;
  return cy + card.dy * cardOffsetY;
}

// New center of the card in the hovered state.
function getYHover(card) {
  return getY(card) - cardHeight * (1 - cardOverlapPercent - 0.01);
}

const cardHeaderOffset = -cardHeight / 2 + 10;

let lastChild = null;
let lastParent = null;

function navigateToParent() {
  if (lastParent) {
    changeFocusId(lastParent.id, "keyboard_left");
    return;
  }

  const focusCard = cardById[currentId];
  const parents = getParents(focusCard);
  if (parents.length === 0) {
    return;
  }

  changeFocusId(parents[parents.length - 1].id, "keyboard_left");
}

function navigateToChild() {
  if (lastChild) {
    changeFocusId(lastChild.id, "keyboard_right");
    return;
  }
  const focusCard = cardById[currentId];
  const children = getChildren(focusCard);
  if (children.length === 0) {
    return;
  }

  changeFocusId(children[children.length - 1].id, "keyboard_right");
}

function onKeyUp(e) {
  let currentIndex;

  switch (e.code) {
    case "ArrowUp":
      currentIndex = visibleNodes.findIndex((n) => n.id === currentId);
      const prevIndex = currentIndex - 1;
      if (prevIndex < 0) {
        console.warn(`Already at first card ${currentId}.`);
        return;
      }
      changeFocusId(visibleNodes[prevIndex].id, "keyboard_up");
      break;
    case "ArrowDown":
      currentIndex = visibleNodes.findIndex((n) => n.id === currentId);
      const nextIndex = currentIndex + 1;
      if (nextIndex >= visibleNodes.length) {
        console.warn(`Already at last card ${currentId}.`);
        return;
      }
      changeFocusId(visibleNodes[nextIndex].id, "keyboard_up");
      break;
    case "ArrowRight":
      navigateToChild();
      break;
    case "ArrowLeft":
      navigateToParent();
      break;
    case "Slash":
      timelineEl.focusSearch();
      break;
  }
}

function onFilter(e) {
  console.log("onFilter", e.detail);
  const { query, field } = e.detail;

  // Find the most relevant node matching this.
  let matching = data.nodes.filter((card) => searchHelper(card, query));

  // Filter by field if needed.
  if (field) {
    matching = matching.filter((card) => card.field.toLowerCase() === field);
  }

  if (query) {
    gtag("event", "search", {
      search_term: query,
    });
  }

  if (field) {
    gtag("event", "filter", {
      value: field,
    });
  }

  updateVisibleNodes(matching);
}

window.addEventListener("load", onLoad);
window.addEventListener("hashchange", onHashChange);
window.addEventListener("resize", onResize);

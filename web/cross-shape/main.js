import { formatYear, loadGraph } from "../utils.js";
import { cardWidth, cardHeight, renderCard, renderMTGCard } from "../card.js";
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
const links = svg.append("g").attr("class", "links");
const nodes = svg.append("g").attr("class", "nodes");

const timelineEl = document.querySelector("asimov-timeline");
timelineEl.addEventListener("filter", onFilter);

let data;
let currentIndex;

const idToIndex = {};
let visibleNodes = [];

async function onLoad() {
  data = await loadGraph("../asimov-1850.tsv");

  for (let [index, card] of data.nodes.entries()) {
    card.index = index;
    idToIndex[card.id] = card.index;
  }
  updateVisibleNodes(data.nodes);

  window.addEventListener("keyup", onKeyUp);
  if (window.location.hash) {
    onHashChange();
  } else {
    const ids = data.nodes.map((n) => n.id);
    const randomIndex = Math.floor(Math.random() * data.nodes.length);
    window.location.hash = ids[randomIndex];
  }
  //renderLabels();
}

function updateVisibleNodes(newVisibleNodes) {
  visibleNodes = data.nodes;
  timelineEl.setAttribute("nodes", JSON.stringify(newVisibleNodes));
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  svg.attr("width", width).attr("viewBox", [0, 0, width, height]);

  renderIndex(currentIndex);
}

function searchHelper(card, query) {
  return (
    card.title.toLowerCase().includes(query) ||
    card.description.toLowerCase().includes(query)
  );
}

function onHashChange() {
  const id = window.location.hash.substring(1);
  console.log("onHashChange id", id);
  currentIndex = idToIndex[id];
  renderIndex(currentIndex);
  timelineEl.setAttribute("focus", id);
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
function getVisibleCards(focusIndex, depth = 0) {
  const cards = visibleNodes;
  // Reset dx and dy on all card data.
  cards.map((card) => {
    card.dx = 0;
    card.dy = 0;
    card.role = "";
  });
  let visible = [];

  if (focusIndex < 0 || focusIndex >= cards.length) {
    return visible;
  }
  const focusCard = cards[focusIndex];
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
  siblings = [...new Set(siblings)];
  siblings.map((sib) => {
    sib.role = "sibling";
    sib.offset = 0;
  });

  console.log(
    `Found ${siblings.length} siblings: ${siblings.map((s) => s.id)}.`
  );
  visible = visible.concat(siblings);

  // Set positions for all visible cards based on their depth.
  for (const card of visible) {
    // console.log(`Offset of ${card.id} is ${card.offset}.`);
    card.dx = card.offset;
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
      if (card.role === "focus") {
        card.dy = 0;
      } else if (card.role === "sibling") {
        card.dy = 1 + index * cardOverlapPercent;
      } else {
        card.dy = getDy(index, generation.length, cardOverlapPercent);
      }
    }
  }

  // Get all next and previous cards.
  // for (let i = 1; i < depth + 1; i++) {
  //   // Try to add a previous card.
  //   if (focusIndex - i > 0) {
  //     const previous = Object.assign({}, cards[focusIndex - i]);
  //     previous.dx = 0;
  //     previous.dy = -i;
  //     previous.role = 'previous';
  //     visible.push(previous);
  //   }
  //   // Try to add a next card.
  //   if (focusIndex + i < cards.length) {
  //     const next = Object.assign({}, cards[focusIndex + i]);
  //     next.dx = 0;
  //     next.dy = i;
  //     next.role = 'next';
  //     visible.push(next);
  //   }
  // }

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
  const beforeLength = ancestors.length;
  ancestors = [...new Set(ancestors)];
  if (beforeLength !== ancestors.length) {
    console.log(`Removed ${beforeLength - ancestors.length} cards via Set.`);
  }

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
  if (total === 2) {
    return index - 0.5;
  }
  const width = spacing * (total - 1);
  const position = index * spacing - width / 2;
  return position;
}

function renderLabels() {
  // Draw text for chronological labels and parent/children labels.
  const data = [
    {
      dx: 0,
      dy: -1,
      text: "previous",
    },
    {
      dx: 0,
      dy: 1,
      text: "next",
    },
    /*
    {
      dx: -1, dy: 0, text: 'depends on'
    },
    {
      dx: 1, dy: 0, text: 'led to'
    }
    */
  ];
  const labels = svg.append("g").attr("class", "labels");
  labels
    .selectAll("text")
    .data(data, (d) => d.text)
    .enter()
    .append("text")
    .attr("class", "label")
    .html((d) => d.text)
    .attr("transform", (d) => getLabelTransform(d));
}

function renderIndex(index) {
  const visible = getVisibleCards(index, 5);
  update(visible);
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
    .attr("y1", (d) => getY(d.source))
    .attr("x2", (d) => getX(d.target))
    .attr("y2", (d) => getY(d.target))
    .attr("class", (d) =>
      d.source.field === d.target.field ? "same-field" : "cross-field"
    )
    .merge(cardLinks);

  cardLinks
    .transition()
    .duration(250)
    .attr("x1", (d) => getX(d.source))
    .attr("y1", (d) => getY(d.source))
    .attr("x2", (d) => getX(d.target))
    .attr("y2", (d) => getY(d.target));

  cardLinks.exit().remove();
}

function updateNodes(visibleNodes) {
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
  cards.exit().style("animation", "fadeout 0.5s").transition().remove();

  // Make sure everything is ordered correctly.
  cards.order();
}

function renderCrossCards(cardsEnter) {
  // const cards = renderCard(cardsEnter);
  const cards = renderMTGCard(cardsEnter);

  cards.on("click", onCardClick);
  cards.attr("transform", (d) => getCardTransform(d));
  cards.style("animation", "fadein 0.25s");
  cards.classed("focus", (d) => d.role == "focus");

  cards.on("mouseenter", function (d, i) {
    d.growTimeout = setTimeout(() => {
      d3.select(this)
        .raise()
        .attr("transform", getCardTransform(d) + " scale(1.5)");
      d.isGrow = true;
    }, 1000);
  });
  cards.on("mouseleave", function (d, i) {
    d3.select(this).attr("transform", getCardTransform(d));
    clearTimeout(d.growTimeout);
    if (d.isGrow) {
      // Sorting cards back to the "original" order leads to odd behaviors.
      cards.order();
      d.isGrow = false;
    }
  });
}

function onCardClick(card) {
  changeFocusIndex(card.index);
}

function changeFocusIndex(cardIndex) {
  if (cardIndex < 0 || cardIndex >= data.nodes.length) {
    console.warn(`Invalid index ${cardIndex}.`);
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

  const cards = data.nodes;
  const focusCard = cards[currentIndex];
  const nextCard = cards[cardIndex];
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

  window.location.hash = nextCard.id;
}

function getCardTransform(card) {
  return `translate(${getX(card)}, ${getY(card)})`;
}

function getLabelTransform(d) {
  const cx = width / 2;
  const cy = height / 2;
  const xOffset = cx + (d.dx * cardOffsetX) / 2;
  const yOffset = cy + (d.dy * cardOffsetY) / 2;
  return `translate(${xOffset}, ${yOffset})`;
}

function getX(card) {
  const cx = width / 2;
  return cx + card.dx * cardOffsetX;
}

function getY(card) {
  const cy = height / 2;
  return cy + card.dy * cardOffsetY;
}

let lastChild = null;
let lastParent = null;

function navigateToParent() {
  if (lastParent) {
    changeFocusIndex(lastParent.index);
    return;
  }

  const cards = data.nodes;
  const focusCard = cards[currentIndex];
  const parents = getParents(focusCard);
  if (parents.length === 0) {
    return;
  }

  changeFocusIndex(parents[parents.length - 1].index);
}

function navigateToChild() {
  if (lastChild) {
    changeFocusIndex(lastChild.index);
    return;
  }
  const cards = data.nodes;
  const focusCard = cards[currentIndex];
  const children = getChildren(focusCard);
  if (children.length === 0) {
    return;
  }

  changeFocusIndex(children[children.length - 1].index);
}

function onKeyUp(e) {
  switch (e.code) {
    case "ArrowUp":
      changeFocusIndex(currentIndex - 1);
      break;
    case "ArrowDown":
      changeFocusIndex(currentIndex + 1);
      break;
    case "ArrowRight":
      navigateToChild();
      break;
    case "ArrowLeft":
      navigateToParent();
      break;
  }
}

function onFilter(e) {
  console.log("onFilter", e.detail);
  const { query, field } = e.detail;

  // Find the most relevant node matching this.
  const matching = data.nodes.filter((card) => searchHelper(card, query));
  updateVisibleNodes(matching);
}

window.addEventListener("load", onLoad);
window.addEventListener("hashchange", onHashChange);
window.addEventListener("resize", onResize);

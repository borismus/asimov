import {formatYear, loadGraph} from '../utils.js';
import {cardWidth, cardHeight, renderCard} from '../card.js';

const cardPaddingX = 100;
const cardPaddingY = 20;
const cardOffsetX = cardWidth + cardPaddingX;
const cardOffsetY = cardHeight + cardPaddingY;
const cardOverlapPercent = 0.16;

const width = window.innerWidth;
const height = window.innerHeight;
const svg = d3.select('#container').append('svg')
  .attr('width', width)
  .attr('viewBox', [0, 0, width, height]);
const links = svg.append('g').attr('class', 'links');
const nodes = svg.append('g').attr('class', 'nodes');

let data;
let currentIndex;

async function onLoad() {
  data = await loadGraph('../asimov-1700.csv');
  for (let [index, card] of data.nodes.entries()) {
    card.index = index;
  }
  window.addEventListener('keyup', onKeyUp);
  let startIndex = 0;
  if (window.location.hash) {
    const id = window.location.hash.slice(1);
    const ids = data.nodes.map(n => n.id);
    startIndex = ids.indexOf(id);
  } else {
    startIndex = Math.floor(Math.random() * data.nodes.length);
  }
  changeFocusIndex(startIndex);
  renderLabels();
}

function onHashChange() {
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
  const cards = data.nodes;
  let visible = [];

  if (focusIndex < 0 || focusIndex >= cards.length) {
    return visible;
  }
  const focusCard = cards[focusIndex];
  focusCard.dx = 0;
  focusCard.dy = 0;
  focusCard.role = 'focus';
  console.log(`Focusing on ${focusCard.id}.`);
  visible.push(focusCard);

  if (depth === 0) {
    return visible;
  }
  // Get all next and previous cards.
  for (let i = 1; i < depth + 1; i++) {
    // Try to add a previous card.
    if (focusIndex - i > 0) {
      const previous = cards[focusIndex - i];
      previous.dx = 0;
      previous.dy = -i;
      previous.role = 'previous';
      visible.push(previous);
    }
    // Try to add a next card.
    if (focusIndex + i < cards.length) {
      const next = cards[focusIndex + i];
      next.dx = 0;
      next.dy = i;
      next.role = 'next';
      visible.push(next);
    }
  }

  // TODO: Get all parents and children recursively to a certain level.
  const ancestors = getAncestors(focusCard, depth)
  console.log(`${focusCard.id} has ${ancestors.length} ancestors with depth ${depth}.`);
  visible = visible.concat(ancestors);
  visible = visible.concat(getDescendants(focusCard, depth));

  return visible;
}

function getAncestors(card, depth, offset = 0) {
  // Base case.
  if (offset === depth) {
    return [];
  }
  let ancestors = [];
  for (const parent of getParents(card)) {
    parent.dx = -offset - 1;
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
    child.dx = offset + 1;
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
  for (const [index, parent] of parents.entries()) {
    parent.dx = -1;
    parent.dy = getDy(index, parents.length, cardOverlapPercent);
    parent.role = 'parent';
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
  for (const [index, child] of children.entries()) {
    child.dx = 1;
    child.dy = getDy(index, children.length, cardOverlapPercent);
    child.role = 'child';
  }
  return children;
}

/** Given an index and the total number, get the position in the grid. For
  * example, with index=0, total=1 => 0. index=0, total=2 => -0.5. index=1,
  * total=3 => 0. */
function getDy(index, total, spacing=1) {
  const width = spacing * (total - 1);
  const position = index * spacing - width/2;
  return position;
}

function renderLabels() {
  // Draw text for chronological labels and parent/children labels.
  const data = [
    {
      dx: 0, dy: -1, text: 'previous'
    },
    {
      dx: 0, dy: 1, text: 'next'
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
  const labels = svg.append('g').attr('class', 'labels');
  labels.selectAll('text')
    .data(data, d => d.text)
    .enter()
    .append('text')
    .attr('class', 'label')
    .html(d => d.text)
    .attr('transform', d => getLabelTransform(d));
}

function renderIndex(index) {
  const {links, nodes} = data;
  const visible = getVisibleCards(index, 3);
  update(visible);
}

function update(visibleNodes) {
  updateLinks(visibleNodes);
  updateNodes(visibleNodes);
}

function updateLinks(visibleNodes) {
  // Filter all links to just include the ones between the visible cards.
  const ids = visibleNodes.map(d => d.id);
  const visibleLinks = data.links.filter(link =>
    ids.includes(link.source.id) && ids.includes(link.target.id)
  );

  const cardLinks = links.selectAll('line')
    .data(visibleLinks, d => d.source.id + d.target.id);

  cardLinks.enter()
    .append('line')
    .attr('x1', d => getX(d.source))
    .attr('y1', d => getY(d.source))
    .attr('x2', d => getX(d.target))
    .attr('y2', d => getY(d.target))
    .merge(cardLinks);

  cardLinks.transition().duration(250)
    .attr('x1', d => getX(d.source))
    .attr('y1', d => getY(d.source))
    .attr('x2', d => getX(d.target))
    .attr('y2', d => getY(d.target));

  cardLinks.exit().remove();
}

function updateNodes(visibleNodes) {
  // Important: the following data call binds the data and assigns a key (in
  // this case, the ID), so that d3 knows which card is old and which is new.
  const cards = nodes
    .selectAll('foreignObject')
    .data(visibleNodes, d => d.id);

  // Render new cards.
  const cardsEnter = cards.enter();
  renderCrossCards(cardsEnter);
  cardsEnter.merge(cards);

  // Update existing cards.
  cards.transition().duration(250)
    .attr('transform', d => getCardTransform(d));

  cards.classed('focus', d => d.role == 'focus');

  // Remove old cards.
  cards.exit()
    .style('animation', 'fadeout 0.25s')
    .transition()
    .remove();
}

function renderCrossCards(cardsEnter) {
  const cards = renderCard(cardsEnter);
  cards.on('click', onCardClick);
  cards.attr('transform', d => getCardTransform(d))
  cards.style('animation', 'fadein 0.25s');
  cards.classed('focus', d => d.role == 'focus');
}

function onCardClick(card) {
  changeFocusIndex(card.index);
}

function changeFocusIndex(cardIndex) {
  currentIndex = cardIndex;
  window.location.hash = data.nodes[cardIndex].id;
  renderIndex(currentIndex);
}

function getCardTransform(card) {
  return `translate(${getX(card)}, ${getY(card)})`;
}

function getLabelTransform(d) {
  const cx = width / 2;
  const cy = height / 2;
  const xOffset = cx + d.dx * cardOffsetX / 2;
  const yOffset = cy + d.dy * cardOffsetY / 2;
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

function navigateToParent() {
  const cards = data.nodes;
  const focusCard = cards[currentIndex];
  const parents = getParents(focusCard);
  if (parents.length === 0) {
    return;
  }

  changeFocusIndex(parents[parents.length - 1].index);
}

function navigateToChild() {
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
    case 'ArrowUp':
      changeFocusIndex(currentIndex - 1);
      break;
    case 'ArrowDown':
      changeFocusIndex(currentIndex + 1);
      break;
    case 'ArrowRight':
      navigateToChild();
      break;
    case 'ArrowLeft':
      navigateToParent();
      break;
  }
}

window.addEventListener('load', onLoad);
window.addEventListener('hashchange', onHashChange);

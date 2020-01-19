import {formatYear, loadGraph} from '../utils.js';
import {cardWidth, cardHeight, renderCard} from '../card.js';

const cardPaddingX = 100;
const cardPaddingY = 20;
const cardOffsetX = cardWidth + cardPaddingX;
const cardOffsetY = cardHeight + cardPaddingY;

const width = window.innerWidth;
const height = window.innerHeight;
const svg = d3.select('#container').append('svg')
  .attr('width', width)
  .attr('viewBox', [0, 0, width, height]);
const nodes = svg.append('g').attr('class', 'nodes');

let data;
let currentIndex;

async function init() {
  data = await loadGraph('../asimov-1700.csv');
  for (let [index, card] of data.nodes.entries()) {
    card.index = index;
  }
  window.addEventListener('keyup', onKeyUp);
  currentIndex = Math.floor(Math.random() * data.nodes.length);
  renderIndex(currentIndex);
}

/**
 * Get all cards that are currently visible, given the focus card, and distance
 * from it. If distance is zero, only show the focus card. If it's one, show
 * next, previous, any parents and children. If it's two, show next and
 * next-next, previous and previous-previous, parents and grandparents, children
 * and grandchildren.
 *
 * Assign each card optional dx, dy attributes which determines where in the
 * grid the card should go (0,0) is center of screen, (1,0) is to the right and
 * may be shared by multiple cards, in which case they will fan out in the
 * y-axis.
 */
function getVisibleCards(focusIndex, distance = 0) {
  const cards = data.nodes;
  let visible = [];

  if (focusIndex < 0 || focusIndex >= cards.length) {
    return visible;
  }
  const focusCard = cards[focusIndex];
  focusCard.dx = 0;
  focusCard.dy = 0;
  console.log(`Focusing on ${focusCard.id}.`);
  visible.push(focusCard);

  if (distance === 0) {
    return visible;
  }
  // Get all next and previous cards.
  for (let i = 1; i < distance + 1; i++) {
    // Try to add a previous card.
    if (focusIndex - i >= 0) {
      const previous = cards[focusIndex - i];
      previous.dx = 0;
      previous.dy = -i;
      visible.push(previous);
    }
    // Try to add a next card.
    if (focusIndex + i < cards.length) {
      const next = cards[focusIndex + i];
      next.dx = 0;
      next.dy = i;
      visible.push(next);
    }
  }

  // TODO: Get all parents and children recursively to a certain level.
  visible = visible.concat(getParents(focusCard));
  visible = visible.concat(getChildren(focusCard));

  return visible;
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
    parent.dy = index;
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
    child.dy = index;
  }
  return children;
}

function renderIndex(index) {
  const {links, nodes} = data;
  const visible = getVisibleCards(index, 1);
  update(visible);
}

function update(data) {
  // Important: the following data call binds the data and assigns a key (in
  // this case, the ID), so that d3 knows which card is old and which is new.
  const cards = nodes
    .selectAll('foreignObject')
    .data(data, d => d.id);

  // Render new cards.
  const cardsEnter = cards.enter();
  renderCrossCards(cardsEnter);
  cardsEnter.merge(cards);

  // Update existing cards.
  cards.transition().duration(500)
    .attr('transform', d => getTransform(d));

  // Remove old cards.
  cards.exit().remove();
}

function renderCrossCards(cardsEnter) {
  const cards = renderCard(cardsEnter);
  cards.on('click', onCardClick);
  cards.attr('transform', d => getTransform(d))
}

function onCardClick(card) {
  currentIndex = card.index;
  renderIndex(currentIndex);
}

function getTransform(d) {
  const cx = width / 2;
  const cy = height / 2;
  const xOffset = cx + d.dx * cardOffsetX;
  const yOffset = cy + d.dy * cardOffsetY;
  return `translate(${xOffset}, ${yOffset})`;
}

function navigateToParent() {
  const cards = data.nodes;
  const focusCard = cards[currentIndex];
  const parents = getParents(focusCard);
  if (parents.length === 0) {
    return;
  }

  currentIndex = parents[0].index;
  renderIndex(currentIndex);
}

function navigateToChild() {
  const cards = data.nodes;
  const focusCard = cards[currentIndex];
  const children = getChildren(focusCard);
  if (children.length === 0) {
    return;
  }

  currentIndex = children[0].index;
  renderIndex(currentIndex);
}

function onKeyUp(e) {
  switch (e.code) {
    case 'ArrowUp':
      currentIndex -= 1;
      renderIndex(currentIndex);
      break;
    case 'ArrowDown':
      currentIndex += 1;
      renderIndex(currentIndex);
      break;
    case 'ArrowRight':
      navigateToChild();
      break;
    case 'ArrowLeft':
      navigateToParent();
      break;
  }
}

window.addEventListener('load', init);

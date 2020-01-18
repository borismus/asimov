import {formatYear, loadGraph} from '../utils.js';
import {renderCard} from '../card.js';

const width = window.innerWidth;
const height = window.innerHeight;

async function init() {
  const data = await loadGraph('../asimov-1700.csv');
  render(data);
}

function render(data) {
  const {links, nodes} = data;

  const index = Math.floor(Math.random() * nodes.length);
  const node = nodes[index];

  const svg = d3.select('#container').append('svg')
    .attr('width', width)
    .attr('viewBox', [0, 0, width, height]);

  const card = svg.selectAll('g')
    .data(nodes.slice(index, index + 2))
    .enter()
    .append('g');

  renderCard(card);

  const W = 500;
  const H = 500;
  card.attr('transform',
    d => `translate(${Math.random() * W}, ${Math.random() * H})`);
}


window.addEventListener('load', init);

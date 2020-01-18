import {formatYear, loadGraph} from '../utils.js';
import {renderCard} from '../card.js';

//const width = window.innerWidth;
const width = 60000;
const height = window.innerHeight;

let x;
let y;
let svg;

async function init() {
  const data = await loadGraph('../asimov-1700.csv');
  render(data);
}

function render(data) {
  const color = 'red';
  const {links, nodes} = data;

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id))
    .force('charge', d3.forceManyBody())
    .force('collide', d3.forceCollide().radius(50))
    .force('center', d3.forceCenter(width / 2, height / 2));

  svg = d3.select('#container').append('svg')
    .attr('width', width)
    .attr('viewBox', [0, 0, width, height]);

  const link = svg.append('g')
    .attr('class', 'link')
    .selectAll('line')
    .data(links)
    .join('line')

  const node = svg.selectAll('g')
    .data(nodes)
    .enter()
    .append('g')
    .on('click', clicked)
    .call(drag(simulation));

  renderCard(node);

  // Create a scale from years to X coordinates.
  const firstYear = nodes[0].year;
  const lastYear = nodes[nodes.length - 1].year;
  const domain = [firstYear - lastYear, -1];
  const range = [0, width];
  const scale = d3.scaleLog()
    .domain(domain)
    .range(range);

  x = year => {
    const yearsRemaining = year - lastYear - 1;
    return scale(yearsRemaining);
  };
  y = val => {
    return Math.min(Math.max(0, val), height);
  };

  simulation.on('tick', () => {
    link
      .attr('x1', d => x(d.source.year))
      .attr('y1', d => y(d.source.y))
      .attr('x2', d => x(d.target.year))
      .attr('y2', d => y(d.target.y));

    node
      .attr('transform', d => {
        return `translate(${x(d.year)}, ${y(d.y)})`
      });
  });

  renderGuidelines(svg);
}

function clicked(d) {
  if (d3.event.defaultPrevented) return; // dragged
  console.log('clicked');

  d.fy = null;
}

const drag = simulation => {

  function dragstarted(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fy = d.y;
  }

  function dragged(d) {
    d.fy = d3.event.y;
  }

  function dragended(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fy = d3.event.y;
  }

  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}

function renderGuidelines(svg) {
  const dates = [
    -1000000,
    -100000,
    -10000,
    -1000,
    -500,
    -250,
    0,
    500,
    1000,
    1250,
    1500
  ];
  const guideline = svg
    .selectAll('.guideline')
    .data(dates)
    .enter()
    .append('g');

  guideline
    .append('line')
    .attr('class', 'guideline')
    .attr('x1', d => x(d))
    .attr('x2', d => x(d))
    .attr('y1', 0)
    .attr('y2', height)

  guideline
    .append('text')
    .attr('x', d => x(d))
    .attr('y', height - 20)
    .text(d => formatYear(d));

}

window.addEventListener('load', init);

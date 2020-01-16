import {loadGraph} from './graph.js';
import {formatYear} from './utils.js';

const width = window.innerWidth;
const height = window.innerHeight;

let x;
let svg;

async function init() {
  const data = await loadGraph('asimov-1700.csv');
  render(data);
}

function render(data) {
  const color = 'red';
  const {links, nodes} = data;

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id))
    .force('charge', d3.forceManyBody())
    .force('center', d3.forceCenter(width / 2, height / 2));

  svg = d3.select('#container').append('svg')
    .attr('viewBox', [0, 0, width, height]);

  const link = svg.append('g')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke-width', d => Math.sqrt(d.value));

  const node = svg.append('g')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', 5)
    .attr('fill', color)
    .on('click', clicked)
    .call(drag(simulation));

  node.append('title')
    .text(d => d.id);

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

  simulation.on('tick', () => {
    link
      .attr('x1', d => x(d.source.year))
      .attr('y1', d => d.source.y)
      .attr('x2', d => x(d.target.year))
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => x(d.year))
      .attr('cy', d => d.y);
  });

  function clicked(d) {
    if (d3.event.defaultPrevented) return; // dragged
    console.log('clicked');

    d.fy = null;
  }
  renderGuidelines(svg);
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
    .attr('x1', d => x(d))
    .attr('x2', d => x(d))
    .attr('y1', 0)
    .attr('y2', height)
    .attr('stroke-dasharray', '5,5')
    .attr('stroke', '#ccc');

  guideline
    .append('text')
    .attr('x', d => x(d))
    .attr('y', height - 20)
    .text(d => formatYear(d));

}

window.addEventListener('load', init);

import {loadGraph} from './graph.js';
import {formatYear} from './utils.js';

const WIDTH = 3500;
const HEIGHT = 300;

const LABEL_WIDTH = 200;
const LABEL_HEIGHT = 100;


const width = WIDTH;
const height = HEIGHT;
var c = cola.d3adaptor(d3).size([width, height]);

const div = d3.select(document.querySelector('#container'));

const svg = div
  .append("svg")
  .attr('id', 'diagram')
  .style("width", WIDTH)
  .style("height", HEIGHT);

const pageBounds = { x: 0, y: 0, width: WIDTH, height: HEIGHT };
const nodeRadius = 10;
const constraints = [];


function update() {
  const details = svg.selectAll('foreignObject');
  svg.selectAll('.expanded')
    .attr('visibility', d => isVisible(d) ? 'visible' : 'hidden');

  svg.selectAll('.collapsed')
    .style('fill', d => isVisible(d) ? 'red' : 'green');

  svg.selectAll('.node')
    .filter(d => isVisible(d))
    .raise();

  // Set the height of the SVG foreignObject based on the height of the HTML inside.
  details.attr('height', (d, i) => {
    const div = details.nodes()[i];
    const height = div.childNodes[0].getBoundingClientRect().height;
    return height;
  });
}



const dates = [-20000, -5000, -2500, -1000, -500, -250, 0, 500, 1000, 1250, 1500];
const guideline = svg.selectAll(".guideline")
  .data(dates)
  .enter().append("g");

guideline
  .append('line')
  .attr('x1', 0)
  .attr('x2', 0)
  .attr("y1", 0)
  .attr("y2", HEIGHT)
  .attr("class", "guideline")
  .attr("stroke-dasharray", "5,5");

guideline
  .append('text')
  .attr('x', 10)
  .attr('y', HEIGHT - 20)
  .text(d => formatYear(d));


let ticks = 0;
c.on("tick", () => {
  // For debugging purposes, stop ticking after a while. Otherwise devtools
  // is impossibly slow.
  // if (ticks > 100) { return; }
  link
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y);
  node.attr('transform', d => `translate(${d.x}, ${d.y})`);
  guideline.attr('transform', d => `translate(${getXForYear(d)}, 0)`);
  ticks += 1;
});

async function onLoad() {
  const graph = await loadGraph('asimov-1700.csv');
  const {nodes, links} = graph;

  d3.select('body').on('click', () => {
    if (d3.event.target.nodeName === 'svg') {
      // Close every node.
      graph.nodes.map(node => node.open = false);
      update();
    }
  });

  // Add chronological constraint.
  for (let i = 0; i < nodes.length - 1; i++) {
    constraints.push({ axis: "x", left: i, right: i + 1, gap: nodeRadius * 2 });
  }

  const tooltip = div
    .append("div")
    .attr("id", "tooltip");

  c.nodes(graph.nodes)
    .links(graph.links)
    .constraints(constraints)
    .linkDistance(15)
    .handleDisconnected(false)
    .start(30);

  const link = svg
    .selectAll(".link")
    .data(graph.links)
    .enter()
    .append("line")
    .attr("class", "link");

  link.exit().remove();

  const node = svg
    .selectAll('.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .call(c.drag);

  node.exit().remove();

  // Render the collapsed circle for each node.
  const collapsed = node
    .append('circle')
    .attr('class', 'collapsed')
    .attr('r', nodeRadius);

  // Render the expanded version of each node.
  const expanded = node
    .append('g')
    .attr('class', 'expanded')
    .attr('visibility', 'hidden')
    .append('foreignObject')
    .attr('x', -LABEL_WIDTH/2)
    .attr('y', 0)
    .attr('width', LABEL_WIDTH);

  const details = expanded.append('xhtml:div')
    .attr('class', 'details')
    .html(d => `
      <h1>${d.title}</h1>
      <div>${formatYear(d.year)}</div>
    `);

  console.log('b');
  // Set the height of the SVG foreignObject based on the height of the HTML inside.
  expanded.attr('height', (d, i) => {
    const div = details.nodes()[i];
    const height = div.getBoundingClientRect().height;
    return height;
  });

  // Show info on hover.
  node
    .on("mouseover", d => {
      d.hover = true;
      update();
    })
    .on("mouseout", function(d) {
      d.hover = false;
      update();
    });

  // Expand the whole chain on click.
  node.on('click', d => {
    const ancestors = getAncestors(d.id);
    console.log(`Ancestors of ${d.id} are ${ancestors.join(', ')}.`);

    // Clicking on an already open thing opens the link in a new page.
    if (isVisible(d)) {
      if (d.url) {
        window.open(d.url, '_blank');
      }
    }

    for (let node of graph.nodes) {
      // Only open nodes that are in the ancestor chain.
      node.open = [...ancestors, d.id].includes(node.id);
    }
    update();
  });
}

window.addEventListener('load', onLoad);

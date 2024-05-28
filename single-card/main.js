import { renderCard, renderMTGCard, cardWidth, cardHeight } from "/static/card.js";
import { loadGraph } from "/static/utils.js";

const width = window.innerWidth;
const height = window.innerHeight;

async function main() {
  const svg = d3
    .select("#container")
    .append("svg")
    .attr("width", width)
    .attr("viewBox", [0, 0, width, height]);
  const nodeSvg = svg.append("g").attr("class", "nodes");

  const { nodes, edges } = await loadGraph("/static/asimov.tsv");
  console.log(`Loaded ${nodes.length} inventions.`);

  const myNodes = [nodes[145]]
  // const myNodes = nodes

  const cards = nodeSvg.selectAll("g").data(myNodes, (d) => d.index);

  const cardEnter = cards.enter();
  const card = renderMTGCard(cardEnter);
  card.attr("transform", `translate(${cardWidth / 2 + 2}, ${cardHeight / 2 + 2})`);
}

function onResize() {
  const svg = d3
    .select("#container svg")
    .attr("width", width)
    .attr("viewBox", [0, 0, width, height]);
}

window.addEventListener("DOMContentLoaded", main);
window.addEventListener("resize", onResize);

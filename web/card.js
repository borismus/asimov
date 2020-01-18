import {formatYear} from './utils.js';

const cardAspect = 2.5 / 3.5;
export const cardWidth = 240;
export const cardHeight = cardWidth / cardAspect;

export function renderCard(card) {
  const innerCard = card
    .append('foreignObject')
    .attr("class", d => `card-container ${d.type.toLowerCase()}`)
    .attr('x', -cardWidth / 2)
    .attr('y', -cardHeight / 2)
    .attr('width', cardWidth)
    .attr('height', cardHeight);

  innerCard
    .append("xhtml:div")
    .attr('class', 'card-details')
    .html(
      d => `
      <header class="card-header">
        <div class="title">${d.title}</div>
        <div class="year">${formatYear(d.year)}</div>
      </header>
      <img src="${d.image}" alt="Image for ${d.id}"/>
      <section class="card-center">
        <div class="inventor">${d.inventor}</div>
        <div class="location">${d.location}</div>
      </section>
      <div class="card-body">
        <div>${d.description}</div>
      </div>`
    );

}


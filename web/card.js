import {formatYear} from './utils.js';

const cardAspect = 1;
export const cardWidth = 240;
export const cardHeight = cardWidth / cardAspect;

export function renderCard(card) {
  const innerCard = card
    .append('foreignObject')
    .attr('class', d => `card-container ${d.type.toLowerCase()} ${d.year}`)
    .attr('x', -cardWidth / 2)
    .attr('y', -cardHeight / 2)
    .attr('width', cardWidth)
    .attr('height', cardHeight);

  const details = innerCard
    .append('xhtml:div')
    .attr('class', 'card-details')
    .html(
      d => `
      <header class='card-header'>
        <div class='title' title='${d.title}'>${d.title}</div>
        <div class='year'>${formatYear(d.year)}</div>
      </header>
      <section class='card-body'>
        ${d.description}
      </section>
      <footer class='card-footer'>
        <div class='inventor'>${d.inventor}</div>
        <div class='location'>${d.location}</div>
      </footer>`
    );

  return innerCard;
}


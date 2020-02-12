import {formatYear} from './utils.js';

const cardAspect = 1;
export const cardWidth = 240;
export const cardHeight = cardWidth / cardAspect;

export function renderCard(card) {
  const innerCard = card
    .append('foreignObject')
    .attr('x', -cardWidth / 2)
    .attr('y', -cardHeight / 2)
    .attr('width', cardWidth)
    .attr('height', cardHeight);

  const details = innerCard
    .append('xhtml:div')
    .attr('class', d => `card-container ${d.field.toLowerCase()} ${d.year}`)
    .html(
      d => `
      <header class='card-header'>
        <div class='title' title='${d.title}'>${d.title}</div>
        <div class='year'>${formatYear(d.year)}</div>
        <img class="field" src="../images/fields/${d.field}.png" />
      </header>
      <section class='card-body'>
        <p>${d.description}</p>
      </section>
      <footer class='card-footer'>
        <div class='inventor ${d.inventor ? '' : 'unknown'}'>${d.inventor}</div>
        <div class='location ${d.location ? '' : 'unknown'}'>${d.location}</div>
      </footer>`
    );

  return innerCard;
}


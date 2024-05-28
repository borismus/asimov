import { formatField, formatYear } from "./utils.js";

const cardAspect = 240 / 342;
export const cardWidth = 240;
export const cardHeight = cardWidth / cardAspect;

const imageAspect = 392 / 312;

const BUG_BODY = `**Describe the issue**

Is the description incorrect? Is the image missing? Are the dependencies weird? Are the dates or inventors wrong?`;

export function renderMTGCard(card) {
  const outerG = card
    .append("g")
    .attr("class", (d) => "card field-" + formatField(d.field));

  const g = outerG.append("g").attr("class", "card-inner");
  g.attr("transform", `translate(${-cardWidth / 2}, ${-cardHeight / 2})`);

  const content = {
    topLeft: (d) => d.title,
    midLeft: (d) => d.inventor,
    bottomLeft: (d) => d.location,
    bottomRight: (d) => formatYear(d.year),
  };

  // Outer rectangle
  g.append("rect")
    .attr("width", cardWidth)
    .attr("height", cardHeight)
    .attr("fill", "white")
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .attr("rx", 4)
    .classed("container", true);

  // Image rectangle
  const margin = 18;
  const marginIn = margin - 2;
  const headerExtra = 4;

  const imageHeight =
    (cardWidth - marginIn * 2) * (1 / imageAspect) + headerExtra;
  g.append("rect")
    .attr("x", marginIn)
    .attr("y", marginIn + headerExtra)
    .attr("width", cardWidth - marginIn * 2)
    .attr("height", imageHeight)
    .attr("fill", "transparent")
    .attr("stroke", "black");

  // Image
  g.append("image")
    .attr("x", margin)
    .attr("y", margin + headerExtra)
    .attr("width", cardWidth - margin * 2)
    .attr("height", (cardWidth - margin * 2) * (1 / imageAspect) + headerExtra)
    .attr("href", (d) => `/static/images/entries/${d.id}.jpg`)
    .attr("preserveAspectRatio", "xMidYMid slice");

  const footerHeight = 20;
  const midHeight = 36;
  // Body rectangle
  g.append("rect")
    .attr("x", marginIn)
    .attr("y", imageHeight + midHeight)
    .attr("height", cardHeight - imageHeight - midHeight - footerHeight)
    .attr("width", cardWidth - 2 * marginIn)
    .attr("fill", "transparent")
    .attr("stroke", "black");

  // Body text
  const bodyFontSize = 10;
  const marginFo = margin + 2;
  g.append("foreignObject")
    .attr("x", marginFo)
    .attr("y", imageHeight + 2 * marginFo - 2)
    .attr("height", cardHeight - imageHeight - 2 * marginFo - footerHeight)
    .attr("width", cardWidth - 2 * marginFo)
    .attr("font-size", bodyFontSize)
    .append("xhtml:div")
    .html(
      (d) =>
        // Safari has a bug where overflow-y: auto causes long text to render incorrectly.
        `<div style="padding: 1px; height: 100%;">${d.description}</div>`
    );

  // Top left text
  g.append("text")
    .attr("x", marginIn)
    .attr("y", 13)
    .attr("font-size", 13)
    .classed("title", true)
    .text(content.topLeft);

  // Middle text
  g.append("text")
    .attr("x", marginIn)
    .attr("y", imageHeight + midHeight / 2 + 13)
    .attr("height", 24)
    .attr("width", cardWidth - 2 * marginIn)
    .attr("font-size", 10)
    .text(content.midLeft);

  // Bottom left text
  g.append("text")
    .attr("x", marginIn)
    .attr("y", cardHeight - footerHeight + 14)
    .attr("font-size", 12)
    .text(content.bottomLeft);

  // Bottom right text
  g.append("text")
    .attr("x", cardWidth - marginIn)
    .attr("y", cardHeight - footerHeight + 14)
    .attr("font-size", 12)
    .attr("text-anchor", "end")
    .text(content.bottomRight);

  // Top right icon
  const circleRadius = 6;
  g.append("circle")
    .attr("cx", cardWidth - margin - 12 + circleRadius)
    .attr("cy", 4 + circleRadius)
    .attr("r", circleRadius)
    .attr("fill", "white")
    .attr("stroke", "black");

  g.append("image")
    .attr("x", cardWidth - margin - 12 + 1)
    .attr("y", 5)
    .attr("width", 10)
    .attr("height", 10)
    .attr("href", (d) => `/static/images/fields/${formatField(d.field)}.png`)
    .attr("cursor", "pointer")
    .on("mouseenter", function() {
      // Change the icon to be the bug report one.
      d3.select(this).attr("href", "/static/images/icons/bug_report.svg");
    })
    .on("mouseleave", function(event, d) {
      d3.select(this).attr("href", `/static/images/fields/${formatField(d.field)}.png`);
    })
    .attr("onclick", (d) => {
      const bugTitle = `Content issue with %23${d.id}`;
      return (
        `window.open('https://github.com/borismus/asimov/issues/new?` +
        `title=${bugTitle}&body=${encodeURIComponent(BUG_BODY)}', '_blank')`
      );
    });

  return outerG;
}

export function renderCard(card) {
  const outerG = card.append("g").attr("class", "card");

  const innerCard = outerG
    .append("foreignObject")
    .attr("x", -cardWidth / 2)
    .attr("y", -cardHeight / 2)
    .attr("width", cardWidth)
    .attr("height", cardHeight);

  const details = innerCard
    .append("xhtml:div")
    .attr("class", (d) => `card-container ${formatField(d.field)} ${d.year}`)
    .html(
      (d) => `
      <header class='card-header'>
        <div class='title' title='${d.title}'>${d.title}</div>
        <div class='year'>${formatYear(d.year)}</div>
        <img class="field" src="/static/images/fields/${formatField(d.field)}.png" />
      </header>
      <section class='card-body'>
        <p>${d.description}</p>
      </section>
      <footer class='card-footer'>
        <div class='inventor ${d.inventor ? "" : "unknown"}'>${d.inventor}</div>
        <div class='location ${d.location ? "" : "unknown"}'>${d.location}</div>
      </footer>`
    );

  return outerG;
}

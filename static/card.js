import { formatField, formatYear } from "./utils.js";

// 3:2 landscape. Image fills below a thin title bar; description / inventor /
// year aren't shown on the card itself anymore (they surface on hover-expand).
export const cardWidth = 240;
export const cardHeight = 160;
// Hover cards use the original portrait MTG card with the description /
// inventor / location / year visible — they're rendered above everything in
// gHoverCards so overlap with neighbor rows is acceptable.
export const fullCardHeight = 342;

const BUG_BODY = `**Describe the issue**

Is the description incorrect? Is the image missing? Are the dependencies weird? Are the dates or inventors wrong?`;

export function renderMTGCard(card) {
  const outerG = card
    .append("g")
    .attr("class", (d) => "card field-" + formatField(d.field));

  const g = outerG.append("g").attr("class", "card-inner");
  g.attr("transform", `translate(${-cardWidth / 2}, ${-cardHeight / 2})`);

  const margin = 18;
  const marginIn = margin - 2;
  const headerExtra = 4;
  const titleBarH = marginIn + headerExtra; // 20: top strip for title + field icon

  // Outer container (background + border)
  g.append("rect")
    .attr("width", cardWidth)
    .attr("height", cardHeight)
    .attr("fill", "white")
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .attr("rx", 4)
    .classed("container", true);

  // Image fills below the title bar with a matching margin on the bottom so
  // the top and bottom borders look symmetric.
  const imageX = marginIn;
  const imageY = titleBarH;
  const imageW = cardWidth - marginIn * 2;
  const imageH = cardHeight - imageY - titleBarH;

  g.append("rect")
    .attr("class", "image-rect")
    .attr("x", imageX)
    .attr("y", imageY)
    .attr("width", imageW)
    .attr("height", imageH)
    .attr("fill", "transparent")
    .attr("stroke", "black");

  g.append("image")
    .attr("x", imageX)
    .attr("y", imageY)
    .attr("width", imageW)
    .attr("height", imageH)
    .attr("href", (d) => `/static/images/entries/${d.id}.jpg`)
    .attr("preserveAspectRatio", "xMidYMid slice");

  // Title (top-left)
  g.append("text")
    .attr("x", marginIn)
    .attr("y", 13)
    .attr("font-size", 13)
    .classed("title", true)
    .text((d) => d.title);

  // Field icon (top-right circle + image)
  const circleRadius = 6;
  g.append("circle")
    .attr("class", "field-icon-bg")
    .attr("cx", cardWidth - margin - 12 + circleRadius)
    .attr("cy", 4 + circleRadius)
    .attr("r", circleRadius)
    .attr("fill", "white")
    .attr("stroke", "black");

  g.append("image")
    .attr("class", "field-icon")
    .attr("x", cardWidth - margin - 12 + 1)
    .attr("y", 5)
    .attr("width", 10)
    .attr("height", 10)
    .attr("href", (d) => `/static/images/fields/${formatField(d.field)}.png`)
    .attr("cursor", "pointer")
    .on("mouseenter", function () {
      d3.select(this).attr("href", "/static/images/icons/bug_report.svg");
    })
    .on("mouseleave", function (event, d) {
      d3.select(this).attr(
        "href",
        `/static/images/fields/${formatField(d.field)}.png`
      );
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

// Full portrait MTG card: title at top, image, body description, inventor row,
// location + year footer. Used for hover-expanded cards in gHoverCards so the
// reader sees the description even when the in-graph card is just a thumbnail.
export function renderFullCard(card) {
  const W = cardWidth;
  const H = fullCardHeight;
  const imageAspect = 3 / 2;

  const outerG = card
    .append("g")
    .attr("class", (d) => "card field-" + formatField(d.field));

  const g = outerG.append("g").attr("class", "card-inner");
  g.attr("transform", `translate(${-W / 2}, ${-H / 2})`);

  const margin = 18;
  const marginIn = margin - 2;
  const headerExtra = 4;
  const imageHeight = (W - marginIn * 2) * (1 / imageAspect) + headerExtra;
  const footerHeight = 20;
  const midHeight = 36;

  g.append("rect")
    .attr("width", W).attr("height", H)
    .attr("fill", "white").attr("stroke", "black").attr("stroke-width", 2).attr("rx", 4)
    .classed("container", true);

  g.append("rect")
    .attr("class", "image-rect")
    .attr("x", marginIn).attr("y", marginIn + headerExtra)
    .attr("width", W - marginIn * 2).attr("height", imageHeight)
    .attr("fill", "transparent").attr("stroke", "black");

  g.append("image")
    .attr("x", margin).attr("y", margin + headerExtra)
    .attr("width", W - margin * 2)
    .attr("height", (W - margin * 2) * (1 / imageAspect) + headerExtra)
    .attr("href", (d) => `/static/images/entries/${d.id}.jpg`)
    .attr("preserveAspectRatio", "xMidYMid slice");

  g.append("rect")
    .attr("class", "body-rect")
    .attr("x", marginIn).attr("y", imageHeight + midHeight)
    .attr("width", W - 2 * marginIn)
    .attr("height", H - imageHeight - midHeight - footerHeight)
    .attr("fill", "transparent").attr("stroke", "black");

  const marginFo = margin + 2;
  g.append("foreignObject")
    .attr("class", "body-text")
    .attr("x", marginFo).attr("y", imageHeight + 2 * marginFo - 2)
    .attr("width", W - 2 * marginFo)
    .attr("height", H - imageHeight - 2 * marginFo - footerHeight)
    .attr("font-size", 9)
    .append("xhtml:div")
    .html((d) => `<div style="padding: 1px; height: 100%;">${d.description}</div>`);

  g.append("text")
    .attr("x", marginIn).attr("y", 13).attr("font-size", 13)
    .classed("title", true).text((d) => d.title);

  g.append("text")
    .attr("class", "middle-text")
    .attr("x", marginIn).attr("y", imageHeight + midHeight / 2 + 13)
    .attr("font-size", 10).text((d) => d.inventor);

  g.append("text")
    .attr("class", "bottom-left")
    .attr("x", marginIn).attr("y", H - footerHeight + 14).attr("font-size", 12)
    .text((d) => d.location);

  g.append("text")
    .attr("class", "bottom-right")
    .attr("x", W - marginIn).attr("y", H - footerHeight + 14)
    .attr("font-size", 12).attr("text-anchor", "end")
    .text((d) => formatYear(d.year));

  const cr = 6;
  g.append("circle")
    .attr("class", "field-icon-bg")
    .attr("cx", W - margin - 12 + cr).attr("cy", 4 + cr).attr("r", cr)
    .attr("fill", "white").attr("stroke", "black");

  g.append("image")
    .attr("class", "field-icon")
    .attr("x", W - margin - 12 + 1).attr("y", 5)
    .attr("width", 10).attr("height", 10)
    .attr("href", (d) => `/static/images/fields/${formatField(d.field)}.png`);

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
        <img class="field" src="/static/images/fields/${formatField(
          d.field
        )}.png" />
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

import { formatField, formatYear } from "./utils.js";

// Card geometry. The image area (not the outer container) is locked to 3:2
// so the source images render uncropped. Image width spans the same band as
// the title / inventor / location text (cardWidth − 2·marginIn = 208), and
// cardHeight is derived so the bottom margin mirrors the title bar.
export const cardWidth = 240;
// Multiplier on top of the inverse-zoom counter-scale: the rendered card
// ends up at cardWidth * cardScreenScale CSS pixels on screen at any zoom.
// Layout (column widths, jitter, collision spacing) still uses cardWidth, so
// changing the screen size doesn't reshape the world.
export const cardScreenScale = 1.2;

const MARGIN = 18;
const MARGIN_IN = MARGIN - 2;                      // 16
const HEADER_EXTRA = 4;
const TITLE_BAR_H = MARGIN_IN + HEADER_EXTRA;      // 20
const IMG_W = cardWidth - MARGIN_IN * 2;           // 208 — matches text band
const IMG_H = IMG_W * 2 / 3;                       // 138.667 — locks 3:2
export const cardHeight = IMG_H + TITLE_BAR_H * 2; // 178.667

// Body + footer panel height (description + inventor row + footer). Matches
// the image height so the unfolded card is visually balanced top-to-bottom.
const BODY_FOOTER_H = IMG_H;
export const fullCardHeight = cardHeight + BODY_FOOTER_H;

// Single source of truth for every coordinate inside a card. Anything
// re-rendering cards outside of this module (e.g. preview.html's static SVG)
// should pull values from here so geometry tweaks here don't drift.
const FOOTER_H = 20;
const IMG_BOTTOM_Y = TITLE_BAR_H + IMG_H;
export const cardGeom = Object.freeze({
  width: cardWidth,
  imgHeight: cardHeight,        // outer height in folded / IMG state
  fullHeight: fullCardHeight,   // outer height in unfolded / FULL state
  margin: MARGIN,
  marginIn: MARGIN_IN,
  titleBarH: TITLE_BAR_H,
  imgW: IMG_W,
  imgH: IMG_H,
  imgBottomY: IMG_BOTTOM_Y,
  inventorY: IMG_BOTTOM_Y + 11,
  bodyY: IMG_BOTTOM_Y + 16,
  footerH: FOOTER_H,
});

const BUG_BODY = `**Describe the issue**

Is the description incorrect? Is the image missing? Are the dependencies weird? Are the dates or inventors wrong?`;

export function renderMTGCard(card) {
  const outerG = card
    .append("g")
    .attr("class", (d) => "card field-" + formatField(d.field));

  // Counter-scale wrapper: card.css sets `transform: scale(calc(1 / var(--zoom, 1)))`
  // so cards in the universe view (where --zoom is set on documentElement)
  // render at constant screen size. In contexts without --zoom (main.js index)
  // the fallback scale=1 makes this a no-op.
  const scaler = outerG.append("g").attr("class", "card-scaler");
  const g = scaler.append("g").attr("class", "card-inner");
  g.attr("transform", `translate(${-cardWidth / 2}, ${-cardHeight / 2})`);

  const margin = MARGIN;
  const marginIn = MARGIN_IN;
  const titleBarH = TITLE_BAR_H;

  // Outer container (background + border)
  g.append("rect")
    .attr("width", cardWidth)
    .attr("height", cardHeight)
    .attr("fill", "white")
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .attr("rx", 4)
    .classed("container", true);

  const imageX = marginIn;
  const imageY = titleBarH;
  const imageW = IMG_W;
  const imageH = IMG_H;

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

// Geometry constants reused by the fold animation in universe.js so it can
// slide the body+footer panel out from behind the image. The image-card
// portion of the full card uses *exactly* the renderMTGCard geometry so the
// IMG↔FULL swap is pixel-perfect — no twitch when the renderer changes.
// Bottom edge of the image in card-inner coords. The panel emerges from
// directly below this line, so the inventor row sits 11px below the image
// (matching the pre-fold layout) instead of 31+ px below the IMG card's
// bottom-margin hinge.
export const fullImageBottomY = TITLE_BAR_H + IMG_H;
// Container hinge: bottom edge of the visible card while folded — matches
// cardHeight so the folded full card overlays the IMG card pixel-perfectly.
export const fullHingeY = cardHeight;
const FULL_CONTAINER_GROWTH = fullCardHeight - fullHingeY;
const FULL_PANEL_SLIDE = fullCardHeight - fullImageBottomY;

// SVG transform applied to the fold-panel group: a pure vertical translate.
// At sy=0 the panel is shifted up far enough that every panel-y is above the
// image-bottom clip line (hidden behind the image). At sy=1 the panel is at
// its natural position (visible below the image). The panel's *opacity* is
// what gates visibility during the animation — the slide just happens with
// the content invisible, so the user never sees content moving across the
// card.
export function foldPanelTransform(sy) {
  return `translate(0, ${-(1 - sy) * FULL_PANEL_SLIDE})`;
}

// Container rect height for a given fold state. At sy=0 the bottom of the
// container coincides with the hinge so it visually matches an image-only
// card; at sy=1 it spans the whole card.
export function foldContainerHeight(sy) {
  return fullHingeY + FULL_CONTAINER_GROWTH * sy;
}

// Clip rect height for a given fold state. The clip starts at the image's
// bottom edge and grows down to the container bottom — that's wider than
// the container-vs-hinge delta because the inventor row sits in the strip
// between fullImageBottomY and fullHingeY.
export function foldClipHeight(sy) {
  return foldContainerHeight(sy) - fullImageBottomY;
}

// card-inner translate.y for a given fold state — shifts content downward
// while the panel is collapsed so the visible image stays centered on the
// card's nominal y-position throughout the fold (no abrupt jump between the
// folded and unfolded states).
export function foldInnerY(sy) {
  return -fullCardHeight / 2 + (fullCardHeight - foldContainerHeight(sy)) / 2;
}

// Counter for unique clipPath IDs — each card needs its own clip rect so
// universe.js can animate the rect's height alongside the container.
let cardSerial = 0;

// Full portrait MTG card: title at top, image, body description, inventor row,
// location + year footer. Used for hover-expanded cards in gHoverCards so the
// reader sees the description even when the in-graph card is just a thumbnail.
// `initialFold` (0..1) sets the starting fold state of the body+footer panel
// — universe.js renders cards with initialFold=0 on IMG→FULL tier transition
// and tweens the panel open.
export function renderFullCard(card, initialFold = 1) {
  const W = cardWidth;
  const H = fullCardHeight;

  const outerG = card
    .append("g")
    .attr("class", (d) => "card field-" + formatField(d.field));

  const scaler = outerG.append("g").attr("class", "card-scaler");
  const g = scaler.append("g").attr("class", "card-inner");
  g.attr("transform", `translate(${-W / 2}, ${foldInnerY(initialFold)})`);

  const margin = MARGIN;
  const marginIn = MARGIN_IN;
  const titleBarH = TITLE_BAR_H;
  // Image dimensions match renderMTGCard exactly so the folded full card
  // overlays a 1:1 copy of the image card it replaces. Locked to 3:2.
  const imageX = marginIn;
  const imageY = titleBarH;
  const imageW = IMG_W;
  const imageH = IMG_H;
  const imageBottomY = fullImageBottomY;
  const footerHeight = 20;
  // Inventor row sits 11px below the image (gap matches the pre-fold layout);
  // the description box sits a further 5px below the inventor baseline.
  const inventorY = imageBottomY + 11;
  const bodyY = inventorY + 5;

  // Container background — its height animates from hingeY to H so the
  // bottom edge slides downward as the body panel emerges.
  g.append("rect")
    .attr("class", "container")
    .attr("width", W).attr("height", foldContainerHeight(initialFold))
    .attr("fill", "white").attr("stroke", "black").attr("stroke-width", 2).attr("rx", 4);

  // Per-card clipPath that limits the body panel to below the image. The
  // clip top sits at the image bottom (not the hinge) so the inventor row
  // can ride in the narrow strip between image-bottom and the IMG-card
  // bottom margin. Animating height in lockstep with the container makes
  // the panel "emerge" through this line as the card grows downward.
  const clipId = `fold-clip-${++cardSerial}`;
  g.append("clipPath")
    .attr("id", clipId)
    .attr("clipPathUnits", "userSpaceOnUse")
    .append("rect")
      .attr("class", "fold-clip-rect")
      .attr("x", 0).attr("y", imageBottomY)
      .attr("width", W)
      .attr("height", foldClipHeight(initialFold));

  // Body + footer ride in a single group, drawn BEFORE the image so the
  // image covers any sliver that pokes into the image area while the panel
  // slides. Translates upward by the panel slide distance when folded so
  // every panel-y lands above the clip line (= invisible). The whole panel
  // also has its opacity gated to the fold edges — without that the inventor
  // and footer are visible mid-slide and read as text moving across the card.
  const fold = g.append("g")
    .attr("class", "fold-panel")
    .attr("clip-path", `url(#${clipId})`)
    .attr("transform", foldPanelTransform(initialFold))
    .style("opacity", initialFold);

  fold.append("rect")
    .attr("class", "body-rect")
    .attr("x", marginIn).attr("y", bodyY)
    .attr("width", W - 2 * marginIn)
    .attr("height", H - bodyY - footerHeight)
    .attr("fill", "transparent").attr("stroke", "black");

  const marginFo = margin + 2;
  fold.append("foreignObject")
    .attr("class", "body-text")
    .attr("x", marginFo).attr("y", bodyY + 2)
    .attr("width", W - 2 * marginFo)
    .attr("height", H - bodyY - footerHeight - 4)
    .attr("font-size", 9)
    .append("xhtml:div")
    .html((d) => `<div style="padding: 1px; height: 100%;">${d.description}</div>`);

  fold.append("text")
    .attr("class", "middle-text")
    .attr("x", marginIn).attr("y", inventorY)
    .attr("font-size", 10).text((d) => d.inventor);

  fold.append("text")
    .attr("class", "bottom-left")
    .attr("x", marginIn).attr("y", H - footerHeight + 14).attr("font-size", 12)
    .text((d) => d.location);

  fold.append("text")
    .attr("class", "bottom-right")
    .attr("x", W - marginIn).attr("y", H - footerHeight + 14)
    .attr("font-size", 12).attr("text-anchor", "end")
    .text((d) => formatYear(d.year));

  // Image and chrome are drawn AFTER the fold panel so they sit on top —
  // any pixel of the panel that hasn't fully cleared the hinge stays hidden
  // behind the image, completing the "slides out from behind" illusion.
  // Geometry is identical to renderMTGCard so the folded full card is a
  // pixel-perfect overlay of the IMG card it replaces.
  g.append("rect")
    .attr("class", "image-rect")
    .attr("x", imageX).attr("y", imageY)
    .attr("width", imageW).attr("height", imageH)
    .attr("fill", "white").attr("stroke", "black");

  g.append("image")
    .attr("x", imageX).attr("y", imageY)
    .attr("width", imageW).attr("height", imageH)
    .attr("href", (d) => `/static/images/entries/${d.id}.jpg`)
    .attr("preserveAspectRatio", "xMidYMid slice");

  g.append("text")
    .attr("x", marginIn).attr("y", 13).attr("font-size", 13)
    .classed("title", true).text((d) => d.title);

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

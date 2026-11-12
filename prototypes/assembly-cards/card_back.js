
// ---- Prototype: card backs -------------------------------------------------
// The back of a card lists its assembly (each bullet links to the card that
// fills that slot) and the natural phenomena it uses (each links to that
// phenomenon's card), then where the card is used as a part, and which inventions use it as a phenomenon.
const escBack = (s) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

function backHTML(d, L) {
  const link = (id) => {
    const n = L.byId[id];
    return n ? `<a data-pin="${escBack(id)}" href="#">${escBack(n.title)}</a>` : escBack(id);
  };
  let h = "";
  const jobLink = (job, text, cls = "") =>
    `<a class="back-joblink ${cls}" data-job="${escBack(job)}" href="#" title="Job: ${escBack(job)}">${escBack(text)}</a>`;
  if (d.job) h += `<div class="back-job">Job: ${jobLink(d.job, d.job)}</div>`;
  if (d.slots) {
    h += `<div class="back-h">${d.listKind === "recipe" ? "Ingredients" : "Assembly"}</div>`;
    if (d.slots.length) {
      h += "<ul>";
      for (const s of d.slots) {
        const slot = `${jobLink(s.job, s.label, "back-slot")} `;
        const why = s.note ? ` <span class="back-why">${escBack(s.note)}</span>` : "";
        if (s.fill) {
          const n = L.byId[s.fill];
          const later = n && n.year > d.year ? ` <span class="back-note">added later</span>` : "";
          h += `<li>${slot}${link(s.fill)}${why}${later}</li>`;
        } else {
          h += `<li class="back-gap">${slot}${escBack(s.gap)}${why} <span class="back-note">no card yet</span></li>`;
        }
      }
      h += "</ul>";
    } else {
      h += `<div class="back-none">A basic part: nothing in the deck goes inside it.</div>`;
    }
  }
  if (d.phen) {
    h += `<div class="back-h">Natural phenomena</div>`;
    if (d.phen.length) {
      h += "<ul>";
      for (const p of d.phen) {
        if (p.id) {
          const n = L.byId[p.id];
          const later = n && n.year > d.year ? ` <span class="back-note">explained later</span>` : "";
          h += `<li>${link(p.id)}${later}</li>`;
        } else {
          h += `<li class="back-gap">${escBack(p.gap)} <span class="back-note">not in the deck</span></li>`;
        }
      }
      h += "</ul>";
    } else {
      h += `<div class="back-none">None listed.</div>`;
    }
  }
  // Where this card is used as a subassembly (a part in another card's assembly).
  const parts = L.partOf[d.id] || [];
  if (parts.length) {
    h += `<div class="back-h">Part of</div><ul>`;
    for (const u of parts) {
      const n = L.byId[u.id];
      const later = n && d.year > n.year ? ` <span class="back-note">added later</span>` : "";
      h += `<li>${link(u.id)} <span class="back-slot">as ${escBack(u.as)}</span>${later}</li>`;
    }
    h += "</ul>";
  }
  // Inventions that list this card among their natural phenomena.
  const users = L.capturedBy[d.id] || [];
  if (users.length) {
    h += `<div class="back-h">Used by</div><ul>${users.map((id) => `<li>${link(id)}</li>`).join("")}</ul>`;
  }
  if (!d.slots && !d.phen && !parts.length && !users.length) {
    h += `<div class="back-none">Nothing in this pilot uses it yet.</div>`;
  }
  return h;
}

export function addBackFace(sel, L) {
  sel.each(function (d) {
    const outer = d3.select(this);
    if (!outer.select("g.card-flip").empty()) return;
    const scaler = outer.select("g.card-scaler");
    const inner = outer.select("g.card-inner");
    // Wrap card-inner in a group we can squeeze horizontally to fake a flip.
    const flip = scaler.append("g").attr("class", "card-flip");
    flip.node().appendChild(inner.node());

    const W = cardWidth;
    const H = fullCardHeight;
    const back = inner.append("g").attr("class", "card-back").style("display", "none");
    back.append("rect")
      .attr("class", "container")
      .attr("width", W).attr("height", H)
      .attr("fill", "white").attr("stroke", "black").attr("stroke-width", 2).attr("rx", 4);
    back.append("text")
      .attr("x", MARGIN_IN).attr("y", 13).attr("font-size", 13)
      .classed("title", true).text(d.title);
    back.append("rect")
      .attr("class", "body-rect")
      .attr("x", MARGIN_IN).attr("y", TITLE_BAR_H)
      .attr("width", W - 2 * MARGIN_IN).attr("height", H - TITLE_BAR_H - FOOTER_H)
      .attr("fill", "transparent").attr("stroke", "black");
    const body = back.append("foreignObject")
      .attr("class", "back-text")
      .attr("x", MARGIN_IN + 2).attr("y", TITLE_BAR_H + 2)
      .attr("width", W - 2 * MARGIN_IN - 4).attr("height", H - TITLE_BAR_H - FOOTER_H - 4)
      .append("xhtml:div")
      .attr("class", "back-body")
      .html(backHTML(d, L));
    body.on("click", (event) => {
      const jobA = event.target.closest("a[data-job]");
      if (jobA) {
        event.preventDefault();
        event.stopPropagation();
        L.onJob(jobA.getAttribute("data-job"));
        return;
      }
      const a = event.target.closest("a[data-pin]");
      if (!a) return;
      event.preventDefault();
      event.stopPropagation();
      L.onLink(a.getAttribute("data-pin"));
    });
    back.append("text")
      .attr("class", "bottom-left")
      .attr("x", MARGIN_IN).attr("y", H - FOOTER_H + 14).attr("font-size", 10)
      .text("tap to flip");
    back.append("text")
      .attr("class", "bottom-right")
      .attr("x", W - MARGIN_IN).attr("y", H - FOOTER_H + 14)
      .attr("font-size", 12).attr("text-anchor", "end")
      .text(formatYear(d.year));
  });
}

const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function flipCard(cardSel, toBack, animate = true) {
  const flip = cardSel.select("g.card-flip");
  if (flip.empty()) return;
  const apply = () => {
    cardSel.select("g.card-back").style("display", toBack ? null : "none");
    cardSel.classed("flipped", toBack);
    document.body.classList.toggle("card-flipped", toBack);
  };
  if (!animate || reduceMotion()) {
    apply();
    return;
  }
  flip.interrupt()
    .transition().duration(130).ease(d3.easeCubicIn).attr("transform", "scale(0.02, 1)")
    .on("end", () => {
      apply();
      flip.transition().duration(170).ease(d3.easeCubicOut).attr("transform", "scale(1, 1)");
    });
}
// ---------------------------------------------------------------------------

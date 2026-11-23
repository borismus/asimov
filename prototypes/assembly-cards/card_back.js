
// ---- Prototype: card backs -------------------------------------------------
// The back of a card lists its parts (each bullet is a job and the card that does
// it) and the effects it works by (each an effect and the card that describes it),
// then the assemblies it is a part of, and which inventions harness its effects.
const escBack = (s) => String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

function backHTML(d, L) {
  const link = (id) => {
    const n = L.byId[id];
    return n ? `<a data-pin="${escBack(id)}" href="#">${escBack(n.title)}</a>` : escBack(id);
  };
  // A small picture of a part or phenomenon card, beside its name.
  const thumb = (id) => L.byId[id]
    ? `<img class="back-thumb" src="/static/images/entries-v2/${encodeURIComponent(id)}.jpg" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`
    : `<span class="back-thumb back-thumb-none"></span>`;
  let h = "";
  const jobLink = (job, text, cls = "") =>
    `<a class="back-joblink ${cls}" data-job="${escBack(job)}" href="#" title="Job: ${escBack(job)}">${escBack(text)}</a>`;
  // An effect is tappable like a job: it lights up every card that works by it.
  const fxLink = (fx) =>
    `<a class="back-effect back-slot back-joblink" data-effect="${escBack(fx)}" href="#" title="Effect: ${escBack(fx)}">${escBack(fx)}</a>`;
  const type = d.field ? `<span class="back-type">${escBack(d.field.toLowerCase())}</span>` : "";
  if (d.job) h += `<div class="back-job">${type ? type + " · " : ""}Job: ${jobLink(d.job, d.job)}</div>`;
  else if (type) h += `<div class="back-job">${type}</div>`;
  // Its parts: one list, the assembly. (How a thing is produced isn't listed.)
  if (d.slots) {
    if (!d.slots.length) {
      h += `<div class="back-h">Parts</div><div class="back-none">A basic part: none of its parts are in the deck.</div>`;
    }
    // One row per part, in a column of pictures at the left: [picture] Card: job.
    const row = (s) => {
      const j = jobLink(s.job, s.job, "back-slot");
      const part = s.part ? ` <span class="back-part">(${escBack(s.part)})</span>` : "";
      const why = s.note ? ` <span class="back-why">${escBack(s.note)}</span>` : "";
      // Newer cards that took over this job: "Carriage springs, later Rubber tire".
      const swaps = (s.later || []).filter((id) => L.byId[id]);
      const then = swaps.length ? `<span class="back-later">, later ${swaps.map(link).join(" and ")}</span>` : "";
      if (!s.fill) {
        return `<li class="has-thumb">${thumb(null)}<span><span class="back-gap">${escBack(s.gap)}</span>: ${j}${part}${why} <span class="back-note">its key part, no card</span>${then}</span></li>`;
      }
      const n = L.byId[s.fill];
      const later = n && n.year > d.year ? ` <span class="back-note">added later</span>` : "";
      return `<li class="has-thumb">${thumb(s.fill)}<span>${link(s.fill)}: ${j}${part}${why}${later}${then}</span></li>`;
    };
    if (d.slots.length) h += `<div class="back-h">Parts</div><ul class="back-thumbs">${d.slots.map(row).join("")}</ul>`;
  }
  // The effects it works by: each bullet is an effect and the card that describes it.
  if (d.phen && d.phen.length) {
    h += `<div class="back-h">Works by</div><ul class="back-thumbs">`;
    for (const p of d.phen) {
      const fx = fxLink(p.effect);
      if (p.id) {
        const n = L.byId[p.id];
        const later = n && n.year > d.year ? ` <span class="back-note">explained later</span>` : "";
        h += `<li class="has-thumb">${thumb(p.id)}<span>${link(p.id)}: ${fx}${later}</span></li>`;
      } else {
        h += `<li class="has-thumb">${thumb(null)}<span><span class="back-gap">${escBack(p.gap)}</span>: ${fx} <span class="back-note">no card yet</span></span></li>`;
      }
    }
    h += "</ul>";
  }
  // The assemblies this card is a part of.
  const parts = L.partOf[d.id] || [];
  if (parts.length) {
    // One bullet per job it does elsewhere, listing the cards it does it in.
    const byJob = new Map();
    for (const u of parts) {
      const key = u.job;
      (byJob.get(key) || byJob.set(key, []).get(key)).push(u);
    }
    h += `<div class="back-h">Part of</div><ul>`;
    for (const us of byJob.values()) {
      const { job } = us[0];
      const cards = us.map((u) => {
        const n = L.byId[u.id];
        const later = n && d.year > n.year ? ` <span class="back-note">added later</span>` : "";
        return `${link(u.id)}${later}`;
      }).join(", ");
      h += `<li>${jobLink(job, job, "back-slot")}: ${cards}</li>`;
    }
    h += "</ul>";
  }
  // Inventions that work by an effect this card describes, one bullet per effect.
  const users = L.capturedBy[d.id] || [];
  if (users.length) {
    const byFx = new Map();
    for (const u of users) (byFx.get(u.effect) || byFx.set(u.effect, []).get(u.effect)).push(u.id);
    h += `<div class="back-h">Harnessed by</div><ul>`;
    for (const [fx, ids] of byFx) {
      const cards = ids.map((id) => {
        const n = L.byId[id];
        const early = n && n.year < d.year ? ` <span class="back-note">before it was explained</span>` : "";
        return `${link(id)}${early}`;
      }).join(", ");
      h += `<li>${fxLink(fx)}: ${cards}</li>`;
    }
    h += "</ul>";
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
      const jobA = event.target.closest("a[data-job]:not([data-effect])");
      if (jobA) {
        event.preventDefault();
        event.stopPropagation();
        L.onJob(jobA.getAttribute("data-job"));
        return;
      }
      const fxA = event.target.closest("a[data-effect]");
      if (fxA) {
        event.preventDefault();
        event.stopPropagation();
        L.onEffect(fxA.getAttribute("data-effect"));
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

// Shrink the back's text until it fits the card (down to a floor; past that it scrolls).
function fitBack(cardSel) {
  cardSel.selectAll(".back-body").each(function () {
    const el = this;
    if (el.dataset.fitted) return;
    let size = 9;
    el.style.fontSize = size + "px";
    while (el.scrollHeight > el.clientHeight + 1 && size > 6.5) {
      size -= 0.5;
      el.style.fontSize = size + "px";
    }
    el.dataset.fitted = "1";
  });
}

const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function flipCard(cardSel, toBack, animate = true) {
  const flip = cardSel.select("g.card-flip");
  if (flip.empty()) return;
  const apply = () => {
    cardSel.select("g.card-back").style("display", toBack ? null : "none");
    cardSel.classed("flipped", toBack);
    if (toBack) fitBack(cardSel);
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

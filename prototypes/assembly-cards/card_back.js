
// ---- Prototype: card backs -------------------------------------------------
// The back of a card lists its slots by kind (inside / runs on / made with;
// each bullet is a job and the card that does it) and the natural phenomena it
// uses, then where the card fills a slot elsewhere, and which inventions harness it.
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
  // Slots, grouped by kind: what's physically inside it, what it uses up
  // while it works, and what's used to make it but isn't in the result.
  const KINDS = [["inside", "Inside"], ["runs on", "Runs on"], ["made with", "Made with"]];
  if (d.slots) {
    if (!d.slots.length) {
      h += `<div class="back-h">Inside</div><div class="back-none">A basic part: nothing in the deck goes inside it.</div>`;
    }
    const filler = (s) => {
      const part = s.part ? ` <span class="back-part">(${escBack(s.part)})</span>` : "";
      const why = s.note ? ` <span class="back-why">${escBack(s.note)}</span>` : "";
      // Newer cards that took over this job: "Carriage springs, later Rubber tire".
      const swaps = (s.later || []).filter((id) => L.byId[id]);
      const then = swaps.length ? `<span class="back-later">, later ${swaps.map(link).join(" and ")}</span>` : "";
      if (!s.fill) return `<span class="back-gap">${escBack(s.gap)}${part}${why} <span class="back-note">its key part, no card</span></span>${then}`;
      const n = L.byId[s.fill];
      const later = n && n.year > d.year ? ` <span class="back-note">added later</span>` : "";
      return `${link(s.fill)}${part}${why}${later}${then}`;
    };
    for (const [kind, heading] of KINDS) {
      const group = d.slots.filter((s) => s.kind === kind);
      if (!group.length) continue;
      // One bullet per job; a job done by several cards lists them underneath.
      const byJob = new Map();
      for (const s of group) (byJob.get(s.job) || byJob.set(s.job, []).get(s.job)).push(s);
      h += `<div class="back-h">${heading}</div><ul>`;
      for (const [job, ss] of byJob) {
        const j = jobLink(job, job, "back-slot");
        h += ss.length === 1
          ? `<li>${j}: ${filler(ss[0])}</li>`
          : `<li>${j}:<ul class="back-sub">${ss.map((x) => `<li>${filler(x)}</li>`).join("")}</ul></li>`;
      }
      h += "</ul>";
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
  // Where this card fills a slot in another card: inside it, fuel for it, or used to make it.
  const parts = L.partOf[d.id] || [];
  if (parts.length) {
    // One bullet per job it does elsewhere, listing the cards it does it in.
    const byJob = new Map();
    for (const u of parts) {
      const key = `${u.job}|${u.kind}`;
      (byJob.get(key) || byJob.set(key, []).get(key)).push(u);
    }
    h += `<div class="back-h">Used in</div><ul>`;
    for (const us of byJob.values()) {
      const { job, kind } = us[0];
      const how = kind === "inside" ? "" : ` <span class="back-part">(${escBack(kind)})</span>`;
      const cards = us.map((u) => {
        const n = L.byId[u.id];
        const later = n && d.year > n.year ? ` <span class="back-note">added later</span>` : "";
        return `${link(u.id)}${later}`;
      }).join(", ");
      h += `<li>${jobLink(job, job, "back-slot")}${how}: ${cards}</li>`;
    }
    h += "</ul>";
  }
  // Inventions that list this card among their natural phenomena.
  const users = L.capturedBy[d.id] || [];
  if (users.length) {
    h += `<div class="back-h">Harnessed by</div><ul>${users.map((id) => `<li>${link(id)}</li>`).join("")}</ul>`;
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

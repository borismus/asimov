// Path-canonical addressing shared between universe.js and mobile.js.
// /<id>/ pins (or jumps to) that invention; /story/<slug>/ enters that story;
// "/" is the no-pin overview. Hash carries view-specific state (zoom/sort/filter)
// and is left untouched.

// Discriminated parse — null for /, {kind:"pin",id} for /<id>/,
// {kind:"story",slug} for /story/<slug>/.
export function parsePath(pathname) {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0] === "story" && parts[1]) return { kind: "story", slug: parts[1] };
  if (parts.length === 1) return { kind: "pin", id: parts[0] };
  return null;
}

// Compat shim — mobile.js still calls parsePathPin and only cares about pins.
export function parsePathPin(pathname) {
  const r = parsePath(pathname);
  return r && r.kind === "pin" ? r.id : null;
}

export function isLocalhost() {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

// Resolve the current navigation target from window.location. In production
// this reads the pathname; on localhost the path stays at /universe.html
// (a plain dev server can't serve /<id>/) and nav lives in the hash as
// `pin=<id>` or `story=<slug>`. Returns the same shape parsePath does.
export function parseLocation() {
  if (isLocalhost()) {
    return parseNavHash(window.location.hash);
  }
  return parsePath(window.location.pathname);
}

// Extract just the nav params (pin / story) from a hash string. Story wins
// over pin if both are present (a story is the more-encompassing state, and
// the production scheme treats them as mutually exclusive). View-state
// params x/y/k are ignored here — parseViewHash in universe.js handles those.
function parseNavHash(hash) {
  if (!hash || hash.length <= 1) return null;
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const story = p.get("story");
  if (story) return { kind: "story", slug: story };
  const pin = p.get("pin");
  if (pin) return { kind: "pin", id: pin };
  return null;
}

// pushState only when the URL would actually change. Same call from popstate
// handlers becomes a no-op (the URL already matches), so back/forward don't
// stack extra history entries.
//
// On localhost the path stays put; we translate the requested pathname into
// hash params and pushState with the new hash. View-state params (x/y/k)
// already in the hash are preserved.
export function pushPath(pathname) {
  if (isLocalhost()) {
    const nav = parsePath(pathname);  // null | {kind, id|slug}
    const p = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    // Mutually exclusive: clear both before setting at most one.
    p.delete("pin");
    p.delete("story");
    if (nav && nav.kind === "pin") p.set("pin", nav.id);
    if (nav && nav.kind === "story") p.set("story", nav.slug);
    const hash = p.toString();
    const next = window.location.pathname + (hash ? `#${hash}` : "");
    if (window.location.pathname + window.location.hash === next) return;
    try { history.pushState(null, "", next); } catch (e) {}
    return;
  }
  const target = pathname + (window.location.hash || "");
  if (window.location.pathname + window.location.hash === target) return;
  try {
    history.pushState(null, "", target);
  } catch (e) {}
}

// Path-canonical addressing shared between universe.js and mobile.js.
// /<id>/ pins (or jumps to) that invention; "/" is the no-pin overview.
// Hash carries view-specific state (zoom/sort/filter) and is left untouched.

export function parsePathPin(pathname) {
  const id = pathname.replace(/^\/+|\/+$/g, "");
  return id || null;
}

// Skip URL mutations during local dev so reloading the page doesn't land on
// a path the dev server can't serve and the URL bar stays stable.
export function isLocalhost() {
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

// pushState only when the URL would actually change. Same call from popstate
// handlers becomes a no-op (the URL already matches), so back/forward don't
// stack extra history entries.
export function pushPath(pathname) {
  if (isLocalhost()) return;
  const target = pathname + (window.location.hash || "");
  if (window.location.pathname + window.location.hash === target) return;
  try {
    history.pushState(null, "", target);
  } catch (e) {}
}

// Path-canonical addressing shared between universe.js and mobile.js.
// /<id>/ pins (or jumps to) that invention; "/" is the no-pin overview.
// Hash carries view-specific state (zoom/sort/filter) and is left untouched.

export function parsePathPin(pathname) {
  const id = pathname.replace(/^\/+|\/+$/g, "");
  return id || null;
}

// pushState only when the URL would actually change. Same call from popstate
// handlers becomes a no-op (the URL already matches), so back/forward don't
// stack extra history entries.
export function pushPath(pathname) {
  const target = pathname + (window.location.hash || "");
  if (window.location.pathname + window.location.hash === target) return;
  try {
    history.pushState(null, "", target);
  } catch (e) {}
}

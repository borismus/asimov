// Generic confirm popover. One title line + a vertical stack of action
// buttons. Esc and backdrop-click run the onDismiss callback (used to fall
// back to the "would-have-happened-without-asking" default — e.g. pin the
// card a click was about to pin anyway).
//
// Wire the popover DOM once via initConfirm(elementId). After that, any
// module can call showConfirm({...}) without touching the DOM itself.
//
// Expected HTML structure (id is whatever you pass to initConfirm):
//   <div id="…" hidden>
//     <div class="confirm-backdrop"></div>
//     <div class="confirm-card">
//       <p class="confirm-title"></p>
//       <div class="confirm-actions"></div>
//     </div>
//   </div>

let elId = null;
let openState = false;
let onDismissCb = null;
let keydownHandler = null;

export function initConfirm(elementId) {
  elId = elementId;
  const root = document.getElementById(elId);
  if (!root) return;
  const backdrop = root.querySelector(".confirm-backdrop");
  const card = root.querySelector(".confirm-card");
  if (backdrop) backdrop.addEventListener("click", () => hideInternal(true));
  // Card click is a no-op so the backdrop's "click to dismiss" doesn't fire
  // when the user clicks inside the popover (e.g. on its title).
  if (card) card.addEventListener("click", (e) => e.stopPropagation());
}

export function isConfirmOpen() {
  return openState;
}

// actions: array of { label, primary?: bool, onClick }
// onDismiss: called when Esc or backdrop closes the popover (not when an
// action button closes it).
export function showConfirm({ title, actions, onDismiss }) {
  if (!elId) return;
  const root = document.getElementById(elId);
  if (!root) return;
  // Replace, don't cancel — closing the prior popover should NOT run its
  // dismiss callback (we're handing off, not bailing out).
  if (openState) hideInternal(false);

  const titleEl = root.querySelector(".confirm-title");
  const actionsEl = root.querySelector(".confirm-actions");
  if (!titleEl || !actionsEl) return;

  titleEl.textContent = title;
  actionsEl.innerHTML = "";
  for (const a of actions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "confirm-btn" + (a.primary ? " primary" : "");
    btn.textContent = a.label;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      hideInternal(false);
      if (typeof a.onClick === "function") a.onClick();
    });
    actionsEl.appendChild(btn);
  }

  onDismissCb = typeof onDismiss === "function" ? onDismiss : null;
  openState = true;
  root.hidden = false;

  // Capture-phase Esc handler so it fires before any other window-level
  // keydown listener (e.g. the story system's own Esc-to-exit). Callers
  // that want their own Esc behavior should check isConfirmOpen() and bail.
  keydownHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      hideInternal(true);
    }
  };
  window.addEventListener("keydown", keydownHandler, true);
}

export function hideConfirm() {
  hideInternal(false);
}

function hideInternal(runDismiss) {
  if (!openState) return;
  const root = elId && document.getElementById(elId);
  if (root) root.hidden = true;
  if (keydownHandler) {
    window.removeEventListener("keydown", keydownHandler, true);
    keydownHandler = null;
  }
  const cb = onDismissCb;
  onDismissCb = null;
  openState = false;
  if (runDismiss && typeof cb === "function") cb();
}

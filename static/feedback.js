// Feedback panel: one-tap reactions + optional note, Formspree + GA.
// Timed bottom nudge (once per browser) and header "Say hi" popover.

import { parseLocation } from "./routing.js";

const FORMSPREE_URL = "https://formspree.io/f/mbdbdlby";
const FEEDBACK_NUDGE_DELAY_MS = 3 * 60 * 1000;
const FEEDBACK_LS_KEY = "invention.feedback.promptSeen";

const COPY_NUDGE = {
  lede: "This is a passion project",
  body:
    "I built this because I love the history of technology — and I'd love to know if any of it lands for you. A one-tap reaction is plenty; a note is gold.",
  footer: "— Boris (I read everything)",
};

const COPY_POPOVER = {
  lede: "Hey — thanks for stopping by",
  body:
    "Invention Cards is a labor of love. I'm passionate about the history of science and technology, and thought it would be fun to visualize. I promise I'll read what you write — a one-tap reaction is plenty, and any note is gold.",
  footer: "— Boris",
};

const COPY_STEP2 = {
  title: "Want to say more?",
  placeholder: "Totally optional — even a few words help.",
  emailPlaceholder: "Email (optional, if you'd like a reply)",
  skip: "No thanks",
  send: "Send",
};

const CHIPS = [
  { label: "Enjoying this", reaction: "enjoying" },
  { label: "Spotted something off", reaction: "issue" },
  { label: "Have an idea", reaction: "idea" },
];

const TOAST = {
  enjoying: "Thanks — glad you're here.",
  default: "Got it — thank you.",
};

let panelEl = null;
let backdropEl = null;
let toastEl = null;
let btnEl = null;
let mode = null;
let source = null;
let pendingReaction = null;
let nudgePending = false;
let engagementStarted = false;
/** @type {null | (() => Record<string, string>)} */
let contextProvider = null;

/** Universe/mobile register live state (pinned card, story step, titles). */
export function setFeedbackContext(provider) {
  contextProvider = provider;
}

function gatherContext() {
  const extra = contextProvider ? contextProvider() : {};
  const loc = parseLocation();
  let mode = "browse";
  let cardId = extra.card_id || "";
  let cardTitle = extra.card_title || "";
  let storySlug = extra.story_slug || "";
  let storyTitle = extra.story_title || "";
  let storyStep = extra.story_step != null ? String(extra.story_step) : "";

  if (loc?.kind === "story") {
    mode = "story";
    storySlug = storySlug || loc.slug;
  } else if (loc?.kind === "pin") {
    mode = "pin";
    cardId = cardId || loc.id;
  }

  if (mode === "story" && !storyStep) {
    const step = new URLSearchParams(location.hash.replace(/^#/, "")).get("step");
    if (step) storyStep = step;
  }

  // Pinned card while browsing the graph (URL may still be /).
  if (cardId && mode === "browse") mode = "pin";

  return { mode, cardId, cardTitle, storySlug, storyTitle, storyStep };
}

function gtagEvent(name, params) {
  if (typeof gtag === "function") gtag("event", name, params || {});
}

function isSearchOpen() {
  return (
    document.body.classList.contains("searching") ||
    document.body.classList.contains("mobile-searching")
  );
}

function isPromptSeen() {
  try {
    return localStorage.getItem(FEEDBACK_LS_KEY) === "1";
  } catch {
    return true;
  }
}

function markPromptSeen() {
  try {
    localStorage.setItem(FEEDBACK_LS_KEY, "1");
  } catch {
    /* private mode */
  }
}

function viewportLabel() {
  return matchMedia("(max-width: 720px)").matches ? "mobile" : "desktop";
}

function isPanelOpen() {
  return panelEl && !panelEl.hidden;
}

async function postFeedback({ reaction, message = "", email = "" }) {
  const fd = new FormData();
  fd.append("reaction", reaction);
  if (message) fd.append("message", message);
  if (email) fd.append("email", email);
  const ctx = gatherContext();
  fd.append("page", location.pathname);
  fd.append("url", location.href);
  fd.append("viewport", viewportLabel());
  fd.append("source", source || "unknown");
  fd.append("mode", ctx.mode);
  if (ctx.cardId) fd.append("card_id", ctx.cardId);
  if (ctx.cardTitle) fd.append("card_title", ctx.cardTitle);
  if (ctx.storySlug) fd.append("story_slug", ctx.storySlug);
  if (ctx.storyTitle) fd.append("story_title", ctx.storyTitle);
  if (ctx.storyStep) fd.append("story_step", ctx.storyStep);
  fd.append("_gotcha", "");
  const res = await fetch(FORMSPREE_URL, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: fd,
  });
  if (!res.ok) throw new Error("Formspree error");
}

function applyIntroCopy(copy) {
  const step1 = panelEl.querySelector('.feedback-step[data-step="1"]');
  step1.querySelector(".feedback-lede").textContent = copy.lede;
  step1.querySelector(".feedback-body").textContent = copy.body;
  step1.querySelector(".feedback-footer").textContent = copy.footer;
}

function renderChips() {
  const container = panelEl.querySelector(".feedback-chips");
  container.innerHTML = "";
  for (const chip of CHIPS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "feedback-chip";
    btn.textContent = chip.label;
    btn.addEventListener("click", () => onChipClick(chip.reaction));
    container.appendChild(btn);
  }
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add("feedback-toast--visible"));
  window.setTimeout(() => {
    toastEl.classList.remove("feedback-toast--visible");
    window.setTimeout(() => {
      toastEl.hidden = true;
    }, 220);
  }, 1600);
}

function resetToStep1() {
  pendingReaction = null;
  panelEl.querySelector('.feedback-step[data-step="1"]').hidden = false;
  const step2 = panelEl.querySelector('.feedback-step[data-step="2"]');
  step2.hidden = true;
  const note = step2.querySelector(".feedback-note");
  note.value = "";
  const email = step2.querySelector(".feedback-email");
  if (email) email.value = "";
}

function positionPopover() {
  if (!btnEl) return;
  const r = btnEl.getBoundingClientRect();
  panelEl.style.setProperty("--feedback-anchor-top", `${r.bottom + 8}px`);
  panelEl.style.setProperty("--feedback-anchor-right", `${Math.max(8, window.innerWidth - r.right)}px`);
}

function showPanel({ source: src, asNudge }) {
  source = src;
  mode = asNudge ? "nudge" : "popover";
  applyIntroCopy(asNudge ? COPY_NUDGE : COPY_POPOVER);
  panelEl.classList.toggle("feedback-panel--nudge", asNudge);
  panelEl.classList.toggle("feedback-panel--popover", !asNudge);
  backdropEl.hidden = asNudge;
  if (!asNudge) {
    backdropEl.hidden = false;
    positionPopover();
    window.addEventListener("resize", positionPopover);
  }
  resetToStep1();
  panelEl.hidden = false;
  if (src === "nudge") gtagEvent("feedback_nudge_shown");
  else gtagEvent("feedback_open");
}

function closePanel() {
  if (!panelEl || panelEl.hidden) return;
  panelEl.hidden = true;
  backdropEl.hidden = true;
  panelEl.classList.remove("feedback-panel--nudge", "feedback-panel--popover");
  window.removeEventListener("resize", positionPopover);
  resetToStep1();
  mode = null;
}

function dismissNudge() {
  markPromptSeen();
  gtagEvent("feedback_nudge_dismissed");
  closePanel();
}

async function onChipClick(reaction) {
  gtagEvent("feedback_reaction", { reaction, source: source || "unknown" });
  if (reaction === "enjoying") {
    try {
      await postFeedback({ reaction });
      markPromptSeen();
      showToast(TOAST.enjoying);
      closePanel();
    } catch {
      showToast("Couldn't send — try again later.");
    }
    return;
  }
  pendingReaction = reaction;
  panelEl.querySelector('.feedback-step[data-step="1"]').hidden = true;
  const step2 = panelEl.querySelector('.feedback-step[data-step="2"]');
  step2.hidden = false;
  step2.querySelector(".feedback-lede").textContent = COPY_STEP2.title;
  const note = step2.querySelector(".feedback-note");
  note.placeholder = COPY_STEP2.placeholder;
  const email = step2.querySelector(".feedback-email");
  if (email) email.placeholder = COPY_STEP2.emailPlaceholder;
  note.focus();
  gtagEvent("feedback_note_open", { reaction });
}

async function completeStep2(includeNote) {
  const step2 = panelEl.querySelector('.feedback-step[data-step="2"]');
  const note = step2.querySelector(".feedback-note");
  const emailEl = step2.querySelector(".feedback-email");
  const message = includeNote ? note.value.trim() : "";
  const email = emailEl ? emailEl.value.trim() : "";
  try {
    await postFeedback({ reaction: pendingReaction, message, email });
    if (message) gtagEvent("feedback_note", { reaction: pendingReaction });
    markPromptSeen();
    showToast(TOAST.default);
    closePanel();
  } catch {
    showToast("Couldn't send — try again later.");
  }
}

function tryShowNudge() {
  if (isPromptSeen() || isPanelOpen()) return;
  if (isSearchOpen()) {
    nudgePending = true;
    return;
  }
  nudgePending = false;
  showPanel({ source: "nudge", asNudge: true });
}

function startEngagementTimer() {
  if (engagementStarted || isPromptSeen()) return;
  engagementStarted = true;
  window.setTimeout(tryShowNudge, FEEDBACK_NUDGE_DELAY_MS);
}

function onFirstEngagement() {
  window.removeEventListener("pointerdown", onFirstEngagement);
  window.removeEventListener("keydown", onFirstEngagement);
  window.removeEventListener("touchstart", onFirstEngagement);
  startEngagementTimer();
}

function onDismissClick() {
  if (mode === "nudge") dismissNudge();
  else closePanel();
}

export function isFeedbackOpen() {
  return isPanelOpen();
}

export function initFeedback() {
  panelEl = document.getElementById("feedback-panel");
  backdropEl = document.getElementById("feedback-backdrop");
  toastEl = document.getElementById("feedback-toast");
  btnEl = document.getElementById("action-feedback");
  if (!panelEl || !backdropEl || !toastEl) return;

  renderChips();

  const step2 = panelEl.querySelector('.feedback-step[data-step="2"]');
  step2.querySelector(".feedback-skip").textContent = COPY_STEP2.skip;
  step2.querySelector(".feedback-send").textContent = COPY_STEP2.send;

  btnEl?.addEventListener("click", () => {
    if (isPanelOpen() && mode === "popover") {
      closePanel();
      return;
    }
    showPanel({ source: "header", asNudge: false });
  });

  panelEl.querySelector(".feedback-dismiss")?.addEventListener("click", onDismissClick);
  backdropEl.addEventListener("click", closePanel);

  step2.querySelector(".feedback-skip")?.addEventListener("click", () => completeStep2(false));
  step2.querySelector(".feedback-send")?.addEventListener("click", () => completeStep2(true));

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isPanelOpen()) return;
    e.preventDefault();
    e.stopPropagation();
    onDismissClick();
  }, true);

  const bodyObs = new MutationObserver(() => {
    if (nudgePending && !isSearchOpen()) tryShowNudge();
  });
  bodyObs.observe(document.body, { attributes: true, attributeFilter: ["class"] });

  if (!isPromptSeen()) {
    window.addEventListener("pointerdown", onFirstEngagement);
    window.addEventListener("keydown", onFirstEngagement);
    window.addEventListener("touchstart", onFirstEngagement);
  }
}

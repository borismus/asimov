# Stories — curated narrative branches through the tech tree

## Context

The asimov tech tree shows ~hundreds of invention cards as a year-axis DAG. The interesting structure isn't any one card; it's the **contingent, unplanned chains** that run through them — domestication → bridles → stirrups → mounted shock combat; cannon-boring → pressure cylinders → piston steam engines → coal-pump killer-app → textile mills; or just the diffusion of writing media (papyrus → parchment → paper → press).

Right now the only way to follow a chain is to pin one card and read its direct neighbors, then re-pin and repeat. The user wants a **first-class authored layer**: hand-curated branches through the graph, each with a name, a description, and per-step narrative beats so the *reasoning* between steps is visible — particularly the "greatness cannot be planned" character of discovery, where each invention turns out to be load-bearing for something its inventors never imagined.

This plan adds a new overlay called a **story** that draws an authored ribbon through an ordered list of cards, dims the rest of the world, and exposes a stepper UX so the reader walks the narrative beat-by-beat. Stories live in a JSON file the user edits directly.

> Out of scope for this plan: a related extension the user wants to track separately — every card carrying a `kind ∈ {"legacy", "added", "speculative"}` so authored gap-fillers and future-facing cards can sit alongside Asimov's corpus with appropriate visual differentiation. Stories will eventually reference IDs across all three kinds, but the data-model change is a sibling effort and gets its own plan.

---

## Naming

- **story** everywhere — URL, UI, source file, classnames
- Stories are technically authored *branches* through the graph (the user's term), but "branch" already suggests git/tree-structure. "Story" foregrounds the narrative — and the narrative is the point, since the connections are often non-obvious.
- URL: `/story/<slug>/`. Header button: "Stories". Module: `stories.js`. Body class: `body.has-story`. Render group: `gStoryTrace` (the visual ribbon — "trace" survives only as an internal name for the rendered geometry).

The seeded stories should foreground contingency: the prose emphasizes that the next step was not the goal of the previous one. Cannon-boring was for *cannons*; it just happened to produce the precision cylinders Watt needed. Stirrups were for staying on a horse; they just happened to make couched lances possible and rewrite European feudalism. That's the editorial voice.

---

## File-level changes

**New files**
- [static/stories.json](static/stories.json) — array of story objects, the single edit point for adding new stories
- [static/stories.js](static/stories.js) — module exporting `initStories`, `loadStories`, `enterStory`, `exitStory`, `renderStoryTrace`, `computeStoryFitTransform`, `renderStoriesMenu`, `renderStoryBanner`
- [static/stories.css](static/stories.css) — spotlight + ribbon + banner + menu styles, kept separate so the feature is removable

**Modified**
- [static/universe.html](static/universe.html) — load stories.css; add `#action-stories` button to `.site-actions`; add `#stories-menu` and `#story-banner` containers
- [static/routing.js](static/routing.js#L5) — extend `parsePathPin` into `parsePath` returning `{kind:"pin"|"story", …}`; keep `parsePathPin` as a compat shim for [static/mobile.js](static/mobile.js)
- [static/universe.js](static/universe.js) — wire `initStories`, add `gStoryDim` + `gStoryTrace` SVG layers, extend `state` with story fields, switch popstate handling to the new parser, hook the header button, gate `persistPin` while a story is active
- [static/asimov.tsv](static/asimov.tsv) — optional: add missing entries the seeded stories want (see "Data gaps" below)

---

## Data shape (`stories.json`)

```json
[
  {
    "slug": "horse-cavalry",
    "title": "From horse to heavy cavalry",
    "blurb": "Bridles, stirrups, horseshoes, and collars turn a wild animal into the dominant battlefield unit of the Middle Ages.",
    "steps": [
      { "id": "animal-dom", "note": "The first domesticated animals — dogs, then goats — set the precedent." },
      { "id": "horse",       "note": "Tamed horses arrive: strong like oxen, smart like donkeys." },
      { "id": "metal-stirrup", "note": "Central Asian invention. Often called one of the most consequential inventions in pre-gunpowder warfare — a stable platform turns the rider into a weapon." },
      { "id": "iron-horseshoes", "note": "Hooves protected; horses can be worked harder, longer, and on harder terrain." },
      { "id": "horse-collar", "note": "Pulling load shifts from windpipe to shoulders — 5x pulling capacity. Power tilts northward in Europe." }
    ],
    "references": []
  }
]
```

Per-step `note` is **optional**; bare strings (`"animal-dom"`) are accepted by the loader and treated as `{id, note: null}`. `loadStories` resolves each `id` against `state.nodesById`, drops missing IDs with `console.warn`, and exposes `story.resolvedSteps[]` (with `node` reference + note) plus `story.missingIds[]` for diagnostics.

`references` is an array of `{title, url}` rendered as small links at the bottom of the banner — the user mentioned acoup.blog for the steam-engine narrative; that goes here.

### Seeded stories (using IDs that exist in asimov.tsv today)

Each story's blurb leads with the contingency — "no one planned this" — and per-step `note` text foregrounds the unintended consequence that made the next step possible.

1. **`horse-cavalry`** — `animal-dom → horse → metal-stirrup → iron-horseshoes → horse-collar`. Blurb angle: nobody domesticating sheep was thinking about armored knights. Stirrups were for not falling off; the couched-lance shock charge was downstream.
2. **`steel-diffusion`** — `steel → coke-iron → bessemer-steel → ironclad-warships → alloy-steel`. Blurb angle: steel was a curiosity-grade alloy for two millennia. Bessemer's process (1856) made it cheap, and within six years it was reshaping naval warfare — one process change rippled into ship hulls, rail, skyscrapers.
3. **`steam-engine-arc`** — `cannon → pressure-cooker → miners-friend → newcomen-steam-engine → coke-iron → steam-engine → spinning-frame → industrial-revolution`. The acoup.blog narrative; this is the canonical "greatness cannot be planned" story. Per-step notes carry the contingency: cannon-boring produced pressure-tight cylinders for purposes nobody intended; Newcomen's pump found a killer app in coal mines, where its fuel was *already on site*; that virtuous cycle ran for ~50 years before the engine was efficient enough to leave the mine and end up driving textile looms.
4. **`writing-media`** — `writing → alphabet → parchment → paper → printing-press`. Diffusion of the medium, not the message — the substrate kept getting cheaper, and each cheaper substrate enabled a different kind of literature.

### Data gaps to flag (do not block this plan)

The seeded chains all use existing IDs, but they'd be richer with additions to asimov.tsv:
- `bridle`, `saddle`, `lance`, `plate-armor` for the cavalry story
- `crucible-steel` (1740) for the steel story (Huntsman's process between coke-iron and Bessemer)
- `cannon-boring` (~1770s, Wilkinson's boring mill — the literal mechanical bridge from cannon to steam cylinder)
- `papyrus` (~3000 BCE) for writing-media

The plan accepts whatever IDs are present; missing IDs warn and are spliced out. The user can add these in a follow-up commit.

---

## Routing changes

[static/routing.js](static/routing.js) gains `parsePath`:

```js
export function parsePath(pathname) {
  const parts = pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0] === "story" && parts[1]) return { kind: "story", slug: parts[1] };
  if (parts.length === 1) return { kind: "pin", id: parts[0] };
  return null;
}

// Compat for mobile.js — keep working without edits.
export function parsePathPin(pathname) {
  const r = parsePath(pathname);
  return r?.kind === "pin" ? r.id : null;
}
```

Plus thin wrappers `pushStoryPath(slug)` (→ `/story/<slug>`) and `pushHomePath()` (→ `/`) that funnel into the existing `pushPath`.

`popstate` in [universe.js:408](static/universe.js#L408) becomes a switch on `parsePath(window.location.pathname)`:
- `null` → `unpin()` and `exitStory({keepUrl:true})` if either is active
- `{kind:"pin", id}` → `exitStory({keepUrl:true})` then `pin(node)` + `centerOnNode`
- `{kind:"story", slug}` → `unpin()` then `enterStory(slug, {animate:true, keepUrl:true})`

`{keepUrl:true}` suppresses the corresponding `pushPath` call so popstate doesn't push redundant history.

---

## State extensions ([universe.js:127](static/universe.js#L127))

```js
storyId: null,            // active slug or null
storyNodes: [],           // resolved node objects, in narrative order
storySteps: [],           // {node, note} pairs, parallel to storyNodes
storyMissing: [],         // unresolved id strings (banner diagnostic)
storyStep: null,          // null = whole-trace view; integer index = stepper focused on step i
stories: [],              // loaded list
storiesById: {},          // slug → story
```

---

## SVG layer order ([universe.js:200-210](static/universe.js#L200))

Slot two new groups:

```
gAxis
gStoryDim          // NEW — full-viewport <rect>, white wash at 0.55
gDots
gLabels
gStickyLabels
gSearchLabels
gCards
gStoryTrace        // NEW — ribbon path + step markers + step indices
gPinnedLines
gPinnedCards
gHoverLines
gHoverCards
```

`gStoryDim` is hidden via `display:none` unless `state.storyId` is set; when active, its rect is sized to the world bbox (or the visible viewport in world coords — easier and equivalent for our purposes). `pointer-events:none` so it doesn't intercept hover.

`gStoryTrace` contains:
- One `<path class="story-trace-ribbon">` whose `d` attribute is `M x0,y0 L x1,y1 …` through each resolved step's world coords
- One `<g class="story-step">` per step containing a numbered `<circle>` + `<text>`
- `pointer-events:none` on the whole group so the ribbon and markers never block clicks on cards underneath

Story-member **cards/dots/labels** are not duplicated into a new layer — they get a `.story-member` class on their existing baseline elements, and CSS does the spotlight (see below). This avoids fighting the tier system's enter/exit transitions.

---

## Visual treatment

The **ribbon connects every consecutive pair in the steps array**, regardless of whether canonical TSV deps exist between them. That's the whole point: the story author is asserting a narrative connection (cannon → steam engine) that the data graph wouldn't draw on its own.

```css
/* stories.css */
body.has-story #links-canvas { opacity: 0.18; }
body.has-story .labels .dag-label,
body.has-story .sticky-labels .dag-label { opacity: 0.35; }
body.has-story g.cards > g.card:not(.story-member) { opacity: 0.25; }
body.has-story g.dots circle.dag-dot:not(.story-member) { opacity: 0.4; }

.story-trace-ribbon {
  fill: none;
  stroke: #b8336a;
  stroke-width: calc(4px / var(--zoom));
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 6px rgba(184, 51, 106, 0.45));
}
.story-step circle {
  fill: white;
  stroke: #b8336a;
  stroke-width: calc(2.5px / var(--zoom));
  r: calc(10px / var(--zoom));
}
.story-step text {
  fill: #b8336a;
  font: bold calc(11px / var(--zoom)) "DM Serif Display", serif;
  text-anchor: middle;
  dominant-baseline: central;
}
g.card.story-member { filter: drop-shadow(0 0 8px rgba(184, 51, 106, 0.55)); }
g.card.story-member.story-current { filter: drop-shadow(0 0 14px rgba(184, 51, 106, 0.85)); }
.dag-dot.story-member { fill: #b8336a; stroke: #b8336a; }
```

Color choice: rose-magenta `#b8336a` is distinct from goldenrod (hover) and steelblue (pin), so the three overlay systems remain visually separable when they coexist.

---

## Banner + stepper

Below the header, a strip shown only when `body.has-story`:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ From cannon to textile mill                                            × │
│ The acoup.blog argument: a dozen contingent steps connect cannons        │
│ to mass-produced cloth.                                                  │
│ ─────────────────────────────────────────────────────────────────────── │
│ ‹  Step 4 / 9 — Newcomen steam engine (1712)                          ›  │
│ Newcomen pumps water out of coal mines — the killer app. Coal is         │
│ conveniently the same fuel that runs the engine: virtuous cycle.         │
│ ─────────────────────────────────────────────────────────────────────── │
│ Refs: Why no Roman industrial revolution (acoup.blog)                    │
└──────────────────────────────────────────────────────────────────────────┘
```

Behavior:
- Initial `enterStory` fits the camera to the full bbox of all step nodes (`computeStoryFitTransform`) and leaves `state.storyStep = null`. The banner shows the story title + blurb + references; no step note yet.
- Clicking `›` advances `state.storyStep` (or sets it to 0 from null), pans the camera to that step's node via existing `panToNode()`, and shows that step's `note` in the banner. `‹` decrements; at the ends, the buttons disable.
- Clicking the **whole-trace** affordance (a small icon next to "Step 4 / 9", or just the title) returns to `storyStep = null` and re-fits the camera.
- The current step's card gets `.story-current` (brighter glow).
- Esc on the document closes the story (same as `×`).

This is the user's "narrative reading experience": the prose lives in the banner, the camera follows along, the ribbon shows where you are in the larger story.

---

## Key new functions

```js
// stories.js

export function initStories({
  state, svg, gStoryDim, gStoryTrace, zoom,
  panToNode, persistView, pushPath, scheduleRedraw,
}) { /* cache deps */ }

export async function loadStories(url = "/static/stories.json") {
  // fetch, normalize step entries (string → {id, note: null}),
  // resolve against state.nodesById, populate state.stories / state.storiesById.
}

export function enterStory(slug, { animate = false, keepUrl = false } = {}) {
  // If story already active and same slug, no-op.
  // If pinned, unpin() first.
  // Resolve story; if unknown slug, console.warn and bail.
  // Set state.storyId / storyNodes / storySteps / storyMissing; storyStep = null.
  // document.body.classList.add("has-story").
  // renderStoryBanner(); renderStoryTrace(); apply story-member classes.
  // computeStoryFitTransform → svg.transition().call(zoom.transform, target).
  // if (!keepUrl) pushStoryPath(slug).
}

export function exitStory({ keepUrl = false } = {}) {
  // Inverse: clear state, remove .has-story, clear .story-member tags,
  // clear gStoryTrace, hide banner, if (!keepUrl) pushHomePath().
}

export function renderStoryTrace() {
  // 1. Tag .story-member on dots/cards/labels for current storyNodes.
  // 2. Build d=M…L… string from storyNodes' world coords; bind to ribbon path.
  // 3. Bind storyNodes to .story-step group; position circles + indices.
  // 4. .story-current toggle on the storyStep node only.
}

export function computeStoryFitTransform(storyNodes, viewport, headerHeight) {
  // World bbox of nodes + 80px screen padding. Clamp k to [0.08, 1.5].
  // Account for headerHeight (camera y-offset so the banner doesn't cover the bbox).
  // Single-step story: behave like centerOnNode at k=1.5.
}

export function gotoStep(i) {
  // Bound to [0, storyNodes.length-1]. state.storyStep = i; panToNode; render.
}

export function renderStoriesMenu(stories) { /* dropdown UL of buttons */ }
export function renderStoryBanner() { /* title/blurb/step-prose/refs/× */ }
```

---

## Interaction with pinning

- `enterStory` calls `unpin()` first. Two heavy overlays on the same cards is just noise.
- While `state.storyId` is set, `persistPin` no-ops — clicking a card to pin it for inspection works (overlay renders, badges show), but the URL stays `/story/<slug>/`. Exiting the story restores normal `persistPin` behavior.
- Hover (goldenrod) is unchanged; it remains the way to peek at non-story neighbors without leaving the trace.

---

## Implementation checklist

1. **Data + routing scaffold (~25 min)**
   - Write `stories.json` with all 4 seeded stories
   - Add `parsePath` + `parsePathPin` shim in [static/routing.js](static/routing.js)
2. **Module skeleton (~30 min)**
   - Create `stories.js` with `loadStories`, `initStories`, no-op `enterStory`/`exitStory` that just toggle `body.has-story` and `state.storyId`
   - Add the `#action-stories` button + `#stories-menu` + `#story-banner` to `universe.html`
   - Wire init from `universe.js` (`await loadStories()` after `loadGraph`)
3. **SVG layers + ribbon render (~45 min)**
   - Insert `gStoryDim` and `gStoryTrace` into the layer stack at [universe.js:200-210](static/universe.js#L200)
   - Implement `renderStoryTrace`: ribbon path + numbered markers + `.story-member` tagging
   - Write `stories.css` with the spotlight rules
4. **Camera fit + popstate (~30 min)**
   - `computeStoryFitTransform`
   - Switch popstate handler to `parsePath` discriminated union
   - Verify back/forward across `/`, `/horse/`, `/story/horse-cavalry/`
5. **Banner + stepper (~40 min)**
   - `renderStoryBanner` (title/blurb/refs/×) + step controls (`‹`, step counter, `›`)
   - `gotoStep(i)` + `.story-current` glow + Esc-to-close
6. **Pin coexistence (~15 min)**
   - `enterStory` unpins first
   - Gate `persistPin` while `state.storyId` is set
7. **Polish + verification (~15 min)**
   - Resize handler keeps `gStoryDim` covering the viewport
   - Re-tag `.story-member` after every `renderCards` (cards re-enter when crossing tiers)

Total: ~3–3.5 hours focused work.

---

## Verification

End-to-end browser tests with the dev server running:

- Cold-load `/story/horse-cavalry/`: camera fits all 5 cards; rose ribbon visible; baseline content dimmed; banner shows title/blurb/refs.
- Cold-load `/horse/`: pins horse exactly as before (compat path).
- Cold-load `/`: random-pin behavior unchanged.
- Click the Stories button → menu opens listing all 4 seeded stories → click "From cannon to textile mill" → camera animates to fit; URL becomes `/story/steam-engine-arc/`.
- Click `›` four times → camera pans to step 4; banner shows that step's `note`; `.story-current` glow on Newcomen steam engine.
- Browser back: returns to previous URL, exits story cleanly (no orphan ribbon, no orphan dim).
- Browser forward: re-enters the story.
- While in a story, click a story-member card → pins it (steelblue + rose coexist visibly); URL stays `/story/...`. Click the same card → unpins; story still active.
- Hover a non-member card → goldenrod hover overlay still fires; no regression.
- Zoom from `k=0.05` (LABEL) → `k=2.0` (FULL): ribbon and step markers stay readable; story-member dots keep rose at LABEL; cards keep drop-shadow at IMG/FULL.
- Step a story whose `notes` include long prose (steam-engine-arc) → banner wraps and stays under ~3 lines (truncate with `line-clamp:3` if needed).
- Add a step ID that doesn't exist in the TSV → one `console.warn` at load; story still renders with the missing step spliced out (ribbon is continuous through the gap, step indices renumber over the resolvable steps); banner shows "(1 missing)" diagnostic.
- Esc with story active → closes it; URL returns to `/`.
- Resize the window during a story → `gStoryDim` resizes; banner re-flows; nothing escapes its bounds.
- Mobile (`mobile.js`) reload on `/story/...` URL → no crash; mobile UI shows its default deck (acceptable; mobile UI for stories is out of scope).

---

## Critical files

- [static/universe.js](static/universe.js) — wire-up, layer additions, popstate switch, persistPin gate
- [static/overlays.js](static/overlays.js) — read-only reference; pin/hover behavior is unchanged
- [static/routing.js](static/routing.js) — `parsePath` + compat shim
- [static/utils.js](static/utils.js) — `loadGraph` shape is the contract `loadStories` consumes
- [static/asimov.tsv](static/asimov.tsv) — optional follow-up additions (bridle/saddle/lance/cannon-boring/papyrus etc.) to enrich seeded stories
- [static/world.js](static/world.js) — `nodesInView`, `drawLinks`; not modified, but the trace layer must coexist with its render cadence
- [static/card.js](static/card.js) — read-only; `renderFullCard` is reused for story-member rendering via existing tier flow
- [static/universe.html](static/universe.html), [static/universe.css](static/universe.css) — header button + banner DOM, dim/spotlight CSS
- New: `static/stories.js`, `static/stories.json`, `static/stories.css`

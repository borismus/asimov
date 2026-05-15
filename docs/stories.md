# Stories

**Status:** shipped (one story live: `horse-cavalry`).

A **story** is a curated, ordered path through the tech tree — an authored narrative ribbon connecting cards with per-edge prose. The architecture is designed around "greatness cannot be planned": each step describes how the previous one turned out to be load-bearing for something its inventors never imagined.

Authored in the same Google Sheet as the cards (one tab per story, prefixed `Story:`). The fetch script writes [static/stories.json](../static/stories.json); the runtime loads it on startup.

## Authoring

See [stories-impl.md](stories-impl.md) for the sheet-side recipe (tab layout, key/value top zone, `id, edge_note` bottom zone, and how [scripts/fetch-tsv.py](../scripts/fetch-tsv.py) discovers `Story: …` tabs into JSON).

Each step row in the sheet carries an **edge note** describing the transition *into* that step from the previous one. The note for step `i` is the prose on the segment between step `i-1` and step `i`.

## Runtime architecture

### Module layout

[static/stories.js](../static/stories.js) is the single module. Public surface:

- `initStories(deps)` — cache shared state + layer refs.
- `loadStories(url)` — fetch `stories.json`, normalize, build reverse index.
- `enterStory(slug)` / `exitStory()` / `requestExitStory()` — start, stop, confirm-then-stop.
- `gotoStep(step)` / `gotoCardInStory(cardId)` — focus a step (half-integer; see below) or jump to a node by id.
- `renderStoryTrace()` / `renderStoryCards()` / `renderStickies()` / `renderStoryBanner()` / `renderStoriesMenu()` / `renderStoryCardChip()` — render passes, called from the universe.js redraw loop.
- `showStoryPrompt(...)` / `hideStoryPrompt()` / `isStoryPromptOpen()` — modal dialog for cross-story navigation (e.g. "leave this story?" or "switch to a different story?").
- `handleCardClickInStoryContext(node, pinFn)` — overlays.js delegates card clicks here so the story system can decide between step-navigate, story-switch prompt, leave-story prompt, or fall through to plain pinning.
- `getStoriesForCard(cardId)` — reverse index: which stories contain this card?

### State

In [static/universe.js](../static/universe.js):

```js
storyId          // active slug, or null
storyNodes       // resolved node refs in narrative order
storySteps       // {node, edgeNote} pairs, parallel to storyNodes
storyMissing     // unresolved ids (diagnostic)
storyStep        // half-integer focus index (see below); null until first redraw
stories          // loaded list
storiesById      // slug → story
storiesByCardId  // card id → story[] (reverse index)
storyCoordsById  // node id → {x, y} virtual coords (band-aligned)
```

### Half-integer focus model

`state.storyStep` uses **half-integers** to encode interleaved node/edge focus:

- `0, 1, 2, ..., N-1` — focus on a node (a story step's card).
- `0.5, 1.5, ..., N-1.5` — focus on the edge between node `floor(step)` and node `ceil(step)`.

Each ←/→ press increments by 0.5, so the user cycles `node → edge → node → edge`. Clicking a card focuses that node; clicking an edge sticky focuses that edge. `syncCurrentStep()` derives focus from the viewport center each redraw, but a short lockout (`GOTO_STEP_LOCKOUT_MS = 550`) suppresses it during the camera transition that follows `gotoStep`, so the just-set focus isn't immediately clobbered by the old camera position.

### SVG layer order

[static/universe.js](../static/universe.js) appends, bottom to top:

```
gStoryTrace          // rose ribbon (continuous polyline through node centers)
gStoryStickies       // edge prose notes (paper) + collapsed mini-squares
gStoryCards          // story-overlay cards (thumbnails / full cards)
gStoryCurrentCard    // focused card alone, paints above stickies
```

Stickies sit below cards so card text always wins when they overlap. The ribbon is a single continuous polyline so cluster-internal connections aren't broken into independent segments.

### Coordinate override

Story members get a virtual y on a shared band (mean of baseline y's), with stable hash jitter (`BAND_Y_JITTER = 350` world units) so close-x neighbors don't stack. x stays at baseline (year-monotonic globally — see [static/world.js](../static/world.js)).

### Thumbnail vs full card

`STORY_FULL_K = 0.3` is the zoom threshold for the story overlay:

- `k < 0.3` — non-focused story members render as **thumbnails** (fold=0 compact cards, `--card-screen-scale: 1`). Non-focused edge stickies render as **mini squares** (28×28) at segment midpoints.
- `k ≥ 0.3` — all story members and edge stickies use the full layout.
- **Regardless of *k*** — the **focused** node (`.story-current` in `gStoryCurrentCard`) and the **focused** edge sticky (in `gStoryStickiesFocused`) always render expanded (full card + full prose note).

`bindStoryCards` tracks the last "look" per layer in a `WeakMap` and explicitly rebuilds the DOM on transition so cards re-enter at the right initial fold.

### Sticky placement

Edge stickies anchor at the geometric midpoint of the edge between two consecutive nodes. The placement solver in `layoutStickies`:

1. Computes the midpoint in screen coords.
2. Clamps to a viewport-safe parametric range along the segment — slides the sticky along its edge so the entire bbox stays inside the viewport. If no t in [0, 1] keeps the sticky on-screen, the sticky is dropped.
3. Sticky-vs-sticky collision push (no card avoidance — overlap with edges outranks card clearance).

Mini stickies (zoomed-out) skip the sliding clamp and just check that their midpoint lies inside the viewport.

`.sticky-scaler` uses `transform-origin: center` + `transform-box: fill-box` so the foreignObject center stays anchored at the `g.story-sticky` world origin (a `transform-origin: 0 0` setup would drift by `(w/2)·(1 − 1/k)`).

### Camera

`gotoStep` calls `zoomToStep`. Clicks and sticky jumps use `zoom.transform` with `max(current k, STORY_FULL_K)` so overview entry reveals full cards. Arrow keys and the on-screen prev/next buttons pass `preserveZoom: true` and pan via `zoom.translateBy` only — scale is never interpolated, so stepping does not cross the thumb↔full threshold.

`computeStoryFitTransform` fits the bbox of the story members' band-aligned coords, with top inset for the banner.

### Visual treatment

In [static/stories.css](../static/stories.css):

- Rose `#b8336a` for the ribbon, focused-card glow, focused-sticky glow, and `.story-member` accents.
- `body.has-story` dims baseline cards, dots, labels, and the links canvas.
- Story-member labels are hidden across all label layers (regular, sticky, search) with `!important` — the story overlay carries the title.
- Focused element (card or sticky) gets `drop-shadow(0 0 14px rose) drop-shadow(0 0 32px rose)`. SVG `filter` on the outer `<g>` so the glow renders at world-coord scale instead of being absorbed by the counter-scaler.

### Pin coexistence + cross-story navigation

`onPinClick` (in [static/overlays.js](../static/overlays.js)) delegates to `handleCardClickInStoryContext` first. While in a story:

- Click a member of the current story → `gotoStep` (focus the corresponding node).
- Click a member of *other* stories → prompt: "Switch to <other story>?"
- Click a card not in any story → prompt: "Leave <current story>?"

Outside a story, clicks pin as normal. If the pinned root is a story member, `renderStoryCardChip` shows an "Explore the X story" button below the card (also below hover-expanded story-member cards). This is the entry point from organic exploration into story mode.

### Routing

URLs:
- `/story/<slug>/` — story active. Cold-load fits the camera to the story bbox; navigates with browser back/forward.
- `/<card-id>/` — pin a card.
- `/` — no pin, no story.

`parsePath` in [static/routing.js](../static/routing.js) discriminates the path. `enterStory({keepUrl})` and `exitStory({keepUrl})` flags exist so the popstate handler doesn't push redundant history.

## Files

- [static/stories.js](../static/stories.js) — all logic.
- [static/stories.css](../static/stories.css) — visual treatment.
- [static/stories.json](../static/stories.json) — derived artifact from `fetch-tsv.py`. Committed to the repo so dev server / deploy have data without an extra step.
- [scripts/fetch-tsv.py](../scripts/fetch-tsv.py) — discovers `Story: …` worksheet tabs + `parse_story_tab` (see [stories-impl.md](stories-impl.md)).

## Known not-yet-implemented

- `references[]` array on stories (originally planned for an "acoup.blog" link in the banner) — not parsed, not rendered. Easy to add to `parse_story_tab` + banner if needed.
- Only one seeded story (`horse-cavalry`). Architecture supports any number.

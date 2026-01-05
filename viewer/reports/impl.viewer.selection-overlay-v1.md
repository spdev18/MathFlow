# Viewer Selection Visuals: Overlay-based highlighting (no DOM outlines)

## Goal
Make drag-selection highlight look clean (no stacked outlines, no floating green bars),
while keeping click / hit-testing behavior unchanged.

## What was wrong
Previously, selection visuals were applied by adding `.mv-selected` to each selected KaTeX DOM node.
This outlines the DOM box of the node. For KaTeX fractions, some "atomic" nodes have no visible ink
(e.g. `FracBar` / `.frac-line`) and their boxes can appear as thin horizontal lines. Outlining them
creates the "floating green bars" seen above/beside fractions.

Also, KaTeX DOM contains nested wrappers. When both parent and child are selected, outlines overlap.

## Fix
Selection visuals are now rendered in a separate absolute overlay layer:

- We keep `selectionState.selectedIds` and all hit-testing logic exactly the same.
- We stop adding `.mv-selected` to KaTeX DOM nodes.
- Instead we paint transparent rectangles in `#selection-overlay` (pointer-events: none).
- Visual-only filtering:
  - never paint `FracBar`
  - skip empty-text nodes
  - keep only "leaf-most" selected nodes (to avoid parent+child overlap)
  - merge adjacent single-digit Num nodes into one rectangle for prettier multi-digit numbers

## Why this is safe
The overlay layer does not participate in hit-testing:
- `pointer-events: none` ensures clicks go through to KaTeX DOM.
- no DOM styles are applied to KaTeX nodes, so their layout and bounding boxes remain unchanged.

## Files
- viewer/app/main.js (selection visuals rewritten)
- viewer/app/surface-map.js (restored to archive baseline to avoid accidental regressions)


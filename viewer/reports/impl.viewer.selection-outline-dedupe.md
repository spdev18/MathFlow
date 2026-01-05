# Viewer: Drag Selection Outline De-duplication

## Problem
Drag (rubber-band) selection produced many overlapping green frames (outlines) because multiple KaTeX DOM nodes were being selected for the same visible glyph.

## Root Cause
KaTeX uses nested wrapper `<span>` elements. Many wrappers have **empty direct text**, but their `.textContent` is the concatenation of all descendant text. If we classify atoms using `.textContent`, wrappers can be misclassified as `Num`, `BinaryOp`, etc., and end up in the atomic list.

Drag selection (`hitTestRect`) returns **all** intersecting atoms, so wrapper duplicates are selected together and each gets `.mv-selected`, producing stacked outlines.

## Fix
Two complementary changes:

1) **Surface map classification uses direct text**
   - In `app/surface-map.js`, classification now prefers the element's *direct* text nodes (`getDirectText`) and only falls back to `.textContent` for true leaf elements.
   - This prevents wrapper spans from becoming atomic nodes.

2) **Rect selection prunes wrapper duplicates**
   - In `app/main.js`, drag selection results are post-processed by `pruneRectSelectionCandidates()`.
   - It keeps the deepest DOM nodes and drops ancestors that only wrap other selected nodes.
   - It also prefers multi-digit numeric containers over digit-level descendants if KaTeX ever splits digits.

## Expected Result
- Drag selection produces a clean set of outlines (one per visible token), without overlapping boxes from wrapper nodes.
- Click mapping remains unchanged (still coordinate-based hit-testing).

# Viewer Patch Report — Surface Map rootEl fix
Date: 2025-12-16

## What was broken
Viewer interactivity was dead due to a runtime crash:

- `surface-map.js` threw `ReferenceError: rootEl is not defined` during `buildSurfaceNodeMap()` traversal.

This prevented the Surface Node Map from building, which cascaded into no hover/click interactivity.

## Fix
Inside `buildSurfaceNodeMap(containerElement, ...)`:

- Define `const rootEl = containerElement;`
- Keep using `getBBoxRelativeTo(baseEl, rootEl)` for bbox calculations.

No functional changes beyond removing the crash.

## Files
- `app/surface-map.js`

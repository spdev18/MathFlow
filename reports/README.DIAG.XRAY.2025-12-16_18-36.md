# Viewer X-Ray Diagnostic Patch

This ZIP adds **non-invasive diagnostics** to the Viewer. No business logic is intentionally changed.

## How to enable diagnostics

1) Add `?diag=1` to the Viewer URL, then reload.

OR

2) Open DevTools Console and run:

- `__FM_DIAG.enable()`

## What you get

- Ring-buffered timeline of key events (clicks, Step2 detection, apply gating)
- Captured request/response tape (primitiveId, selectionPath, endpoint, status)
- No spam by default (disabled unless you enable it)

## How to dump

- `__FM_DIAG.print()` – prints JSON to Console
- `__FM_DIAG.dump()` – returns the JSON object
- `__FM_DIAG.clear()` – clears the buffers

## Key event names

- `ui.pointerup` – click hit-test result (surface id/kind/role/stableKey)
- `p1.click` – P1 integer click snapshot (stableKey/mode/astId)
- `p1.mode.set` – P1 mode transitions
- `step2.detect.*` – Step2 multiplier context detection (enter/ok/fail + reasons)
- `apply.attempt` / `apply.blocked` – apply gateway gating
- `REQUEST` / `RESPONSE` – engine request/response tape

## Notes

- When disabled, diagnostics are effectively no-ops.
- We intentionally avoid logging the full LaTeX; we log small snippets + hashes.

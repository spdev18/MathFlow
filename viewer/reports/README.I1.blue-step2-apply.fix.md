# Viewer Patch: Step2 BLUE apply (double-click + hint click)

## Goal
Make Step2 multiplier `1` apply **P.ONE_TO_TARGET_DENOM** reliably when BLUE is selected:
- Double-click on the selected `1` applies the BLUE primitive (e.g., `7/7`, `5/5`).
- Clicking the BLUE hint (mode indicator) also applies.

## What changed
### app/engine-adapter.js
- Disabled engine-side integer double-click apply.
- Integer clicks are now handled entirely in `app/main.js` (mode cycling + single apply gateway).
- Reason: engine-side integer dblclick was applying `P.INT_TO_FRAC` (`1/1`) and overriding BLUE behavior.

### app/main.js
- Added capture-phase click/dblclick shield on the hint (mode indicator) so outside capture-handlers cannot dismiss it before `onclick` runs.

## How to install
Unzip into the Viewer root so these paths overwrite:
- `app/main.js`
- `app/engine-adapter.js`


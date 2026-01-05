# Viewer: BLUE hint apply diagnostics + operator mapping stabilization
Date: 2025-12-15

## What was broken (observed)
- Clicking the BLUE hint (or double-click in BLUE) often did nothing: the hint disappeared, but no step was applied.
- Sometimes the wrong operator / wrong term was affected (e.g. clicking `·` near the left term affecting the right one).

## Root causes fixed in this patch
1) Hint click race with selection clearing
- The hint overlay could receive a click while the selection system cleared `integerCycleState` before the overlay's onclick ran.
- Result: apply gateway had no stableKey/astId at click time → no-op.

Fix:
- The overlay now stores `stableKey`, `astId`, and `surfaceNodeId` in `indicator.dataset`.
- On hint click, state is rehydrated from `indicator.dataset` BEFORE apply.

2) Surface-map duplicate nodes from \htmlData wrappers
- Instrumented KaTeX tokens have a wrapper span (data-ast-id) and inner KaTeX spans.
- The surface map traversal could create multiple nodes for the same visual token → operatorIndex / mapping drift.

Fix:
- In `surface-map.js`, if an element is an instrumented leaf token (`data-ast-id` + `data-role` in {number, operator, variable, paren}),
  it is treated as a single atomic surface node and its children are NOT traversed.

3) EngineAdapter integer apply interference
- EngineAdapter forwarded integer double-clicks directly to the engine without `preferredPrimitiveId`,
  which could trigger default conversions (e.g. `1 -> 1/1`) and break hint cycling state.

Fix:
- EngineAdapter no longer forwards integer clicks to the engine; integer apply is controlled by main.js via preferredPrimitiveId.

## Files changed
- viewer/app/main.js
- viewer/app/surface-map.js
- viewer/app/engine-adapter.js

## Expected behavior after patch
Expression: \frac{3}{5}+\frac{2}{7} → click `+` → multiplied form.
- Click left `1` until BLUE shows `Convert 1 → 7/7`, then click BLUE hint OR double-click the `1` → left becomes `7/7`.
- Right side remains independent and still can become `5/5` when BLUE is selected.

If it still fails, the next diagnostics step is to log the exact V5 payload and the engine response status for BLUE apply.

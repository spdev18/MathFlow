Viewer Patch: Step2 BLUE dblclick apply reliability
Date: 2025-12-15 22:07:25

What was wrong (most likely):
- engine-adapter was still forwarding integer double-clicks to the backend using legacy integerCycleState.primitives/cycleIndex.
- The viewer now uses mode-based state (GREEN/ORANGE/BLUE), so legacy primitives/cycleIndex can be out of sync.
- Result: double-click often applied P.INT_TO_FRAC (1/1) or no-op instead of P.ONE_TO_TARGET_DENOM.

What this patch changes:
1) engine-adapter.js: never forwards integer clicks to engine (integers are handled locally via hint-cycle apply gateway)
2) main.js: adds a real DOM 'dblclick' listener that:
   - resolves the clicked Num node -> stableKey + astNodeId
   - recomputes Step2 context at apply-time
   - forces mode BLUE for Step2 multiplier-1, else ORANGE
   - calls applyCurrentHintForStableKey("[DOUBLE-CLICK APPLY]")

How to verify:
- Hard refresh (Ctrl+Shift+R)
- \frac{3}{5}+\frac{2}{7} -> click '+' to get multiplied-by-1 form
- Click left '1' once -> BLUE or GREEN depending on your cycle settings
- Double-click the left '1' -> should send preferredPrimitiveId=P.ONE_TO_TARGET_DENOM and update to 7/7
- Right side should still work independently.

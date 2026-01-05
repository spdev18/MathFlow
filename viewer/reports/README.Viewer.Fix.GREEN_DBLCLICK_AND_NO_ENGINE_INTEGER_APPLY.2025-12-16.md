README.Viewer.Fix.GREEN_DBLCLICK_AND_NO_ENGINE_INTEGER_APPLY.2025-12-16.md

What changed
- main.js: applyCurrentHintForStableKey now allows DOUBLE-CLICK in GREEN mode to apply P.INT_TO_FRAC
  for normal P1 integer nodes (NOT Step2 multiplier-1 tokens).
  Step2 tokens remain protected: GREEN still does not apply; BLUE applies P.ONE_TO_TARGET_DENOM.
- engine-adapter.js: integers are NOT sent to engine from EngineAdapter (prevents competing apply sources);
  main.js single apply gateway is the only apply path for numbers.

Why
- Your symptom "dblclick on 1 in green used to produce 1/1, now nothing happens" is caused by:
  (1) engine-adapter integer apply disabled (removes old engine-side dblclick),
  (2) main.js was blocking GREEN apply entirely.
  This patch restores the expected dblclick behavior without reintroducing the double-apply race.

How to install
- Unzip into the root of your Viewer folder (so files land in:
  - app/main.js
  - app/engine-adapter.js
)

What to test
1) Simple: "1" -> dblclick while selected (GREEN) => should convert via P.INT_TO_FRAC (1/1).
2) Step2: after you have "... · 1" tokens (different denominators):
   - single click to toggle GREEN<->BLUE
   - dblclick in BLUE => should apply P.ONE_TO_TARGET_DENOM (d/d or b/b depending on side)

If Step2 still fails, open Console and look for:
- [VIEWER-REQUEST] preferredPrimitiveId=...
- [APPLY RESULT] status=...

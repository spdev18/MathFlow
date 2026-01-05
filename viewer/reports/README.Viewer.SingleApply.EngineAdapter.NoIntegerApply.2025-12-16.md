# Viewer Patch: Single Apply Source (EngineAdapter ignores integer dblclick)

Date: 2025-12-16

## What this fixes

Your Viewer currently has **two competing "apply" sources** for number nodes:
- `main.js` handles number clicks locally (mode cycling + BLUE apply gateway).
- `engine-adapter.js` also sends V5 `applyStep` on **integer double-click** (P1 logic).

For Step2 multiplier `1` tokens, `main.js` uses modes **GREEN=0 / BLUE=2**.
But `engine-adapter.js` expects a `cycleIndex` that maps into `primitives[]` (0..1).
So in BLUE mode (`cycleIndex = 2`) the adapter cannot inject a `preferredPrimitiveId`,
and it still sends a V5 request, making Step2 behavior **nondeterministic**.

This patch makes **EngineAdapter ignore all integer/number clicks (including dblclick)**.
Numbers are handled **only** by `main.js` (single gateway), which is the intended contract.

## Files changed

- `app/engine-adapter.js` — in `shouldSendToEngine()`, integer/number nodes now always return `false`.

## How to install

Extract this ZIP into your Viewer root:

- `D:\G\viewer\`

After extraction you should have:

- `D:\G\viewer\app\engine-adapter.js`
- `D:\G\viewer\reports\README.Viewer.SingleApply.EngineAdapter.NoIntegerApply.2025-12-16.md`

## How to verify (one scenario)

1. Open Viewer page.
2. Use formula: `3/5 + 2/7`
3. Click `+` (Step1 should produce `3/5·1 + 2/7·1`)
4. Single-click the left `1` until **BLUE** is shown.
5. Double-click that same `1` → must apply `P.ONE_TO_TARGET_DENOM` and become `7/7`.
6. Repeat for the right `1` → must become `5/5`.

### Console expectation

You should see logs similar to:
- `[P1] Integer click ignored by EngineAdapter ...` (this confirms adapter is not competing)
- `[DBL-DET] ... action=APPLY`
- `[VIEWER-REQUEST] preferredPrimitiveId=P.ONE_TO_TARGET_DENOM ...`
- `[APPLY RESULT] status=step-applied`

If Step2 still doesn't apply, the next step is to inspect the `[VIEWER-REQUEST]` payload + response status,
but now we will be debugging a **single** apply path (no race).

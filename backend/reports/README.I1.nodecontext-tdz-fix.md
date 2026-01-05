# NodeContextBuilder TDZ fix (effectiveClick)

## What was broken
The backend could crash during V5 runner execution with:

- `Cannot access 'effectiveClick' before initialization`

This happened because `effectiveNodeId` was computed using `effectiveClick` **before** `effectiveClick` was declared (Temporal Dead Zone for `const`).

## What I changed
- `src/engine/v5/NodeContextBuilder.ts`
  - Compute `effectiveNodeId` from the original `click` first.
  - Then build `effectiveClick`.
  - Also gated a noisy `[DEBUG-VISIT]` log behind env var `MOTOR_DEBUG_NODE_SEARCH=1`.

## How to apply
Unzip this archive directly into your project root:
- `D:\G\backend-api-v1.http-server`

## How to verify
Run exactly what you ran:

```powershell
cd D:\G\backend-api-v1.http-server
npm test -- tests/verify-infrastructure.test.ts tests/EngineHttpServer.contract.test.ts
```

Expected: `POST /api/entry-step with valid JSON returns 200` should end with `status=step-applied` (no `engine-error`).

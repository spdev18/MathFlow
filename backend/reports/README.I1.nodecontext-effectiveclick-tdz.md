# Fix kit: NodeContextBuilder TDZ (effectiveClick)

## What was broken
During the V5 runner execution, `NodeContextBuilder.build(...)` referenced `effectiveClick` **before** it was initialized. That throws at runtime:

- `Cannot access 'effectiveClick' before initialization`

Because of that, `/api/entry-step` returned `engine-error`, and this test failed:
- `tests/verify-infrastructure.test.ts` ("POST /api/entry-step with valid JSON returns 200")

## What I changed
File updated:
- `src/engine/v5/NodeContextBuilder.ts`

Fix:
- Compute `effectiveNodeId` from `click.nodeId` (or fallback to AST root id) **before** creating `effectiveClick`.
- Gate the stray debug log behind `MOTOR_DEBUG_NODE_SEARCH=1` so it doesn't spam tests.

## How to apply
1) Unzip this archive into: `D:\G\backend-api-v1.http-server`
2) Run:

```powershell
cd D:\G\backend-api-v1.http-server
npm test -- tests/verify-infrastructure.test.ts tests/EngineHttpServer.contract.test.ts
```

Expected: the previously failing infrastructure test should now return `step-applied` for the valid JSON case.

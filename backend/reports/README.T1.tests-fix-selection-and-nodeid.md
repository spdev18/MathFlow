# Test Fix Drop — selectionPath + root click normalization

Date: 2025-12-11

## What was broken (from your `vitest` run)
1) **Operator click on root** produced a ClickTarget with `nodeId: ""` (empty string), so `NodeContextBuilder` could not resolve the node and preconditions failed with `operator mismatch`.
2) **Nested selectionPath like `term[0]`** was not resolvable in MapMaster because `getNodeByPath()` treated the segment literally as a property name, instead of mapping `term[0] -> left` / `term[1] -> right` on binary nodes. That caused the selection normalizer to fall back to `root`, which then made “2 + 3 - 1” tests generate **0 candidates**.

## Changes included in this ZIP
### 1) backend-api-v1.http-server/src/engine/v5/NodeContextBuilder.ts
- If `click.nodeId` is empty/blank, it is normalized to `ast.id ?? "root"` before node lookup.

### 2) backend-api-v1.http-server/src/mapmaster/mapmaster.ast-helpers.ts
- `MapMasterAstHelpers.getNodeByPath()` now supports ast.ts-style segments:
  - `term[0]` / `term[1]` map to `left` / `right` for binary nodes
  - generic `prop[index]` maps to array property access when `prop` is an array.

## How to run tests (backend)
From PowerShell:

- `cd D:\G\backend-api-v1.http-server`
- `npm test`

If you want a quick confirmation subset:
- `npm test -- tests/verify-infrastructure.test.ts tests/atomic/atomic-stage1.test.ts`

# P1: INT_TO_FRAC Nested Apply Fix

## Summary
Fixed INT_TO_FRAC to apply to integers inside expressions when `preferredPrimitiveId` is provided.
The fix **bypasses StepMaster entirely** and directly executes the primitive transformation.

## How It Works

When a request includes `preferredPrimitiveId = "P.INT_TO_FRAC"`:

1. **Path Resolution:** Parse `selectionPath` (e.g., `term[0]` for left operand of `2+3`)
2. **Validation:** Verify target node is an integer, else return error
3. **Direct Execution:** Use `replaceNodeAt()` to transform integer → fraction
4. **Early Return:** Return `step-applied` immediately, bypassing StepMaster

### Key Insight
The previous implementation created a synthetic candidate but still went through StepMaster, which rejected it via locality filtering. The fix skips StepMaster completely.

---

## Files Changed

### [step.orchestrator.ts](file:///D:/G/backend-api-v1.http-server/src/orchestrator/step.orchestrator.ts)
- Added `replaceNodeAt` and `toLatex` to AST imports
- Rewrote INT_TO_FRAC block (lines 233-380) to:
  - Validate selectionPath resolves to integer
  - Directly apply transformation via `replaceNodeAt()`
  - Return `step-applied` immediately (bypass StepMaster)
  - Emit TraceHub DECISION and RUN_END events

---

## Test Results ✅

All 6 tests passing:

| Test | Input | SelectionPath | Expected | Result |
|------|-------|---------------|----------|--------|
| 1 | `6` | `root` | `\frac{6}{1}` | ✅ |
| 2 | `2+3` | `term[0]` | contains `\frac{2}{1}` | ✅ |
| 3 | `2+3` | `term[1]` | contains `\frac{3}{1}` | ✅ |
| 4 | `2+3` | `root` | engine-error (binaryOp) | ✅ |
| 5 | `2*5` | `term[0]` | contains `\frac{2}{1}` | ✅ |
| 6 | `7` | `root` | bypassedStepMaster=true | ✅ |

Run: `pnpm vitest run tests/int-to-frac-direct.test.ts`

---

## Browser Verification

After restarting backend:

1. Open http://localhost:4002/debug-tool.html
2. Enter `2+3`
3. Click "AST Debug" to load AST
4. Click on "2" in preview → target shows `term[0]`
5. Click "Force Apply INT_TO_FRAC"
6. Expected: Glass box shows `step-applied`, output `\frac{2}{1}+3`

---

## TraceHub Events

The following events are emitted for P.INT_TO_FRAC:

**DECISION (accept):**
```json
{
  "preferredPrimitiveId": "P.INT_TO_FRAC",
  "selectionPath": "term[0]",
  "resolvedPath": "term[0]",
  "resolvedKind": "integer",
  "decision": "apply"
}
```

**RUN_END (success):**
```json
{
  "primitiveId": "P.INT_TO_FRAC",
  "ok": true,
  "resultLatexShort": "\\frac{2}{1}+3"
}
```

Fetch with: `GET http://localhost:4201/debug/trace/latest`

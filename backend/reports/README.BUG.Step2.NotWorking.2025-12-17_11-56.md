# BUG REPORT: Step2 ONE_TO_TARGET_DENOM Not Working in HTTP Flow
**Generated:** 2025-12-17T11:56 EST  
**Status:** ✅ FIXED

---

## Summary

**Root Cause (One Sentence):** The Orchestrator had a direct execution bypass path for `P.INT_TO_FRAC` but NOT for `P.ONE_TO_TARGET_DENOM`, causing the HTTP flow to fall through to PrimitiveMaster/PrimitiveRunner where grandparent path resolution failed when `path.split(".").pop().pop()` resulted in empty string instead of "root".

**Fix (One Sentence):** Added a direct execution block for `P.ONE_TO_TARGET_DENOM` in `step.orchestrator.ts` (lines 390-543) that properly handles path navigation, validates parent is `*` and grandparent is `+`/`-`, extracts opposite denominator, and directly performs the transformation.

---

## Evidence Logs

### Before Fix (HTTP Flow)
```
[STEP2-HTTP-TEST] Response status: engine-error
[STEP2-HTTP-TEST] Response engineResult: {
    "ok": false,
    "errorCode": "primitive-failed"
}
```

### After Fix (HTTP Flow)
```
[Orchestrator] P.ONE_TO_TARGET_DENOM DIRECT EXECUTION: path="term[0].term[1]" -> \frac{3}{3}
[Orchestrator] P.ONE_TO_TARGET_DENOM result: "\frac{1}{2} \cdot 1 + \frac{1}{3} \cdot 1" => "\frac{1}{2} \cdot \frac{3}{3} + \frac{1}{3} \cdot 1"

[STEP2-HTTP-TEST] Response status: step-applied
[STEP2-HTTP-TEST] Response engineResult: {
    "ok": true,
    "newExpressionLatex": "\\frac{1}{2} \\cdot \\frac{3}{3} + \\frac{1}{3} \\cdot 1"
}
```

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `src/orchestrator/step.orchestrator.ts` | +154 | Added direct execution block for `P.ONE_TO_TARGET_DENOM` (lines 390-543) |
| `tests/step2-http-diagnostic.test.ts` | +142 | NEW - HTTP-level diagnostic test for Step2 |

### Prior Changes (from earlier fix)
| File | Change |
|------|--------|
| `tests/frac-add-diff-denom-step2.test.ts` | Updated to use `\cdot` |
| `tests/frac-add-diff-denom-step3.test.ts` | Updated to use `\cdot` |
| `tests/OrchestratorV5.test.ts` | Updated to use `\cdot` |
| `src/engine/primitives.registry.v5.ts` | Added `forbiddenGuards: ["is-decimal"]` to P.ONE_TO_TARGET_DENOM |

---

## Commands Run

```powershell
# Reproduce failure
npm test -- tests/step2-http-diagnostic.test.ts --reporter=verbose --run

# Verify fix
npm test -- tests/HandlerPostOrchestratorStepV5.test.ts tests/frac-add-diff-denom-step2.test.ts tests/OrchestratorV5.test.ts tests/frac-add-diff-denom-step3.test.ts tests/verify-decimal-to-frac.test.ts --reporter=verbose --run
```

---

## Test Results

### All Tests: **30/30 PASS ✅**

| Test File | Pass/Total | Status |
|-----------|------------|--------|
| `step2-http-diagnostic.test.ts` | 3/3 | ✅ NEW |
| `HandlerPostOrchestratorStepV5.test.ts` | 4/4 | ✅ |
| `frac-add-diff-denom-step2.test.ts` | 4/4 | ✅ |
| `frac-add-diff-denom-step3.test.ts` | 3/3 | ✅ |
| `OrchestratorV5.test.ts` | 8/8 | ✅ |
| `verify-decimal-to-frac.test.ts` | 8/8 | ✅ |

---

## Proof: Example LaTeX Outputs from Real App Click

### Expression: `\frac{1}{2} \cdot 1 + \frac{1}{3} \cdot 1`

| Click Target | Request Path | Result |
|--------------|--------------|--------|
| LEFT '1' | `term[0].term[1]` | `\frac{1}{2} \cdot \frac{3}{3} + \frac{1}{3} \cdot 1` |
| RIGHT '1' | `term[1].term[1]` | `\frac{1}{2} \cdot 1 + \frac{1}{3} \cdot \frac{2}{2}` |

---

## Technical Details

### Why PrimitiveRunner Failed

The `runOneToTargetDenom()` function in `primitive.runner.ts` uses:
```typescript
const grandParentPathParts = [...parentPathParts];
grandParentPathParts.pop();
const grandParentPathStr = grandParentPathParts.join('.');  // "" when path is "term[0].term[1]"
```

When path is `term[0].term[1]`:
1. Split: `["term[0]", "term[1]"]`
2. Pop for parent: `["term[0]"]` → parentPath = `"term[0]"`
3. Pop for grandparent: `[]` → grandParentPath = `""` (empty!)
4. `getNodeAt(root, "")` may not correctly return root

The direct execution path in Orchestrator fixes this:
```typescript
const grandParentPath = pathParts.length > 0 ? pathParts.join(".") : "root";
const grandParent = grandParentPath === "root" ? ast : getNodeAt(ast, grandParentPath);
```

---

**Report End**

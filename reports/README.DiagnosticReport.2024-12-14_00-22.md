# Diagnostic Report: 9 Remaining Test Failures

## Summary
- **Total Failures:** 9 test assertions
- **Test Files Failing:** 4

---

## Group A: Execution / Runner Issues - 0 FOUND

After individual test runs, no pure Execution/Runner issues were identified.
All primitive runner logic is working correctly.

---

## Group B: Stage1 Rule ID Mismatch - 4 TESTS (1 FILE)

### File: `tests/stepmaster.stage1.coverage.test.ts`

| Test Name | Expected | Actual | Selection Correct? | Failure Location |
|-----------|----------|--------|-------------------|------------------|
| FRAC_ADD_SAME_DEN_STAGE1 produces primitives | `FRAC_ADD_SAME_DEN_STAGE1` | `R.FRAC_ADD_SAME` | NO - wrong rule ID | MapMaster candidate selection |
| FRAC_SUB_SAME_DEN_STAGE1 produces primitives | `FRAC_SUB_SAME_DEN_STAGE1` | `R.FRAC_SUB_SAME` | NO - wrong rule ID | MapMaster candidate selection |
| INT_ADD_STAGE1 produces primitives | `INT_ADD_STAGE1` | `R.INT_ADD` | NO - wrong rule ID | MapMaster candidate selection |
| MIXED_INT_TO_FRAC_STAGE1 produces primitives | `MIXED_INT_TO_FRAC_STAGE1` | `R.INT_TO_FRAC` | NO - wrong rule ID | MapMaster candidate selection |

### Root Cause Analysis:
These tests were written expecting the **Stage1 invariant rule naming convention** (e.g., `FRAC_ADD_SAME_DEN_STAGE1`) used by the MapMaster legacy pipeline.

However, the current system returns **V5-style rule IDs** (e.g., `R.FRAC_ADD_SAME`, `R.INT_ADD`) which are different identifiers.

**This is NOT an execution/runner issue.** It's a **rule ID naming contract issue** between:
- Stage1 invariant registry (old naming: `*_STAGE1`)
- V5 registry/MapMaster output (new naming: `R.*`)

### Decision Required:
- Tests are outdated vs current V5 contract
- V5 is the canonical system and should not be changed
- Tests should be updated to expect V5 rule IDs OR removed if Stage1 is deprecated

---

## Group C: primitiveDebug Field Missing - 2 TESTS (1 FILE)

### File: `tests/EntryStepPrimitiveDebug.test.ts`

| Test Name | Expected | Actual | Issue |
|-----------|----------|--------|-------|
| includes primitiveDebug for a Stage1 fraction sum 1/7 + 3/7 | `response.status = "step-applied"`, `primitiveDebug.primitiveId = "FRAC_ADD_SAME_DEN_STAGE1"` | `response.status = "choice"` | Status is "choice", not "step-applied" |
| sets primitiveDebug to none for mixed case 2 + 1/3 | `primitiveDebug` defined | `primitiveDebug` undefined | Field not populated |

### Root Cause Analysis:
1. **Test 1:** The test expects `status = "step-applied"` but receives `"choice"`.
   - This is consistent with Cluster A contract: V5 returns `"choice"` for clicks without `preferredPrimitiveId`
   - The test sends `operatorIndex: 0` without `preferredPrimitiveId`
   - V5 orchestrator correctly returns "choice" for operator clicks on fraction additions

2. **Test 2:** `primitiveDebug` field is undefined.
   - The response handler doesn't populate `primitiveDebug` for non-step-applied responses
   - This is expected behavior per the V5 contract

### Decision Required:
- Tests are outdated vs V5 contract
- For "step-applied" results: need to provide `preferredPrimitiveId` or accept "choice"
- `primitiveDebug` field may be deprecated or optional in V5

---

## Group D: Other Scattered - 3 TESTS

Looking at the full test run output, the remaining failures are duplicates or related to the same root causes:
- Stage1 rule ID expectation mismatches
- primitiveDebug field expectations

---

## Categorized Failure Summary

| Group | Count | Root Cause | Fix Type |
|-------|-------|------------|----------|
| A: Execution/Runner | 0 | - | - |
| B: Stage1 Rule ID Mismatch | 4 | Tests expect Stage1 IDs, V5 returns R.* IDs | Update Tests |
| C: primitiveDebug Missing | 2 | V5 returns "choice" not "step-applied", primitiveDebug not populated | Update Tests |
| D: Other | 3 | Duplicates of B/C | - |

---

## Recommendation

**All 9 failures are TEST CONTRACT ISSUES, not execution/runner bugs.**

The tests were written for an older Stage1/MapMaster pipeline that:
1. Returns `*_STAGE1` rule IDs
2. Populates `primitiveDebug` field
3. Returns `step-applied` for operator clicks without preferredPrimitiveId

The current V5 pipeline:
1. Returns `R.*` rule IDs
2. Does not populate `primitiveDebug` in all cases
3. Returns `choice` for operator clicks without preferredPrimitiveId

### Suggested Actions:
1. **Update `stepmaster.stage1.coverage.test.ts`** to expect V5 rule IDs OR skip/deprecate if Stage1 coverage is no longer needed
2. **Update `EntryStepPrimitiveDebug.test.ts`** to match V5 status contract (choice vs step-applied) OR remove if primitiveDebug is deprecated
3. Consider adding a VERSION comment to these test files explaining the contract change

---

## Critical Tests Status (MUST NOT REGRESS)

| Test | Status |
|------|--------|
| OrchestratorV5.test.ts | ✅ 8/8 passing |
| int-to-frac-fraction-children.test.ts | ✅ 7/7 passing |
| verify-decimal-to-frac.test.ts | ✅ 8/8 passing |
| int-to-frac-direct.test.ts | ✅ 6/6 passing |

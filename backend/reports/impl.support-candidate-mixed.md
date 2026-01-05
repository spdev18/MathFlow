# Implementation Report: Support Candidate Emission for Mixed-Domain Expressions

## Summary

Implemented support candidate emission for mixed-domain expressions (integer + fraction) so that cases like `4 + 5/2` no longer silently fail. When direct arithmetic rules cannot apply due to mixed operand types, MapMaster now emits a support candidate (`P.INT_TO_FRAC`) targeting the integer operand.

## Files Changed

| File | Change |
|------|--------|
| [mapmaster.rules.mixed.stage1.ts](file:///d:/G/backend-api-v1.http-server/src/mapmaster/mapmaster.rules.mixed.stage1.ts) | Added logic to emit `P.INT_TO_FRAC` support candidate when a binaryOp has one integer and one fraction operand |
| [mapmaster.core.ts](file:///d:/G/backend-api-v1.http-server/src/mapmaster/mapmaster.core.ts) | Added `category?: 'direct' \| 'support'` field to `MapMasterCandidate` interface |

## Files Added

| File | Description |
|------|-------------|
| [support-candidate-mixed.test.ts](file:///d:/G/backend-api-v1.http-server/tests/support-candidate-mixed.test.ts) | Tests verifying support candidate emission for mixed expressions |

## Why Previous Behavior Produced "No Action"

Previously, when a user clicked on `+` in `4 + 5/2`:

1. **Domain Detection**: The registry adapter correctly identified this as `Mixed` domain.
2. **Rule Matching**: `R.INT_PLUS_FRAC` rule was looked up, but it required specific patterns or was not wired to a primitive.
3. **No Candidates**: Since no direct rule matched, MapMaster returned an empty candidate list.
4. **StepMaster**: With no candidates, StepMaster returned `no-candidates` status.

**Root Cause**: There was no fallback logic to emit a support step (like `P.INT_TO_FRAC`) when direct rules failed.

## How Support Candidate Is Now Emitted

1. **Detection**: When `buildCandidatesForMixedStage1` runs, it checks if `windowRootNode` is a `binaryOp`.
2. **Mixed Check**: If one operand is `integer` and the other is `fraction`, it identifies the integer side.
3. **Path Calculation**: It builds the path to the integer operand (e.g., `left` or `right`).
4. **Candidate Emission**: Emits a candidate with:
   - `primitiveIds: ['P.INT_TO_FRAC']`
   - `targetPath`: path to integer operand
   - `category: 'support'`
   - `description`: "Normalize integer to fraction (n → n/1) for mixed operation"

## Response Structure

When a client clicks on `+` in `4 + 5/2`, the response now includes a candidate:

```json
{
  "candidates": [
    {
      "id": "cand-support-int-to-frac-1",
      "invariantRuleId": "R.INT_TO_FRAC",
      "primitiveIds": ["P.INT_TO_FRAC"],
      "targetPath": "left",
      "description": "Normalize integer to fraction (n → n/1) for mixed operation",
      "category": "support"
    }
  ]
}
```

## Verification

- **New Tests**: 4/4 passing in `support-candidate-mixed.test.ts`
- **Regression Tests**: All existing tests pass

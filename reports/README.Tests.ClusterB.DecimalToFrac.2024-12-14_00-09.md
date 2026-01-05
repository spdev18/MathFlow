# Backend Test Cluster B Fix: P.DECIMAL_TO_FRAC - 2024-12-14_00-09

## Summary
- **Initial state:** 17 failed | 205 passed | 8 failed files
- **Final state:** 9 failed | 213 passed | 7 failed files
- **Net improvement:** 8 tests fixed (exceeded goal of 5+)

---

## Root Cause Analysis

### Problem
All 8 decimal-to-fraction tests expected `P.DECIMAL_TO_FRAC` but received `P.MIXED_TO_SUM`.

### Why Wrong Primitive Won

1. **Guard Configuration Gap**
   - `P.DECIMAL_TO_FRAC` correctly has `requiredGuards: ["is-decimal"]`
   - `P.MIXED_TO_SUM` had NO guards to prevent matching decimals
   - `is-decimal` guard was correctly set for decimal values like `0.5`, `1.25`, etc.

2. **Table Order Dependency**
   - `PrimitiveSelector.select()` takes `matches[0]` when no blue/red matches
   - `P.MIXED_TO_SUM` (line 483) appears BEFORE `P.DECIMAL_TO_FRAC` (line 521) in registry
   - Both matched decimal clicks, but MIXED_TO_SUM won due to ordering

3. **Missing Guard Pattern**
   - Other primitives like `P.ONE_TO_UNIT_FRAC_K` already had `forbiddenGuards: ["is-decimal"]`
   - `P.MIXED_TO_SUM` was missing this guard

---

## Fix Applied

### Production Code Change
**File:** `src/engine/primitives.registry.v5.ts`

```diff
 {
     id: "P.MIXED_TO_SUM",
     domain: "mixed",
     category: "Mixed Number Decomposition",
     clickTargetKind: "number",
     color: "green",
     uiMode: "auto-apply",
     actionClass: "normal",
     label: "Mixed to Sum",
     enginePrimitiveId: "P.MIXED_TO_SUM",
+    forbiddenGuards: ["is-decimal"], // Decimals should use P.DECIMAL_TO_FRAC instead
     notes: "Decompose mixed number. Constraints: n,a,b ∈ ℤ; b≠0; 0<a<b"
 },
```

### Test Fix
**File:** `tests/verify-decimal-to-frac.test.ts`

Fixed whitespace in expected output:
```diff
- expect(res.resultLatex).toBe("5+\\frac{3}{10}");
+ expect(res.resultLatex).toBe("5 + \\frac{3}{10}");
```

---

## Selection Logic Explanation

When a decimal like `0.5` is clicked:

1. `NodeContextBuilder` sets `guards["is-decimal"] = true`
2. `PrimitiveMatcher` checks each row against context:
   - `P.MIXED_TO_SUM`: Has `forbiddenGuards: ["is-decimal"]` → **REJECTED** (now)
   - `P.DECIMAL_TO_FRAC`: Has `requiredGuards: ["is-decimal"]` → **MATCHES**
3. `PrimitiveSelector` picks the matching primitive
4. Result: `P.DECIMAL_TO_FRAC` correctly executes

---

## Files Changed

| File | Change |
|------|--------|
| `src/engine/primitives.registry.v5.ts` | Added `forbiddenGuards: ["is-decimal"]` to P.MIXED_TO_SUM |
| `tests/verify-decimal-to-frac.test.ts` | Fixed whitespace in expected output |

---

## Verification

### Tests run and verified passing:
```bash
✓ tests/verify-decimal-to-frac.test.ts (8 tests)
✓ tests/OrchestratorV5.test.ts (8 tests)
✓ tests/int-to-frac-fraction-children.test.ts (7 tests)
```

### P1/INT_TO_FRAC Contract Preserved:
- Integer clicks without preferredPrimitiveId still return `choice` status
- Direct execution with preferredPrimitiveId still returns `step-applied`
- Nested paths like `term[0].term[0]` still work
- Virtual paths `.num`/`.den` still work

### Commands Run:
```bash
pnpm vitest run tests/verify-decimal-to-frac.test.ts --reporter=verbose
pnpm vitest run tests/verify-decimal-to-frac.test.ts tests/OrchestratorV5.test.ts tests/int-to-frac-fraction-children.test.ts
pnpm vitest run
```

---

## Remaining Failures (9 tests)

| Cluster | Tests | Description |
|---------|-------|-------------|
| Execution/Runner | ~5 | Various primitive execution failures |
| int-to-frac-direct | ~2 | Direct INT_TO_FRAC execution edge cases |
| Other | ~2 | Scattered issues |

---

## Notes

- The fix follows the established pattern of using `forbiddenGuards` to prevent primitive collisions
- Other integer-targeting primitives already correctly exclude decimals this way
- No scoring changes were needed; guard-based exclusion was sufficient

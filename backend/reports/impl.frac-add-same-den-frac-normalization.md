# Implementation Report: Fraction Addition Same Denominator - AST Node Normalization

## Summary

Extended the previous fraction addition regression fix to handle LaTeX fractions (like `\frac{1}{7}+\frac{3}{7}`) where the `denominator` property can be an AST node object, not just a string.

## Root Cause

When parsing `\frac{1}{7}+\frac{3}{7}`, the AST parser may represent denominators as:
- **Strings**: For simple slash fractions like `1/7+3/7`, denominator is `"7"`
- **Objects**: For LaTeX fractions like `\frac{1}{7}`, denominator might be `{ type: "integer", value: "7" }`

The previous fix compared denominators using `leftDen === rightDen`, which works for strings but fails for objects (reference equality always returns `false` for different objects).

## Fix

Added a `denomKey()` helper function inside `NodeContextBuilder.buildContext()` that extracts a comparable string from any denominator representation:

```typescript
function denomKey(den: any): string | null {
    if (!den) return null;
    if (typeof den === 'string') return den;
    if (typeof den === 'number' || typeof den === 'bigint') return String(den);
    if (typeof den === 'object') {
        // Common AST shapes
        if (typeof (den as any).value === 'string' || typeof (den as any).value === 'number') 
            return String((den as any).value);
        if (typeof (den as any).latex === 'string') return (den as any).latex;
        if (typeof (den as any).text === 'string') return (den as any).text;
        if (typeof (den as any).id === 'string') return (den as any).id; // fallback
    }
    return String(den);
}
```

Updated both denominator comparison locations to use `denomKey()`:

```typescript
const leftKey = denomKey(leftDen);
const rightKey = denomKey(rightDen);
guards['denominators-equal'] = (leftKey !== null && rightKey !== null && leftKey === rightKey);
```

## Files Changed

| File | Change |
|------|--------|
| [NodeContextBuilder.ts](file:///d:/G/backend-api-v1.http-server/src/engine/v5/NodeContextBuilder.ts) | Added `denomKey()` helper and updated both denominator comparisons |
| [frac-add-same-den-regression.test.ts](file:///d:/G/backend-api-v1.http-server/tests/frac-add-same-den-regression.test.ts) | Added tests for `\frac{1}{7} + \frac{3}{7}` (with spaces) and `\frac{5}{9}+\frac{2}{9}` (no spaces) |

## Test Results

All 9 tests passed:
- `computes denominators-equal guard for 1/7+3/7` ✓
- `computes denominators-equal guard for 1/2+1/2` ✓
- `computes denominators-different guard for 1/3+1/4` ✓
- `computes denominators-equal for \frac{1}{7} + \frac{3}{7} (with spaces)` ✓
- `computes denominators-equal for \frac{5}{9}+\frac{2}{9} (no spaces)` ✓
- `matches P.FRAC_ADD_SAME_DEN for 1/7+3/7` ✓
- `does NOT match P.FRAC_ADD_SAME_DEN for 1/3+1/4` ✓
- `executes P.FRAC_ADD_SAME_DEN for 1/7+3/7 -> 4/7` ✓
- `executes P.FRAC_ADD_SAME_DEN for 1/2+1/2 -> 2/2` ✓

## How to Run

```powershell
cd D:\G\backend-api-v1.http-server

# Run regression tests
npx vitest run tests/frac-add-same-den-regression.test.ts

# Run infrastructure tests
npx vitest run tests/verify-infrastructure.test.ts tests/EngineHttpServer.contract.test.ts
```

# Implementation Report: Fraction Addition Same Denominator Regression Fix

## Summary

Fixed regression where fraction addition with same denominators (e.g., `1/7+3/7`, `\frac{1}{7}+\frac{3}{7}`) no longer worked because the `denominators-equal` guard was missing from `NodeContext`.

## Root Cause

**File**: `src/engine/v5/NodeContextBuilder.ts` (lines 99-113)

**Problem**: The guard computation logic ONLY checked the parent of the clicked node to determine if denominators were equal:

```typescript
const parent = this.findParent(ast, effectiveClick.nodeId);
if (parent && (parent as any).left && (parent as any).right) {
    // Compute guards from parent's children
}
```

When clicking on the root expression (e.g., the `+` operator in `1/7+3/7`), the clicked node IS the root `binaryOp` node. Since `findParent` returns `undefined` for the root, the guard computation was skipped entirely.

**Result**: `denominators-equal` remained `false` (its default), causing `P.FRAC_ADD_SAME_DEN` to fail matching.

## Fix

Modified `NodeContextBuilder.ts` to first check if the clicked node itself is a `binaryOp` with fraction operands:

```typescript
// First try: check the clicked node itself if it's a binaryOp
if (node.type === 'binaryOp' && (node as any).left && (node as any).right) {
    const left = (node as any).left;
    const right = (node as any).right;
    const leftDen = (left as any).denominator;
    const rightDen = (right as any).denominator;

    if (leftDen && rightDen) {
        guards['denominators-equal'] = (leftDen === rightDen);
        guards['denominators-different'] = !guards['denominators-equal'];
    }
}
// Fallback: check parent if node itself didn't have fraction operands
else if (parent && (parent as any).left && (parent as any).right) {
    // ... existing logic
}
```

## Files Changed

| File | Change |
|------|--------|
| [NodeContextBuilder.ts](file:///d:/G/backend-api-v1.http-server/src/engine/v5/NodeContextBuilder.ts) | Fixed guard computation to check node itself when it's a binaryOp |

## Tests Added

| File | Description |
|------|-------------|
| [frac-add-same-den-regression.test.ts](file:///d:/G/backend-api-v1.http-server/tests/frac-add-same-den-regression.test.ts) | 7 tests verifying guard computation, primitive matching, and execution |

## Test Results

- **7 new tests**: All passing
- **13 existing tests**: All passing
- **Total**: 20 tests passing

## Manual Reproduction (PowerShell)

```powershell
cd D:\G\backend-api-v1.http-server

# Run regression test
npx vitest run tests/frac-add-same-den-regression.test.ts

# Run full verification suite
npx vitest run tests/verify-infrastructure.test.ts tests/GenericPatternMatching.test.ts
```

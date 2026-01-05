# Step 2: Fraction Different Denominators - P.ONE_TO_TARGET_DENOM

**Date:** 2024-12-14

## Summary

Step 2 converts the multiplicative identity `1` in `fraction * 1` to an equivalent fraction `d/d` where `d` is the **opposite fraction's denominator**.

## What Changed

### Already Existed (No Changes Needed)
| File | Description |
|------|-------------|
| `src/engine/primitives.registry.v5.ts` | `P.ONE_TO_TARGET_DENOM` defined at lines 557-567 |
| `src/engine/primitive.runner.ts` | `runOneToTargetDenom` implemented at lines 937-989 |

### New Files
| File | Description |
|------|-------------|
| `scripts/verify-frac-diff-denom-step2.ts` | Verification script for Step 2 |

## How It Works

Given expression: `\frac{1}{2} \cdot 1 + \frac{1}{3} \cdot 1`

| Click Target | Result |
|--------------|--------|
| Left `1` | Becomes `\frac{3}{3}` (opposite denom = 3) |
| Right `1` | Becomes `\frac{2}{2}` (opposite denom = 2) |

### Matching Conditions
- `clickTargetKind === "number"`
- Clicked value is integer `1`
- Parent is multiplication `fraction * 1`
- Grandparent is `+` or `-` binary operation
- Both sides have different denominators

## Verification

### Run Script
```bash
cd D:\G\backend-api-v1.http-server
npx tsx scripts/verify-frac-diff-denom-step2.ts
```

### Expected Output
```
[PASS] All Step 2 tests passed!
- Click left '1':  becomes \frac{3}{3}
- Click right '1': becomes \frac{2}{2}
```

## Restart Requirements

| Component | Restart Required |
|-----------|------------------|
| Backend | Yes (if registry changed) |
| Viewer | Hard refresh (for JS changes) |

## Notes

The primitive logic is complete. The remaining integration work is ensuring the Viewer sends the correct `selectionPath` (AST node ID) when a number is clicked.

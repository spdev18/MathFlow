# P1: INT_TO_FRAC Fraction Children Targeting

## Summary
Implemented `.num` and `.den` virtual path extensions to enable targeting numerator/denominator integers inside simple fractions for `P.INT_TO_FRAC` primitive.

---

## Virtual Path Contract

### Syntax
| Path | Meaning |
|------|---------|
| `root.num` | Numerator of root fraction |
| `root.den` | Denominator of root fraction |
| `term[0].num` | Numerator of left-side fraction |
| `term[1].den` | Denominator of right-side fraction |
| `term[0].term[1].num` | Nested path to fraction numera tor |

### Constraints
- `.num`/`.den` only valid when parent node is a `fraction`
- Child value must be a simple integer string (regex: `/^-?\d+$/`)
- Non-integer children (variables, expressions) return error

---

## Changes Made

### Backend

#### [ast.ts](file:///D:/G/backend-api-v1.http-server/src/mapmaster/ast.ts)

**getNodeAt()** (lines 440-488)
- Added handling for `part === "num"` and `part === "den"`
- Checks if parent is fraction node
- Returns synthetic IntegerNode for integer string children
- Returns undefined for non-integer children

**replaceNodeAt()** (lines 603-651)
- Added handling for `.num`/`.den` path segments
- Converts replacement node to LaTeX string via `toLatex()`
- Replaces fraction's numerator/denominator string

### Viewer

#### [debug-tool.js](file:///D:/G/viewer/app/debug-tool.js)

**findNumberPathByValue()** (lines 469-490)
- Changed from returning `NON_TARGETABLE:` to returning valid `.num`/`.den` paths
- Only returns valid paths for integer children
- Still marks non-integer fraction children as `NON_TARGETABLE`

---

## Test Results

All 7 tests pass:

```
✓ root fraction
  ✓ should convert numerator: \frac{2}{3} root.num => \frac{\frac{2}{1}}{3}
  ✓ should convert denominator: \frac{2}{3} root.den => \frac{2}{\frac{3}{1}}
✓ nested fraction (in binary expression)
  ✓ should convert numerator: 1+\frac{2}{3} term[1].num => 1+\frac{\frac{2}{1}}{3}
  ✓ should convert denominator: 1+\frac{2}{3} term[1].den => 1+\frac{2}{\frac{3}{1}}
✓ error cases
  ✓ should fail for .num on non-fraction node
  ✓ should fail for non-integer numerator
✓ left-side fraction in expression
  ✓ should convert numerator: \frac{4}{5}-1 term[0].num
```

---

## Example Transformations

| Input | Path | Output |
|-------|------|--------|
| `\frac{2}{3}` | `root.num` | `\frac{\frac{2}{1}}{3}` |
| `\frac{2}{3}` | `root.den` | `\frac{2}{\frac{3}{1}}` |
| `1+\frac{2}{3}` | `term[1].num` | `1+\frac{\frac{2}{1}}{3}` |
| `\frac{4}{5}-1` | `term[0].num` | `\frac{\frac{4}{1}}{5}-1` |

---

## Modified Files

| File | Change |
|------|--------|
| `D:\G\backend-api-v1.http-server\src\mapmaster\ast.ts` | Extended `getNodeAt()` and `replaceNodeAt()` for .num/.den |
| `D:\G\viewer\app\debug-tool.js` | Updated `findNumberPathByValue()` to return .num/.den paths |
| `D:\G\backend-api-v1.http-server\tests\int-to-frac-fraction-children.test.ts` | New test file |

---

## Manual Verification

```bash
# Start backend
cd D:\G\backend-api-v1.http-server && pnpm start:dev

# Test via curl/PowerShell
Invoke-WebRequest -Method POST -Uri 'http://localhost:4201/api/orchestrator/v5/step' `
  -ContentType 'application/json' `
  -Body '{"sessionId":"test","expressionLatex":"\\frac{2}{3}","selectionPath":"root.num","preferredPrimitiveId":"P.INT_TO_FRAC","courseId":"default"}' `
  | Select-Object -ExpandProperty Content

# Expected: {"status":"step-applied","engineResult":{"newExpressionLatex":"\\frac{\\frac{2}{1}}{3}",...}}
```

---

## Limitations

1. **Non-integer children**: If numerator/denominator is not a simple integer (e.g., `\frac{x}{3}`), targeting fails with error
2. **Expression children**: Fractions like `\frac{1+2}{3}` cannot have their numerator targeted this way
3. **Nested fractions within fractions**: The `.num`/`.den` path only works one level deep into the fraction

---

## Future Work

- Support `.num`/`.den` for mixed numbers (whole, numerator, denominator)
- Handle expression children by parsing them as sub-ASTs

# P1: INT_TO_FRAC Targeting Stabilization

## Summary
Documented and enforced the backend path contract for `selectionPath` used in INT_TO_FRAC targeting. Added TraceHub events for tracing and improved error handling for non-targetable fraction children.

---

## Path Contract (Backend `getNodeAt`)

### Supported Paths
| Expression | Path | Resolves To |
|------------|------|-------------|
| `6` | `root` | integer "6" |
| `2+3` | `term[0]` | integer "2" |
| `2+3` | `term[1]` | integer "3" |
| `2+3-1-1` | `term[0].term[0].term[0]` | integer "2" |
| `2+3-1-1` | `term[0].term[0].term[1]` | integer "3" |
| `2+3-1-1` | `term[0].term[1]` | first "1" |
| `2+3-1-1` | `term[1]` | second "1" |

### NOT Supported (Backend Limitation)
- `root.numerator`, `root.denominator` - **Backend does not understand these**
- Fractions like `\frac{2}{3}` store numerator/denominator as **strings, not nodes**
- Individual integers inside simple fractions **cannot be targeted**

---

## Key Insight: AST Structure Difference

**Backend AST** (for `\frac{2}{3}`):
```json
{ "type": "fraction", "numerator": "2", "denominator": "3" }
```

**Viewer AST** (for `\frac{2}{3}`):
```json
{ "type": "fraction", "args": [{ "type": "integer", "value": "2" }, { "type": "integer", "value": "3" }] }
```

The viewer parser treats fraction children as nodes, but the backend treats them as strings. This is why path navigation into fractions doesn't work.

---

## Files Changed

### 1. [debug-tool.js](file:///D:/G/viewer/app/debug-tool.js)
- **findNumberPathByValue**: Returns `NON_TARGETABLE:path` for fraction numerator/denominator
- **updateTargetInfoDisplay**: Shows red warning for non-targetable paths

### 2. [main.js](file:///D:/G/viewer/app/main.js)
- **applyP1Action**: Added TraceHub events:
  - `VIEWER_HINT_APPLY_REQUEST` before backend call
  - `VIEWER_HINT_APPLY_RESPONSE` after response

---

## TraceHub Events Added

### VIEWER_HINT_APPLY_REQUEST
```json
{
  "module": "viewer.main",
  "event": "VIEWER_HINT_APPLY_REQUEST",
  "data": {
    "latex": "2+3-1-1",
    "selectionPath": "term[0].term[0].term[0]",
    "preferredPrimitiveId": "P.INT_TO_FRAC",
    "surfaceNodeId": "num-1"
  }
}
```

### VIEWER_HINT_APPLY_RESPONSE
```json
{
  "module": "viewer.main",
  "event": "VIEWER_HINT_APPLY_RESPONSE",
  "data": {
    "status": "step-applied",
    "newLatex": "\\frac{2}{1}+3-1-1"
  }
}
```

---

## Verification

### 1. Binary Expressions (WORKS)
- Input: `2+3-1-1`
- Each integer can be clicked and converted independently
- Paths like `term[0].term[0].term[0]` resolve correctly

### 2. Simple Fractions (LIMITATION)
- Input: `\frac{2}{3}`
- Clicking numerator "2" shows `NON_TARGETABLE: root.numerator` (red warning)
- Cannot apply INT_TO_FRAC to fraction children

### 3. Fraction + Integer Expression (WORKS FOR INTEGER)
- Input: `\frac{2}{3}+5`
- The "5" can be targeted with path `term[1]`
- The fraction children 2 and 3 are NOT targetable

---

## Test Commands

```bash
# Backend tests
cd D:\G\backend-api-v1.http-server
pnpm vitest run tests/int-to-frac-direct.test.ts

# Manual browser test
# 1. Open http://localhost:4002/debug-tool.html
# 2. Enter: 2+3-1-1
# 3. Click AST Debug
# 4. Click each integer → verify path shows correctly
# 5. Click Force Apply INT_TO_FRAC → verify step-applied
```

---

## Known Limitations

1. **Fraction children not targetable**: Backend AST design stores numerator/denominator as strings
2. **Integers inside parentheses**: Depends on how the viewer parser handles them
3. **Mixed numbers**: Same limitation as fractions

## Future Work
- Extend backend AST to represent fraction children as nodes (breaking change)
- Or implement special path syntax like `root.num` → resolve to string value and create synthetic integer node

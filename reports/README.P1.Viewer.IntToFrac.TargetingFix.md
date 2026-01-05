# P1 Viewer INT_TO_FRAC Targeting Fix

## Summary
Fixed order-dependent double-click bug in viewer where INT_TO_FRAC would sometimes apply to the wrong integer or fail silently.

---

## Root Cause

The bug occurred because:

1. **Stale state fallback**: On double-click, the code used `astId || integerCycleState.astNodeId` as fallback. If clicking a NEW integer without prior selection, the `integerCycleState.astNodeId` contained a stale value from a previously selected integer.

2. **State not updated before apply**: The selection state (`integerCycleState.selectedNodeId`, `integerCycleState.astNodeId`) wasn't updated to match the clicked node BEFORE calling `applyP1Action`, causing a mismatch between the visual highlight and the actual apply target.

3. **No validation before backend call**: Missing validation allowed apply attempts with undefined/null selectionPath.

---

## Changes Made

### [main.js](file:///D:/G/viewer/app/main.js)

#### P1 Click Handler (lines ~1403-1580)
- Added **non-targetable detection**: Checks if `astId.startsWith('NON_TARGETABLE:')` and shows alert
- Added **TraceHub event** `VIEWER_INTEGER_CLICK_TARGETED` on every integer click
- Added **validation before apply**: Aborts with alert if no valid `astNodeId`
- **Fixed state update timing**: Now updates `integerCycleState.selectedNodeId` and `integerCycleState.astNodeId` BEFORE calling `applyP1Action`
- **Fixed timing-based double-click**: Uses stored `integerCycleState.astNodeId` which was set on the first click

#### New Test Helper (lines ~257-350)
- Added `runP1OrderTest(order)` function for deterministic order-independence testing
- Usage: `window.runP1OrderTest()` or `window.runP1OrderTest("right-to-left")`

---

## Modified Files

| File | Changes |
|------|---------|
| `D:\G\viewer\app\main.js` | Fixed P1 click handler, added TraceHub event, added order test helper |

---

## TraceHub Events Added

### VIEWER_INTEGER_CLICK_TARGETED
Emitted on every integer click with:
```json
{
  "latex": "2+3-1-1",
  "surfaceNodeId": "num-1",
  "value": "2",
  "selectionPath": "term[0].term[0].term[0]",
  "clickCount": 1
}
```

### VIEWER_HINT_APPLY_REQUEST / VIEWER_HINT_APPLY_RESPONSE
(Added in previous session, already present)

---

## Error Handling

### Non-Targetable Paths (Fraction Children)
If user clicks on an integer inside a simple fraction like `\frac{2}{3}`:
- Shows alert: "This number is inside a simple fraction and cannot be targeted individually (backend limitation)."
- Updates diagnostics with `lastHintApplyStatus: "blocked"`
- Click processing is aborted safely

### Missing Selection Path
If double-click lacks valid astNodeId:
- Shows alert: "Cannot apply: no valid selection path for this integer."
- Aborts without calling backend

---

## Manual Verification Steps

### Test 1: Order Independence (Left-to-Right)
1. Open http://localhost:4002/
2. Enter `2+3-1-1` in the formula input
3. Click integer "2" → should highlight green
4. Double-click "2" → should become `\frac{2}{1}+3-1-1`
5. Repeat for "3", then both "1"s
6. Each should convert independently

### Test 2: Order Independence (Right-to-Left)
1. Repeat test 1 but start from the rightmost "1"
2. Each integer should still convert to the correct fraction

### Test 3: Console Test Helper
```javascript
await window.runP1OrderTest("left-to-right")
await window.runP1OrderTest("right-to-left")
```
Both should report `passed: true`

### Test 4: Fraction Child Safe Fail
1. Enter `\frac{2}{3}` in formula
2. Click on numerator "2"
3. Should see alert about non-targetable integers

---

## Before/After Comparison

### Before Fix
- Clicking "2" then "3" then double-click: might apply to wrong integer
- `integerCycleState.astNodeId` could be stale from previous session
- No error message for invalid paths

### After Fix
- Double-click always uses the correct `astNodeId` from the clicked surface node
- State is updated before apply to ensure visual highlight matches target
- Clear error messages for edge cases
- TraceHub events for debugging

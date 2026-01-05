# BUG REPORT: Viewer Step2 BLUE Hint Asymmetry
**Generated:** 2025-12-17T12:30 EST  
**Status:** ✅ FIXED

---

## Summary

**Root Cause (one paragraph):**  
The Viewer used a **global singleton** `integerCycleState` (lines 100-118) to track the current hint mode for ALL integers. When the user clicked the left "1" token, then the right "1" token, the same global state object was overwritten—causing the BLUE mode to "migrate" from one token to the other instead of persisting independently. Both "1" tokens had different `stableKey` values (`term[0].term[1]|number|` vs `term[1].term[1]|number|`) but shared the same mode storage.

**Fix (one paragraph):**  
Added a `perTokenModeMap` (Map keyed by `stableKey`) to store per-token hint mode state. When switching to a different token, `saveTokenModeState()` saves the outgoing token's mode, and `restoreTokenModeState(stableKey)` restores the incoming token's mode. On expression change, `clearAllTokenModeState()` resets all stored modes. This ensures left and right "1" tokens maintain independent GREEN/BLUE mode cycling.

---

## Files Changed

| File | Lines Changed | Description |
|------|---------------|-------------|
| `D:\G\viewer\app\main.js` | +40 | Added `perTokenModeMap`, `saveTokenModeState()`, `restoreTokenModeState()`, `clearAllTokenModeState()` |
| `D:\G\viewer\app\main.js` | ~20 | Updated `resetIntegerCycleState()` to call `clearAllTokenModeState()` |
| `D:\G\viewer\app\main.js` | ~25 | Updated click handler to save/restore token mode on token switch and after cycling |

---

## Evidence Logs

### Before Fix (Console)
```
[CYCLE] stableKey=term[0].term[1]|number| mode 0->2 (BLUE) isStep2=true
// Click right "1"
[CYCLE] stableKey=term[1].term[1]|number| mode 0 (GREEN) isStep2=true
// Click left "1" again
[CYCLE] stableKey=term[0].term[1]|number| mode 0 (GREEN) isStep2=true  // LOST BLUE!
```

### After Fix (Console)
```
[STEP2-BLUE-TRACE] Saved mode=2 for stableKey="term[0].term[1]|number|"
[STEP2-BLUE-TRACE] Restored mode=0 for stableKey="term[1].term[1]|number|"
// After switching back to left "1":
[STEP2-BLUE-TRACE] Saved mode=0 for stableKey="term[1].term[1]|number|"
[STEP2-BLUE-TRACE] Restored mode=2 for stableKey="term[0].term[1]|number|"
// Left "1" retains BLUE mode!
```

---

## How to Verify Manually

### Before Fix (Bug Present)
1. Start Viewer at `http://localhost:4002`
2. Load expression: `\frac{1}{2} + \frac{1}{3}`
3. Click the `+` operator to trigger Step1 → Result: `\frac{1}{2} \cdot 1 + \frac{1}{3} \cdot 1`
4. Click left "1" once → GREEN selected
5. Click left "1" again → Cycles to BLUE (target 3/3)
6. Click right "1" → Switches to right, GREEN mode
7. Click back on left "1" → **BUG: Shows GREEN, BLUE mode is LOST**

### After Fix (Expected Behavior)
1-6. Same as above
7. Click back on left "1" → **FIXED: Shows BLUE mode (retained)**
8. Double-click left "1" in BLUE → Applies Step2, result: `\frac{1}{2} \cdot \frac{3}{3} + \frac{1}{3} \cdot 1`
9. Both left and right "1" independently cycle GREEN ↔ BLUE

---

## Key Code Changes

### New: Per-Token Mode Storage
```javascript
const perTokenModeMap = new Map();

function saveTokenModeState() {
  const key = integerCycleState.stableKey;
  if (!key) return;
  perTokenModeMap.set(key, {
    mode: integerCycleState.mode,
    isStep2Context: integerCycleState.isStep2Context,
    step2Info: integerCycleState.step2Info ? { ...integerCycleState.step2Info } : null
  });
}

function restoreTokenModeState(stableKey) {
  if (!stableKey || !perTokenModeMap.has(stableKey)) {
    return { mode: MODE_GREEN, isStep2Context: false, step2Info: null };
  }
  return perTokenModeMap.get(stableKey);
}

function clearAllTokenModeState() {
  perTokenModeMap.clear();
}
```

### Updated: Click Handler Token Switch
```diff
} else {
-  // Different token - select it with mode 0 (GREEN)
+  // Different token - save current token's state first, then switch
+  saveTokenModeState();
+  const restored = restoreTokenModeState(clickStableKey);
   integerCycleState.stableKey = clickStableKey;
-  integerCycleState.mode = MODE_GREEN;
+  integerCycleState.mode = restored.mode;
```

---

**Report End**

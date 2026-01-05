# BUG REPORT: Viewer Step2 Post-Apply Cycle Policy
**Generated:** 2025-12-17T12:35 EST  
**Status:** ✅ FIXED

---

## Summary

**Root Cause (one paragraph):**  
After Step2 was applied on one "1" token (e.g., left side), the remaining "1" (right side) incorrectly switched from GREEN↔BLUE cycle to GREEN↔ORANGE cycle. This happened because: (1) `detectStep2MultiplierContext()` used a regex that required BOTH sides to have `\cdot 1`, but after Step2 apply one side becomes `\cdot \frac{d}{d}`, breaking the match; (2) `resetIntegerCycleState()` called `clearAllTokenModeState()` which wiped per-token saved state; (3) Token switch handler used saved `isStep2Context` without revalidating against current expression.

**Fix (one paragraph):**  
Three changes: (1) Extended `detectStep2MultiplierContext()` with additional regex patterns to match partial expressions where one side has already been converted; (2) Removed `clearAllTokenModeState()` from `resetIntegerCycleState()` so token modes persist across expression changes; (3) Updated token switch handler to ALWAYS revalidate Step2 context and validate the restored mode (fallback to GREEN if BLUE is no longer valid, or if ORANGE is restored for a Step2 token).

---

## Files Changed

| File | Changes |
|------|---------|
| `D:\G\viewer\app\main.js` | Updated `detectStep2MultiplierContext()` with partial expression patterns |
| `D:\G\viewer\app\main.js` | Removed `clearAllTokenModeState()` from `resetIntegerCycleState()` |
| `D:\G\viewer\app\main.js` | Updated token switch handler to revalidate Step2 context and validate mode |

---

## How to Verify

### Before Fix (Bug Present)
1. Start Viewer at `http://localhost:4002`
2. Load: `\frac{1}{2} + \frac{1}{3}`
3. Click `+` → Result: `\frac{1}{2}\cdot 1 + \frac{1}{3}\cdot 1`
4. Click left "1" twice → BLUE (3/3)
5. Click right "1" twice → BLUE (2/2)
6. Double-click left "1" while BLUE → APPLY → `\frac{1}{2}\cdot \frac{3}{3} + \frac{1}{3}\cdot 1`
7. Click right "1" → **BUG: Shows GREEN→ORANGE cycle (Step2 lost)**

### After Fix (Expected)
Steps 1-6 same as above
7. Click right "1" → **FIXED: Shows GREEN→BLUE cycle (Step2 still valid)**
8. Click right "1" again → BLUE (shows "Convert 1 → 2/2")
9. Double-click right "1" → APPLY → `\frac{1}{2}\cdot \frac{3}{3} + \frac{1}{3}\cdot \frac{2}{2}`

---

## Debug Flag

Enable verbose logging for Step2 cycle debugging:
```javascript
window.__debugStep2Cycle = true
```

Example log output:
```
[STEP2-CYCLE] stableKey=term[1].term[1]|number| hasStep2=true allowedModes=[GREEN,BLUE] restoredMode=2 validatedMode=2
[STEP2-CYCLE] detectStep2MultiplierContext: astNodeId=term[1].term[1], side=right, oppositeDenom=2, matchType=leftApplied
```

---

## Key Code Changes

### Extended `detectStep2MultiplierContext()` Patterns
```javascript
// Pattern 1: Both sides have ·1 (original)
const fullPattern = /\\frac{...}\\cdot\s*1...\s*\\frac{...}\\cdot\s*1/;
// Pattern 2: Left side has ·frac, right side has ·1 (left already applied)
const leftAppliedPattern = /\\frac{...}\\cdot\s*\\frac{...}...\s*\\frac{...}\\cdot\s*1/;
// Pattern 3: Left side has ·1, right side has ·frac (right already applied)
const rightAppliedPattern = /\\frac{...}\\cdot\s*1...\s*\\frac{...}\\cdot\s*\\frac{...}/;
```

### Mode Validation on Token Switch
```javascript
// Validate restored mode: if BLUE but Step2 no longer available, fallback to GREEN
if (restored.mode === MODE_BLUE && !step2Ctx.isStep2Context) {
  validatedMode = MODE_GREEN;
}
// If Step2 token had ORANGE saved (shouldn't happen), fallback to GREEN
if (validatedMode === MODE_ORANGE && step2Ctx.isStep2Context) {
  validatedMode = MODE_GREEN;
}
```

---

**Report End**

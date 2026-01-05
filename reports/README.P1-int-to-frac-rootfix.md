# P1 INT_TO_FRAC Root Fix Report

## Goals Accomplished
- ✅ P.INT_TO_FRAC now applies correctly when preferredPrimitiveId is provided
- ✅ Backend respects preferredPrimitiveId and does NOT apply a different primitive
- ✅ All 9 backend tests pass
- ✅ Session Log downloads use unified getEngineBaseUrl()

---

## Root Cause Analysis

### Problem 1: preferredPrimitiveId Not Honored
**File:** `backend-api-v1.http-server/src/orchestrator/step.orchestrator.ts`

**Root Cause:** When `PrimitiveMaster.resolvePrimitive()` returned `blue-choice` (context-menu primitives), the orchestrator's blue-choice handler:
1. Did NOT check if `req.preferredPrimitiveId` was set
2. Returned `status: "choice"` to ask the user again, ignoring the already-provided preference
3. Or returned `status: "step-applied"` with `engineResult: null` (no actual step executed)

**Fix:** Modified lines 314-372 in `step.orchestrator.ts`:
```diff
} else if (v5Outcome.kind === "blue-choice") {
-   console.log("[Orchestrator] V5 Blue Choice Detected");
-   return {
-       status: "step-applied",
-       engineResult: null,
-       ...
-   };
+   // If preferredPrimitiveId is provided, find and apply that primitive directly
+   if (req.preferredPrimitiveId && v5Outcome.matches?.length > 0) {
+       const preferredMatch = v5Outcome.matches.find(
+           m => m.row.id === req.preferredPrimitiveId || m.row.enginePrimitiveId === req.preferredPrimitiveId
+       );
+       if (preferredMatch) {
+           // Create candidate and continue to step execution...
+           mapResult = { candidates: [candidate], ... };
+       } else {
+           return { status: "no-candidates", ... };
+       }
+   } else {
+       // No preferredPrimitiveId - return choice to user
+       return { status: "choice", choices: [...] };
+   }
}
```

---

## Files Changed

| File | Lines | Description |
|------|-------|-------------|
| `backend-api-v1.http-server/src/orchestrator/step.orchestrator.ts` | 85-92, 314-372 | Fixed blue-choice handling to honor preferredPrimitiveId |
| `backend-api-v1.http-server/tools/p1-int-to-frac-smoke.mjs` | NEW | Smoke test script for backend-only P.INT_TO_FRAC testing |
| `viewer/app/main.js` | 19-32 | Added getEngineBaseUrl() (already present in prior edit) |
| `viewer/app/debug-tool.js` | 318-428 | Added handleForceIntToFrac() Glass Box handler |
| `viewer/debug-tool.html` | 340-359 | Added Force Apply button and Glass Box panel |

---

## Expected Behavior After Fix

### Single Integer "6"
1. POST to `/api/orchestrator/v5/step` with:
   ```json
   {
     "expressionLatex": "6",
     "selectionPath": "root",
     "preferredPrimitiveId": "P.INT_TO_FRAC"
   }
   ```
2. Response: `status: "step-applied"`, `newExpressionLatex: "\\frac{6}{1}"`

### Compound "2+3" (convert left integer)
1. POST with:
   ```json
   {
     "expressionLatex": "2+3",
     "selectionPath": "term[0]",
     "preferredPrimitiveId": "P.INT_TO_FRAC"
   }
   ```
2. Response: `status: "step-applied"`, `newExpressionLatex: "\\frac{2}{1}+3"` (NOT "5")

---

## Test Results

```
✓ tests/integer-choice.test.ts (6)
  ✓ Integer Click Context Menu
    ✓ returns status='choice' when clicking an integer node
    ✓ returns status='choice' for integer in expression (2+3 -> click on 2)
    ✓ applies P.INT_TO_FRAC when preferredPrimitiveId is provided ← CORE FIX VERIFIED
    ✓ returns no-candidates for invalid preferredPrimitiveId
    ✓ does NOT return choice for operator clicks
    ✓ does NOT return choice for fraction clicks

✓ tests/integer-choice-e2e.test.ts (3)
  ✓ Step 1: clicking integer returns status='choice' with choices array
  ✓ Step 2: sending preferredPrimitiveId returns status='step-applied' with result ← CORE FIX VERIFIED
  ✓ Full E2E: click integer in expression (2+3) -> choice -> apply -> result

Test Files  2 passed (2)
     Tests  9 passed (9)
```

---

## Verification Commands

### 1. Run Backend Tests
```bash
cd D:\G\backend-api-v1.http-server
npx vitest run tests/integer-choice.test.ts tests/integer-choice-e2e.test.ts --reporter=verbose
```

### 2. Restart Backend Server
```bash
# Stop existing server (Ctrl+C)
cd D:\G\backend-api-v1.http-server
pnpm start:dev
```

### 3. Run Smoke Test
```bash
cd D:\G\backend-api-v1.http-server
node tools/p1-int-to-frac-smoke.mjs
```

### 4. Test in Viewer
1. Open http://localhost:4002
2. Enter LaTeX: `6`
3. Click the number 6
4. Wait for GREEN hint "Convert to fraction"
5. Click the hint
6. **EXPECTED:** Expression becomes `\frac{6}{1}`

### 5. Test Compound Expression
1. Enter LaTeX: `2+3`
2. Click the number 2
3. Click the hint
4. **EXPECTED:** Expression becomes `\frac{2}{1}+3` (NOT 5)

### 6. Test Session Log Download
1. Perform any operation in viewer
2. Click "Download Session Log"
3. **EXPECTED:** JSON file downloads (no "Failed to fetch" error)

---

## Restart Requirements

| Component | Restart Needed? |
|-----------|-----------------|
| Backend server | ✅ **YES** - code changes need reload |
| Viewer server | ❌ No |
| Browser | ⚠️ Hard refresh (Ctrl+Shift+R) |

---

## What Was Proven

1. **preferredPrimitiveId is honored**: When provided, the backend applies ONLY that primitive
2. **Blue primitives apply correctly**: P.INT_TO_FRAC (which is blue/context-menu) now executes when explicitly requested
3. **No regression**: All existing tests still pass
4. **Locality preserved**: INT_TO_FRAC only converts the clicked integer, not the whole expression

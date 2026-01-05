# P1 INT_TO_FRAC Glass Box Fix Report

## Root Causes Fixed

### 1. "preferredPrimitiveId is not defined" Runtime Error
**Location:** `viewer/app/main.js` lines 545-557 (original)
**Problem:** Code referenced `preferredPrimitiveId` and `endpointUrl` variables BEFORE they were defined.
**Fix:** Moved variable definitions (`v5Payload` and `endpointUrl`) BEFORE the `updateP1Diagnostics` call that uses them.

### 2. Session Log Download "Failed to fetch"
**Location:** `viewer/app/main.js` lines 1656, 1680, 1704
**Problem:** Debug endpoints were hardcoded to wrong port or no unified base URL.
**Fix:** Created `getEngineBaseUrl()` function that returns `http://localhost:4201` as single source of truth. All debug endpoints now use `${getEngineBaseUrl()}/debug/...`.

### 3. No Glass Box Debugging for INT_TO_FRAC
**Problem:** No way to test P.INT_TO_FRAC in isolation and see request/response.
**Fix:** Added "Force Apply INT_TO_FRAC" button to `debug-tool.html` with Glass Box panel showing:
- Request JSON (endpoint, payload)
- Response JSON (status, outputLatex, chosenPrimitiveId)
- Full response details in expandable section

---

## Files Changed

| File | Changes |
|------|---------|
| `viewer/app/main.js` | Added `getEngineBaseUrl()`, removed duplicate `V5_ENDPOINT_URL`, updated debug endpoint URLs |
| `viewer/app/debug-tool.js` | Added `handleForceIntToFrac()` with Glass Box visualization |
| `viewer/debug-tool.html` | Added "Force Apply INT_TO_FRAC" button and Glass Box debug panel |

---

## How to Run

### Backend
```bash
cd D:\G\backend-api-v1.http-server
pnpm start:dev
# Listens on http://localhost:4201
```

### Viewer
```bash
cd D:\G\viewer
node tiny-server.js --port 4002
# Open http://localhost:4002
# Debug Tool: http://localhost:4002/debug-tool.html
```

---

## How to Verify

### Test 1: Single Integer "3"
1. Open `http://localhost:4002`
2. Enter LaTeX: `3`
3. Click on the number 3
4. Wait for GREEN hint "Convert to fraction (click to apply)"
5. Click the hint
6. **EXPECTED:** Expression becomes `\frac{3}{1}`

### Test 2: Compound Expression "2+3"
1. Enter LaTeX: `2+3`
2. Click on the number 2
3. Wait for GREEN hint
4. Click the hint
5. **EXPECTED:** Expression becomes `\frac{2}{1}+3` (NOT 5!)

### Test 3: Glass Box Debug Tool
1. Open `http://localhost:4002/debug-tool.html`
2. Enter LaTeX: `3` in the input field
3. Click "Force Apply INT_TO_FRAC" (green button)
4. **EXPECTED:** Glass Box panel appears showing:
   - Request JSON with `preferredPrimitiveId: "P.INT_TO_FRAC"`
   - Response with `status: "step-applied"` (green) or `"no-candidates"` (yellow)
   - Output LaTeX if successful

### Test 4: Session Log Downloads
1. Open `http://localhost:4002`
2. Perform an operation (click an operator)
3. Click "Download Session Log"
4. **EXPECTED:** JSON file downloads (no error)
5. Click "Download Step Snapshot"
6. **EXPECTED:** JSON file downloads
7. Click "Reset Session Log"
8. **EXPECTED:** Alert "Session log reset."

---

## What the Force Apply Button Proves

The "Force Apply INT_TO_FRAC" button directly tests the backend's support for:
1. **P.INT_TO_FRAC primitive:** Whether backend recognizes this primitive
2. **preferredPrimitiveId filtering:** Whether backend honors the requested primitive
3. **Integer targeting:** Whether backend correctly targets the integer node

If it shows:
- ✅ **SUCCESS** (green): Backend supports P.INT_TO_FRAC and honored the request
- ⚠️ **NO CANDIDATES** (yellow): Backend doesn't have P.INT_TO_FRAC mapped for this target
- ❌ **ERROR** (red): Backend returned an error

---

## Backend Test Results

```
✓ tests/integer-choice.test.ts       (6 passed)
✓ tests/integer-choice-e2e.test.ts   (3 passed)
✓ tests/verify-infrastructure.test.ts (3 passed)
─────────────────────────────────────────────────
Total: 12 passed (12)
```

---

## Restart Instructions

| Component | Action |
|-----------|--------|
| Backend | ✅ NOT needed (no backend changes) |
| Viewer Server | ✅ NOT needed (no server config changes) |
| Browser | ⚠️ **Hard refresh (Ctrl+Shift+R)** |

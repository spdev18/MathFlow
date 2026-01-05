# Debug Tool: Force Apply INT_TO_FRAC Targeting Fix

## Problem
In debug-tool.html, "Force Apply INT_TO_FRAC" was sending `selectionPath="root"` for all expressions, causing `engine-error` when the root is not an integer (e.g., for `2+3` the root is a binaryOp).

## Solution
Implemented click-based targeting: user clicks an integer in the rendered preview, and that specific integer's AST path is used.

## Files Changed

### 1. `D:\G\viewer\debug-tool.html`
- Added target tracking display UI showing:
  - `selectionPath` - the AST path that will be sent to backend
  - `kind` - integer, decimal, or other
  - `surfaceNodeId` - DOM element ID
  - `value` - the clicked number value

### 2. `D:\G\viewer\app\debug-tool.js`
- Updated `lastClickedIntegerTarget` state to include `selectionPath`, `kind`, `surfaceNodeId`, `latexFragment`
- Rewrote `handleMathPreviewClick()` to:
  - Detect integers and decimals
  - Find matching AST path via `findNumberPathByValue()`
  - Update UI display via `updateTargetInfoDisplay()`
  - Show visual feedback (green outline for integers)
- Rewrote `findNumberPathByValue()` to use BFS for leftmost match
- Added `updateTargetInfoDisplay()` to update UI elements
- Updated `handleForceIntToFrac()` to:
  - Use `selectionPath` instead of `astNodeId`
  - Validate target kind is integer
  - Show clear error messages for non-integer targets

## Verification Steps

1. **Start servers:**
   - Backend: `http://localhost:4201`
   - Viewer: `http://localhost:4002`

2. **Open debug tool:**
   - Navigate to `http://localhost:4002/debug-tool.html`

3. **Test "2+3":**
   - Enter `2+3` in LaTeX input
   - Click "AST Debug" to load the AST
   - Click on "2" in the preview
   - Verify UI shows: `selectionPath: term[0]`, `kind: integer`, `value: 2`
   - Click "Force Apply INT_TO_FRAC"
   - Verify request shows `selectionPath: "term[0"` (NOT "root")

4. **Test fraction numerator/denominator:**
   - Enter `\frac{1}{7}+\frac{3}{7}`
   - Click "AST Debug"
   - Click on "1", "7", or "3" in preview
   - Verify UI updates with correct path

5. **Test error case:**
   - If you click on an operator or non-number, the target remains unchanged
   - The system keeps tracking until you click a valid number

## Expected Behavior
- Clicking integers updates the target display
- Force Apply uses the clicked target's path, not "root"
- Even if backend still fails for other reasons, the request target is correct

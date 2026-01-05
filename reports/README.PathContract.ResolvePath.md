# Path Contract: AST Resolve-Path Endpoint

## Summary
Added a debug endpoint to resolve selectionPath against AST and observe the backend's path resolution behavior.

## Endpoint Specification

### POST /debug/ast/resolve-path

**Request:**
```json
{
  "latex": "2+3",
  "selectionPath": "term[0]"
}
```

**Successful Response:**
```json
{
  "ok": true,
  "selectionPath": "term[0]",
  "resolvedType": "integer",
  "resolvedKind": "integer",
  "value": "2",
  "latexFragment": "2",
  "nodeKeys": ["type", "value"]
}
```

**Error Response (path not found):**
```json
{
  "ok": false,
  "error": "path-not-found",
  "message": "Path 'term[5]' not found in AST",
  "latex": "2+3",
  "selectionPath": "term[5]",
  "astRootType": "binaryOp"
}
```

---

## Files Changed

### Backend
- **[engineHttpServer.ts](file:///D:/G/backend-api-v1.http-server/src/server/engineHttpServer.ts)** - Added POST /debug/ast/resolve-path endpoint

### Viewer
- **[debug-tool.html](file:///D:/G/viewer/debug-tool.html)** - Added "Resolve Path" button
- **[debug-tool.js](file:///D:/G/viewer/app/debug-tool.js)** - Added handleResolvePath function

---

## Canonical Path Format

Backend uses these path formats (from `getNodeAt` function):

| Expression | Node | Path |
|------------|------|------|
| `2+3` | left operand (2) | `term[0]` |
| `2+3` | right operand (3) | `term[1]` |
| `2+3` | root operator | `root` |
| `\frac{a}{b}+c` | fraction | `term[0]` |
| `\frac{a}{b}+c` | c | `term[1]` |

**Note:** The viewer's `findNumberPathByValue()` generates paths in `term[N]` format which should match the backend's `getNodeAt()` resolution.

---

## Verification Steps

After restarting the backend server:

1. **Test "2+3" with term[0]:**
```bash
curl -X POST http://localhost:4201/debug/ast/resolve-path \
  -H "Content-Type: application/json" \
  -d '{"latex": "2+3", "selectionPath": "term[0]"}'
```
Expected: `ok: true, value: "2", resolvedType: "integer"`

2. **Test "2+3" with term[1]:**
```bash
curl -X POST http://localhost:4201/debug/ast/resolve-path \
  -H "Content-Type: application/json" \
  -d '{"latex": "2+3", "selectionPath": "term[1]"}'
```
Expected: `ok: true, value: "3", resolvedType: "integer"`

3. **Via Debug Tool:**
   - Go to http://localhost:4002/debug-tool.html
   - Enter "2+3", click AST Debug
   - Click on "2" in preview
   - Click "Resolve Path" button
   - Verify glassbox shows the resolution result

---

## Known Issues / Next Steps

1. **Server restart required** - Backend must be rebuilt/restarted for new endpoint
2. **Path mismatch investigation** - If resolve-path shows path is valid but Force Apply fails, issue is in StepMaster/candidate selection
3. **TraceHub events** - Need to add DECISION and RUN_END events to preferredPrimitiveId flow (partially implemented)

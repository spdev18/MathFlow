# MapMaster Module Boundaries

## Overview

MapMaster is the core "map engine" for the math trainer. It provides the logic for analyzing mathematical expressions, identifying possible steps (candidates), and validating transformations.

The **Global Map Builder** is a debug/analysis layer built on top of MapMaster. It traverses an entire expression to build a comprehensive map of all possible operations for every operator.

The **Dev Tool** (`viewer/debug-tool.html`) is a standalone, developer-facing utility that visualizes the internal state of MapMaster, the AST, and the Global Map. It communicates exclusively with dedicated **debug endpoints**.

The **Student-Facing Flow** (the main application) interacts with the engine via the standard entry-step API and **must not** access debug endpoints.

## Layers and Responsibilities

### 1. MapMaster Core
- **Location:** `backend-api-v1.http-server/src/mapmaster/*.ts` (excluding HTTP handlers)
- **Responsibilities:**
    - Parse expressions into AST (`ast.ts`).
    - Compute local MapMaster candidates (`mapmaster.core.ts`).
    - Run invariants and rules (`mapmaster.rules.*.ts`).
    - Produce debug pipelines (`mapmaster.debug.ts`).
    - Compute global maps (`mapmaster.global-map.ts`).
- **Constraint:** **No HTTP, no UI, no knowledge of endpoints.** This layer is pure domain logic.

### 2. Debug HTTP Layer
- **Location:** `backend-api-v1.http-server/src/server/HandlerPost*Debug.ts` and `HandlerPostMapMasterGlobalMap.ts`
- **Responsibilities:**
    - Wrap MapMaster and Global Map logic for external inspection.
    - Expose debug endpoints:
        - `/api/ast-debug`
        - `/api/mapmaster-debug`
        - `/api/step-debug`
        - `/api/mapmaster-global-map`
- **Constraint:** **Debug endpoints are never called from the student-viewer flow.** They are for tools and analysis only.

### 3. Dev Tool (Debug Viewer)
- **Location:** `viewer/debug-tool.html` and `viewer/app/debug-tool.js`
- **Responsibilities:**
    - Provide a browser-based visualization of the AST, MapMaster pipeline, StepMaster decisions, and Global Map.
    - Call **only debug endpoints** under `DEBUG_API_BASE` (port 4201).
    - Be safe to remove in production builds if needed.
- **Constraint:** **Dev Tool is a client of debug endpoints only, not part of the student UI.** It does not participate in the actual learning session state.

### 4. Student-Facing Flow
- **Location:** `viewer/app/main.js`, `viewer/app/engine-adapter.js` (and related files)
- **Responsibilities:**
    - Manage the interactive student session.
    - Call `/api/entry-step` (and `/api/undo-step`, `/api/hint-request`) to progress through problems.
- **Constraint:** **Student-facing code must not call debug endpoints.** It should rely solely on the standard engine API.

## Allowed Dependencies and Forbidden Shortcuts

| Component | Allowed Calls | Forbidden Calls |
| :--- | :--- | :--- |
| **Student Viewer** | `/api/entry-step`, `/api/undo-step` | `/api/ast-debug`, `/api/mapmaster-debug`, `/api/step-debug`, `/api/mapmaster-global-map` |
| **Dev Tool** | `/api/ast-debug`, `/api/mapmaster-debug`, `/api/step-debug`, `/api/mapmaster-global-map` | `/api/entry-step` (for internal debug features) |
| **Debug Handlers** | MapMaster Core, Global Map Builder | - |
| **MapMaster Core** | - | Any HTTP or Viewer code |

### Examples

**Good Usage (Dev Tool):**
```javascript
// viewer/app/debug-tool.js
async function callGlobalMapDebug(req) {
    // Correct: Calling a debug endpoint from the Dev Tool
    const res = await fetch(`${DEBUG_API_BASE}/api/mapmaster-global-map`, ...);
    return res.json();
}
```

**Bad Usage (Student Viewer):**
```javascript
// viewer/app/engine-adapter.js
async function applyStep(latex) {
    // WRONG: Student viewer should not call debug endpoints
    // await fetch('/api/mapmaster-debug', ...); 
    
    // Correct: Use the standard entry-step API
    return await fetch('/api/entry-step', ...);
}
```

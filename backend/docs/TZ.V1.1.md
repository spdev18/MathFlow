# TzV1.1 — Minimal Backend for Motor Step Orchestrator

**Version:** 1.1.0  
**Name:** `TzV1.1 – Minimal Backend Architecture for Motor (Orchestrator-based)`  
**Scope:** Minimal but extensible backend for one-step expression transformation (“EntryStep”) in the Motor application.

> This version 1.1 clarifies session/history behavior, active invariant sets, path semantics, error handling, configuration, and testing expectations, and adds a worked example of a learning session.

---

## 1. Goals and Scope

### 1.1. Primary goals

1. Provide a **full step pipeline**:

   - Input: student action from Display (expression + selection).
   - Backend: generation of candidates, step decision, call to NGIN, history update.
   - Output: new expression and status back to Display.

2. Keep the backend **modular and extensible**:

   - invariants and primitives described as **data (course model)**, not hard-coded logic;
   - six focused **library modules** with clear responsibilities;
   - a single **Step Orchestrator** module that coordinates these libraries.

3. Keep **v1 simple**:

   - one HTTP endpoint;
   - one course (one invariant model) loaded from a course file;
   - a single basic policy for student mode;
   - minimal but clean step history (per request).

### 1.2. Out of scope for TzV1 (deferred to TzV2+)

- Advanced teacher modes and analytics dashboards.
- Multi-course selection and runtime course switching.
- Sophisticated hinting / scaffolding flows (multi-step tutoring).
- Extended statistics, reporting, and exports.
- Authentication, multi-tenant infrastructure, user roles.

---

## 2. High-level Data Flow

### 2.1. Request path (Display → Orchestrator → NGIN → Display)

1. **Expression Viewer (frontend)**  
   Student interacts with the expression (clicks, selects, presses “make step”).  
   The frontend forms an `EntryStepRequest` (JSON).

2. **Display Adapter & HTTP Client (frontend)**  
   Sends `POST /api/entry-step` with `EntryStepRequest` to the backend.

3. **Engine HTTP Server (backend)**  
   Receives the HTTP request and routes it to `HandlerPostEntryStep`.

4. **HandlerPostEntryStep (backend)**  
   - Deserializes `EntryStepRequest`.  
   - Builds a domain-level `OrchestratorStepRequest`.  
   - Calls the **Step Orchestrator**.

5. **Step Orchestrator (backend)**  
   - Uses the six library modules:
     - Invariants Model & Registry,
     - MapMaster Core,
     - StepMaster Core,
     - Step History Service,
     - Step Policies,
     - Engine Bridge.
   - Coordinates the step:
     - builds candidates,
     - decides which step to run,
     - calls NGIN via Engine Bridge,
     - updates history (per-request),
     - produces `OrchestratorStepResult`.

6. **HandlerPostEntryStep**  
   Transforms `OrchestratorStepResult` → `EngineStepResponse` (JSON) and returns HTTP 200.

7. **Display Adapter & Viewer**  
   Receives `EngineStepResponse`, updates visual state (expression, highlights, hints).

### 2.2. ASCII data flow diagram

```text
Student → Display → HTTP POST /api/entry-step
                        │
                        ▼
               HandlerPostEntryStep
                        │
                        ▼
                 Step Orchestrator
                 /    │       │
                /     │       │
        Invariants  MapMaster  StepMaster
             │          │           │
             │          │           ▼
             │       Candidates   Decision
             │          │           │
             ▼          │           │
          Registry   History ◀──────┘
                        │
                        ▼
                  Engine Bridge
                        │
                        ▼
                       NGIN
                        │
                        ▼
             OrchestratorStepResult
                        │
                        ▼
               EngineStepResponse → Display
```

---

## 3. Module Types

### 3.1. Library modules (pure, no HTTP/UI)

1. **Invariants Model & Registry**  
2. **MapMaster Core**  
3. **StepMaster Core**  
4. **Step History Service**  
5. **Step Policies**  
6. **Engine Bridge**  

### 3.2. Dependent / orchestration modules

7. **Step Orchestrator** (core orchestration module).  
8. **Engine HTTP Server** (transport + routing).  
9. **HandlerPostEntryStep** (HTTP ↔ orchestrator adapter).  
10. **Invariant Course Loader** (loads invariant model and registry from a course file).  
11. **Minimal Logging / Error Handling**.

---

## 4. Invariants Model & Registry

> This module is already implemented in the current codebase; TzV1.1 fixes how it is used and loaded.

### 4.1. Responsibilities

- Represent a **course** as a set of:
  - **primitives** (atomic transformation operations), and
  - **invariant rules** grouped into **invariant sets**.
- Validate the invariant model (shape, required fields, cross references).
- Provide **fast lookup** APIs: by primitive id, invariant rule id, invariant set id, and reverse mapping (rules by primitive id).

### 4.2. Core types (TypeScript)

- `PrimitiveDefinition`  
- `InvariantRuleDefinition`  
- `InvariantSetDefinition`  
- `InvariantModelDefinition`  

- `InvariantModelIssue`  
- `InvariantModelValidationResult`  

- `validateInvariantModel(input: unknown): InvariantModelValidationResult`  
- `InMemoryInvariantRegistry`

### 4.3. Validation contract

`validateInvariantModel(input)` must:

- check that root is an object with `primitives` and `invariantSets` arrays;
- validate every primitive, rule, and set:
  - strings are non-empty where required;
  - arrays are actually arrays;
- detect and report:
  - duplicate primitive ids,
  - duplicate invariant set ids,
  - duplicate rule ids within a given set,
  - invalid field types (tags must be string[], etc.),
  - unknown primitive ids referenced from rules;
- return:

```ts
interface InvariantModelValidationResult {
  ok: boolean;
  issues: InvariantModelIssue[];
  model?: InvariantModelDefinition; // normalized, defensive copy
}
```

### 4.4. Registry contract

`InMemoryInvariantRegistry`:

- constructed from a **validated** model (caller must run `validateInvariantModel` first);
- stores internal canonical copies of the model and exposes defensive copies:

```ts
class InMemoryInvariantRegistry {
  constructor(config: { model: InvariantModelDefinition });

  getAllPrimitives(): PrimitiveDefinition[];
  getPrimitiveById(id: PrimitiveId): PrimitiveDefinition | undefined;

  getAllInvariantSets(): InvariantSetDefinition[];
  getInvariantSetById(id: InvariantSetId): InvariantSetDefinition | undefined;

  findRule(setId: InvariantSetId, ruleId: InvariantRuleId): InvariantRuleDefinition | undefined;

  findRulesByPrimitiveId(primitiveId: PrimitiveId): InvariantRuleDefinition[];
}
```

- All returned values must be **defensive copies**, not internal references.
- **Defensive copy rule (v1.1):**
  - Arrays must be new instances.
  - All returned objects must be deep copies of internal structures.
  - Mutating any returned value **must not affect** the registry state.

---

## 5. Invariant Course Loader (mandatory in TzV1.1)

TzV1.1 requires that **invariants and primitives are not hard-coded** in the main backend modules.  
They must be loaded from a **course file** by a dedicated loader.

### 5.1. Responsibilities

- Load a course model (primitives + invariant sets) from a file (`JSON` in v1).
- Validate the model via `validateInvariantModel`.
- Construct `InMemoryInvariantRegistry`.
- Fail fast on startup if the model is invalid.

### 5.2. Course file format (v1)

- A JSON file with the same structure as `InvariantModelDefinition`:

```jsonc
{
  "primitives": [ /* PrimitiveDefinition[] */ ],
  "invariantSets": [ /* InvariantSetDefinition[] */ ]
}
```

- TzV1.1 requires exactly **one default course file** (single-course system), e.g.:  
  `config/courses/default.course.invariants.json`.

### 5.3. Loader API

```ts
export interface CourseLoaderConfig {
  path: string; // path to JSON file (absolute or relative to backend root)
}

export function loadInvariantRegistryFromFile(
  config: CourseLoaderConfig
): InMemoryInvariantRegistry;
```

### 5.4. Behavior

- The loader:
  1. Reads the JSON file from `config.path`.
  2. Parses it as `unknown`.
  3. Runs `validateInvariantModel`.
  4. If `ok === false`:
     - logs issues,
     - throws an error, preventing the server from starting.
  5. If `ok === true`:
     - constructs `InMemoryInvariantRegistry` with `result.model`,
     - returns it.

- **Server startup rule (TzV1.1):**  
  The backend must fail to start if the default course file is missing or invalid.

### 5.5. Active invariant set in TzV1.1

- The course file must define at least one invariant set. One of them is designated as **default** (for example by id `"default"` or a documented name).
- In TzV1.1, the system is **single-course, single-set** from the orchestrator’s point of view:
  - The Step Orchestrator always uses `invariantSetIds = [DEFAULT_SET_ID]` when building `MapMasterInput`.
  - The frontend does not choose or switch invariant sets.
  - Step Policies in v1.1 do not alter active invariant sets.

This keeps TzV1.1 simple while leaving a clear extension point for TzV2+ (multiple courses and sets).

---

## 6. MapMaster Core (v1)

### 6.1. Responsibilities

- For a given current state (expression + selection + active invariant sets) and registry:
  - determine which invariant rules are applicable;
  - generate a list of **step candidates**.

- TzV1.1 allows simple, even heuristic logic inside MapMaster Core, as long as the public contract is respected.

### 6.2. Core types

```ts
export interface MapMasterInput {
  expressionLatex: string;
  selectionPath: string | null;      // path to selected node in Surface/AST
  invariantSetIds: InvariantSetId[]; // active invariant sets (for v1.1: one default set)
  registry: InMemoryInvariantRegistry;
}

export type MapMasterCandidateId = string & { __brand: "MapMasterCandidateId" };

export interface MapMasterCandidate {
  id: MapMasterCandidateId;
  invariantRuleId: InvariantRuleId;
  primitiveIds: PrimitiveId[];
  targetPath: string;                // where to apply the step
  description: string;               // debug/teacher description
}

export interface MapMasterResult {
  candidates: MapMasterCandidate[];
}
```

### 6.3. Public API

```ts
export function mapMasterGenerate(input: MapMasterInput): MapMasterResult;
```

### 6.4. TzV1.1 simplifications

- MapMaster Core v1.1 may:
  - support only a small subset of rules (e.g., for basic fraction steps);
  - use simple pattern checks (e.g., targetPath analysis, simple AST patterns);
- It must not depend on:
  - HTTP,
  - Step policies,
  - Step history,
  - UI components.

### 6.5. Path format and semantics (v1.1)

- `selectionPath` and `targetPath` are abstract **path strings** into the expression tree (Surface/AST).  
  TzV1.1 does not mandate a specific syntax (e.g., `"root.left.numerator"` vs `"0/1/2"`), but requires **consistency** between Display, MapMaster, and Engine Bridge.
- Semantics in v1.1:
  - `selectionPath` is where the student clicked.
  - `targetPath` is where the primitive is applied.
- In the simplest case, `targetPath === selectionPath`.  
  MapMaster is allowed to choose a **parent node** of `selectionPath` as `targetPath` (e.g., student clicks numerator, but the whole fraction is the transformation target).  
  It must **not** select an unrelated node that has no structural connection to the click.

---

## 7. StepMaster Core (v1)

### 7.1. Responsibilities

- Given:
  - a list of step candidates (`MapMasterResult`),
  - a history snapshot,
  - a policy,
- decide whether to perform a step, and if yes — which candidate to choose.

### 7.2. Core types

```ts
export type StepMasterDecisionStatus = "chosen" | "no-candidates";

export interface StepHistorySnapshot {
  lastStep: StepHistoryEntry | null;
}

export interface StepMasterInput {
  candidates: MapMasterCandidate[];
  history: StepHistorySnapshot;
  policy: StepPolicyConfig;
}

export interface StepMasterDecision {
  status: StepMasterDecisionStatus;
  chosenCandidateId: MapMasterCandidateId | null;
}

export interface StepMasterResult {
  input: StepMasterInput;
  decision: StepMasterDecision;
}
```

### 7.3. Public API

```ts
export function stepMasterDecide(input: StepMasterInput): StepMasterResult;
```

### 7.4. TzV1.1 simplifications

- Decision strategy can be straightforward:
  - if there are no candidates → `status = "no-candidates"`;
  - else → pick:
    - either the first suitable candidate (basic v1.1),
    - or the candidate with the highest simple priority (if implemented).
- No advanced scoring, teacher-specific logic, or multi-step lookahead is required in v1.1.

---

## 8. Step History Service (v1)

### 8.1. Responsibilities

- Maintain an **immutable history** of executed steps (within the context of a single orchestrator call).
- Provide easy access to a simple history snapshot for StepMaster Core.

### 8.2. Core types

```ts
export type StepId = string;

export interface StepHistoryEntry {
  stepId: StepId;
  candidateId: MapMasterCandidateId | null;
  decisionStatus: StepMasterDecisionStatus;
  timestampIso: string;
}

export interface StepHistory {
  entries: StepHistoryEntry[];
}
```

### 8.3. Public API

```ts
export function createEmptyHistory(): StepHistory;

export function appendStepFromResult(
  history: StepHistory,
  result: StepMasterResult
): StepHistory;

export function getSnapshot(history: StepHistory): StepHistorySnapshot;
```

### 8.4. Semantics and TzV1.1 rules

- `createEmptyHistory()` returns a history with `entries = []`.
- `appendStepFromResult`:
  - creates a new `StepHistoryEntry` from `StepMasterResult.decision`,
  - uses a generated `stepId`,
  - sets `candidateId` to:
    - `null` when `decision.status === "no-candidates"`,
    - the chosen candidate id when `decision.status === "chosen"`, even if the engine execution later fails.
- `getSnapshot` must return the last entry (or `null`) in a **read-only** form.

### 8.5. Per-request history in TzV1.1

- In TzV1.1, history is **per orchestrator call**, not persisted across HTTP requests:
  - each call to `runOrchestratorStep` starts from `createEmptyHistory()`,
  - appends at most one entry for the current step,
  - returns the updated history in `OrchestratorStepResult.history` (for debugging / future undo).
- The backend does not manage long-lived student sessions in v1.1.  
  Persistent session management is explicitly deferred to TzV2+.  

---

## 9. Step Policies (v1)

### 9.1. Responsibilities

- Provide a minimal policy configuration for student mode.

### 9.2. Core types

```ts
export type StepPolicyId = "student.default";

export interface StepPolicyConfig {
  id: StepPolicyId;
  maxCandidatesToShow: number; // reserved for future UI, may be unused in v1.1 logic
}
```

### 9.3. Public API (v1.1)

```ts
export function createDefaultStudentPolicy(): StepPolicyConfig;
```

### 9.4. TzV1.1 simplifications

- Only one policy is required: `student.default`.
- It may simply say “always choose one candidate if there is any”.

---

## 10. Engine Bridge (v1)

### 10.1. Responsibilities

- Convert an abstract step candidate selected by StepMaster into a concrete request to NGIN.
- Convert the NGIN response into a simple execution result for the orchestrator.

### 10.2. Core types

```ts
export interface EngineStepExecutionRequest {
  expressionLatex: string;
  targetPath: string;
  primitiveId: PrimitiveId;
  invariantRuleId: InvariantRuleId;
}

export interface EngineStepExecutionResult {
  ok: boolean;
  newExpressionLatex?: string;
  errorCode?: string;
}
```

### 10.3. Public API

```ts
export async function executeStepViaEngine(
  candidate: MapMasterCandidate,
  input: MapMasterInput
): Promise<EngineStepExecutionResult>;
```

### 10.4. TzV1.1 simplifications

- Engine Bridge v1.1 may:
  - call a local or HTTP-based NGIN service;
  - assume a simple `request → response` contract with NGIN (no streaming).
- It must not know about:
  - HTTP handlers,
  - Step history or policies,
  - Orchestrator internals.

### 10.5. NGIN interface (v1.1 note)

- The **actual** NGIN API (its endpoints, payload shape, internal AST format) is **out of scope** of TzV1.1.
- TzV1.1 only fixes the **local contract** between the Engine Bridge and the rest of the backend:
  - `EngineStepExecutionRequest` and `EngineStepExecutionResult`.
- The Engine Bridge is responsible for:
  - translating this local contract into whatever NGIN expects (LaTeX, AST, etc.);
  - handling asynchronous errors and mapping them to `ok: false, errorCode: string`.

This allows the backend to remain stable even if the NGIN implementation evolves.

---

## 11. Step Orchestrator (v1)

### 11.1. Responsibilities

- Act as the **central coordinator** for a single step:
  - talk to Invariants Registry, MapMaster, StepMaster, History, Engine Bridge;
  - maintain per-request step history and policy;
  - expose a simple function called by the HTTP handler.

### 11.2. Core types

```ts
export interface OrchestratorContext {
  invariantRegistry: InMemoryInvariantRegistry;
  policy: StepPolicyConfig;
}

export interface OrchestratorStepRequest {
  expressionLatex: string;
  selectionPath: string | null;
}

export type OrchestratorStepStatus =
  | "step-applied"
  | "no-candidates"
  | "engine-error";

export interface OrchestratorStepResult {
  history: StepHistory;
  engineResult: EngineStepExecutionResult | null;
  status: OrchestratorStepStatus;
}
```

> Note: History is created and used **inside** the orchestrator per call (see section 8.5).  
> The context does not carry history across calls in TzV1.1.

### 11.3. Public API

```ts
export async function runOrchestratorStep(
  ctx: OrchestratorContext,
  req: OrchestratorStepRequest
): Promise<OrchestratorStepResult>;
```

### 11.4. Algorithm (v1.1)

1. Create an empty history: `let history = createEmptyHistory()`.
2. Build `MapMasterInput` from `req`, `ctx.invariantRegistry` and the default invariant set id (section 5.5).
3. Call `mapMasterGenerate(input)` to get candidates.
4. Build `StepMasterInput` using:
   - candidates,
   - `getSnapshot(history)` (initially empty),
   - `ctx.policy`.
5. Call `stepMasterDecide(stepInput)`.
6. Use `appendStepFromResult(history, stepMasterResult)` to obtain `updatedHistory`.
7. If `decision.status === "no-candidates"`:
   - Return:
     - `status = "no-candidates"`,
     - `engineResult = null`,
     - `history = updatedHistory`.
8. If `decision.status === "chosen"`:
   - Extract the chosen candidate from the candidates list.
   - Call `executeStepViaEngine(chosenCandidate, mapMasterInput)` → `engineResult`.
   - If `engineResult.ok === true`:
     - Return:
       - `status = "step-applied"`,
       - `engineResult`,
       - `history = updatedHistory`.
   - If `engineResult.ok === false`:
     - Return:
       - `status = "engine-error"`,
       - `engineResult`,
       - `history = updatedHistory`.

---

## 12. Engine HTTP Server & HandlerPostEntryStep (v1)

### 12.1. Endpoint

- `POST /api/entry-step`

### 12.2. Request / Response types

```ts
export interface EntryStepRequest {
  expressionLatex: string;
  selectionPath: string | null;
}

export interface EngineStepResponse {
  expressionLatex: string;
  status: OrchestratorStepStatus;
}
```

### 12.3. Handler responsibilities

- Validate and parse `EntryStepRequest` from JSON.
- Translate it to `OrchestratorStepRequest`.
- Construct or obtain an `OrchestratorContext`:
  - `invariantRegistry` from the **course loader**,
  - `policy` via `createDefaultStudentPolicy()`.
- Call `runOrchestratorStep(ctx, req)`.
- Map `OrchestratorStepResult` to `EngineStepResponse`:
  - if `status = "step-applied"` → HTTP 200, updated expression;
  - if `status = "no-candidates"` → HTTP 200, expression may stay unchanged;
  - if `status = "engine-error"` → for TzV1.1 we return HTTP 200 with `status = "engine-error"` and let the UI decide what to show.

### 12.4. Error handling and HTTP status mapping (v1.1)

- **Malformed JSON or invalid request fields**:
  - Handler returns HTTP 400 with a minimal error payload.
  - Logged as input/validation error.
- **Invalid course model at startup**:
  - Loader throws; server does not start (see section 5.4).
- **Engine errors** (`engineResult.ok === false`):
  - Orchestrator returns `status = "engine-error"`.
  - Handler returns HTTP 200 with that status.
- **Internal backend errors** (unhandled exceptions in MapMaster, StepMaster, Orchestrator, etc.):
  - Handler returns HTTP 500.
  - Error is logged with stack trace.

The goal is to keep TzV1.1 semantics simple for the frontend while still distinguishing input errors (400) from internal failures (500).

---

## 13. Operational notes for TzV1.1

### 13.1. Single course in v1.1

- Only one course file is required (single invariant model).
- The orchestrator always uses the default invariant set defined by that course.

### 13.2. History and sessions

- History is **per orchestrator invocation** in TzV1.1:
  - no server-side long-lived sessions,
  - no shared history across different HTTP requests.
- The `history` field in `OrchestratorStepResult` is primarily for:
  - debugging,
  - logging,
  - future features (like undo).
- Persistent session management and multi-step trajectories are left for TzV2+.

### 13.3. Configuration (TzV1.1)

The backend must be configurable via environment or configuration files. Suggested parameters:

- `COURSE_FILE_PATH` — path to the course JSON file (required).
- `NGIN_ENDPOINT` — URL or local endpoint for the NGIN service.
- `PORT` — HTTP server port (default e.g. `3000`).

Missing required configuration must cause startup failure (fail-fast).

### 13.4. Fail-fast behavior

- If the course file is missing, unreadable, or invalid → server must not start.
- If configuration is incomplete or invalid → server must not start.
- Engine errors at runtime do **not** stop the server; they are reported via `"engine-error"` status.

### 13.5. Immutability expectations

- Library modules must avoid mutating inputs:
  - Invariants Registry returns deep defensive copies,
  - Step History Service returns new history objects,
  - MapMaster and StepMaster treat input as read-only.
- Tests should explicitly verify that mutating returned objects does not affect internal state.

### 13.6. Testing expectations (high level)

- **Unit tests**:
  - Each library (Invariants, MapMaster, StepMaster, History, Policies, Engine Bridge) should have unit tests with mocked dependencies.
- **Integration tests**:
  - Step Orchestrator + all libraries tested together with a mock NGIN.
- **Validation tests**:
  - Course file validation tests with both valid and invalid models.
- **Defensive copy tests**:
  - Registry tests that verify internal state is not affected by mutations on returned objects.

Exact coverage percentages are out of scope of TzV1.1, but core modules must be well-tested.

---

## 14. Plain-language summary (for engineers & managers)

- The backend is built around a **Step Orchestrator** that manages one student step at a time.
- The orchestrator uses six focused library modules:
  - **Invariants** — describes what mathematical rules and primitives exist in the course.
  - **MapMaster** — proposes which steps are possible right now, based on the current expression, selection, and invariant set.
  - **StepMaster** — chooses which step to actually perform under a simple student policy.
  - **History** — records what decisions were made for each step (per request).
  - **Policies** — define the basic behavior (in v1.1: a single simple student policy).
  - **Engine Bridge** — carries the chosen step to the NGIN engine and brings back a result.
- The **course model (invariants + primitives) is stored in a separate JSON file**, not hard-coded, and loaded at startup through a dedicated loader.  
  Changing the course later means editing that file, not rewriting backend logic.
- The frontend only knows about one HTTP endpoint: `/api/entry-step`.  
  Everything else (rules, policies, decision logic, engine interaction) is hidden inside the orchestrator and its libraries.

This makes TzV1.1 both **simple to implement now** and **safe to extend later** without a full rewrite.

---

## 15. Example learning session (fraction sum)

This example shows how a student might solve `3 + 2/5` step by step under a course that enforces **maximally atomic** fraction operations.

### Initial state

- Expression on screen: `3 + 2/5`
- Student wants to add a whole number and a fraction.

### Step 1 — Convert whole number to a fraction

- Student clicks on `3`.
- Frontend sends:

```json
{
  "expressionLatex": "3 + 2/5",
  "selectionPath": "term[0]"
}
```

- Backend (MapMaster + StepMaster) chooses the primitive “convert whole to fraction”.  
- NGIN applies the step.

**Result expression:** `3/1 + 2/5`  
**Status:** `"step-applied"`

### Step 2 — Introduce common denominator via 5/5

- Student now clicks on the fraction `3/1`.
- Backend finds a rule: “multiply by 1 expressed as 5/5 to match denominator 5”.  
- New step is:
  - `3/1` → `3/1 * 5/5`

**Result expression:** `3/1 * 5/5 + 2/5`  
**Status:** `"step-applied"`

### Step 3 — Multiply numerator and denominator explicitly

- Student clicks on `3/1 * 5/5` (the product).
- Backend applies a primitive: “multiply numerators and denominators”.

**Result expression:** `(3 * 5) / (1 * 5) + 2/5`  
**Status:** `"step-applied"`

### Step 4 — Compute the products in the fraction

- Student clicks on `(3 * 5) / (1 * 5)`.
- Backend applies “evaluate simple products in numerator and denominator”.

**Result expression:** `15/5 + 2/5`  
**Status:** `"step-applied"`

### Step 5 — Add fractions with the same denominator

- Student clicks on the whole sum `15/5 + 2/5`.
- Backend applies “add fractions with equal denominators”.

**Result expression:** `17/5`  
**Status:** `"step-applied"`

At no point does the backend “jump over” intermediate steps:

- turning `3` into `3/1`,
- explicitly introducing the `5/5` factor,
- explicitly multiplying numerators and denominators,
- only затем приводя выражение к `15/5 + 2/5` и, наконец, к `17/5`.

This example illustrates the core philosophy of Motor: **many small, understandable steps** instead of a single magic transformation.

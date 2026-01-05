# Motor V5 Primitive Decision Layer
### Technical Specification (Consolidated Version)

> **Language:** English only  
> **Status:** Ready for implementation  
> **Scope:** Arithmetic domain (integers, fractions, decimals, mixed numbers), designed to be extensible to future domains (algebra, trig, etc.)

This document defines the **primitive‑based decision layer** for the Motor V5 pipeline.  
The goal is to ensure that **for any student click on the expression**, the system can deterministically answer:

- **What happens next?**
- Is it a **single automatic step**, a **guided multi‑step scenario**, a **multi‑choice action**, a **pure diagnostic**, or **no step**?

The **single source of truth** for all such decisions is the **Primitives Table**.  
No “hidden logic” outside the table is allowed to influence which primitive is chosen.

---

## 1. High‑Level Overview

### 1.1. Core Idea

We separate the system into two clear responsibilities:

1. **Mathematical truth & pedagogy** – stored in a **Primitives Table** (human‑authored, versioned).
2. **Mechanical application of rules** – implemented by a set of modules that:
   - read the table,
   - analyze the AST and the click,
   - choose **exactly one outcome** per click,
   - call the existing Engine to execute the primitive.

The decision layer **does not invent math**. It only applies what is written in the table.

### 1.2. Main Components

1. **Primitives Table (PrimitivesTable.v5)** – declarative description of all primitives.
2. **NodeContextBuilder** – builds a rich context around the clicked node.
3. **PrimitiveMatcher** – finds all table rows compatible with the current context.
4. **PrimitiveSelector** – resolves conflicts and chooses **a single outcome**.
5. **AstEnhancer** – annotates AST nodes with primitive metadata, colors, and UI info.
6. **Engine Integration (PrimitiveRunner + Orchestrator V5)** – executes the primitive and returns a new expression.
7. **Scenario & Guard Layer** – supports multi‑step arithmetic scenarios and extra boolean constraints.
8. **Validation & Tooling** – ensures the table is consistent and conflict‑free at load time.

The Viewer and HTTP endpoints already exist. They call the V5 Orchestrator, which will internally use these components.

---

## 2. Domains, Terminology and IDs

### 2.1. Expression and Node IDs

These are already present in the system, but we standardize their usage here:

```ts
type ExpressionId = string;   // unique per expression instance
type NodeId       = string;   // unique per AST node within an expression
type PrimitiveId  = string;   // e.g. "P.INT_ADD", "P.FRAC_ADD_SAME_DEN"
```

### 2.2. Click Target

The Viewer sends information about what the student clicked:

```ts
type ClickTargetKind = "operator" | "number" | "fractionBar" | "bracket" | "other";

interface ClickTarget {
  nodeId: NodeId;
  kind: ClickTargetKind;
  // extra details if needed (e.g. is this the left or right bracket of a pair)
}
```

### 2.3. Domains and Operand Types

We classify primitives by **domain** and **operand types**:

```ts
type Domain =
  | "integers"
  | "fractions"
  | "decimals"
  | "mixed"
  | "signs"
  | "brackets"
  | "algebra"   // reserved for future
  | "trig";     // reserved for future

type OperandType =
  | "int"
  | "nonzero-int"
  | "fraction"
  | "nonzero-fraction"
  | "decimal"
  | "mixed-number"
  | "any";
```

Examples:

- `P.INT_ADD` → `domain = "integers"`, operands: `int + int`.
- `P.FRAC_ADD_SAME_DEN` → `domain = "fractions"`, operands: `fraction + fraction` with equal denominators.
- `P.FRAC_DIV` → `domain = "fractions"`, operands: `fraction ÷ fraction`, divisor nonzero.

### 2.4. Color Semantics

Each primitive row carries a **color** that drives both UI and pedagogy:

```ts
type PrimitiveColor = "green" | "yellow" | "red" | "blue";
```

- **green** – simple atomic step; auto‑applied if chosen (e.g. `1 + 2 → 3`, `1/7 + 3/7 → 4/7`).
- **yellow** – multi‑step **scenario** (requires several steps to complete a mathematical idea).
- **red** – **diagnostic** / “cannot apply now” (e.g. division by zero).
- **blue** – **choice point**: multiple possible actions are available, needs a context menu or dialog.

### 2.5. UI Modes and Action Classes

```ts
type UiMode = "auto-apply" | "requires-confirmation" | "context-menu" | "diagnostic-only";

type ActionClass = "normal" | "diagnostic";
```

The combination `(color, uiMode, actionClass)` defines how the Viewer should behave.

---

## 3. Guards and Scenarios

### 3.1. Guard IDs

Guards are boolean flags indicating additional facts about the local expression. They are computed once per AST / expression and reused.

```ts
type GuardId =
  | "divisor-nonzero"
  | "result-is-integer"
  | "numerators-coprime"
  | "denominators-equal"
  | "denominators-different"
  | "operands-free"          // operands are not “tied” by adjacent multiplication or division
  | "inside-brackets"
  | "left-negative"
  | "right-negative";
```

A primitive row can require a set of guards to be `true` in order to be considered applicable.

### 3.2. Scenario Metadata

Yellow (and some blue) primitives can be **scenarios** – multi‑step procedures that group several underlying primitives into a pedagogical “macro”.

```ts
type ScenarioId =
  | "SC.FRACTIONS_COMMON_DEN"
  | "SC.DISTRIBUTIVE_EXPAND"
  | "SC.COLLECT_LIKE_TERMS"
  | "SC.NORMALIZE_MIXED";
  // extensible

interface ScenarioMeta {
  scenarioId: ScenarioId;
  stepIndex: number;            // 0-based step within the scenario
  stepCount: number;            // total planned steps
  isTerminalStep: boolean;      // true if this step completes the scenario
}
```

Scenario state (current `stepIndex`) is stored in **Orchestrator session state**, not in the Viewer, so that the backend remains the single authority.

---

## 4. Primitives Table (Source of Truth)

### 4.1. PrimitiveRow Definition

```ts
interface PrimitiveRow {
  id: PrimitiveId;

  // Classification
  domain: Domain;
  category: string;          // human label (e.g. "Fraction Addition – Same Denominator")

  // Pattern / operator
  clickTargetKind: ClickTargetKind; // "operator", "number", ...
  operatorLatex?: string;           // "+", "-", "\times", "\div", ":", etc.
  operandTypes?: {
    left?: OperandType;
    right?: OperandType;
  };

  // Guard constraints
  requiredGuards?: GuardId[];       // all must be true
  forbiddenGuards?: GuardId[];      // all must be false

  // Scenario meta (for yellow / blue)
  scenario?: ScenarioMeta | null;

  // UI & pedagogy
  color: PrimitiveColor;
  uiMode: UiMode;
  actionClass: ActionClass;         // "normal" or "diagnostic"
  label: string;                    // short description for UI

  // Engine integration
  enginePrimitiveId: PrimitiveId;   // usually same as id; may differ if we alias

  // Optional extra metadata (for logging, analytics, etc.)
  notes?: string;
}
```

### 4.2. Table Container

```ts
interface PrimitivesTable {
  version: string;                  // e.g. "v5.0.0"
  rows: PrimitiveRow[];
}
```

The table exists as a TypeScript module, e.g. `src/primitives/primitives.v5.table.ts`, exporting a strongly typed constant `PRIMITIVES_V5_TABLE`.

---

## 5. Node Context Builder

### 5.1. Responsibility

Given:

- the current AST,
- the `ExpressionId`,
- the `ClickTarget`,

the **NodeContextBuilder** returns a `NodeContext` that contains all information needed to match primitives.

### 5.2. API

```ts
interface NodeContext {
  expressionId: ExpressionId;
  nodeId: NodeId;
  clickTarget: ClickTarget;

  // Local AST structure
  operatorLatex?: string;        // "+", "-", "\times", "\div", etc.
  leftOperandType?: OperandType;
  rightOperandType?: OperandType;

  // Denominator and fraction info (if applicable)
  denominatorsEqual?: boolean;
  denominatorsDifferent?: boolean;

  // Mixed numbers / integers / decimals classification
  leftDomain?: Domain;
  rightDomain?: Domain;

  // Guard flags
  guards: Record<GuardId, boolean>;

  // Extra: parse / engine information if needed later
  isInsideBrackets?: boolean;
}

interface NodeContextBuilder {
  buildContext(params: {
    expressionId: ExpressionId;
    ast: AstNode;
    click: ClickTarget;
  }): NodeContext;
}
```

### 5.3. Behavior

- Traverses the AST from `nodeId` up/down to determine the **local operation window** (typically a binary operation).
- Classifies left/right operands into `OperandType` and `Domain`.
- Computes all guards (`divisor-nonzero`, `denominators-equal`, `operands-free`, etc.).
- If the click target is not on a meaningful operator / number (e.g. whitespace, unsupported node), it marks the context accordingly (e.g. `clickTarget.kind = "other"`).

NodeContextBuilder must be **pure** and easily unit‑testable.

---

## 6. Primitive Matcher

### 6.1. Responsibility

Given a `NodeContext` and the `PrimitivesTable`, return **all primitives that could apply** to this context.

### 6.2. API

```ts
interface PrimitiveMatch {
  row: PrimitiveRow;
  score: number;   // used later if we implement scoring; for now usually 1
}

interface PrimitiveMatcher {
  match(params: {
    table: PrimitivesTable;
    ctx: NodeContext;
  }): PrimitiveMatch[];
}
```

### 6.3. Matching Rules

A primitive row matches the context if **all** conditions are met:

1. `row.clickTargetKind === ctx.clickTarget.kind`.
2. If `row.operatorLatex` is specified, it must equal `ctx.operatorLatex`.
3. If `row.operandTypes.left` is specified, it must be compatible with `ctx.leftOperandType`.
4. If `row.operandTypes.right` is specified, it must be compatible with `ctx.rightOperandType`.
5. All `row.requiredGuards` must be `true` in `ctx.guards`.
6. All `row.forbiddenGuards` must be `false` in `ctx.guards`.

If no rows match, Matcher returns an empty array.

Matcher itself **never resolves conflicts** – it may return several matches.

---

## 7. Primitive Selector (Determinism & Disambiguation)

### 7.1. Responsibility

Given the list of `PrimitiveMatch` instances, pick **one deterministic outcome** for the click:

- A single green/yellow/blue/red primitive, or
- A special **“no candidates”** outcome.

### 7.2. API

```ts
type SelectedOutcomeKind =
  | "green-primitive"
  | "yellow-scenario"
  | "blue-choice"
  | "red-diagnostic"
  | "no-candidates";

interface SelectedOutcome {
  kind: SelectedOutcomeKind;
  primitive?: PrimitiveRow;    // present for all except "no-candidates"
  matches: PrimitiveMatch[];   // full list of matches (for logging/debug)
}

interface PrimitiveSelector {
  select(matches: PrimitiveMatch[]): SelectedOutcome;
}
```

### 7.3. Selection Rules

1. **No matches** → return `kind = "no-candidates"`.
2. **Single match** → choose it; `kind` derived from `row.color`.
3. **Multiple matches**:
   - If there is more than one primitive of the **same color**, the table is likely inconsistent. Selector should:
     - Prefer the most specific (e.g. more guards, more specific operand types).
     - Log a warning and record the conflict.
   - If there are primitives of **different colors** for the same context, the **Primitives Table is invalid**. This must be caught by validation at load time (see section 11). At runtime, Selector returns `no-candidates` + logs an error.

The **goal** is: ***in a valid table, for any reachable context there is at most one applicable primitive per color, and usually exactly one total***.

---

## 8. AST Enhancer

### 8.1. Responsibility

Given an expression AST, the `PrimitivesTable`, and an optional “current click”, the **AstEnhancer** precomputes **all possible primitive applications** and attaches metadata to AST nodes.

This enables:

- consistent highlighting (green / yellow / red / blue),
- pre‑computed context menus,
- debugging overlays for teachers.

### 8.2. API

```ts
interface EnhancedNodeMeta {
  nodeId: NodeId;
  possiblePrimitives: PrimitiveId[];    // may be empty
  dominantColor?: PrimitiveColor;       // e.g. "green" if there is a safe auto-step
  hasChoice: boolean;                   // true if there is at least one blue primitive
}

interface EnhancedAst {
  expressionId: ExpressionId;
  ast: AstNode;
  nodeMeta: Record<NodeId, EnhancedNodeMeta>;
}

interface AstEnhancer {
  enhance(params: {
    expressionId: ExpressionId;
    ast: AstNode;
    table: PrimitivesTable;
  }): EnhancedAst;
}
```

### 8.3. Behavior

For each node in the AST:

1. Build a `NodeContext` as if the student clicked this node.
2. Run `PrimitiveMatcher`.
3. Run `PrimitiveSelector`.
4. Fill `EnhancedNodeMeta` with:
   - `possiblePrimitives` (IDs of all matches),
   - `dominantColor` based on selected outcome,
   - `hasChoice` if any match is blue.

The Viewer can then use `EnhancedAst` to color‑code operators and numbers even before the student clicks.

AstEnhancer is **read‑only**: it never modifies the AST, only annotates it.

---

## 9. Engine Integration

### 9.1. PrimitiveRunner Contract

The existing Engine is responsible for actual numeric / symbolic transformations. We define a narrow API for the decision layer to call.

```ts
interface EngineStepRequest {
  expressionId: ExpressionId;
  expressionLatex: string;
  primitiveId: PrimitiveId;
  nodeId: NodeId;                       // main node to which the primitive applies
}

interface EngineStepResult {
  success: boolean;
  newExpressionLatex?: string;
  errorCode?: string;                   // e.g. "ENGINE_INTERNAL_ERROR"
  debugInfo?: unknown;
}

interface PrimitiveRunner {
  run(req: EngineStepRequest): Promise<EngineStepResult>;
}
```

The Engine maintains its own registry of supported primitives. The ID `primitiveId` must correspond to a known operation (e.g. `P.INT_ADD`, `P.FRAC_ADD_SAME_DEN`, `P.FRAC_DIV`, `P.FRAC_IMPROPER_TO_MIXED`).

### 9.2. Orchestrator V5 Flow

For each `/api/orchestrator/v5/step` request:

1. Parse the incoming LaTeX into an AST.
2. Build `NodeContext` for the clicked node.
3. Use `PrimitiveMatcher` + `PrimitiveSelector` to obtain `SelectedOutcome`.
4. Handle outcome:

   - **no-candidates** → return a “no step” result to Viewer (yellow/red highlighting as needed).
   - **red-diagnostic** → return diagnostic information; Engine may not be called.
   - **blue-choice** → return a list of possible actions to the Viewer (for a context menu).
   - **yellow-scenario / green-primitive** → call `PrimitiveRunner` with `primitiveId = row.enginePrimitiveId`.

5. If Engine succeeds (`success = true`):
   - return `status: "step-applied"` and `newExpressionLatex`.
6. If Engine fails:
   - return `status: "engine-error"` with diagnostic info (see section 12).

The Orchestrator remains the **single backend API** for both Viewer and tests.

---

## 10. Multi‑Step Scenarios

### 10.1. Scenario Lifecycle

A **scenario** (yellow primitive) is a multi‑step pedagogical process, e.g.:

- “bring fractions to a common denominator”,
- “expand brackets using distributive law”.

For example, *Fractions – Different Denominators* might be split into:

1. Insert `× 1` next to each fraction.
2. Convert each `1` to a unit fraction (e.g. `2/2`, `3/3`, etc.).
3. Perform multiplication to get equal denominators.
4. Finally use `P.FRAC_ADD_SAME_DEN`.

The scenario is represented by several primitive rows sharing the same `scenarioId` and having consecutive `stepIndex` values.

### 10.2. State Storage

Scenario state is stored in the **session / expression state** managed by the Orchestrator:

```ts
interface ScenarioState {
  scenarioId: ScenarioId;
  currentStepIndex: number;
  expressionId: ExpressionId;
}
```

On each step:

- Orchestrator checks if there is an active scenario.
- If yes, it restricts matching to primitive rows of that scenario and the next `stepIndex`.
- If the selected primitive row has `isTerminalStep = true`, scenario state is cleared.

If a user performs an action that invalidates the scenario (e.g. clicks somewhere else, changes structure), the scenario is reset.

---

## 11. Table Validation and Tooling

### 11.1. Validation Goals

The table must be validated at build / startup time so that **no runtime conflicts** occur.

### 11.2. Validation Checks

1. **Primitive ID uniqueness** – no two rows share the same `id`.
2. **Scenario consistency** – for each `scenarioId`:
   - `stepIndex` starts from 0,
   - steps form a contiguous sequence (`0..stepCount-1`),
   - exactly one step has `isTerminalStep = true`.
3. **Guard consistency** – no meaningless combinations such as:
   - `requiredGuards` containing mutually exclusive guards (e.g. `denominators-equal` and `denominators-different`).
4. **Determinism checks** – for each *synthetic test context*:
   - there is at most one green primitive,
   - if both red and green could apply, the situation is flagged.
5. **Domain consistency** – if `domain = "fractions"`, then operand types include at least one `fraction`.

Validation runs as a Node script (e.g. `npm run validate:primitives`) and fails CI if any inconsistency is found.

### 11.3. Developer Tools

- A script to export the table into **HTML / CSV** for human review (like the one you’re currently using).
- A test harness that feeds in synthetic `NodeContext` instances and verifies selected outcomes.

---

## 12. Error Handling and Diagnostics

### 12.1. Parser Errors

If the LaTeX cannot be parsed into an AST:

- Orchestrator returns a `status: "parse-error"`,
- the Viewer displays an appropriate message,
- no Engine or primitive matching is performed.

### 12.2. No Candidates

If there are no matching primitives:

- Orchestrator returns `status: "no-candidates"`,
- EnhancedAst still marks the node (e.g. with a neutral or red highlight, depending on configuration),
- this is the normal way to signal “you cannot do this step yet”.

### 12.3. Engine Errors

If Engine returns `success: false`:

- Orchestrator returns `status: "engine-error"` and an `errorCode`,
- the Viewer displays a non‑pedagogical “technical” error,
- the event is logged for investigation.

This should be rare; most invalid actions should be prevented by the Primitives Table + guards, not by Engine failing.

### 12.4. Network / HTTP Failures

- Handled outside this spec (Viewer and server infrastructure),
- but Orchestrator always returns structured JSON with `status` and optional `errorCode`.

---

## 13. Extensibility

The design is intentionally extensible:

- **New domains** (decimals, algebra, trig) are added by:
  - introducing new `Domain` values,
  - adding new primitives to the table,
  - adding new `GuardId`s if needed,
  - extending Engine support for new `PrimitiveId`s.
- The **core modules** (NodeContextBuilder, PrimitiveMatcher, PrimitiveSelector, AstEnhancer, PrimitiveRunner, Orchestrator V5) remain unchanged.
- Pedagogical behavior (which primitive exists, what color it is, what label it shows) is controlled entirely by the **Primitives Table**.

---

## 14. Implementation Roadmap (Suggested)

1. **Stage 1 – Skeleton & Validation**
   - Implement `PrimitivesTable` types and loader.
   - Implement `NodeContextBuilder`, `PrimitiveMatcher`, `PrimitiveSelector`.
   - Implement table validation script.

2. **Stage 2 – Basic Integers**
   - Implement primitives for `P.INT_ADD`, `P.INT_DIV_TO_INT`, zero/identity rules.
   - Integrate with Engine via `PrimitiveRunner`.
   - Wire Orchestrator V5 to use the decision layer.

3. **Stage 3 – Fractions, Same Denominator**
   - Implement `P.FRAC_ADD_SAME_DEN`, `P.FRAC_SUB_SAME_DEN`.
   - Add guard `denominators-equal`.
   - Ensure Viewer can correctly step `1/7 + 3/7 → 4/7` via `/api/orchestrator/v5/step`.

4. **Stage 4 – Basic Fraction Operations**
   - `P.FRAC_MUL`, `P.FRAC_DIV` (as “multiply by reciprocal”), `P.FRAC_IMPROPER_TO_MIXED`, `P.FRAC_MIXED_TO_IMPROPER`, `P.FRAC_SIMPLIFY_GCD`.
   - Introduce first multi‑step scenarios for different denominators.

5. **Stage 5 – Scenarios & Blue Choices**
   - Implement scenario handling for “common denominator” and other multi‑step transformations.
   - Implement blue primitives and Viewer context menus for multi‑choice actions.

6. **Stage 6 – Brackets, Signs, Diagnostics**
   - Add bracket simplification, distributive law, negative number rules, and diagnostics (e.g. division by zero).
   - Refine red primitives and error flows.

7. **Stage 7 – Documentation and Developer Tools**
   - Generate HTML/Markdown summaries of the Primitives Table.
   - Provide a “debug overlay” mode in the Viewer, powered by `AstEnhancer`.

Once these stages are complete, the Motor V5 system will have a **fully deterministic, table‑driven primitive layer**, directly aligned with the pedagogical primitives you designed.

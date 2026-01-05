# Math Engine Application — Implementation Checklist v1.0

Companion document to **MathEngine_TechSpec_v1.md**.  
Goal: provide a practical, ordered checklist of implementation tasks, so that engineers can see:

- what already exists and only needs alignment / refactor;
- what must be added from scratch;
- in what order to implement and test components.

Status markers (to be updated manually in this file):
- `[ ]` not started
- `[-]` in progress
- `[x]` done
- `[?]` needs investigation / unclear

You can also add dates or owners after each line if helpful.

---

## 0. Global priorities and order of work

Recommended order (top-down, but with strong focus on MapMaster and diagnostics):

1. **Diagnostics & Contracts Backbone**
   - AST / Map / Step debug functions and endpoints.
   - Ensure all core contracts exist in code, even as stubs.
2. **MapMaster v1.0 (Stage 1 domains)**
   - Fractions same denominator, integers, mixed same denominator.
   - Full pipeline: SelectionNormalizer → Window → RuleProvider → Invariants → Candidates.
3. **Engine primitives and invariants alignment**
   - Ensure primitives used by MapMaster exist and behave correctly.
   - Ensure invariants registry matches MapMaster expectations.
4. **StepMaster v1.0**
   - Minimal modes, history, undo/redo, decision logic.
5. **Viewer / Adapters & Dev Tools**
   - Engine adapter, display adapter, dev viewers wired to debug endpoints.
6. **Extended domains & strategies**
   - More fraction cases, parentheses, negatives, “strategic” steps (add 0, multiply by 1, etc.).

This checklist is structured roughly in that order.

---

## 1. Contracts and shared types

### 1.1. AST and IDs

- [ ] Confirm presence of a central **AST types** module (e.g. `ast.types.ts`):
  - [ ] `AstNodeId`, `AstPath`
  - [ ] `AstNodeKind` union
  - [ ] `AstNode` / `AstRoot` structure as in spec
- [ ] Ensure **Engine/NGIN** is the **only** component that creates ASTs and IDs:
  - [ ] No MapMaster/StepMaster code re-generates IDs.
  - [ ] All consumers treat AST as immutable input.
- [ ] Add or verify **AST debug snapshot** type:
  - [ ] `AstDebugRequest`
  - [ ] `AstDebugResponse`

### 1.2. Primitives & invariants core types

- [ ] Create/verify `PrimitiveId`, `PrimitiveDefinition`, `PrimitiveRegistry` interfaces.
- [ ] Create/verify `InvariantId`, `InvariantDefinition`, `InvariantPattern`, `InvariantRegistry` interfaces.
- [ ] Ensure both are defined in shared, accessible modules (no duplication across packages).

### 1.3. Selection and viewer → backend contracts

- [ ] Define/verify `ViewerSelection` (kind, `astPath`, `operatorIndex`).
- [ ] Define/verify `EngineStepRequest` and `EngineStepResponse` according to spec.
- [ ] Ensure all TypeScript types compile and are imported consistently in backend and frontend.

---

## 2. Engine / NGIN

### 2.1. LaTeX parser and AST builder

- [ ] Implement / verify `parseLatexToAst(latex: string): AstRoot`:
  - [ ] LaTeX coverage for integers, simple fractions, mixed numbers.
  - [ ] Assign `AstNodeId` and `AstPath` to every node.
  - [ ] Deterministic path generation (same LaTeX → same paths).
- [ ] Implement `/api/ast-debug` endpoint:
  - [ ] Accept `AstDebugRequest` (with `latex`).
  - [ ] Return `AstDebugResponse` with `AstRoot` or error.
  - [ ] Log parse errors meaningfully for engineers.

### 2.2. PrimitiveRunner

- [ ] Implement core `PrimitiveRunner` with `runMany`:
  - [ ] Internal execution of primitive sequence with rollback if needed.
  - [ ] Ensure error handling and logging.
- [ ] Implement registry lookup:
  - [ ] `PrimitiveRegistry.get(id)` wired for all primitives used in Stage 1 invariants.

### 2.3. Stage 1 primitives (fractions, integers, mixed)

- [ ] `PRIM_ADD_INTEGERS`
- [ ] `PRIM_SUBTRACT_INTEGERS`
- [ ] `PRIM_ADD_FRACTIONS_SAME_DEN_STAGE1`
- [ ] `PRIM_SUB_FRACTIONS_SAME_DEN_STAGE1`
- [ ] `PRIM_MIXED_ADD_INT_FRAC_SAME_DEN_STAGE1` (if implemented as primitive chain)
- [ ] Minimal test coverage for each primitive (AST in, AST out).

### 2.4. Engine internal apply API

- [ ] Implement internal `EngineApplyPrimitivesRequest/Result` functions:
  - [ ] Input: `AstRoot`, `targetPath`, `primitiveIds[]`.
  - [ ] Output: updated `AstRoot` + LaTeX.
- [ ] Integrate with backend step endpoint through StepMaster (later).

---

## 3. Invariants and Stage 1 catalog

### 3.1. Invariants registry structure

- [ ] Create/verify `invariants.registry.ts` with:
  - [ ] `InvariantRegistry` implementation.
  - [ ] Central list of invariants for Stage 1.
- [ ] Confirm invariants are identified by stable `InvariantId` strings.

### 3.2. Stage 1 invariants (baseline)

Fractions, same denominator:

- [ ] `INV_FRAC_ADD_SAME_DEN_STAGE1`
- [ ] `INV_FRAC_SUB_SAME_DEN_STAGE1`

Integers:

- [ ] `INV_INT_ADD_STAGE1`
- [ ] `INV_INT_SUB_STAGE1`

Mixed (integer + fraction, same denominator):

- [ ] `INV_MIXED_ADD_INT_FRAC_SAME_DEN_STAGE1`

Each invariant must define:

- [ ] `pattern.domain`
- [ ] structural constraints (e.g. same denominator)
- [ ] `plan.primitiveIds`

### 3.3. Tests

- [ ] For each invariant, add unit tests that:
  - [ ] build a minimal AST expression that matches the pattern,
  - [ ] call its primitives via Engine,
  - [ ] verify result AST/LaTeX is mathematically correct.

---

## 4. MapMaster v1.0

### 4.1. Core modules present

Verify that the following files exist (names may vary but responsibilities must match):

- [ ] `mapmaster.core.ts` — main orchestration.
- [ ] `mapmaster.selection-normalizer.ts` — selection → anchorNodeId.
- [ ] `mapmaster.ast-helpers.ts` — window building, AST utilities.
- [ ] `mapmaster.rule-provider.ts` — semantic window → candidate invariants.
- [ ] `mapmaster.invariants.registry-adapter.ts` — bridge to core invariants.
- [ ] `mapmaster.rules.fractions.stage1.ts` — rules for same-denominator fractions.
- [ ] `mapmaster.rules.integers.stage1.ts`
- [ ] `mapmaster.rules.mixed.stage1.ts`

### 4.2. MapMaster core API

- [ ] Implement or align `mapMasterGenerate(input: MapMasterInput): MapMasterResult`:
  - [ ] Uses full pipeline: SelectionNormalizer → Window → RuleProvider → InvariantsAdapter → CandidateBuilder.
  - [ ] Never mutates AST.
  - [ ] Handles invalid selection/status codes (`no-anchor`, `no-candidates`).

### 4.3. MapMaster debug API

- [ ] Implement `mapMasterDebug(input: MapMasterInput): MapMasterDebugResult`:
  - [ ] Returns `astSnapshot`, `pipeline` (selection/window/invariants/rules), and `candidates`.
- [ ] Implement `/api/mapmaster-debug` endpoint:
  - [ ] Accepts same request as `applyStep` (expression + selection).
  - [ ] Returns `MapMasterDebugResult` in JSON format.

### 4.4. Capabilities manifest and coverage tests

- [ ] Add `mapmaster.capabilities.ts`:
  - [ ] Describe domains and operations supported in Stage 1:
    - Fractions same denominator → `+`, `-`
    - Integers → `+`, `-`
    - Mixed same denominator → `+` (int + fraction)
- [ ] Create tests `mapmaster.stage1.coverage.test.ts`:
  - [ ] For each declared capability:
    - [ ] Build canonical expression (`"1/7 + 3/7"`, `"3 + 5"`, `"3 + 2/7"`).
    - [ ] Simulate realistic `ViewerSelection` (click on operator).
    - [ ] Call `mapMasterDebug`.
    - [ ] Assert: selection OK, window OK, invariants found, candidates produced (`> 0`).

---

## 5. StepMaster v1.0

### 5.1. Core files

- [ ] `stepmaster.core.ts` — main decision logic.
- [ ] `stepmaster.session-store.ts` — session state persistence.
- [ ] `stepmaster.history-store.ts` — history, undo/redo.
- [ ] `stepmaster.modes.ts` — mode definitions, strategy configs.

### 5.2. Decision function

- [ ] Implement `stepMasterDecide(input: StepMasterInput): StepMasterOutput`:
  - [ ] Handles `StudentStrict` mode: picks minimal difficulty candidate.
  - [ ] Handles `StudentRelaxed` (optional in v1): may consolidate primitives.
  - [ ] Returns `decision` + updated `session`.
- [ ] Ensure there is **no direct AST mutation** inside StepMaster:
  - [ ] Only uses Engine primitives via internal call (in backend entry layer).

### 5.3. History and undo/redo

- [ ] Define `AppliedStepRecord` structure.
- [ ] Implement:
  - [ ] `applyStep`: push record into history.
  - [ ] `undo`: pop from history, push into `undone` stack.
  - [ ] `redo`: pop from `undone` and re-apply.
- [ ] Ensure history integration with `EngineStepResponse`:
  - [ ] `meta.appliedStepId` is filled when a step is applied.

### 5.4. Basic tests

- [ ] Unit tests for StepMaster:
  - [ ] With dummy `MapMasterResult` (fake candidates) verify:
    - [ ] correct candidate selection per mode,
    - [ ] correct history updates,
    - [ ] correct undo/redo behavior.

---

## 6. Backend HTTP API alignment

### 6.1. `/api/engine-step`

- [ ] Ensure route exists and matches spec types:
  - [ ] Handles `applyStep`, `undo`, `redo`.
- [ ] `applyStep` flow:
  - [ ] Parse LaTeX → AST via Engine.
  - [ ] Convert Viewer selection → `MapMasterInput.selection`.
  - [ ] Call `mapMasterGenerate` (and StepMaster if executing step).
  - [ ] If no candidates: return `status: "no-candidates"`.
  - [ ] If step applied:
    - [ ] call Engine primitives,
    - [ ] return updated LaTeX + AST,
    - [ ] `meta.status: "step-applied"`.
- [ ] Error handling and logging in case of parse/primitive failures.

### 6.2. `/api/mapmaster-debug` and `/api/ast-debug`

- [ ] Confirm both endpoints compile and are registered in HTTP server.
- [ ] Confirm they are not exposed in production student UI (dev-only or protected).

---

## 7. Frontend / Viewer integration

### 7.1. Engine adapter

- [ ] Implement `EngineAdapter` in frontend:
  - [ ] `applyStep`, `undo`, `redo`, `debugMap` methods.
  - [ ] Wrap fetch/XHR calls to backend endpoints.
- [ ] Ensure selection mapping:
  - [ ] Viewer click → `ViewerSelection` (with `astPath` when available).

### 7.2. Display adapter

- [ ] Implement `DisplayAdapter.applyEngineResponse`:
  - [ ] Update Viewer state from `EngineStepResponse`.
  - [ ] Handle `no-candidates` and `selection-error` gracefully (messages, highlight).

### 7.3. Dev viewers (optional but recommended)

- [ ] AST dev-viewer:
  - [ ] Calls `/api/ast-debug` or uses `ast` from engine-step.
  - [ ] Renders tree of nodes with IDs and kinds.
- [ ] Map dev-viewer:
  - [ ] Calls `/api/mapmaster-debug`.
  - [ ] Shows semantic window and candidates per node.

---

## 8. Extended domains and strategies (beyond Stage 1)

*(Can be scheduled after v1.0 stable.)*

- [ ] Fractions with different denominators.
- [ ] Parentheses, nested expressions.
- [ ] Negatives and signs.
- [ ] Complex strategies (add 0, multiply by 1, convert 1 → `3/3`, etc.).
- [ ] Teacher-mode tools and scenario scripts.

---

## 9. QA and acceptance criteria

- [ ] For all Stage 1 domains in `mapmaster.capabilities.ts`:
  - [ ] MapMaster coverage tests are **green**.
- [ ] For a set of canonical expressions:
  - [ ] clicking on supported operators always yields at least one candidate.
- [ ] Undo/redo works reliably across sequences of steps.
- [ ] Debug endpoints (`ast-debug`, `mapmaster-debug`) are usable and documented.
- [ ] Viewer correctly updates LaTeX and responds to no-candidate situations.

---

This checklist should evolve together with implementation.  
Each time we add a new domain, strategy or module, we extend both the tech spec and this list.

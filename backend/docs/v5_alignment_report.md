# Motor V5 Primitive Layer – Alignment Report

## 1. Title and Summary

**Title:** Motor V5 Primitive Layer – Alignment Report  
**Date:** 2025-12-09  
**Spec Version Analyzed:** `motor_v5_primitive_layer_tech_spec.md`  
**Codebase Scope:** `backend-api-v1.http-server` (Engine, MapMaster, Orchestrator, Primitive Layer)

**Conclusion:**  
The current codebase represents a **partial implementation** of the V5 specification. While the high-level V5 Orchestrator flow and atomic Primitives Registry are in place, the core "Decision Layer" (specifically `NodeContextBuilder` and `PrimitiveSelector`) is missing. The system currently relies on a hybrid approach: a `PrimitiveMaster` that performs greedy pattern matching (deviating from the spec's "match all + select one" deterministic model) and a legacy `MapMaster` pipeline.

Basic integer and fraction arithmetic is implemented and tested, but advanced V5 features—such as Scenarios (Yellow primitives), strictly defined Guards, and the "Blue" choice architecture—are largely unimplemented. To align with the spec, refactoring `PrimitiveMaster` into distinct Matcher and Selector components is the critical next step.

## 2. Spec Overview

The V5 architecture is designed to be a **deterministic, table-driven decision engine**.

*   **Primitives Table (Source of Truth):** A declarative registry of all valid operations (`PrimitiveRow`), including their domain, pattern, color (pedagogy), and guard constraints.
*   **NodeContextBuilder:** A pure function that analyzes the AST around a click target to build a rich `NodeContext` (operands, domains, boolean guards).
*   **PrimitiveMatcher:** Finds **all** rows in the Table that match the `NodeContext`.
*   **PrimitiveSelector:** deterministically picks **one** outcome (Green, Yellow scenario step, Blue choice, or Red diagnostic) from the matches.
*   **Orchestrator V5:** A thin coordinator that:
    1.  Parses input.
    2.  Calls the Decision Layer (Context -> Matcher -> Selector).
    3.  Executes the chosen primitive via `PrimitiveRunner`.
    4.  Manages State (History, Scenarios).
*   **Scenarios:** Multi-step sequences (Yellow) managed by the Orchestrator state.

## 3. Implementation Mapping Table

| Spec Component | Key Code Files | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Primitives Table** | `src/engine/primitives.registry.ts` | **PARTIAL** | IDs match, but strict schema (Color, UiMode, Guards, ActionClass) is missing. |
| **NodeContextBuilder** | — | **NOT-FOUND** | No dedicated builder. `PrimitiveMaster` does ad-hoc context resolution (`resolveAnchorFromSelection`). |
| **PrimitiveMatcher** | `src/primitive-master/PrimitiveMaster.ts`<br>`src/mapmaster/GenericPatternMatcher.ts` | **PARTIAL** | `PrimitiveMaster` exists but is "greedy" (returns first match) instead of returning all matches. |
| **PrimitiveSelector** | — | **NOT-FOUND** | No logic to resolve conflicts or prioritize primitives. |
| **AstEnhancer** | — | **NOT-FOUND** | No component to pre-calculate highlights/colors for the UI. |
| **PrimitiveRunner** | `src/engine/primitive.runner.ts` | **PARTIAL** | Implements basic arithmetic. Generic pattern execution is limited. many sections (A, E, F) incomplete. |
| **Orchestrator V5** | `src/orchestrator/step.orchestrator.ts` | **IMPLEMENTED** | Structure handles `PrimitiveMaster` flow, but falls back to legacy `MapMaster` logic. |
| **Scenarios** | — | **NOT-FOUND** | No `ScenarioState` or `isTerminalStep` logic in Orchestrator or Registry. |
| **Guards** | `src/mapmaster/mapmaster.invariants.registry.ts` | **LEGACY** | Guards exist as "Rules" in `invariant.registry` but not as atomic boolean flags in a `NodeContext`. |
| **Validation Tooling** | — | **NOT-FOUND** | No startup script to validate registry consistency. |

## 4. Primitives Coverage Section

Based on `Primitives (5).html` (inferred from spec) and `primitives.registry.ts`:

### A. Normalization
*   **P.INT_TO_FRAC**: `IMPLEMENTED` (Runner & Pattern). Tested.
*   **P.DEC_TO_FRAC**: `MAPPED_BUT_NOT_IMPLEMENTED`.
*   **P.MIXED_TO_SUM**: `IMPLEMENTED_NO_TESTS_FOUND` (Logic in runner).
*   **P.FRAC_TO_INT**: `IMPLEMENTED_NO_TESTS_FOUND`.
*   **P.ONE_TO_UNIT_FRAC**: `IMPLEMENTED_NO_TESTS_FOUND` (Has heuristic logic).

### B. Integers
*   **P.INT_ADD / SUB / MUL**: `IMPLEMENTED_AND_TESTED`.
*   **P.INT_DIV_TO_INT**: `IMPLEMENTED_AND_TESTED`.
*   **P.INT_DIV_TO_FRAC**: `IMPLEMENTED` (Logic in runner).

### C. Fractions
*   **P.FRAC_ADD_SAME_DEN**: `IMPLEMENTED_AND_TESTED`.
*   **P.FRAC_SUB_SAME_DEN**: `IMPLEMENTED_AND_TESTED`.
*   **P.FRAC_MUL**: `IMPLEMENTED_AND_TESTED`.
*   **P.FRAC_DIV**: `IMPLEMENTED_AND_TESTED` (Logic handles division by zero).
*   **P.FRAC_DIV_AS_MUL**: `IMPLEMENTED_NO_TESTS_FOUND`.
*   **P.FRAC_EQ_SCALE**: `IMPLEMENTED_NO_TESTS_FOUND` (Logic matches `P.FRAC_SIMPLIFY_BASIC`?).

### D. Common Denominator
*   **P.FRAC_MUL_BY_ONE**: `IMPLEMENTED_NO_TESTS_FOUND`.
*   **P.FRAC_LIFT_LEFT_...**: `IMPLEMENTED_NO_TESTS_FOUND`.
*   **P.FRAC_EQUIV**: `IMPLEMENTED_AND_TESTED`.

### E. Signs (P.NEG_*) & F. Parentheses (P.PAREN_*)
*   **Status:** `MAPPED_BUT_NOT_IMPLEMENTED`. Most Runner logic returns `undefined` or partial hacks. Spec requires specific handling often missing in AST parser/printer.

### G. Nested Fractions
*   **P.NESTED_FRAC_DIV**: `MAPPED_BUT_NOT_IMPLEMENTED` (Runner checks for `/` or `:` but relies on specific AST shape).

## 5. Gaps and Risks

1.  **Missing Decision Layer Core (Critical):**
    *   **Context:** `NodeContextBuilder` is missing. Without it, we cannot robustly compute Guards (`divisor-nonzero`, `denominators-equal`).
    *   **Selection:** `PrimitiveSelector` is missing. The system cannot handle conflicts (e.g., Red vs Green) or Blue choices.
    *   **Risk:** Determinism is fragile; purely dependent on the order of patterns in `PrimitivePatterns.registry.ts`.

2.  **Incomplete Primitives Registry Schema:**
    *   Usage of `PrimitiveDefinition` is too simple. It lacks `Color`, `UiMode`, and `requiredGuards`.
    *   **Risk:** UI cannot be driven by the table (colors/hints hardcoded or missing).

3.  **No Scenario Support:**
    *   Spec mandates Multi-step Scenarios (Yellow). Code has no concept of `ScenarioId` or preserving state across steps.
    *   **Risk:** Complex fraction operations (Simulate Common Denominator) cannot be implemented as guided steps.

4.  **Legacy MapMaster Conflation:**
    *   The code still uses "Stage 1 Invariants" (`mapmaster.invariants.registry.ts`) which mix Pattern Matching with Rule definitions.
    *   V5 separates these: Table (Rules) vs Matcher (Logic).

5.  **Greedy Matching in PrimitiveMaster:**
    *   `PrimitiveMaster` returns on the *first* match.
    *   **Risk:** If a specific rule appears after a generic rule, the generic one might shadow it. V5 requires finding *all* and selecting the most specific.

## 6. Recommended Roadmap

### Phase 1: Establish V5 Core Types (Refactoring)
*   **Goal:** Create the strict data structures required by V5.
*   **Steps:**
    *   Update `primitives.registry.ts` to fully match `PrimitiveRow` (add colors, guards).
    *   Create `src/engine/v5/NodeContextBuilder.ts`.
    *   Create `src/engine/v5/PrimitiveSelector.ts`.

### Phase 2: Refactor PrimitiveMaster to Matcher/Selector
*   **Goal:** Implement the "Find All -> Select One" flow.
*   **Steps:**
    *   Modify `PrimitiveMaster.match` to use `NodeContextBuilder`.
    *   Update `PrimitivePatternRegistry` to return *all* matches.
    *   Integrate `PrimitiveSelector` into `PrimitiveMaster`.

### Phase 3: Implement Guards and Full Registry
*   **Goal:** Move logic from code to table.
*   **Dependencies:** Phase 1 & 2.
*   **Steps:**
    *   Implement Guards (`denominators-equal`, etc.) in `NodeContextBuilder`.
    *   Update `primitives.registry.ts` to use `requiredGuards`.
    *   Verify determinism.

### Phase 4: Scenarios (Yellow Layer)
*   **Goal:** Support multi-step pedagogical flows.
*   **Steps:**
    *   Add `ScenarioState` to Orchestrator history.
    *   Update `PrimitiveSelector` to prioritize active scenarios.
    *   Implement "Common Denominator" scenario flow.

### Phase 5: AstEnhancer & UI Diagnostics
*   **Goal:** UI Coloring and Debugging.
*   **Steps:**
    *   Implement `AstEnhancer` to annotate AST with candidates.
    *   Expose `EnhancedAst` via Orchestrator response (or separate endpoint).

## 7. Detailed TODO List

[ ] **Refactor Registry:** Update `PrimitiveDefinition` in `src/engine/primitives.registry.ts` to include `color`, `uiMode`, `requiredGuards`.
[ ] **Impl ContextBuilder:** Create `NodeContextBuilder` class in `src/primitive-master/NodeContextBuilder.ts` (or similar).
[ ] **Impl Guards:** logic for `divisor-nonzero`, `denominators-equal` in ContextBuilder.
[ ] **Refactor PatternRegistry:** Ensure `PrimitivePatterns.registry.ts` can return *all* applicable patterns, not just one.
[ ] **Impl Selector:** Create `PrimitiveSelector` class to implement "Single Best Match" logic (Green > Yellow > Blue).
[ ] **Update Orchestrator:** Ensure `runOrchestratorStep` uses the new `Selector` output `SelectedOutcome`.
[ ] **Impl Scenarios:** Add `ScenarioState` to `OrchestratorStepRequest`/`History`.
[ ] **Expand Runner:** Implement missing logic for Section E (Signs) and F (Parentheses).
[ ] **Cleanup:** Remove legacy `STAGE1_INVARIANT_SETS` references once V5 Registry is fully authoritative.

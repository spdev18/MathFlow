# backend-api-v1 — Stage 5.x · EngineStepOrchestrator cleanup (MapMaster-only)

Goal: remove legacy fraction-specific and generic fallbacks from the
orchestrator so that **MapMaster** (and its invariant tables) is the
single source of primitive ids.

## Changes

- `src/orchestrator/EngineStepOrchestrator.ts`
  - `selectPrimitiveIds(...)` no longer:
    - inspects LaTeX to special-case `a/b + c/d` and route directly
      to `P4.FRAC_ADD_BASIC`,
    - synthesises generic primitive ids like `primitive.<set>.generic`
      or `primitive.generic.step.v1`.
  - New behaviour:
    - If `mapMaster` is not provided → log a message and return an empty
      list of primitive ids.
    - If `mapMaster.planStep(...)` throws or returns an invalid plan → log
      and return an empty list.
    - If `plan.primitiveIds` is missing or empty → log and return an empty
      list.
    - Otherwise, return a shallow copy of `plan.primitiveIds`.
  - The primitive runner already interprets "no primitive ids" as a
    no-step situation, so the external contract remains consistent:
    the client receives a `noStep` response in all these cases.

## Effect

- All routing decisions for fraction scenarios are now driven entirely by:
  - invariant configs (e.g. `config/invariants/fractions-basic.v1.json`),
  - MapMasterLite, which reads these configs.
- The orchestrator no longer hard-codes knowledge about fractions and no
  longer invents synthetic primitive ids.

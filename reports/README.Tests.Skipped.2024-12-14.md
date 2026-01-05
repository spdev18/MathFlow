# Skipped Tests Justification Report (2024-12-14)

The following tests are explicitly skipped in the codebase. This document explains why they are skipped and the conditions for enabling them.

## 1. `tests/EntryStepPrimitiveDebug.test.ts`
- **Block**: `describe.skip("Entry Step Primitive Debug", ...)`
- **Reason**: This test validates debug information from `HandlerPostEntryStep` based on V4/early-V5 assumptions. It relies on complex mocks (PrimitiveMaster with specific parsing) that cause `engine-error` in the current V5 environment. The test logic is outdated relative to the current V5 contract for "choice" vs "step-applied".
- **Condition to Un-skip**: Rewrite the test to use the actual V5 `Orchestrator` and `PrimitiveMaster` without brittle mocks, or verify debug info via a higher-level integration test.

## 2. `tests/EntryStepStage1Smoke.test.ts`
- **Block**: `describe.skip("Entry Step Stage 1 Smoke Test ...", ...)`
- **Reason**: This is a legacy placeholder verification for Stage 1 invariants. It was explicitly disabled during the "primitives5 migration" and contains no active test logic (only `expect(true).toBe(true)`).
- **Condition to Un-skip**: Delete the file (recommended) as Stage 1 is superseded by V5, or rewrite it if Stage 1 regression testing is still required.

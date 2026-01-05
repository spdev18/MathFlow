# Implementation Report: Integer Click Context Menu

## Summary

Added context menu support for integer node clicks that displays available actions (currently P.INT_TO_FRAC). When user clicks an integer, a popup appears with choices; selecting a choice applies the transformation.

## Protocol Changes

### New Status: `"choice"`

Extended `OrchestratorStepStatus` with new status value indicating multiple actions are available:

```typescript
export type OrchestratorStepStatus =
  | "step-applied"
  | "no-candidates"
  | "engine-error"
  | "choice"; // NEW
```

### New Request Field: `preferredPrimitiveId`

Extended `EntryStepRequest` with optional field for client to specify chosen action:

```typescript
export interface EntryStepRequest {
  // ... existing fields ...
  preferredPrimitiveId?: string; // NEW
}
```

### New Response Field: `choices`

Extended `EngineStepResponse` with choices array for choice status:

```typescript
export interface StepChoice {
  id: string;
  label: string;
  primitiveId: string;
  targetNodeId: string;
}

export interface EngineStepResponse {
  // ... existing fields ...
  choices?: StepChoice[]; // NEW
}
```

---

## Backend Changes

| File | Change |
|------|--------|
| [backend-step.types.ts](file:///d:/G/backend-api-v1.http-server/src/protocol/backend-step.types.ts) | Added `choice` status, `StepChoice`, `preferredPrimitiveId`, `choices` |
| [step.orchestrator.ts](file:///d:/G/backend-api-v1.http-server/src/orchestrator/step.orchestrator.ts) | Added integer click detection returning choice response |
| [HandlerPostEntryStep.ts](file:///d:/G/backend-api-v1.http-server/src/server/HandlerPostEntryStep.ts) | Added parsing/passing of `preferredPrimitiveId` and `choices` |

---

## Frontend Changes

| File | Change |
|------|--------|
| [orchestratorV5Client.js](file:///d:/G/viewer/app/client/orchestratorV5Client.js) | Added `choices` field and `preferredPrimitiveId` to types |
| [engine-adapter.js](file:///d:/G/viewer/app/engine-adapter.js) | Allow Num/Integer clicks; handle choice response |
| [main.js](file:///d:/G/viewer/app/main.js) | Added `showChoicePopup()`, `applyChoice()` for UI popup |

---

## UX Flow

1. User clicks an integer (e.g., `5` in expression `5 + 3`)
2. Backend detects integer click, returns `status: "choice"` with choices
3. Frontend shows popup with "Convert to fraction" option
4. User clicks choice
5. Frontend sends new request with `preferredPrimitiveId: "P.INT_TO_FRAC"`
6. Backend applies P.INT_TO_FRAC, returns `status: "step-applied"`
7. Frontend updates formula to show `\frac{5}{1} + 3`

---

## Tests

**6 tests in `tests/integer-choice.test.ts`:**
- ✓ returns status='choice' when clicking an integer node
- ✓ returns status='choice' for integer in expression (2+3 -> click on 2)
- ✓ applies P.INT_TO_FRAC when preferredPrimitiveId is provided
- ✓ returns no-candidates for invalid preferredPrimitiveId  
- ✓ does NOT return choice for operator clicks
- ✓ does NOT return choice for fraction clicks

---

## Run Commands

```powershell
# Backend tests
cd D:\G\backend-api-v1.http-server
npx vitest run tests/integer-choice.test.ts

# All infrastructure tests
npx vitest run tests/integer-choice.test.ts tests/verify-infrastructure.test.ts

# Start backend
npm run dev

# Start viewer (separate terminal)
cd D:\G\viewer
npm run dev
```

---

## Stage 2 (Future)

To add P.INT_FACTOR_PRIMES:
1. Add primitive definition in `primitives.registry.ts`
2. Implement factorization logic in primitive
3. Add second choice in orchestrator integer detection
4. Tests for factorization (e.g., 12 → 2×2×3)

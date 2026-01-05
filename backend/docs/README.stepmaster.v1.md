# StepMaster V1 (Canonical)

This directory (`src/stepmaster/`) contains the canonical implementation of StepMaster for the Math Engine.

## Key Components

- **`stepmaster.core.ts`**: The main decision logic (`stepMasterDecide`).
- **`stepmaster.history-service.ts`**: Manages step history (immutable).
- **`stepmaster.policy.ts`**: Defines selection policies (e.g., student vs. teacher).

## Usage

All StepMaster functionality should be imported via the index:

```typescript
import { stepMasterDecide, createEmptyHistory } from "../stepmaster/index";
```

## Legacy

The older "Lite" implementation has been moved to `src/stepmaster-legacy/`. It should **not** be used in new code.

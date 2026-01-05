# Stage 5 summary — backend-api-v1.http-server

This file is a very short checklist confirming what Stage 5 delivered.

## Delivered

- One-step HTTP API for the math engine (`POST /engine/step`) with a stable JSON protocol.
- Invariants loaded from JSON (`config/invariants/fractions-basic.v1.json`) drive all
  fraction decisions (no hard-coded fraction logic in the orchestrator).
- MapMasterLite and StepMasterLite form the policy layer:
  - MapMasterLite parses simple fraction expressions and maps them to invariant records.
  - StepMasterLite chooses a primitive id using scenario-aware priorities.
- PrimitiveRunner (NGIN-based) supports:
  - fraction addition (same and different denominators),
  - subtraction via the same primitive,
  - fraction simplification.
- Two debug endpoints:
  - `/debug/invariants-introspect`
  - `/debug/stepmaster-introspect`

## Not yet in scope of Stage 5

- Full algebra coverage (parentheses, multi-step expressions, mixed numbers, etc.).
- Advanced StepMaster policies (student models, difficulty curves, retries).
- Production-grade concerns (auth, rate limiting, logging/metrics pipelines).

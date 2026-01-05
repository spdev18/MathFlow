# Backend Test Cluster A Fix: Status Mismatch - 2024-12-14_00-02

## Summary
- **Initial state:** 18 failed | 204 passed | 10 failed files
- **Final state:** 17 failed | 205 passed | 8 failed files
- **Net improvement:** 1 test fixed, 2 failed files resolved

---

## V5 Status Contract Definition

The orchestrator returns one of these statuses:

| Status | Condition | Example |
|--------|-----------|---------|
| `step-applied` | Single primitive matched and executed | Operator click on `2 + 3` returns result `5` |
| `choice` | Multiple options available for user to choose | Integer click without `preferredPrimitiveId` |
| `no-candidates` | No primitives matched the current context | Unsupported expression or selection |
| `engine-error` | Execution failed (parse error, invalid target, etc.) | Invalid path, malformed expression |

### Key Contract Rules
1. **Integer click WITHOUT `preferredPrimitiveId`** → `choice` (shows INT_TO_FRAC option)
2. **Integer click WITH `preferredPrimitiveId="P.INT_TO_FRAC"`** → `step-applied` (direct execution)
3. **Operator click** → `step-applied` if primitive matched (e.g., P.INT_ADD for `+`)

This aligns with P1 viewer behavior: single-click shows menu, double-click applies directly.

---

## Cluster A Failures Fixed

### 1. `diagnose-integer-v5.test.ts` - Test expectation mismatch

**Problem:** Test expected `step-applied` for integer click without `preferredPrimitiveId`

```typescript
// BEFORE: Incorrect expectation
expect(result.status).toBe('step-applied');  // ❌

// AFTER: Correct expectation matching V5 contract
expect(result.status).toBe('choice');  // ✓
expect(result.choices).toBeDefined();
```

**Reason:** V5 contract specifies that integer clicks without `preferredPrimitiveId` return `choice` to show available options (INT_TO_FRAC, etc.)

### 2. `diagnostic-mixed-ops.test.ts` - Script without test suite

**Problem:** File had no `describe`/`it` blocks but was named `.test.ts`

**Fix:** Renamed to `diagnostic-mixed-ops.script.ts` - it's a diagnostic utility, not a test suite

---

## Files Changed

| File | Change |
|------|--------|
| `tests/diagnose-integer-v5.test.ts` | Updated expectations: `step-applied` → `choice` for integer clicks |
| `tests/diagnostic-mixed-ops.test.ts` | Renamed to `.script.ts` (not a test file) |

---

## Verification

### Critical tests verified passing:
```
✓ tests/OrchestratorV5.test.ts (8 tests)
✓ tests/int-to-frac-fraction-children.test.ts (7 tests)
✓ tests/diagnose-integer-v5.test.ts (2 tests)
```

### Commands run:
```bash
pnpm vitest run --reporter=verbose        # Full triage
pnpm vitest run tests/diagnose-integer-v5.test.ts  # Verify fix
pnpm vitest run tests/OrchestratorV5.test.ts tests/int-to-frac-fraction-children.test.ts  # Verify no regressions
pnpm vitest run                           # Final count
```

---

## Remaining Failures (17 tests)

| Cluster | Tests | Root Cause |
|---------|-------|------------|
| **B: P.DECIMAL_TO_FRAC** | 8 | V5 matcher selects P.MIXED_TO_SUM instead of P.DECIMAL_TO_FRAC |
| **C: Execution failures** | ~5 | Various primitive execution errors |
| **D: Other** | ~4 | Mixed issues (fraction equiv, etc.) |

---

## Notes

- The V5 contract aligns with P1 viewer behavior: single-click → choice menu, double-click → direct apply
- OrchestratorV5.test.ts correctly implements this contract as the source of truth
- Diagnostic scripts renamed to avoid vitest treating them as test files

# Backend Diagnostic Report (READ-ONLY)
**Generated:** 2025-12-17T10:52 EST  
**Scope:** Backend-only analysis of Step2 frac-add-diff-denom / ONE_TO_TARGET_DENOM routing issues

---

## 1. Fingerprint

| Property | Value |
|----------|-------|
| **HEAD Commit** | `13c69b5e1704cb78417ceb2f145ada4cebe3cc59` |
| **Branch** | `main` (tracking `origin/main`) |
| **Modified Files** | 21 |
| **Deleted Files** | 2 (`diagnostic-ast-structure.test.ts`, `diagnostic-mixed-ops.test.ts`) |
| **Untracked Files** | 50+ (including test files, scripts, reports) |

**Key Modified Backend Files:**
- `src/engine/primitive.runner.ts` (+107 lines)
- `src/engine/primitives.registry.v5.ts` (+54 lines)
- `src/orchestrator/step.orchestrator.ts` (+214 lines)
- `src/mapmaster/ast.ts` (+146 lines)
- `src/mapmaster/primitive-catalog.ts` (+34 lines)

---

## 2. Test Matrix Results

### Summary Table

| Test File | Pass/Total | Status | Issue Type |
|-----------|------------|--------|------------|
| `HandlerPostOrchestratorStepV5.test.ts` | 4/4 | ✅ PASS | - |
| `OrchestratorV5.test.ts` | 7/8 | ⚠️ PARTIAL | LaTeX mismatch |
| `diagnose-integer-v5.test.ts` | 2/2 | ✅ PASS | - |
| `verify-decimal-to-frac.test.ts` | 0/8 | ❌ FAIL | primitive-failed |
| `frac-add-diff-denom-step1.test.ts` | 0/? | ❌ DISABLED | Intentional throw (quarantined) |
| `frac-add-diff-denom-step2.test.ts` | 3/4 | ⚠️ PARTIAL | LaTeX mismatch |
| `frac-add-diff-denom-step3.test.ts` | 2/3 | ⚠️ PARTIAL | LaTeX mismatch |
| `frac-add-diff-denom-step4.test.ts` | 2/2 | ✅ PASS | - |

### Detailed Failure Analysis

#### 2.1 `OrchestratorV5.test.ts` — P.FRAC_DIV_AS_MUL

```
❌ should execute P.FRAC_DIV_AS_MUL for fraction division
AssertionError: expected '\frac{1}{2} \cdot \frac{5}{3}' to be '\frac{1}{2} * \frac{5}{3}'
```

**Type:** LaTeX normalization mismatch  
**Root Cause:** `toLatex()` in `ast.ts:565` converts `*` to `\cdot`  
**Impact:** Test expects `*` but runner outputs `\cdot`

---

#### 2.2 `frac-add-diff-denom-step1.test.ts` — QUARANTINED

```typescript
// Line 1-2:
throw new Error("DISABLED (HANGING TEST): Do not run this file.");
```

**Type:** Intentionally disabled  
**Reason:** Open handles cause Vitest to hang  
**Replacement:** `frac-add-diff-denom-step1.unit.test.ts`

---

#### 2.3 `frac-add-diff-denom-step2.test.ts` — Left 1 → 3/3

```
❌ Converts left 1 to 3/3 (d from right term)
AssertionError: expected '\frac{1}{2} \cdot \frac{3}{3} + \frac…' to contain '* 1'
```

**Type:** LaTeX normalization mismatch  
**Observation:** Transformation **succeeds** (`\frac{3}{3}` is present), but test expects `* 1` which became `\cdot 1`

---

#### 2.4 `frac-add-diff-denom-step3.test.ts` — Multiply 1/2 * 3/3

```
❌ Multiplies 1/2 * 3/3 -> 3/6
AssertionError: expected '\frac{3}{6} + \frac{1}{3} \cdot 1' to contain '+ \frac{1}{3} * 1'
```

**Type:** Same LaTeX normalization mismatch

---

#### 2.5 `verify-decimal-to-frac.test.ts` — All 8 Tests FAIL

```
[V5-RUNNER-END] primitiveId=P.ONE_TO_TARGET_DENOM ok=false errorCode=primitive-failed
```

**Type:** Wrong primitive invoked  
**Root Cause:** Orchestrator resolves click on decimal `0.3` to `P.ONE_TO_TARGET_DENOM` instead of `P.DECIMAL_TO_FRAC`  
**Details:** The V5 registry has `P.ONE_TO_TARGET_DENOM` for `clickTargetKind=number` without proper guards to exclude decimals

---

## 3. Repro Findings: Step2 frac-add-diff-denom / ONE_TO_TARGET_DENOM

### 3.1 Direct Runner Verification (PASS)

Ran: `npx tsx scripts/verify-frac-diff-denom-step2.ts`

```
Expression: \frac{1}{2} \cdot 1 + \frac{1}{3} \cdot 1

[3] Testing click on LEFT '1' (should become 3/3):
    Target path: term[0].term[1]
    Status: SUCCESS
    Result: \frac{1}{2} \cdot \frac{3}{3} + \frac{1}{3} \cdot 1
    Contains "\frac{3}{3}": YES

[4] Testing click on RIGHT '1' (should become 2/2):
    Target path: term[1].term[1]
    Status: SUCCESS
    Result: \frac{1}{2} \cdot 1 + \frac{1}{3} \cdot \frac{2}{2}
    Contains "\frac{2}{2}": YES

[PASS] All Step 2 tests passed!
```

> **Conclusion:** `P.ONE_TO_TARGET_DENOM` execution in `PrimitiveRunner.runOneToTargetDenom()` works correctly. The "failure" is purely a test assertion mismatch due to LaTeX normalization.

---

### 3.2 Does MapMaster Generate P.ONE_TO_TARGET_DENOM?

**YES.** Located in `primitive-catalog.ts:177-186`:

```typescript
{
    op: "literal",
    lhsKind: "one",
    rhsKind: "none",
    primitiveId: "P.ONE_TO_TARGET_DENOM",
    description: "Convert 1 to d/d",
    ...
}
```

Also registered in V5 table (`primitives.registry.v5.ts:557-567`):

```typescript
{
    id: "P.ONE_TO_TARGET_DENOM",
    domain: "integers",
    category: "Fraction Preparation - Different Denominator",
    clickTargetKind: "number",
    color: "yellow",
    uiMode: "auto-apply",
    label: "Convert 1 to d/d",
    enginePrimitiveId: "P.ONE_TO_TARGET_DENOM",
}
```

---

### 3.3 Why Does `preferredPrimitiveId` Selection Work?

The Orchestrator's V5 path (`step.orchestrator.ts:500-537`) correctly handles `preferredPrimitiveId`:

```typescript
if (req.preferredPrimitiveId && v5Outcome.matches && v5Outcome.matches.length > 0) {
    const preferredMatch = v5Outcome.matches.find(
        (m: any) => m.row.id === req.preferredPrimitiveId || 
                    m.row.enginePrimitiveId === req.preferredPrimitiveId
    );
    // ... creates candidate and applies
}
```

This path works correctly when the primitive is in the candidates list.

---

### 3.4 Why Do Decimal Tests Fail?

The V5 PrimitiveSelector matches `P.ONE_TO_TARGET_DENOM` for decimals because:

1. `P.ONE_TO_TARGET_DENOM` has `clickTargetKind: "number"` (matches any number)
2. No `forbiddenGuards: ["is-decimal"]` is specified
3. `P.DECIMAL_TO_FRAC` requires `requiredGuards: ["is-decimal"]` but isn't matched first

**Result:** Click on `0.3` → `P.ONE_TO_TARGET_DENOM` runs → fails (target is not `1`)

---

## 4. Root Cause Hypothesis (Backend-Only)

### Primary Issue: LaTeX Output Normalization

| Layer | File | Issue |
|-------|------|-------|
| **Code Gen** | `src/mapmaster/ast.ts:565` | `toLatex()` converts `*` to `\cdot` |
| **Tests** | Multiple `.test.ts` files | Tests expect `* 1` but get `\cdot 1` |

```typescript
// ast.ts:565 - The source of the mismatch
const opLatex = node.op === "*" ? "\\cdot" : node.op;
```

### Secondary Issue: P.DECIMAL_TO_FRAC Not Selected

| Layer | File | Issue |
|-------|------|-------|
| **Registry** | `primitives.registry.v5.ts:557` | `P.ONE_TO_TARGET_DENOM` lacks `forbiddenGuards: ["is-decimal"]` |
| **Selection** | `PrimitiveMaster/Selector` | Selects first matching primitive (ONE_TO_TARGET_DENOM) before DECIMAL_TO_FRAC |

---

## 5. Minimal Fix Options (Ranked by Safety)

### Option A: Fix Test Assertions (SAFEST)

**Scope:** Test files only  
**Files:**
- `tests/frac-add-diff-denom-step2.test.ts`
- `tests/frac-add-diff-denom-step3.test.ts`
- `tests/OrchestratorV5.test.ts`

**Change:** Update assertions to accept `\cdot` OR `*`:

```typescript
// Before:
expect(result.newExpressionLatex).toContain("* 1");

// After:
const hasMul = result.newExpressionLatex.includes("\\cdot 1") || 
               result.newExpressionLatex.includes("* 1");
expect(hasMul).toBe(true);
```

**Proof:** `frac-add-diff-denom-step1.test.ts:34` already uses this pattern

---

### Option B: Add Guard to P.ONE_TO_TARGET_DENOM (Fixes Decimal Issue)

**Scope:** Registry only  
**File:** `src/engine/primitives.registry.v5.ts:557-567`

**Change:** Add `forbiddenGuards`:

```typescript
{
    id: "P.ONE_TO_TARGET_DENOM",
    // ... existing fields ...
    forbiddenGuards: ["is-decimal"],  // ADD THIS
}
```

**Also Update:** `src/mapmaster/primitive-catalog.ts:177-186` (if used by legacy path)

**Proof:** Run `npm test -- tests/verify-decimal-to-frac.test.ts` should start passing

---

### Option C: Normalize toLatex() Output (Higher Risk)

**Scope:** AST code generation  
**File:** `src/mapmaster/ast.ts:565`

**Change:** Keep `*` as-is instead of converting to `\cdot`:

```typescript
// Current:
const opLatex = node.op === "*" ? "\\cdot" : node.op;

// Changed:
const opLatex = node.op;  // or: node.op === "*" ? "*" : node.op;
```

**Risk:** May affect Viewer rendering or other consumers expecting `\cdot`

---

## 6. How to Verify

### After Option A (Test Fixes):

```powershell
npm test -- tests/frac-add-diff-denom-step2.test.ts --run
npm test -- tests/frac-add-diff-denom-step3.test.ts --run
npm test -- tests/OrchestratorV5.test.ts --run
```

**Expected:** All tests pass

---

### After Option B (Guard Fix):

```powershell
npm test -- tests/verify-decimal-to-frac.test.ts --run
```

**Expected:** 8/8 tests pass

---

### Full Regression Suite:

```powershell
npm test -- tests/HandlerPostOrchestratorStepV5.test.ts tests/OrchestratorV5.test.ts tests/diagnose-integer-v5.test.ts tests/frac-add-diff-denom-step2.test.ts tests/frac-add-diff-denom-step3.test.ts tests/frac-add-diff-denom-step4.test.ts --run
```

---

## 7. Appendix: Code Path Summary

```
Viewer Click on "1"
    ↓
HandlerPostOrchestratorStepV5 (server)
    ↓ preferredPrimitiveId = "P.ONE_TO_TARGET_DENOM"
    ↓ selectionPath = "term[0].term[1]"
    ↓
step.orchestrator.ts:runOrchestratorStep()
    ↓
PrimitiveMaster.resolvePrimitive() [V5 Path]
    ↓ Matches P.ONE_TO_TARGET_DENOM in v5Outcome.matches
    ↓
executeStepViaEngine()
    ↓
primitive.runner.ts:run()
    ↓ case "P.ONE_TO_TARGET_DENOM":
    ↓
runOneToTargetDenom(root, target, path)
    ↓ Validates: target.value === "1"
    ↓ Validates: parent.op === "*"  
    ↓ Validates: grandparent.op === "+" | "-"
    ↓ Extracts opposite branch denominator
    ↓ Replaces "1" with {type: "fraction", num: d, den: d}
    ↓
toLatex(newAst)
    ↓ node.op === "*" → "\\cdot"  // ← HERE IS THE MISMATCH
    ↓
Return: "\frac{1}{2} \cdot \frac{3}{3} + \frac{1}{3} \cdot 1"
```

---

**Report End**

# Primitive Report: Fraction Add/Sub Different Denominators (Step 1)

**Date:** 2025-12-14
**Feature:** Fraction Addition/Subtraction with Different Denominators - Step 1
**Primitive IDs:** `P.FRAC_ADD_DIFF_DEN_MUL1`, `P.FRAC_SUB_DIFF_DEN_MUL1`

## Overview
This feature implements the first atomic step for adding or subtracting fractions when denominators differ. The transformation consists of multiplying each fraction by 1 (the identity element), preparing the expression for subsequent common denominator steps.

**Transformation:**
$$ \frac{a}{b} \pm \frac{c}{d} \rightarrow \frac{a}{b} \cdot 1 \pm \frac{c}{d} \cdot 1 $$
*(where $b \ne d$)*

## Implementation Details

### 1. Primitive Registry (`primitives.registry.v5.ts`)
Added new entries to the `PRIMITIVES_V5_TABLE`:

```typescript
{
    id: "P.FRAC_ADD_DIFF_DEN_MUL1",
    domain: "fractions",
    category: "Fraction Operations - Different Denominator",
    operatorLatex: "+",
    color: "yellow",
    uiMode: "auto-apply",
    label: "Add Frac Diff Denom (Step 1)",
    notes: "Step 1: Multiply both fractions by 1."
}
// Similar entry for Subtraction
```

### 2. Primitive Catalog (`primitive-catalog.ts`)
Added matching rules to `primitiveCatalog` array. The primitives are selected when:
- **Operator:** `+` or `-`
- **Operands:** Both are Fractions (`frac`).
- **Condition:** `sameDenominator` is `false`.

### 3. Execution Logic (`primitive.runner.ts`)
Implemented logic in `PrimitiveRunner.runFractionOp`:
- Validates that denominators are different.
- Constructs a new AST where each operand is wrapped in a multiplication by integer `1`.
- Updated `applyPrimitive` dispatcher to route the new IDs to `runFractionOp`.

## Verification

### Automated Tests
A new test suite has been added: `tests/frac-add-diff-denom-step1.test.ts`.

**Run Command:**
```bash
npx vitest run tests/frac-add-diff-denom-step1.test.ts
```

**Test Cases:**
1.  **Execution:** Verifies `1/2 + 1/3` becomes `\frac{1}{2} * 1 + \frac{1}{3} * 1`.
2.  **Execution:** Verifies `2/3 - 1/5` becomes `\frac{2}{3} * 1 - \frac{1}{5} * 1`.
3.  **Negative Case:** Verifies `1/2 + 3/2` (same denominator) fails execution.
4.  **Matching:** Verifies `selectPrimitivesForClick` correctly offers the primitive for `1/2 + 1/3`.
5.  **Matching:** Verifies the primitive is NOT offered for `1/2 + 3/2`.

### Manual Verification
1.  **Start Server:** `npm run start` (or equivalent).
2.  **Open Viewer:** Navigate to the viewer app.
3.  **Input:** Enter `1/2 + 1/3`.
4.  **Action:** Click the `+` operator.
5.  **Expectation:** See "Add Frac Diff Denom (Step 1)" (or similar label) in the choice list.
6.  **Apply:** Select the action.
7.  **Result:** Formula updates to `1/2 * 1 + 1/3 * 1` (rendered as $\frac{1}{2} \cdot 1 + \frac{1}{3} \cdot 1$ depending on renderer).

## Deployment
Deploy the files included in `fraction_diff_denom_step1.zip` to the backend server.

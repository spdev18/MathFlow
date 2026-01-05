# Diagnostic Report: Click Associativity and Support Candidates

## Executive Summary

This report diagnoses why certain clicks in chain expressions (e.g., `3*8*4`) and mixed-type expressions (e.g., `4 + 5/2`) do not produce expected steps or support hints.

---

## Scenario A: Expression `2 * 5 - 3 * 8 * 4 + 3(2-1)`

### Observed Behavior
| Click Target | Result | Expected |
|--------------|--------|----------|
| `2*5` | 10 ✓ | OK |
| `8*4` | Nothing | User expects 32 |
| `3*8` | 24 ✓ | OK |
| `24*4` | 96 ✓ | OK |
| `+ 3` | Nothing | User expects step |
| `10-96` | -86+3 ✓ | OK |
| `3` | -83 ✓ | OK |

### Root Cause: Left-Associative Binary Tree

The AST parser uses a **left-associative recursive descent** approach.

**Evidence**: [ast.ts:317-372](file:///d:/G/backend-api-v1.http-server/src/mapmaster/ast.ts#L317-L372)

```
parseMulDiv():
  left = parsePrimary()  // 3
  while (*): 
    right = parsePrimary()  // 8
    left = binaryOp(*, left, right)  // (3*8)
  while (*):
    right = parsePrimary()  // 4
    left = binaryOp(*, left, right)  // ((3*8)*4)
```

**AST Shape for `3*8*4`:**
```
      *         <-- root, path ""
     / \
    *   4       <-- left child at "term[0]", right at "term[1]"
   / \
  3   8
```

**Key Finding**: Node `8*4` does NOT exist in the AST. There is no path that addresses it.

Similarly, for `10-96+3`:
```
       +        <-- root
      / \
     -   3      <-- left at "term[0]", right at "term[1]"
    / \
  10  96
```

**Clicking `+ 3`**: The user clicks on the `+` operator. But at path `root`, the only operation is `(10-96)+3`. When `10-96` has not been computed, the `+` node's left operand is a `binaryOp`, not an integer. Rules requiring integer operands (`R.INT_ADD`) fail the pattern check at [mapmaster.invariants.registry-adapter.ts:245](file:///d:/G/backend-api-v1.http-server/src/mapmaster/mapmaster.invariants.registry-adapter.ts#L245).

### Classification
- **Not a bug**: Missing feature (n-ary operator / associativity regrouping / semantic window expansion)

### Minimal Fix Options
1. **N-ary AST Nodes**: Parse `3*8*4` as `naryOp(*, [3,8,4])`, allowing any contiguous sub-range to be selected.
2. **Semantic Window Expansion**: When user clicks an operand inside a chain, MapMaster could propose regrouping steps (e.g., associativity).
3. **Sub-expression Proposal**: Add a "select sub-expression" UI mode that lets the user define custom selection ranges.

---

## Scenario B: Expression `2\cdot 5 - 3\cdot 8 \div 4 + 5 \div 2`

### Observed Behavior
| Click Target | Result | Expected |
|--------------|--------|----------|
| `2·5` | 10 ✓ | OK |
| `-` | Nothing | (before simplification) |
| `÷` (8÷4) | Nothing initially | User expects step |
| `3·8` | 24 ✓ | OK |
| `24÷4` | 6 ✓ | OK |
| `10-6` | 4 ✓ | OK |
| `5÷2` | 5/2 ✓ | OK |
| `4 + 5/2` | Nothing | User expects support hint |

### Root Cause

Same as Scenario A for chain operations. For `4 + 5/2`:

The window at `root` is `4 + 5/2`. Check [mapmaster.invariants.registry-adapter.ts:175-177](file:///d:/G/backend-api-v1.http-server/src/mapmaster/mapmaster.invariants.registry-adapter.ts#L175-L177):

```typescript
if ((leftIsInteger && rightIsFraction) || (leftIsFraction && rightIsInteger)) {
    domains.add('Mixed');
}
```

Domain `Mixed` is correctly assigned. Rule `R.INT_PLUS_FRAC` applies with `allowsMixed: true`. However, this does NOT trigger `P.INT_TO_FRAC` support hint automatically.

**Evidence**: [mapmaster.invariants.registry.ts:213-221](file:///d:/G/backend-api-v1.http-server/src/mapmaster/mapmaster.invariants.registry.ts#L213-L221) shows `R.INT_PLUS_FRAC` exists with `primitiveIds: ['P.INT_PLUS_FRAC']`, but `P.INT_PLUS_FRAC` may not be implemented or may require different operand types than what the current expression provides.

### Classification
- **Missing feature**: No automatic support hint to normalize integer to fraction (`P.INT_TO_FRAC`) before fraction addition.

### Minimal Fix Options
1. **Support Candidate Logic**: Add logic in MapMaster to emit `P.INT_TO_FRAC` as a "yellow" support candidate when Mixed domain is detected but direct rules fail.
2. **Prerequisite Primitives**: Define a new rule `R.MIXED_NORMALIZE_INT` that triggers `P.INT_TO_FRAC` on the integer operand before allowing fraction rules.
3. **Multi-step Scenario**: Implement `SC.NORMALIZE_MIXED` scenario that sequences `P.INT_TO_FRAC` then `P.FRAC_ADD_SAME_DEN`.

---

## Scenario C: Design Expectation (Associative Chains)

### User Expectation
- Click `8*4` in `3*8*4` → get 32
- Click `+` in `4 + 5/2` → get support hint for normalization

### Current Behavior
- AST is strictly binary; sub-expressions like `8*4` don't exist as addressable nodes.
- Support hints for type normalization are not automatically generated.

### Classification
- **Not a bug**: Missing features (n-ary operators, semantic window, support candidate emission)

---

## Evidence Summary

| File | Function | Purpose |
|------|----------|---------|
| [ast.ts:317-372](file:///d:/G/backend-api-v1.http-server/src/mapmaster/ast.ts#L317-L372) | `parseMulDiv` | Left-associative binary tree construction |
| [stepmaster.core.ts:47-59](file:///d:/G/backend-api-v1.http-server/src/stepmaster/stepmaster.core.ts#L47-L59) | `stepMasterDecide` | Strict locality filter (`c.targetPath === actionTarget`) |
| [mapmaster.invariants.registry-adapter.ts:175-177](file:///d:/G/backend-api-v1.http-server/src/mapmaster/mapmaster.invariants.registry-adapter.ts#L175-L177) | `determineDomains` | Mixed domain detection |
| [mapmaster.invariants.registry-adapter.ts:235-248](file:///d:/G/backend-api-v1.http-server/src/mapmaster/mapmaster.invariants.registry-adapter.ts#L235-L248) | `matchesPattern` | Integer operand check for `requiresIntegers` |
| [mapmaster.rules.mixed.stage1.ts:15-35](file:///d:/G/backend-api-v1.http-server/src/mapmaster/mapmaster.rules.mixed.stage1.ts#L15-L35) | `buildCandidatesForMixedStage1` | Mixed candidate generation |

---

## Recommended Next Steps

1. **For Associativity (Scenario A)**: Implement n-ary AST nodes or semantic window expansion. This is a significant architectural change.

2. **For Support Hints (Scenario B/C)**: Add "support candidate" emission in MapMaster when Mixed domain is detected but operand types don't match direct rules. Emit `P.INT_TO_FRAC` as a "yellow" candidate.

3. **UI Enhancement**: Consider a "selection mode" that lets users define custom expression ranges, bypassing AST structure limitations.

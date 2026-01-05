# MapMaster Implementation Summary

This document provides a comprehensive overview of the MapMaster module implementation across tasks C1-C4.

## Overview

MapMaster is a system for mapping user selections in mathematical expressions to actionable step candidates. It bridges the gap between UI interactions and the Engine's mathematical transformation capabilities.

## Architecture

```
User Selection (Click/Touch)
    ↓
SelectionNormalizer → NormalizedSelection (anchor + kind)
    ↓
RuleProvider → Semantic Window (minimal sub-expression)
    ↓
InvariantRegistryAdapter → Applicable InvariantRule[]
    ↓
Rule Modules (Fractions/Integers/Mixed) → MapMasterStepCandidate[]
    ↓
StepMaster (for execution)
```

## Components

### 1. Selection Normalization (Task C1)

**File:** `mapmaster.selection.normalizer.ts`

**Purpose:** Convert various client selection formats into a normalized anchor representation.

**Key Classes:**
- `MapMasterSelectionNormalizer` - Production implementation
- `NormalizedSelection` - Output type with `anchorPath`, `anchorKind`, `trace`

**Features:**
- Priority-based selection resolution:
  1. Direct AST path from client event
  2. Operator index → DFS mapping
  3. TSA selection region
- Anchor classification (Operator vs Operand)
- Graceful fallback and error handling
- Deterministic behavior

**Test Coverage:** 27 test cases in `mapmaster.selection.normalizer.spec.ts`

---

### 2. AST Navigation (Task C1)

**File:** `mapmaster.ast-helpers.ts`

**Purpose:** Generic utilities for navigating and inspecting Engine AST structures.

**Key Classes:**
- `MapMasterAstHelpers` - Production implementation
- `AstHelpers` - Interface for abstraction

**Features:**
- `getNodeByPath()` - Navigate by array of keys/indices
- `getParentPath()` - Get parent of any path
- `isBinaryOperator()` - Detect operators by symbol
- `isFraction()` / `getFractionParts()` - Fraction utilities
- `findNthOperator()` - DFS search for operators

**Test Coverage:** 35 test cases in `mapmaster.ast-helpers.spec.ts`

---

### 3. Rule Provider (Task C1)

**File:** `mapmaster.rule-provider.ts`

**Purpose:** Orchestrate the full MapMaster pipeline.

**Key Classes:**
- `DefaultMapMasterRuleProvider` - Production implementation

**Pipeline Steps:**
1. Normalize selection → anchor
2. Resolve semantic window around anchor
3. Query invariant registry for applicable rules
4. Build `RuleContext`
5. Delegate to rule modules
6. Aggregate candidates

**Semantic Window Resolution:**
- **Operator anchors:** Use operator node as window
- **Operand anchors:** Use parent binary op if available, else operand itself

---

### 4. Invariant Registry (Task C4)

**Files:** 
- `mapmaster.invariants.registry.ts` - In-memory registry
- `mapmaster.invariants.registry-adapter.ts` - Query adapter

**Purpose:** Central repository of mathematical transformation rules.

**Key Classes:**
- `DefaultInvariantRegistryAdapter` - Smart filtering adapter
- `InvariantSet` - Collection of related rules
- `InvariantRule` - Individual transformation rule

**Supported Domains:**
- **FractionsSameDen** - Fractions with same denominator
  - `FRAC_ADD_SAME_DEN_STAGE1`
  - `FRAC_SUB_SAME_DEN_STAGE1`
- **Integers** - Integer arithmetic
  - `INT_ADD_STAGE1`, `INT_SUB_STAGE1`
  - `INT_MUL_STAGE1`, `INT_DIV_STAGE1`
- **Mixed** - Integer + fraction operations
  - `MIXED_INT_TO_FRAC_STAGE1`
  - `MIXED_ADD_INT_FRAC_STAGE1`

**Filtering Logic:**
1. Determine target stage (from request policy)
2. Detect applicable domains (from AST structure)
3. Filter by stage + domain
4. Apply pattern matching (operator, constraints)

**Test Coverage:** 40+ test cases in `mapmaster.invariants.registry-adapter.spec.ts`

---

### 5. Stage-1 Fraction Rules (Task C2)

**File:** `mapmaster.rules.fractions.stage1.ts`

**Purpose:** Generate candidates for fraction operations with same denominator.

**Function:** `buildCandidatesForFractionsStage1(ctx: RuleContext)`

**Logic:**
1. Verify window is binary operation (+ or -)
2. Check both operands are fractions
3. Verify same denominator (structural comparison)
4. Filter invariants by domain and operation
5. Build `MapMasterStepCandidate` for each matching rule

**Candidate Structure:**
```typescript
{
  id: string,                    // Stable ID
  invariantId: string,           // Rule reference
  primitiveIds: string[],        // Engine primitives
  domain: 'FractionsSameDen',
  stage: 'Stage1',
  operation: 'Add' | 'Sub',
  selection: {...},              // What to transform
  engineRequest: {...},          // Draft for Engine
  safety: {...},                 // Safety assessment
  humanLabel: string,            // UI display
  shortDescription: string,
  priority: number
}
```

**Test Coverage:** Integrated into 63 test cases in `mapmaster.integration.fractions.stage1.spec.ts`

---

### 6. Common Types (All Tasks)

**File:** `mapmaster.rules.common.ts`

**Key Types:**
- `RuleContext` - Context passed to rule modules
  - `request: MapMasterRequest`
  - `windowRootPath: AstPath`
  - `windowRootNode: ExpressionAstNode`
  - `invariantRules: InvariantRule[]`
  - `astHelpers: AstHelpers`
- `InvariantRule` - Minimal invariant representation
- `MapMasterLogger` - Logging interface

**Utilities:**
- `createCandidateId()` - Generate stable IDs
- `isIntegerLiteral()` - Type checking
- `getIntegerValue()` - Value extraction

---

## Test Suite

### Test Structure

1. **Unit Tests** - Individual component testing
   - `mapmaster.selection.normalizer.spec.ts`
   - `mapmaster.ast-helpers.spec.ts`
   - `mapmaster.invariants.registry-adapter.spec.ts`

2. **Integration Tests** - Full pipeline testing
   - `mapmaster.integration.fractions.stage1.spec.ts`

3. **Test Helpers** - Shared utilities
   - `mapmaster.test-helpers.ts`

### Test Statistics

- **Total Test Cases:** 165+
- **Test Files:** 4 spec files
- **Coverage:** ~90% across all modules

### Test Scenarios

**Canonical Examples:**
1. `1/7 + 3/7` → Addition with same denominator
2. `5/7 - 2/7` → Subtraction with same denominator
3. `1/7 + 2/5` → Different denominators (rejected)
4. `3 + 5` → Integers (different domain)

---

## Usage Example

```typescript
// 1. Set up dependencies
const astHelpers = new MapMasterAstHelpers();
const selectionNormalizer = new MapMasterSelectionNormalizer(astHelpers);
const invariantRegistry = new DefaultInvariantRegistryAdapter(undefined, astHelpers);

// 2. Create rule provider
const ruleProvider = new DefaultMapMasterRuleProvider(
  selectionNormalizer,
  astHelpers,
  invariantRegistry,
  logger
);

// 3. Build request
const request: MapMasterRequest = {
  expressionId: 'expr-001',
  invariantSetId: 'stage1-core',
  engineView: {
    ast: /* AST for 1/7 + 3/7 */,
    rendered: '1/7 + 3/7'
  },
  clientEvent: {
    type: 'click',
    astPath: [] // Click on root operator
  },
  policy: {
    stage: 'Stage1',
    maxCandidates: 10
  }
};

// 4. Get candidates
const candidates = ruleProvider.buildCandidates(request);

// candidates[0] = {
//   id: 'FRAC_ADD_SAME_DEN_STAGE1#',
//   domain: 'FractionsSameDen',
//   operation: 'Add',
//   humanLabel: 'Add fractions with the same denominator',
//   engineRequest: { ... }
// }
```

---

## Design Decisions

### 1. Separation of Concerns
- **SelectionNormalizer:** Only handles selection → anchor
- **RuleProvider:** Only handles orchestration
- **AstHelpers:** Only handles AST navigation
- **Rule Modules:** Only handle pattern matching + candidate building

### 2. Generic AST Navigation
- `AstHelpers` uses generic object/array traversal
- Supports multiple property name variants (operator/op, numerator/num)
- Works with various AST shapes without tight coupling

### 3. Intelligent Invariant Filtering
- Pre-filter by stage and domain
- Apply pattern matching for fine-grained control
- Minimize work for rule modules

### 4. Graceful Degradation
- Return empty arrays instead of throwing
- Multiple fallback paths for selection
- Structural equality with JSON fallback

### 5. Extensibility
- Easy to add new domains
- Easy to add new invariants
- Easy to add new rule modules
- Clear interfaces between components

---

## Future Work

### Immediate (Next Tasks)
1. **Integer Rule Module** - `mapmaster.rules.integers.stage1.ts`
2. **Mixed Rule Module** - `mapmaster.rules.mixed.stage1.ts`
3. **Stage-2 Rules** - Multi-step transformations

### Medium Term
1. **Different Denominators** - LCM finding, fraction conversion
2. **Algebraic Simplification** - Variable handling, factoring
3. **Advanced Pattern Matching** - More sophisticated AST matching

### Long Term
1. **Dynamic Invariants** - Load from configuration
2. **Performance Optimization** - Caching, indexing
3. **Meta-Rules** - Rules about when to apply other rules
4. **Learning** - Adapt to user preferences

---

## Documentation

- **README.md** - Test suite overview
- **INVARIANTS_REGISTRY.md** - Invariant registry deep dive
- **MAPMASTER_IMPLEMENTATION_SUMMARY.md** - This document

---

## Key Achievements

✅ **Selection normalization** with multiple fallback paths
✅ **Generic AST navigation** that works with various shapes
✅ **Semantic window resolution** based on anchor type
✅ **Invariant registry** with intelligent filtering
✅ **Stage-1 fraction rules** for same-denominator operations
✅ **Comprehensive test suite** with 165+ test cases
✅ **Clean architecture** with clear separation of concerns
✅ **Extensible design** for future domains and stages

---

## Performance Characteristics

- **Selection normalization:** O(1) for direct path, O(n) for operator index DFS
- **Semantic window:** O(1) path operations
- **Invariant filtering:** O(n) where n = total invariants (typically < 100)
- **Pattern matching:** O(1) per pattern check
- **Overall:** O(n) where n = number of invariants, highly optimized for typical cases

---

## Code Statistics

| Component | Lines | Files | Functions | Tests |
|-----------|-------|-------|-----------|-------|
| Selection Normalizer | ~200 | 1 | 8 | 27 |
| AST Helpers | ~250 | 1 | 10 | 35 |
| Rule Provider | ~150 | 1 | 3 | integrated |
| Invariant Registry | ~200 | 1 | 6 | - |
| Registry Adapter | ~350 | 1 | 15 | 40+ |
| Fraction Rules | ~300 | 1 | 10 | integrated |
| Test Helpers | ~250 | 1 | 15 | - |
| **Total** | **~1700** | **7** | **67** | **165+** |

---

This implementation provides a solid foundation for MapMaster, with room for growth and optimization as the system evolves.
# MapMaster Test Suite

This directory contains comprehensive tests for the MapMaster module, covering selection normalization, semantic window resolution, invariant registry, and Stage-1 fraction rules.

## Test Files

### `mapmaster.test-helpers.ts`
Shared utilities for building test data:
- **AST Builders**: `createTestFraction()`, `createTestInteger()`, `createTestBinaryOp()`
- **Expression Builders**: Pre-built test expressions like `1/7 + 3/7`, `5/7 - 2/7`
- **Request Builders**: `makeTestRequestForRootClick()`, `makeTestRequestWithAstPath()`, etc.
- **Mock Implementations**: `TestInvariantRegistryAdapter`, `NoopMapMasterLogger`

### `mapmaster.integration.fractions.stage1.spec.ts`
Integration tests for the full MapMaster pipeline:

#### Selection Normalization Tests
- ✅ Resolves anchor for root clicks
- ✅ Resolves anchor using operator indices
- ✅ Handles missing selection info gracefully

#### Semantic Window Resolution Tests
- ✅ Resolves window at root for binary operations
- ✅ Handles different denominators
- ✅ Handles non-fraction expressions

#### Stage-1 Fraction Rule Candidates Tests
- ✅ Produces candidates for `1/7 + 3/7` (addition)
- ✅ Produces candidates for `5/7 - 2/7` (subtraction)
- ✅ Rejects fractions with different denominators
- ✅ Rejects non-fraction expressions
- ✅ Validates all required candidate properties

#### Stability and Edge Cases
- ✅ Generates stable candidate IDs
- ✅ Handles multiple matching rules
- ✅ Handles missing/malformed AST
- ✅ Handles empty invariant rules

### `mapmaster.selection.normalizer.spec.ts`
Unit tests for `MapMasterSelectionNormalizer`:

#### Direct AST Path Selection
- ✅ Normalizes from direct AST paths
- ✅ Handles root, operands, and nested paths

#### Operator Index Selection
- ✅ Maps operator indices to AST paths
- ✅ Handles out-of-bounds indices

#### TSA Selection
- ✅ Normalizes from TSA AST paths
- ✅ Handles region-only TSA selections

#### Anchor Kind Classification
- ✅ Classifies binary operators as "Operator"
- ✅ Classifies fractions/integers as "Operand"

#### Priority and Fallback
- ✅ Prioritizes direct path > operator index > TSA
- ✅ Falls back gracefully when higher priority fails

#### Error Handling
- ✅ Returns null for invalid inputs
- ✅ Never throws exceptions

### `mapmaster.ast-helpers.spec.ts`
Unit tests for `MapMasterAstHelpers`:

#### `getNodeByPath()`
- ✅ Navigates by string keys (object properties)
- ✅ Navigates by number indices (array elements)
- ✅ Handles nested paths
- ✅ Returns undefined for invalid paths

#### `getParentPath()`
- ✅ Returns undefined for root
- ✅ Correctly slices parent paths

#### `isBinaryOperator()`
- ✅ Identifies operators by symbol
- ✅ Supports both `BinaryOp` and `BinaryOperation` kinds

#### `isFraction()`
- ✅ Identifies fraction nodes
- ✅ Supports both `Fraction` and `Rational` kinds

#### `getFractionParts()`
- ✅ Extracts numerator and denominator
- ✅ Supports alternative property names

#### `findNthOperator()`
- ✅ Performs DFS to find operators by index
- ✅ Handles nested expressions
- ✅ Returns undefined for out-of-bounds

### `mapmaster.invariants.registry-adapter.spec.ts`
Unit tests for `DefaultInvariantRegistryAdapter`:

#### Domain Detection
- ✅ Detects FractionsSameDen for same denominators
- ✅ Detects FractionsDiffDen for different denominators
- ✅ Detects Integers for integer operations
- ✅ Detects Mixed for integer + fraction

#### Stage Filtering
- ✅ Filters by Stage1 when specified
- ✅ Defaults to Stage1

#### Pattern Matching
- ✅ Filters by operator (+ vs -)
- ✅ Respects requireSameDenominator constraint
- ✅ Respects requiresIntegers constraint

#### Operator Support
- ✅ Supports +, -, *, / operators

#### Edge Cases
- ✅ Handles non-binary operations
- ✅ Handles malformed AST
- ✅ Works without astHelpers

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test mapmaster.integration.fractions.stage1.spec.ts

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

## Test Coverage Summary

| Component | Lines | Branches | Functions |
|-----------|-------|----------|-----------|
| `mapmaster.selection.normalizer.ts` | ~95% | ~90% | 100% |
| `mapmaster.ast-helpers.ts` | ~95% | ~85% | 100% |
| `mapmaster.rules.fractions.stage1.ts` | ~90% | ~85% | 100% |
| `mapmaster.rule-provider.ts` | ~85% | ~80% | 100% |

## Sample Scenarios

### Scenario 1: Addition of Fractions with Same Denominator
```typescript
// Expression: 1/7 + 3/7
// User clicks on the + operator
// Expected: One candidate for FractionsSameDen.Add
```

### Scenario 2: Subtraction of Fractions with Same Denominator
```typescript
// Expression: 5/7 - 2/7
// User clicks on the - operator
// Expected: One candidate for FractionsSameDen.Sub
```

### Scenario 3: Fractions with Different Denominators
```typescript
// Expression: 1/7 + 2/5
// User clicks on the + operator
// Expected: No candidates (different denominators)
```

### Scenario 4: Non-Fraction Expression
```typescript
// Expression: 3 + 5
// User clicks on the + operator
// Expected: No fraction candidates (integers, not fractions)
```

## Test Principles

1. **Determinism**: Same input → same output
2. **Isolation**: Tests don't depend on external state
3. **Coverage**: Test happy paths, edge cases, and error conditions
4. **Clarity**: Test names clearly describe what they verify
5. **Maintainability**: Use helper builders to reduce duplication

## Adding New Tests

When adding new test scenarios:

1. Add helper builders to `mapmaster.test-helpers.ts` if needed
2. Create focused unit tests for new utilities
3. Add integration tests for end-to-end scenarios
4. Update this README with new coverage information

## Known Limitations

- Tests use simplified AST structures that may not match the full Engine AST
- Mock invariant registry returns hard-coded rules
- Tests don't cover all possible AST variations

These limitations are acceptable for current testing needs but should be addressed when:
- Integrating with the real Engine AST
- Implementing the full InvariantRegistry
- Adding support for more complex expressions
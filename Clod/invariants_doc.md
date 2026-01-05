# MapMaster Invariants Registry

The Invariants Registry is a central repository of mathematical transformation rules that MapMaster uses to generate step candidates. Each invariant represents a valid mathematical operation that can be applied when certain patterns are detected in the AST.

## Architecture

### Components

1. **`mapmaster.invariants.registry.ts`** - In-memory registry of invariants
2. **`mapmaster.invariants.registry-adapter.ts`** - Adapter for querying and filtering invariants
3. **Rule Modules** - Domain-specific modules that use invariants to generate candidates

### Flow

```
Request → DefaultInvariantRegistryAdapter
            ↓
    1. Determine target stage (Stage1, Stage2, etc.)
    2. Detect domains from AST window
    3. Filter invariants by stage + domain
    4. Apply pattern matching
            ↓
    Filtered InvariantRule[] → Rule Modules → Candidates
```

## Invariant Structure

Each invariant rule has:

```typescript
interface InvariantRule {
  id: string;                    // Unique identifier
  stage: string;                 // "Stage1", "Stage2", etc.
  domain: MapMasterDomain;       // "FractionsSameDen", "Integers", etc.
  operation?: string;            // "Add", "Sub", "Mul", "Div", etc.
  primitiveIds: string[];        // Engine primitive IDs
  description?: string;          // Human-readable description
  pattern?: InvariantPattern;    // When this rule applies
}
```

### Pattern Specification

Patterns define when an invariant is applicable:

```typescript
interface InvariantPattern {
  operator?: string;              // "+", "-", "*", "/"
  requiresFractions?: boolean;    // Must be fractions
  requireSameDenominator?: boolean; // Fractions must have same denominator
  requiresIntegers?: boolean;     // Must be integers
  allowsMixed?: boolean;          // Can mix integers and fractions
}
```

## Supported Domains

### FractionsSameDen
Operations on fractions with the same denominator.

**Stage-1 Invariants:**
- `FRAC_ADD_SAME_DEN_STAGE1` - Add fractions: `a/d + b/d = (a+b)/d`
- `FRAC_SUB_SAME_DEN_STAGE1` - Subtract fractions: `a/d - b/d = (a-b)/d`

**Example:**
```
1/7 + 3/7  →  4/7
5/7 - 2/7  →  3/7
```

### Integers
Basic integer arithmetic.

**Stage-1 Invariants:**
- `INT_ADD_STAGE1` - Add integers: `a + b`
- `INT_SUB_STAGE1` - Subtract integers: `a - b`
- `INT_MUL_STAGE1` - Multiply integers: `a * b`
- `INT_DIV_STAGE1` - Divide integers: `a / b`

**Example:**
```
3 + 5  →  8
7 - 2  →  5
4 * 3  →  12
```

### Mixed
Operations involving both integers and fractions.

**Stage-1 Invariants:**
- `MIXED_INT_TO_FRAC_STAGE1` - Convert integer to fraction: `n = n/1`
- `MIXED_ADD_INT_FRAC_STAGE1` - Add integer and fraction: `n + a/b`

**Example:**
```
2 + 1/3  →  2/1 + 1/3  →  7/3
```

### Future Domains

- **FractionsDiffDen** - Fractions with different denominators
- **Decimals** - Decimal arithmetic
- **Algebra** - Algebraic simplification

## Usage

### In Rule Modules

Rule modules receive filtered invariants in `RuleContext`:

```typescript
export function buildCandidatesForFractionsStage1(ctx: RuleContext): MapMasterStepCandidate[] {
  // ctx.invariantRules contains only relevant invariants
  // Pre-filtered by:
  // - Stage (Stage1)
  // - Domain (FractionsSameDen)
  // - Pattern (operator, denominator constraints)
  
  const candidates: MapMasterStepCandidate[] = [];
  
  for (const rule of ctx.invariantRules) {
    // Match AST pattern and build candidate
    const candidate = buildCandidate(ctx, rule);
    if (candidate) {
      candidates.push(candidate);
    }
  }
  
  return candidates;
}
```

### Creating the Adapter

```typescript
import { DefaultInvariantRegistryAdapter } from './mapmaster.invariants.registry-adapter';
import { MapMasterAstHelpers } from './mapmaster.ast-helpers';

const astHelpers = new MapMasterAstHelpers();
const invariantRegistry = new DefaultInvariantRegistryAdapter(undefined, astHelpers);
```

### Custom Invariants

For testing or extension, you can provide custom invariant sets:

```typescript
import { InvariantSet } from './mapmaster.invariants.registry';

const customSet: InvariantSet = {
  id: 'custom-stage1',
  name: 'Custom Stage 1 Rules',
  rules: [
    {
      id: 'CUSTOM_RULE_1',
      stage: 'Stage1',
      domain: 'Custom',
      primitiveIds: ['CUSTOM_PRIMITIVE'],
      pattern: { /* ... */ }
    }
  ]
};

const adapter = new DefaultInvariantRegistryAdapter([customSet], astHelpers);
```

## Domain Detection

The adapter automatically detects applicable domains by inspecting the AST:

### Detection Logic

1. **Check if binary operation** - If not, classify as "Other"
2. **Inspect operands:**
   - Both fractions?
     - Same denominator → `FractionsSameDen`
     - Different denominator → `FractionsDiffDen`
   - Both integers? → `Integers`
   - One integer, one fraction? → `Mixed`
   - Otherwise → `Other`

### Denominator Comparison

The adapter uses structural equality to compare denominators:
- Integer literals: Compare values
- Variables: Compare names
- Complex expressions: Deep structural comparison

## Pattern Matching

After domain detection, the adapter applies pattern matching:

### Operator Matching
```typescript
pattern: { operator: '+' }
```
Only matches binary operations with `+` operator.

### Fraction Requirements
```typescript
pattern: {
  requiresFractions: true,
  requireSameDenominator: true
}
```
Only matches when both operands are fractions with the same denominator.

### Integer Requirements
```typescript
pattern: { requiresIntegers: true }
```
Only matches when both operands are integers.

## Performance Considerations

1. **Pre-filtering** - The adapter filters by stage and domain before pattern matching
2. **Quick AST checks** - Simple structural checks before deep comparisons
3. **Caching** - Future: Cache invariant lookups by AST signature

## Extending the Registry

### Adding New Invariants

1. Add to the appropriate set in `mapmaster.invariants.registry.ts`:

```typescript
export const FRACTIONS_SAME_DEN_STAGE1: InvariantSet = {
  // ...
  rules: [
    // ... existing rules
    {
      id: 'NEW_RULE_ID',
      stage: 'Stage1',
      domain: 'FractionsSameDen',
      operation: 'NewOp',
      primitiveIds: ['NEW_PRIMITIVE'],
      description: 'New operation description',
      pattern: {
        operator: '⊕',
        requiresFractions: true,
        requireSameDenominator: true
      }
    }
  ]
};
```

2. Update the corresponding rule module to handle the new invariant

3. Add tests in `mapmaster.invariants.registry-adapter.spec.ts`

### Adding New Domains

1. Add to `MapMasterDomain` type:

```typescript
export type MapMasterDomain = 
  | 'FractionsSameDen'
  | 'NewDomain'  // ← Add here
  | ...
```

2. Create new invariant set:

```typescript
export const NEW_DOMAIN_STAGE1: InvariantSet = {
  id: 'new-domain-stage1',
  name: 'New Domain - Stage 1',
  rules: [/* ... */]
};
```

3. Update domain detection in `DefaultInvariantRegistryAdapter.determineDomains()`

4. Create corresponding rule module: `mapmaster.rules.newdomain.stage1.ts`

## Testing

See `mapmaster.invariants.registry-adapter.spec.ts` for comprehensive tests covering:
- Domain detection for all supported cases
- Stage filtering
- Pattern matching for all constraint types
- Operator support
- Edge cases and error handling

## Future Improvements

1. **Dynamic Loading** - Load invariants from configuration files
2. **Stage-2+ Rules** - Add multi-step transformations
3. **Custom Predicates** - Allow executable pattern matching functions
4. **Performance Optimization** - Cache lookups, index by domain
5. **Rule Composition** - Combine multiple invariants into complex transformations
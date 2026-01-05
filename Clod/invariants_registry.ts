/**
 * MapMaster Invariants Registry
 * 
 * In-memory registry of mathematical invariants organized by domain and stage.
 * Each invariant represents a mathematical transformation rule that can be
 * applied when certain patterns are detected in the AST.
 */

import type { InvariantRule, MapMasterDomain } from './mapmaster.invariants.registry-adapter';

/**
 * A collection of related invariant rules.
 */
export interface InvariantSet {
  /**
   * Unique identifier for this set.
   */
  id: string;

  /**
   * Human-readable name for this set.
   */
  name: string;

  /**
   * Description of what this set covers.
   */
  description?: string;

  /**
   * The invariant rules in this set.
   */
  rules: InvariantRule[];
}

/**
 * Pattern specification for an invariant rule.
 * Used to determine when a rule is applicable to an AST node.
 */
export interface InvariantPattern {
  /**
   * The operator this rule applies to (e.g., "+", "-", "*", "/").
   */
  operator?: string;

  /**
   * Whether this rule requires operands to be fractions.
   */
  requiresFractions?: boolean;

  /**
   * Whether this rule requires fractions to have the same denominator.
   */
  requireSameDenominator?: boolean;

  /**
   * Whether this rule requires operands to be integers.
   */
  requiresIntegers?: boolean;

  /**
   * Whether this rule applies to mixed numbers (integer + fraction).
   */
  allowsMixed?: boolean;

  /**
   * Additional custom constraints.
   */
  custom?: Record<string, any>;
}

/**
 * Stage-1 Fraction Invariants
 * 
 * Rules for basic fraction operations with the same denominator.
 */
export const FRACTIONS_SAME_DEN_STAGE1: InvariantSet = {
  id: 'fractions-same-den-stage1',
  name: 'Fractions with Same Denominator - Stage 1',
  description: 'Basic addition and subtraction of fractions with identical denominators',
  rules: [
    {
      id: 'FRAC_ADD_SAME_DEN_STAGE1',
      stage: 'Stage1',
      domain: 'FractionsSameDen',
      operation: 'Add',
      primitiveIds: ['FRAC_ADD_SAME_DEN'],
      description: 'Add fractions with the same denominator: a/d + b/d = (a+b)/d',
      pattern: {
        operator: '+',
        requiresFractions: true,
        requireSameDenominator: true
      }
    },
    {
      id: 'FRAC_SUB_SAME_DEN_STAGE1',
      stage: 'Stage1',
      domain: 'FractionsSameDen',
      operation: 'Sub',
      primitiveIds: ['FRAC_SUB_SAME_DEN'],
      description: 'Subtract fractions with the same denominator: a/d - b/d = (a-b)/d',
      pattern: {
        operator: '-',
        requiresFractions: true,
        requireSameDenominator: true
      }
    }
  ]
};

/**
 * Stage-1 Integer Invariants
 * 
 * Rules for basic integer arithmetic operations.
 */
export const INTEGERS_STAGE1: InvariantSet = {
  id: 'integers-stage1',
  name: 'Integer Arithmetic - Stage 1',
  description: 'Basic addition, subtraction, multiplication, and division of integers',
  rules: [
    {
      id: 'INT_ADD_STAGE1',
      stage: 'Stage1',
      domain: 'Integers',
      operation: 'Add',
      primitiveIds: ['INT_ADD'],
      description: 'Add two integers: a + b',
      pattern: {
        operator: '+',
        requiresIntegers: true
      }
    },
    {
      id: 'INT_SUB_STAGE1',
      stage: 'Stage1',
      domain: 'Integers',
      operation: 'Sub',
      primitiveIds: ['INT_SUB'],
      description: 'Subtract two integers: a - b',
      pattern: {
        operator: '-',
        requiresIntegers: true
      }
    },
    {
      id: 'INT_MUL_STAGE1',
      stage: 'Stage1',
      domain: 'Integers',
      operation: 'Mul',
      primitiveIds: ['INT_MUL'],
      description: 'Multiply two integers: a * b',
      pattern: {
        operator: '*',
        requiresIntegers: true
      }
    },
    {
      id: 'INT_DIV_STAGE1',
      stage: 'Stage1',
      domain: 'Integers',
      operation: 'Div',
      primitiveIds: ['INT_DIV'],
      description: 'Divide two integers: a / b',
      pattern: {
        operator: '/',
        requiresIntegers: true
      }
    }
  ]
};

/**
 * Stage-1 Mixed Invariants
 * 
 * Rules for operations involving both integers and fractions.
 */
export const MIXED_STAGE1: InvariantSet = {
  id: 'mixed-stage1',
  name: 'Mixed Integer/Fraction - Stage 1',
  description: 'Operations involving integers and fractions',
  rules: [
    {
      id: 'MIXED_INT_TO_FRAC_STAGE1',
      stage: 'Stage1',
      domain: 'Mixed',
      operation: 'Convert',
      primitiveIds: ['INT_TO_FRAC'],
      description: 'Convert an integer to a fraction: n = n/1',
      pattern: {
        requiresIntegers: true,
        allowsMixed: true
      }
    },
    {
      id: 'MIXED_ADD_INT_FRAC_STAGE1',
      stage: 'Stage1',
      domain: 'Mixed',
      operation: 'Add',
      primitiveIds: ['INT_TO_FRAC', 'FRAC_ADD'],
      description: 'Add integer and fraction: n + a/b',
      pattern: {
        operator: '+',
        allowsMixed: true
      }
    }
  ]
};

/**
 * Registry of all Stage-1 invariant sets.
 */
export const STAGE1_INVARIANT_SETS: InvariantSet[] = [
  FRACTIONS_SAME_DEN_STAGE1,
  INTEGERS_STAGE1,
  MIXED_STAGE1
];

/**
 * Get all invariants from a collection of sets.
 */
export function getAllInvariants(sets: InvariantSet[]): InvariantRule[] {
  return sets.flatMap(set => set.rules);
}

/**
 * Get invariants for a specific domain.
 */
export function getInvariantsByDomain(
  sets: InvariantSet[],
  domain: MapMasterDomain
): InvariantRule[] {
  return getAllInvariants(sets).filter(rule => rule.domain === domain);
}

/**
 * Get invariants for a specific stage.
 */
export function getInvariantsByStage(
  sets: InvariantSet[],
  stage: string
): InvariantRule[] {
  return getAllInvariants(sets).filter(rule => rule.stage === stage);
}

/**
 * Get invariants for a specific domain and stage.
 */
export function getInvariantsByDomainAndStage(
  sets: InvariantSet[],
  domain: MapMasterDomain,
  stage: string
): InvariantRule[] {
  return getAllInvariants(sets).filter(
    rule => rule.domain === domain && rule.stage === stage
  );
}

/**
 * Find an invariant by ID.
 */
export function findInvariantById(
  sets: InvariantSet[],
  id: string
): InvariantRule | undefined {
  return getAllInvariants(sets).find(rule => rule.id === id);
}
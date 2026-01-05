/**
 * Tests for MapMaster Stage-1 Fraction Rules
 * 
 * These tests verify that the FractionsSameDen rule module correctly
 * identifies and generates candidates for fraction operations.
 */

import { describe, it, expect } from 'vitest';
import { DefaultMapMasterRuleProvider } from '../mapmaster.rule-provider';
import { MapMasterSelectionNormalizer } from '../mapmaster.selection.normalizer';
import { MapMasterAstHelpers } from '../mapmaster.ast-helpers';
import type { MapMasterRequest } from '../mapmaster.core';
import type { InvariantRule } from '../mapmaster.rules.common';

/**
 * Mock invariant registry adapter for testing.
 */
class MockInvariantRegistry {
  constructor(private rules: InvariantRule[] = []) {}

  getInvariantRulesForRequest(_request: any, _path: any, _node: any): InvariantRule[] {
    return this.rules;
  }
}

/**
 * Helper to create a fraction AST node.
 */
function createFraction(numerator: number, denominator: number) {
  return {
    kind: 'Fraction',
    numerator: {
      kind: 'Integer',
      value: numerator
    },
    denominator: {
      kind: 'Integer',
      value: denominator
    }
  };
}

/**
 * Helper to create a binary operation AST node.
 */
function createBinaryOp(operator: string, left: any, right: any) {
  return {
    kind: 'BinaryOp',
    operator: operator,
    left: left,
    right: right
  };
}

describe('MapMaster Stage-1 Fraction Rules', () => {
  it('should generate candidates for addition of fractions with same denominator', () => {
    // Create AST: 1/7 + 3/7
    const ast = createBinaryOp(
      '+',
      createFraction(1, 7),
      createFraction(3, 7)
    );

    // Create mock invariant rule
    const invariantRule: InvariantRule = {
      id: 'fractions-same-den-add',
      domain: 'FractionsSameDen',
      stage: 'Stage1',
      operation: 'Add',
      primitiveIds: ['add-fractions-same-den'],
      description: 'Add fractions with the same denominator'
    };

    // Create mock registry with the rule
    const registry = new MockInvariantRegistry([invariantRule]);

    // Create rule provider
    const selectionNormalizer = new MapMasterSelectionNormalizer(new MapMasterAstHelpers());
    const astHelpers = new MapMasterAstHelpers();
    const ruleProvider = new DefaultMapMasterRuleProvider(
      selectionNormalizer,
      astHelpers,
      registry as any
    );

    // Create request
    const request: MapMasterRequest = {
      engineView: {
        ast: ast,
        rendered: '1/7 + 3/7'
      },
      clientEvent: {
        type: 'click',
        astPath: [] // Root of the AST
      }
    } as any;

    // Build candidates
    const candidates = ruleProvider.buildCandidates(request);

    // Assertions
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      domain: 'FractionsSameDen',
      stage: 'Stage1',
      operation: 'Add',
      invariantId: 'fractions-same-den-add'
    });
    expect(candidates[0].primitiveIds).toContain('add-fractions-same-den');
    expect(candidates[0].humanLabel).toContain('Add fractions');
  });

  it('should generate candidates for subtraction of fractions with same denominator', () => {
    // Create AST: 5/7 - 2/7
    const ast = createBinaryOp(
      '-',
      createFraction(5, 7),
      createFraction(2, 7)
    );

    // Create mock invariant rule
    const invariantRule: InvariantRule = {
      id: 'fractions-same-den-sub',
      domain: 'FractionsSameDen',
      stage: 'Stage1',
      operation: 'Sub',
      primitiveIds: ['sub-fractions-same-den'],
      description: 'Subtract fractions with the same denominator'
    };

    // Create mock registry with the rule
    const registry = new MockInvariantRegistry([invariantRule]);

    // Create rule provider
    const selectionNormalizer = new MapMasterSelectionNormalizer(new MapMasterAstHelpers());
    const astHelpers = new MapMasterAstHelpers();
    const ruleProvider = new DefaultMapMasterRuleProvider(
      selectionNormalizer,
      astHelpers,
      registry as any
    );

    // Create request
    const request: MapMasterRequest = {
      engineView: {
        ast: ast,
        rendered: '5/7 - 2/7'
      },
      clientEvent: {
        type: 'click',
        astPath: [] // Root of the AST
      }
    } as any;

    // Build candidates
    const candidates = ruleProvider.buildCandidates(request);

    // Assertions
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      domain: 'FractionsSameDen',
      stage: 'Stage1',
      operation: 'Sub',
      invariantId: 'fractions-same-den-sub'
    });
    expect(candidates[0].primitiveIds).toContain('sub-fractions-same-den');
    expect(candidates[0].humanLabel).toContain('Subtract fractions');
  });

  it('should not generate candidates for fractions with different denominators', () => {
    // Create AST: 1/7 + 2/5 (different denominators)
    const ast = createBinaryOp(
      '+',
      createFraction(1, 7),
      createFraction(2, 5)
    );

    // Create mock invariant rule
    const invariantRule: InvariantRule = {
      id: 'fractions-same-den-add',
      domain: 'FractionsSameDen',
      stage: 'Stage1',
      operation: 'Add',
      primitiveIds: ['add-fractions-same-den'],
      description: 'Add fractions with the same denominator'
    };

    // Create mock registry with the rule
    const registry = new MockInvariantRegistry([invariantRule]);

    // Create rule provider
    const selectionNormalizer = new MapMasterSelectionNormalizer(new MapMasterAstHelpers());
    const astHelpers = new MapMasterAstHelpers();
    const ruleProvider = new DefaultMapMasterRuleProvider(
      selectionNormalizer,
      astHelpers,
      registry as any
    );

    // Create request
    const request: MapMasterRequest = {
      engineView: {
        ast: ast,
        rendered: '1/7 + 2/5'
      },
      clientEvent: {
        type: 'click',
        astPath: [] // Root of the AST
      }
    } as any;

    // Build candidates
    const candidates = ruleProvider.buildCandidates(request);

    // Assertions - should be empty because denominators differ
    expect(candidates).toHaveLength(0);
  });

  it('should not generate candidates for non-fraction operations', () => {
    // Create AST: 3 + 5 (integers, not fractions)
    const ast = createBinaryOp(
      '+',
      { kind: 'Integer', value: 3 },
      { kind: 'Integer', value: 5 }
    );

    // Create mock invariant rule
    const invariantRule: InvariantRule = {
      id: 'fractions-same-den-add',
      domain: 'FractionsSameDen',
      stage: 'Stage1',
      operation: 'Add',
      primitiveIds: ['add-fractions-same-den'],
      description: 'Add fractions with the same denominator'
    };

    // Create mock registry with the rule
    const registry = new MockInvariantRegistry([invariantRule]);

    // Create rule provider
    const selectionNormalizer = new MapMasterSelectionNormalizer(new MapMasterAstHelpers());
    const astHelpers = new MapMasterAstHelpers();
    const ruleProvider = new DefaultMapMasterRuleProvider(
      selectionNormalizer,
      astHelpers,
      registry as any
    );

    // Create request
    const request: MapMasterRequest = {
      engineView: {
        ast: ast,
        rendered: '3 + 5'
      },
      clientEvent: {
        type: 'click',
        astPath: [] // Root of the AST
      }
    } as any;

    // Build candidates
    const candidates = ruleProvider.buildCandidates(request);

    // Assertions - should be empty because operands are not fractions
    expect(candidates).toHaveLength(0);
  });

  it('should handle multiplication and division operators by returning empty candidates', () => {
    // Create AST: 1/7 * 3/7 (multiplication not supported in Stage-1 for same-den)
    const ast = createBinaryOp(
      '*',
      createFraction(1, 7),
      createFraction(3, 7)
    );

    // Create mock invariant rule (for addition)
    const invariantRule: InvariantRule = {
      id: 'fractions-same-den-add',
      domain: 'FractionsSameDen',
      stage: 'Stage1',
      operation: 'Add',
      primitiveIds: ['add-fractions-same-den'],
      description: 'Add fractions with the same denominator'
    };

    // Create mock registry with the rule
    const registry = new MockInvariantRegistry([invariantRule]);

    // Create rule provider
    const selectionNormalizer = new MapMasterSelectionNormalizer(new MapMasterAstHelpers());
    const astHelpers = new MapMasterAstHelpers();
    const ruleProvider = new DefaultMapMasterRuleProvider(
      selectionNormalizer,
      astHelpers,
      registry as any
    );

    // Create request
    const request: MapMasterRequest = {
      engineView: {
        ast: ast,
        rendered: '1/7 * 3/7'
      },
      clientEvent: {
        type: 'click',
        astPath: [] // Root of the AST
      }
    } as any;

    // Build candidates
    const candidates = ruleProvider.buildCandidates(request);

    // Assertions - should be empty because operator is *, not + or -
    expect(candidates).toHaveLength(0);
  });
});
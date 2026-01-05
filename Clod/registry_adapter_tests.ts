/**
 * Unit Tests for InvariantRegistryAdapter
 * 
 * Tests the invariant registry adapter's filtering and domain detection logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultInvariantRegistryAdapter, EmptyInvariantRegistryAdapter } from '../mapmaster.invariants.registry-adapter';
import { MapMasterAstHelpers } from '../mapmaster.ast-helpers';
import type { MapMasterRequest } from '../mapmaster.core';
import {
  createTestFraction,
  createTestInteger,
  createTestBinaryOp,
  makeTestExpression_1over7_plus_3over7,
  makeTestExpression_5over7_minus_2over7,
  makeTestExpression_1over7_plus_2over5,
  makeTestExpression_3_plus_5,
  makeTestRequestForRootClick
} from '../mapmaster.test-helpers';

describe('DefaultInvariantRegistryAdapter', () => {
  let adapter: DefaultInvariantRegistryAdapter;
  let astHelpers: MapMasterAstHelpers;

  beforeEach(() => {
    astHelpers = new MapMasterAstHelpers();
    adapter = new DefaultInvariantRegistryAdapter(undefined, astHelpers);
  });

  describe('Domain Detection', () => {
    it('detects FractionsSameDen for fractions with same denominator', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const rules = adapter.getInvariantRulesForRequest(request, [], expr.ast);

      // Should return rules for FractionsSameDen domain
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(r => r.domain === 'FractionsSameDen')).toBe(true);
    });

    it('detects FractionsDiffDen for fractions with different denominators', () => {
      const expr = makeTestExpression_1over7_plus_2over5();
      const request = makeTestRequestForRootClick(expr);

      const rules = adapter.getInvariantRulesForRequest(request, [], expr.ast);

      // Should return rules for FractionsDiffDen domain (or empty if none defined)
      const fractionsSameDenRules = rules.filter(r => r.domain === 'FractionsSameDen');
      expect(fractionsSameDenRules.length).toBe(0);
    });

    it('detects Integers domain for integer operations', () => {
      const expr = makeTestExpression_3_plus_5();
      const request = makeTestRequestForRootClick(expr);

      const rules = adapter.getInvariantRulesForRequest(request, [], expr.ast);

      // Should return rules for Integers domain
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(r => r.domain === 'Integers')).toBe(true);
    });

    it('detects Mixed domain for integer + fraction', () => {
      const ast = createTestBinaryOp(
        '+',
        createTestInteger(3),
        createTestFraction(1, 2)
      );
      
      const request: MapMasterRequest = {
        engineView: { ast },
        clientEvent: { type: 'click', astPath: [] },
        policy: { stage: 'Stage1' }
      } as any;

      const rules = adapter.getInvariantRulesForRequest(request, [], ast);

      // Should return rules for Mixed domain
      const mixedRules = rules.filter(r => r.domain === 'Mixed');
      expect(mixedRules.length).toBeGreaterThan(0);
    });
  });

  describe('Stage Filtering', () => {
    it('filters by Stage1 when specified in policy', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request: MapMasterRequest = {
        engineView: expr,
        clientEvent: { type: 'click', astPath: [] },
        policy: { stage: 'Stage1' }
      } as any;

      const rules = adapter.getInvariantRulesForRequest(request, [], expr.ast);

      // All rules should be Stage1
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(r => r.stage === 'Stage1')).toBe(true);
    });

    it('defaults to Stage1 when no stage specified', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request: MapMasterRequest = {
        engineView: expr,
        clientEvent: { type: 'click', astPath: [] },
        policy: {}
      } as any;

      const rules = adapter.getInvariantRulesForRequest(request, [], expr.ast);

      // Should default to Stage1
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every(r => r.stage === 'Stage1')).toBe(true);
    });
  });

  describe('Pattern Matching', () => {
    it('filters by operator in pattern', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const rules = adapter.getInvariantRulesForRequest(request, [], expr.ast);

      // Should only return addition rules, not subtraction
      const addRules = rules.filter(r => r.operation === 'Add');
      const subRules = rules.filter(r => r.operation === 'Sub');

      expect(addRules.length).toBeGreaterThan(0);
      expect(subRules.length).toBe(0);
    });

    it('filters by operator for subtraction', () => {
      const expr = makeTestExpression_5over7_minus_2over7();
      const request = makeTestRequestForRootClick(expr);

      const rules = adapter.getInvariantRulesForRequest(request, [], expr.ast);

      // Should only return subtraction rules, not addition
      const addRules = rules.filter(r => r.operation === 'Add');
      const subRules = rules.filter(r => r.operation === 'Sub');

      expect(addRules.length).toBe(0);
      expect(subRules.length).toBeGreaterThan(0);
    });

    it('respects requireSameDenominator pattern constraint', () => {
      // Test with same denominators
      const exprSame = makeTestExpression_1over7_plus_3over7();
      const requestSame = makeTestRequestForRootClick(exprSame);
      const rulesSame = adapter.getInvariantRulesForRequest(requestSame, [], exprSame.ast);

      // Test with different denominators
      const exprDiff = makeTestExpression_1over7_plus_2over5();
      const requestDiff = makeTestRequestForRootClick(exprDiff);
      const rulesDiff = adapter.getInvariantRulesForRequest(requestDiff, [], exprDiff.ast);

      // Same denominators should match FractionsSameDen rules
      expect(rulesSame.some(r => r.domain === 'FractionsSameDen')).toBe(true);

      // Different denominators should NOT match FractionsSameDen rules
      expect(rulesDiff.some(r => r.domain === 'FractionsSameDen')).toBe(false);
    });

    it('respects requiresIntegers pattern constraint', () => {
      const exprInt = makeTestExpression_3_plus_5();
      const requestInt = makeTestRequestForRootClick(exprInt);
      const rulesInt = adapter.getInvariantRulesForRequest(requestInt, [], exprInt.ast);

      const exprFrac = makeTestExpression_1over7_plus_3over7();
      const requestFrac = makeTestRequestForRootClick(exprFrac);
      const rulesFrac = adapter.getInvariantRulesForRequest(requestFrac, [], exprFrac.ast);

      // Integer expression should match Integer rules
      expect(rulesInt.some(r => r.domain === 'Integers')).toBe(true);

      // Fraction expression should NOT match Integer rules
      expect(rulesFrac.some(r => r.domain === 'Integers')).toBe(false);
    });
  });

  describe('Operator Support', () => {
    it('supports addition operator', () => {
      const ast = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      const request: MapMasterRequest = {
        engineView: { ast },
        clientEvent: { type: 'click', astPath: [] },
        policy: { stage: 'Stage1' }
      } as any;

      const rules = adapter.getInvariantRulesForRequest(request, [], ast);

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.operation === 'Add')).toBe(true);
    });

    it('supports subtraction operator', () => {
      const ast = createTestBinaryOp('-', createTestInteger(5), createTestInteger(3));
      const request: MapMasterRequest = {
        engineView: { ast },
        clientEvent: { type: 'click', astPath: [] },
        policy: { stage: 'Stage1' }
      } as any;

      const rules = adapter.getInvariantRulesForRequest(request, [], ast);

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.operation === 'Sub')).toBe(true);
    });

    it('supports multiplication operator', () => {
      const ast = createTestBinaryOp('*', createTestInteger(2), createTestInteger(3));
      const request: MapMasterRequest = {
        engineView: { ast },
        clientEvent: { type: 'click', astPath: [] },
        policy: { stage: 'Stage1' }
      } as any;

      const rules = adapter.getInvariantRulesForRequest(request, [], ast);

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.operation === 'Mul')).toBe(true);
    });

    it('supports division operator', () => {
      const ast = createTestBinaryOp('/', createTestInteger(6), createTestInteger(2));
      const request: MapMasterRequest = {
        engineView: { ast },
        clientEvent: { type: 'click', astPath: [] },
        policy: { stage: 'Stage1' }
      } as any;

      const rules = adapter.getInvariantRulesForRequest(request, [], ast);

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.operation === 'Div')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles non-binary-operation nodes', () => {
      const ast = createTestInteger(42);
      const request: MapMasterRequest = {
        engineView: { ast },
        clientEvent: { type: 'click', astPath: [] },
        policy: { stage: 'Stage1' }
      } as any;

      const rules = adapter.getInvariantRulesForRequest(request, [], ast);

      // Non-binary operations shouldn't match typical arithmetic rules
      expect(Array.isArray(rules)).toBe(true);
    });

    it('handles nodes without operands', () => {
      const ast = { kind: 'BinaryOp', operator: '+' } as any;
      const request: MapMasterRequest = {
        engineView: { ast },
        clientEvent: { type: 'click', astPath: [] },
        policy: { stage: 'Stage1' }
      } as any;

      const rules = adapter.getInvariantRulesForRequest(request, [], ast);

      // Malformed AST should not crash
      expect(Array.isArray(rules)).toBe(true);
    });

    it('works without astHelpers', () => {
      const adapterNoHelpers = new DefaultInvariantRegistryAdapter();
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const rules = adapterNoHelpers.getInvariantRulesForRequest(request, [], expr.ast);

      // Should still work with fallback logic
      expect(Array.isArray(rules)).toBe(true);
    });
  });

  describe('Rule Properties', () => {
    it('returns rules with all required properties', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const rules = adapter.getInvariantRulesForRequest(request, [], expr.ast);

      expect(rules.length).toBeGreaterThan(0);

      for (const rule of rules) {
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('stage');
        expect(rule).toHaveProperty('domain');
        expect(rule).toHaveProperty('primitiveIds');
        expect(Array.isArray(rule.primitiveIds)).toBe(true);
      }
    });

    it('returns rules with valid primitive IDs', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const rules = adapter.getInvariantRulesForRequest(request, [], expr.ast);

      expect(rules.length).toBeGreaterThan(0);

      for (const rule of rules) {
        expect(rule.primitiveIds.length).toBeGreaterThan(0);
        for (const primitiveId of rule.primitiveIds) {
          expect(typeof primitiveId).toBe('string');
          expect(primitiveId.length).toBeGreaterThan(0);
        }
      }
    });
  });
});

describe('EmptyInvariantRegistryAdapter', () => {
  it('always returns empty array', () => {
    const adapter = new EmptyInvariantRegistryAdapter();
    const expr = makeTestExpression_1over7_plus_3over7();
    const request = makeTestRequestForRootClick(expr);

    const rules = adapter.getInvariantRulesForRequest(request, [], expr.ast);

    expect(rules).toEqual([]);
  });

  it('works with any input', () => {
    const adapter = new EmptyInvariantRegistryAdapter();
    
    const rules = adapter.getInvariantRulesForRequest(
      null as any,
      [],
      { kind: 'Unknown' } as any
    );

    expect(rules).toEqual([]);
  });
});
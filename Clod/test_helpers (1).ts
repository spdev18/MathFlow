/**
 * Test Helpers for MapMaster
 * 
 * Provides utilities for building test ASTs, requests, and mock dependencies.
 */

import type { 
  MapMasterRequest, 
  EngineExpressionView,
  MapMasterClientEvent,
  MapMasterPolicy
} from './mapmaster.core';
import type { ExpressionAstNode, AstPath } from './mapmaster.ast-helpers';
import type { InvariantRule } from './mapmaster.rules.common';
import type { InvariantRegistryAdapter } from './mapmaster.invariants.registry-adapter';

/**
 * Create a test fraction node.
 */
export function createTestFraction(numerator: number, denominator: number): ExpressionAstNode {
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
 * Create a test integer node.
 */
export function createTestInteger(value: number): ExpressionAstNode {
  return {
    kind: 'Integer',
    value: value
  };
}

/**
 * Create a test binary operation node.
 */
export function createTestBinaryOp(
  operator: string,
  left: ExpressionAstNode,
  right: ExpressionAstNode
): ExpressionAstNode {
  return {
    kind: 'BinaryOp',
    operator: operator,
    left: left,
    right: right
  };
}

/**
 * Create a test expression view for 1/7 + 3/7.
 */
export function makeTestExpression_1over7_plus_3over7(): EngineExpressionView {
  const ast = createTestBinaryOp(
    '+',
    createTestFraction(1, 7),
    createTestFraction(3, 7)
  );

  return {
    ast: ast,
    rendered: '1/7 + 3/7',
    tsaLayout: {
      regions: [
        { kind: 'fraction', startIndex: 0, endIndex: 3 },
        { kind: 'operator', startIndex: 4, endIndex: 5 },
        { kind: 'fraction', startIndex: 6, endIndex: 9 }
      ]
    }
  } as EngineExpressionView;
}

/**
 * Create a test expression view for 5/7 - 2/7.
 */
export function makeTestExpression_5over7_minus_2over7(): EngineExpressionView {
  const ast = createTestBinaryOp(
    '-',
    createTestFraction(5, 7),
    createTestFraction(2, 7)
  );

  return {
    ast: ast,
    rendered: '5/7 - 2/7',
    tsaLayout: {
      regions: [
        { kind: 'fraction', startIndex: 0, endIndex: 3 },
        { kind: 'operator', startIndex: 4, endIndex: 5 },
        { kind: 'fraction', startIndex: 6, endIndex: 9 }
      ]
    }
  } as EngineExpressionView;
}

/**
 * Create a test expression view for 1/7 + 2/5 (different denominators).
 */
export function makeTestExpression_1over7_plus_2over5(): EngineExpressionView {
  const ast = createTestBinaryOp(
    '+',
    createTestFraction(1, 7),
    createTestFraction(2, 5)
  );

  return {
    ast: ast,
    rendered: '1/7 + 2/5',
    tsaLayout: {
      regions: [
        { kind: 'fraction', startIndex: 0, endIndex: 3 },
        { kind: 'operator', startIndex: 4, endIndex: 5 },
        { kind: 'fraction', startIndex: 6, endIndex: 9 }
      ]
    }
  } as EngineExpressionView;
}

/**
 * Create a test expression view for 3 + 5 (integers, not fractions).
 */
export function makeTestExpression_3_plus_5(): EngineExpressionView {
  const ast = createTestBinaryOp(
    '+',
    createTestInteger(3),
    createTestInteger(5)
  );

  return {
    ast: ast,
    rendered: '3 + 5',
    tsaLayout: {
      regions: [
        { kind: 'integer', startIndex: 0, endIndex: 1 },
        { kind: 'operator', startIndex: 2, endIndex: 3 },
        { kind: 'integer', startIndex: 4, endIndex: 5 }
      ]
    }
  } as EngineExpressionView;
}

/**
 * Create a test MapMaster request with a click on a specific AST path.
 */
export function makeTestRequestWithAstPath(
  expressionView: EngineExpressionView,
  astPath: AstPath
): MapMasterRequest {
  const clientEvent: MapMasterClientEvent = {
    type: 'click',
    astPath: astPath,
    timestamp: Date.now()
  } as any;

  return {
    expressionId: 'test-expr-001',
    invariantSetId: 'test-invariants',
    engineView: expressionView,
    clientEvent: clientEvent,
    policy: makeDefaultTestPolicy(),
    tsaSelection: null
  } as MapMasterRequest;
}

/**
 * Create a test MapMaster request with a click on the root (top-level operation).
 */
export function makeTestRequestForRootClick(
  expressionView: EngineExpressionView
): MapMasterRequest {
  return makeTestRequestWithAstPath(expressionView, []);
}

/**
 * Create a test MapMaster request with an operator index.
 */
export function makeTestRequestWithOperatorIndex(
  expressionView: EngineExpressionView,
  operatorIndex: number
): MapMasterRequest {
  const clientEvent: MapMasterClientEvent = {
    type: 'click',
    operatorIndex: operatorIndex,
    timestamp: Date.now()
  } as any;

  return {
    expressionId: 'test-expr-001',
    invariantSetId: 'test-invariants',
    engineView: expressionView,
    clientEvent: clientEvent,
    policy: makeDefaultTestPolicy(),
    tsaSelection: null
  } as MapMasterRequest;
}

/**
 * Create a default test policy.
 */
export function makeDefaultTestPolicy(): MapMasterPolicy {
  return {
    stage: 'Stage1',
    maxCandidates: 10,
    includeExplanations: true,
    safetyLevel: 'Safe'
  } as MapMasterPolicy;
}

/**
 * Test implementation of InvariantRegistryAdapter.
 * Returns pre-configured invariant rules for testing.
 */
export class TestInvariantRegistryAdapter implements InvariantRegistryAdapter {
  constructor(private rules: InvariantRule[] = []) {
    // If no rules provided, add default test rules
    if (this.rules.length === 0) {
      this.rules = [
        {
          id: 'FRAC_ADD_SAME_DEN_STAGE1',
          stage: 'Stage1',
          domain: 'FractionsSameDen',
          operation: 'Add',
          primitiveIds: ['FRAC_ADD_SAME_DEN'],
          description: 'Add fractions with the same denominator'
        },
        {
          id: 'FRAC_SUB_SAME_DEN_STAGE1',
          stage: 'Stage1',
          domain: 'FractionsSameDen',
          operation: 'Sub',
          primitiveIds: ['FRAC_SUB_SAME_DEN'],
          description: 'Subtract fractions with the same denominator'
        }
      ];
    }
  }

  getInvariantRulesForRequest(
    _request: MapMasterRequest,
    _windowRootPath: AstPath,
    windowRootNode: ExpressionAstNode
  ): InvariantRule[] {
    // Simple filtering: return rules that might apply to this node
    // For binary operations on fractions, return fraction rules
    if (windowRootNode.kind === 'BinaryOp' || windowRootNode.kind === 'BinaryOperation') {
      const operator = (windowRootNode as any).operator;
      
      return this.rules.filter(rule => {
        if (rule.domain !== 'FractionsSameDen') {
          return false;
        }
        
        // Match operator to operation
        if (operator === '+' && rule.operation === 'Add') {
          return true;
        }
        if (operator === '-' && rule.operation === 'Sub') {
          return true;
        }
        
        return false;
      });
    }

    return [];
  }

  /**
   * Add a custom rule to this adapter (useful for specific test scenarios).
   */
  addRule(rule: InvariantRule): void {
    this.rules.push(rule);
  }

  /**
   * Clear all rules.
   */
  clearRules(): void {
    this.rules = [];
  }
}

/**
 * No-op logger for tests.
 */
export class NoopMapMasterLogger {
  debug(_message: string): void {}
  info(_message: string): void {}
  warn(_message: string): void {}
  error(_message: string): void {}
}

/**
 * Console logger for tests (useful for debugging).
 */
export class ConsoleMapMasterLogger {
  debug(message: string): void {
    console.log(`[DEBUG] ${message}`);
  }
  info(message: string): void {
    console.log(`[INFO] ${message}`);
  }
  warn(message: string): void {
    console.warn(`[WARN] ${message}`);
  }
  error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }
}
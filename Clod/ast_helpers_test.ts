/**
 * Unit Tests for MapMasterAstHelpers
 * 
 * Tests AST navigation and inspection utilities.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MapMasterAstHelpers } from '../mapmaster.ast-helpers';
import type { ExpressionAstNode } from '../mapmaster.ast-helpers';
import {
  createTestFraction,
  createTestInteger,
  createTestBinaryOp
} from '../mapmaster.test-helpers';

describe('MapMasterAstHelpers', () => {
  let helpers: MapMasterAstHelpers;

  beforeEach(() => {
    helpers = new MapMasterAstHelpers();
  });

  describe('getNodeByPath', () => {
    it('returns root node for empty path', () => {
      const ast = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      
      const result = helpers.getNodeByPath(ast, []);

      expect(result).toBe(ast);
    });

    it('navigates to left operand', () => {
      const left = createTestInteger(1);
      const right = createTestInteger(2);
      const ast = createTestBinaryOp('+', left, right);
      
      const result = helpers.getNodeByPath(ast, ['left']);

      expect(result).toBe(left);
    });

    it('navigates to right operand', () => {
      const left = createTestInteger(1);
      const right = createTestInteger(2);
      const ast = createTestBinaryOp('+', left, right);
      
      const result = helpers.getNodeByPath(ast, ['right']);

      expect(result).toBe(right);
    });

    it('navigates to nested numerator', () => {
      const fraction = createTestFraction(1, 7);
      const ast = createTestBinaryOp('+', fraction, createTestInteger(2));
      
      const result = helpers.getNodeByPath(ast, ['left', 'numerator']);

      expect(result).toBeDefined();
      expect(result!.kind).toBe('Integer');
      expect((result as any).value).toBe(1);
    });

    it('navigates to nested denominator', () => {
      const fraction = createTestFraction(1, 7);
      const ast = createTestBinaryOp('+', fraction, createTestInteger(2));
      
      const result = helpers.getNodeByPath(ast, ['left', 'denominator']);

      expect(result).toBeDefined();
      expect(result!.kind).toBe('Integer');
      expect((result as any).value).toBe(7);
    });

    it('returns undefined for invalid path', () => {
      const ast = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      
      const result = helpers.getNodeByPath(ast, ['nonexistent']);

      expect(result).toBeUndefined();
    });

    it('returns undefined for path that goes too deep', () => {
      const ast = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      
      const result = helpers.getNodeByPath(ast, ['left', 'value', 'deep']);

      expect(result).toBeUndefined();
    });

    it('handles array indices in path', () => {
      const ast: ExpressionAstNode = {
        kind: 'Expression',
        children: [
          createTestInteger(1),
          createTestInteger(2),
          createTestInteger(3)
        ]
      };
      
      const result = helpers.getNodeByPath(ast, ['children', 1]);

      expect(result).toBeDefined();
      expect((result as any).value).toBe(2);
    });

    it('returns undefined for out-of-bounds array index', () => {
      const ast: ExpressionAstNode = {
        kind: 'Expression',
        children: [createTestInteger(1)]
      };
      
      const result = helpers.getNodeByPath(ast, ['children', 99]);

      expect(result).toBeUndefined();
    });
  });

  describe('getParentPath', () => {
    it('returns undefined for root path', () => {
      const result = helpers.getParentPath([]);

      expect(result).toBeUndefined();
    });

    it('returns empty array for single-segment path', () => {
      const result = helpers.getParentPath(['left']);

      expect(result).toEqual([]);
    });

    it('returns parent path for nested path', () => {
      const result = helpers.getParentPath(['left', 'numerator']);

      expect(result).toEqual(['left']);
    });

    it('returns parent path for deeply nested path', () => {
      const result = helpers.getParentPath(['a', 'b', 'c', 'd']);

      expect(result).toEqual(['a', 'b', 'c']);
    });
  });

  describe('isBinaryOperator', () => {
    it('identifies addition operator', () => {
      const ast = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      
      const result = helpers.isBinaryOperator(ast, '+');

      expect(result).toBe(true);
    });

    it('identifies subtraction operator', () => {
      const ast = createTestBinaryOp('-', createTestInteger(5), createTestInteger(3));
      
      const result = helpers.isBinaryOperator(ast, '-');

      expect(result).toBe(true);
    });

    it('identifies multiplication operator', () => {
      const ast = createTestBinaryOp('*', createTestInteger(2), createTestInteger(3));
      
      const result = helpers.isBinaryOperator(ast, '*');

      expect(result).toBe(true);
    });

    it('returns false for wrong operator symbol', () => {
      const ast = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      
      const result = helpers.isBinaryOperator(ast, '-');

      expect(result).toBe(false);
    });

    it('returns false for non-binary-operator node', () => {
      const ast = createTestInteger(42);
      
      const result = helpers.isBinaryOperator(ast, '+');

      expect(result).toBe(false);
    });

    it('handles BinaryOperation kind variant', () => {
      const ast: ExpressionAstNode = {
        kind: 'BinaryOperation',
        operator: '+',
        left: createTestInteger(1),
        right: createTestInteger(2)
      };
      
      const result = helpers.isBinaryOperator(ast, '+');

      expect(result).toBe(true);
    });
  });

  describe('isFraction', () => {
    it('identifies fraction nodes', () => {
      const ast = createTestFraction(1, 7);
      
      const result = helpers.isFraction(ast);

      expect(result).toBe(true);
    });

    it('returns false for integer nodes', () => {
      const ast = createTestInteger(42);
      
      const result = helpers.isFraction(ast);

      expect(result).toBe(false);
    });

    it('returns false for binary operator nodes', () => {
      const ast = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      
      const result = helpers.isFraction(ast);

      expect(result).toBe(false);
    });

    it('handles Rational kind variant', () => {
      const ast: ExpressionAstNode = {
        kind: 'Rational',
        numerator: createTestInteger(3),
        denominator: createTestInteger(4)
      };
      
      const result = helpers.isFraction(ast);

      expect(result).toBe(true);
    });
  });

  describe('getFractionParts', () => {
    it('extracts numerator and denominator from fraction', () => {
      const ast = createTestFraction(3, 5);
      
      const result = helpers.getFractionParts(ast);

      expect(result).toBeDefined();
      expect(result!.numerator.kind).toBe('Integer');
      expect((result!.numerator as any).value).toBe(3);
      expect(result!.denominator.kind).toBe('Integer');
      expect((result!.denominator as any).value).toBe(5);
    });

    it('returns undefined for non-fraction nodes', () => {
      const ast = createTestInteger(42);
      
      const result = helpers.getFractionParts(ast);

      expect(result).toBeUndefined();
    });

    it('returns undefined for malformed fraction', () => {
      const ast: ExpressionAstNode = {
        kind: 'Fraction'
        // Missing numerator and denominator
      };
      
      const result = helpers.getFractionParts(ast);

      expect(result).toBeUndefined();
    });

    it('handles alternative property names (num/denom)', () => {
      const ast: ExpressionAstNode = {
        kind: 'Fraction',
        num: createTestInteger(2),
        denom: createTestInteger(9)
      };
      
      const result = helpers.getFractionParts(ast);

      expect(result).toBeDefined();
      expect((result!.numerator as any).value).toBe(2);
      expect((result!.denominator as any).value).toBe(9);
    });
  });

  describe('findNthOperator', () => {
    it('finds the first operator in simple expression', () => {
      const ast = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      
      const result = helpers.findNthOperator(ast, 0);

      expect(result).toEqual([]);
    });

    it('finds operator in nested expression', () => {
      // (1 + 2) + 3
      const inner = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      const outer = createTestBinaryOp('+', inner, createTestInteger(3));
      
      const result0 = helpers.findNthOperator(outer, 0);
      const result1 = helpers.findNthOperator(outer, 1);

      expect(result0).toEqual([]); // Outer +
      expect(result1).toEqual(['left']); // Inner +
    });

    it('finds operators in complex expression', () => {
      // (1 + 2) - (3 * 4)
      const left = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      const right = createTestBinaryOp('*', createTestInteger(3), createTestInteger(4));
      const ast = createTestBinaryOp('-', left, right);
      
      const result0 = helpers.findNthOperator(ast, 0);
      const result1 = helpers.findNthOperator(ast, 1);
      const result2 = helpers.findNthOperator(ast, 2);

      expect(result0).toEqual([]); // Root -
      expect(result1).toEqual(['left']); // Left +
      expect(result2).toEqual(['right']); // Right *
    });

    it('returns undefined for out-of-bounds index', () => {
      const ast = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      
      const result = helpers.findNthOperator(ast, 5);

      expect(result).toBeUndefined();
    });

    it('returns undefined for negative index', () => {
      const ast = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      
      const result = helpers.findNthOperator(ast, -1);

      expect(result).toBeUndefined();
    });

    it('handles expression with no operators', () => {
      const ast = createTestInteger(42);
      
      const result = helpers.findNthOperator(ast, 0);

      expect(result).toBeUndefined();
    });

    it('finds operators in deeply nested expression', () => {
      // ((1 + 2) + 3) + 4
      const innermost = createTestBinaryOp('+', createTestInteger(1), createTestInteger(2));
      const middle = createTestBinaryOp('+', innermost, createTestInteger(3));
      const outer = createTestBinaryOp('+', middle, createTestInteger(4));
      
      const result0 = helpers.findNthOperator(outer, 0);
      const result1 = helpers.findNthOperator(outer, 1);
      const result2 = helpers.findNthOperator(outer, 2);

      expect(result0).toEqual([]); // Outermost +
      expect(result1).toEqual(['left']); // Middle +
      expect(result2).toEqual(['left', 'left']); // Innermost +
    });
  });
});
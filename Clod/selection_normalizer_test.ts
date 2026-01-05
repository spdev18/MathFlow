/**
 * Unit Tests for MapMasterSelectionNormalizer
 * 
 * Tests the selection normalization logic in isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MapMasterSelectionNormalizer } from '../mapmaster.selection.normalizer';
import { MapMasterAstHelpers } from '../mapmaster.ast-helpers';
import type { MapMasterRequest } from '../mapmaster.core';
import {
  makeTestExpression_1over7_plus_3over7,
  makeTestRequestForRootClick,
  makeTestRequestWithAstPath,
  makeTestRequestWithOperatorIndex
} from '../mapmaster.test-helpers';

describe('MapMasterSelectionNormalizer', () => {
  let normalizer: MapMasterSelectionNormalizer;
  let astHelpers: MapMasterAstHelpers;

  beforeEach(() => {
    astHelpers = new MapMasterAstHelpers();
    normalizer = new MapMasterSelectionNormalizer(astHelpers);
  });

  describe('Direct AST Path Selection', () => {
    it('normalizes selection from direct AST path', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithAstPath(expr, []);

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.anchorPath).toEqual([]);
      expect(result!.anchorKind).toBe('Operator');
      expect(result!.trace).toBe('clientEvent.astPath');
    });

    it('normalizes selection to left operand', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithAstPath(expr, ['left']);

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.anchorPath).toEqual(['left']);
      expect(result!.anchorKind).toBe('Operand');
      expect(result!.trace).toBe('clientEvent.astPath');
    });

    it('normalizes selection to right operand', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithAstPath(expr, ['right']);

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.anchorPath).toEqual(['right']);
      expect(result!.anchorKind).toBe('Operand');
    });

    it('normalizes selection to nested numerator', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithAstPath(expr, ['left', 'numerator']);

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.anchorPath).toEqual(['left', 'numerator']);
      expect(result!.anchorKind).toBe('Operand');
    });
  });

  describe('Operator Index Selection', () => {
    it('normalizes selection from operator index 0', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithOperatorIndex(expr, 0);

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.anchorKind).toBe('Operator');
      expect(result!.trace).toContain('operatorIndex');
      expect(result!.trace).toContain('0th operator');
    });

    it('returns null for out-of-bounds operator index', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithOperatorIndex(expr, 99);

      const result = normalizer.normalizeSelection(request);

      // No 99th operator exists
      expect(result).toBeNull();
    });

    it('returns null for negative operator index', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithOperatorIndex(expr, -1);

      const result = normalizer.normalizeSelection(request);

      expect(result).toBeNull();
    });
  });

  describe('TSA Selection', () => {
    it('normalizes selection from TSA astPath', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: expr,
        clientEvent: null,
        policy: null,
        tsaSelection: {
          astPath: []
        }
      } as any;

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.anchorPath).toEqual([]);
      expect(result!.trace).toBe('tsaSelection.astPath');
    });

    it('returns null for TSA selection without AST path', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: expr,
        clientEvent: null,
        policy: null,
        tsaSelection: {
          regionId: 'some-region'
        }
      } as any;

      const result = normalizer.normalizeSelection(request);

      // No AST path available from TSA selection
      expect(result).toBeNull();
    });
  });

  describe('Anchor Kind Classification', () => {
    it('classifies binary operator as Operator', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.anchorKind).toBe('Operator');
    });

    it('classifies fraction as Operand', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithAstPath(expr, ['left']);

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.anchorKind).toBe('Operand');
    });

    it('classifies integer as Operand', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithAstPath(expr, ['left', 'numerator']);

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.anchorKind).toBe('Operand');
    });
  });

  describe('Priority and Fallback', () => {
    it('prioritizes clientEvent.astPath over operator index', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: expr,
        clientEvent: {
          type: 'click',
          astPath: ['left'],
          operatorIndex: 0
        } as any,
        policy: null,
        tsaSelection: null
      } as any;

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.anchorPath).toEqual(['left']);
      expect(result!.trace).toBe('clientEvent.astPath');
    });

    it('falls back to operator index when AST path is invalid', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: expr,
        clientEvent: {
          type: 'click',
          astPath: ['nonexistent', 'path'],
          operatorIndex: 0
        } as any,
        policy: null,
        tsaSelection: null
      } as any;

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.trace).toContain('operatorIndex');
    });

    it('prioritizes clientEvent over TSA selection', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: expr,
        clientEvent: {
          type: 'click',
          astPath: []
        } as any,
        policy: null,
        tsaSelection: {
          astPath: ['left']
        }
      } as any;

      const result = normalizer.normalizeSelection(request);

      expect(result).not.toBeNull();
      expect(result!.trace).toBe('clientEvent.astPath');
    });
  });

  describe('Error Handling', () => {
    it('returns null for missing engine view', () => {
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: null,
        clientEvent: { type: 'click', astPath: [] } as any,
        policy: null,
        tsaSelection: null
      } as any;

      const result = normalizer.normalizeSelection(request);

      expect(result).toBeNull();
    });

    it('returns null for missing AST in engine view', () => {
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: { ast: null } as any,
        clientEvent: { type: 'click', astPath: [] } as any,
        policy: null,
        tsaSelection: null
      } as any;

      const result = normalizer.normalizeSelection(request);

      expect(result).toBeNull();
    });

    it('returns null for invalid AST path', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithAstPath(expr, ['nonexistent']);

      const result = normalizer.normalizeSelection(request);

      expect(result).toBeNull();
    });

    it('returns null when no selection information is available', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: expr,
        clientEvent: null,
        policy: null,
        tsaSelection: null
      } as any;

      const result = normalizer.normalizeSelection(request);

      expect(result).toBeNull();
    });
  });

  describe('Determinism', () => {
    it('produces identical results for identical requests', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request1 = makeTestRequestForRootClick(expr);
      const request2 = makeTestRequestForRootClick(expr);

      const result1 = normalizer.normalizeSelection(request1);
      const result2 = normalizer.normalizeSelection(request2);

      expect(result1).toEqual(result2);
    });
  });
});
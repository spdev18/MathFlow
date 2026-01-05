/**
 * MapMaster Integration Tests - Stage-1 Fractions
 * 
 * Tests the full pipeline:
 * 1. Selection normalization
 * 2. Semantic window resolution
 * 3. Stage-1 fraction rule candidate generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultMapMasterRuleProvider } from '../mapmaster.rule-provider';
import { MapMasterSelectionNormalizer } from '../mapmaster.selection.normalizer';
import { MapMasterAstHelpers } from '../mapmaster.ast-helpers';
import type { MapMasterRequest, MapMasterStepCandidate } from '../mapmaster.core';
import {
  makeTestExpression_1over7_plus_3over7,
  makeTestExpression_5over7_minus_2over7,
  makeTestExpression_1over7_plus_2over5,
  makeTestExpression_3_plus_5,
  makeTestRequestForRootClick,
  makeTestRequestWithOperatorIndex,
  TestInvariantRegistryAdapter,
  NoopMapMasterLogger
} from '../mapmaster.test-helpers';

describe('MapMaster Integration Tests - Stage-1 Fractions', () => {
  let ruleProvider: DefaultMapMasterRuleProvider;
  let astHelpers: MapMasterAstHelpers;
  let selectionNormalizer: MapMasterSelectionNormalizer;
  let invariantRegistry: TestInvariantRegistryAdapter;

  beforeEach(() => {
    // Set up fresh instances for each test
    astHelpers = new MapMasterAstHelpers();
    selectionNormalizer = new MapMasterSelectionNormalizer(astHelpers);
    invariantRegistry = new TestInvariantRegistryAdapter();
    
    ruleProvider = new DefaultMapMasterRuleProvider(
      selectionNormalizer,
      astHelpers,
      invariantRegistry,
      new NoopMapMasterLogger()
    );
  });

  describe('Selection Normalization', () => {
    it('resolves anchor for 1/7 + 3/7 when clicking on root', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const normalized = selectionNormalizer.normalizeSelection(request);

      expect(normalized).not.toBeNull();
      expect(normalized!.anchorPath).toEqual([]);
      expect(normalized!.anchorKind).toBe('Operator');
      expect(normalized!.trace).toBeDefined();
    });

    it('resolves anchor for 5/7 - 2/7 when clicking on root', () => {
      const expr = makeTestExpression_5over7_minus_2over7();
      const request = makeTestRequestForRootClick(expr);

      const normalized = selectionNormalizer.normalizeSelection(request);

      expect(normalized).not.toBeNull();
      expect(normalized!.anchorPath).toEqual([]);
      expect(normalized!.anchorKind).toBe('Operator');
    });

    it('resolves anchor using operator index', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestWithOperatorIndex(expr, 0);

      const normalized = selectionNormalizer.normalizeSelection(request);

      expect(normalized).not.toBeNull();
      expect(normalized!.anchorKind).toBe('Operator');
      expect(normalized!.trace).toContain('operatorIndex');
    });

    it('returns null for request without valid selection info', () => {
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: makeTestExpression_1over7_plus_3over7(),
        clientEvent: null,
        policy: null,
        tsaSelection: null
      } as any;

      const normalized = selectionNormalizer.normalizeSelection(request);

      expect(normalized).toBeNull();
    });
  });

  describe('Semantic Window Resolution', () => {
    it('resolves semantic window at root for binary operation', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      // Build candidates to trigger window resolution
      const candidates = ruleProvider.buildCandidates(request);

      // Verify the process completed without errors
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('handles expressions with different denominators', () => {
      const expr = makeTestExpression_1over7_plus_2over5();
      const request = makeTestRequestForRootClick(expr);

      // Should not crash, but may return empty candidates
      const candidates = ruleProvider.buildCandidates(request);

      expect(Array.isArray(candidates)).toBe(true);
      // Different denominators means no FractionsSameDen candidates
      expect(candidates.length).toBe(0);
    });

    it('handles non-fraction expressions gracefully', () => {
      const expr = makeTestExpression_3_plus_5();
      const request = makeTestRequestForRootClick(expr);

      const candidates = ruleProvider.buildCandidates(request);

      expect(Array.isArray(candidates)).toBe(true);
      // Integer expressions won't match FractionsSameDen rules
      expect(candidates.length).toBe(0);
    });
  });

  describe('Stage-1 Fraction Rule Candidates', () => {
    it('produces FractionsSameDen Stage1 candidate for 1/7 + 3/7', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const candidates = ruleProvider.buildCandidates(request);

      // Filter for fraction candidates
      const fracCandidates = candidates.filter(
        c => c.domain === 'FractionsSameDen'
      );

      expect(fracCandidates.length).toBeGreaterThan(0);

      const candidate = fracCandidates[0];
      
      // Verify candidate structure
      expect(candidate.id).toBeDefined();
      expect(candidate.invariantId).toBeDefined();
      expect(candidate.primitiveIds).toBeDefined();
      expect(candidate.primitiveIds.length).toBeGreaterThan(0);
      expect(candidate.domain).toBe('FractionsSameDen');
      expect(candidate.stage).toBe('Stage1');
      expect(candidate.operation).toBe('Add');
      
      // Verify engine request is present
      expect(candidate.engineRequest).toBeDefined();
      expect((candidate.engineRequest as any).targetPath).toBeDefined();
      expect((candidate.engineRequest as any).primitiveIds).toBeDefined();
      expect((candidate.engineRequest as any).invariantRuleId).toBeDefined();
      
      // Verify descriptions
      expect(candidate.humanLabel).toBeDefined();
      expect(candidate.humanLabel).toContain('Add');
      expect(candidate.shortDescription).toBeDefined();
      
      // Verify safety
      expect(candidate.safety).toBeDefined();
      expect(candidate.safety.level).toBe('Safe');
    });

    it('produces FractionsSameDen Stage1 candidate for 5/7 - 2/7', () => {
      const expr = makeTestExpression_5over7_minus_2over7();
      const request = makeTestRequestForRootClick(expr);

      const candidates = ruleProvider.buildCandidates(request);

      const fracCandidates = candidates.filter(
        c => c.domain === 'FractionsSameDen'
      );

      expect(fracCandidates.length).toBeGreaterThan(0);

      const candidate = fracCandidates[0];
      
      expect(candidate.domain).toBe('FractionsSameDen');
      expect(candidate.stage).toBe('Stage1');
      expect(candidate.operation).toBe('Sub');
      expect(candidate.primitiveIds.length).toBeGreaterThan(0);
      expect(candidate.engineRequest).toBeDefined();
      
      expect(candidate.humanLabel).toContain('Subtract');
    });

    it('does not produce candidates for fractions with different denominators', () => {
      const expr = makeTestExpression_1over7_plus_2over5();
      const request = makeTestRequestForRootClick(expr);

      const candidates = ruleProvider.buildCandidates(request);

      const fracCandidates = candidates.filter(
        c => c.domain === 'FractionsSameDen'
      );

      expect(fracCandidates.length).toBe(0);
    });

    it('does not produce fraction candidates for integer expressions', () => {
      const expr = makeTestExpression_3_plus_5();
      const request = makeTestRequestForRootClick(expr);

      const candidates = ruleProvider.buildCandidates(request);

      const fracCandidates = candidates.filter(
        c => c.domain === 'FractionsSameDen'
      );

      expect(fracCandidates.length).toBe(0);
    });
  });

  describe('Candidate Properties and Stability', () => {
    it('generates stable candidate IDs for the same request', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request1 = makeTestRequestForRootClick(expr);
      const request2 = makeTestRequestForRootClick(expr);

      const candidates1 = ruleProvider.buildCandidates(request1);
      const candidates2 = ruleProvider.buildCandidates(request2);

      expect(candidates1.length).toBe(candidates2.length);
      
      if (candidates1.length > 0) {
        expect(candidates1[0].id).toBe(candidates2[0].id);
      }
    });

    it('includes complete metadata in candidates', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const candidates = ruleProvider.buildCandidates(request);

      if (candidates.length > 0) {
        const candidate = candidates[0];
        
        // Check all required fields are present
        expect(candidate).toHaveProperty('id');
        expect(candidate).toHaveProperty('invariantId');
        expect(candidate).toHaveProperty('primitiveIds');
        expect(candidate).toHaveProperty('domain');
        expect(candidate).toHaveProperty('stage');
        expect(candidate).toHaveProperty('operation');
        expect(candidate).toHaveProperty('selection');
        expect(candidate).toHaveProperty('engineRequest');
        expect(candidate).toHaveProperty('safety');
        expect(candidate).toHaveProperty('humanLabel');
        expect(candidate).toHaveProperty('shortDescription');
      }
    });

    it('assigns appropriate priority to Stage-1 operations', () => {
      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const candidates = ruleProvider.buildCandidates(request);

      if (candidates.length > 0) {
        const candidate = candidates[0];
        
        expect(candidate.priority).toBeDefined();
        expect(candidate.priority).toBeGreaterThan(0);
      }
    });
  });

  describe('Multiple Matching Rules', () => {
    it('generates multiple candidates if multiple rules match', () => {
      // Add an additional rule that also matches
      invariantRegistry.addRule({
        id: 'FRAC_ADD_SAME_DEN_STAGE1_ALT',
        stage: 'Stage1',
        domain: 'FractionsSameDen',
        operation: 'Add',
        primitiveIds: ['FRAC_ADD_SAME_DEN_ALT'],
        description: 'Alternative rule for adding fractions with same denominator'
      });

      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const candidates = ruleProvider.buildCandidates(request);

      const fracCandidates = candidates.filter(
        c => c.domain === 'FractionsSameDen'
      );

      // Should have multiple candidates (original + alternative)
      expect(fracCandidates.length).toBeGreaterThanOrEqual(2);
      
      // Each should have unique ID
      const ids = fracCandidates.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(fracCandidates.length);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles missing AST gracefully', () => {
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: { ast: null } as any,
        clientEvent: { type: 'click', astPath: [] } as any,
        policy: null,
        tsaSelection: null
      } as any;

      const candidates = ruleProvider.buildCandidates(request);

      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBe(0);
    });

    it('handles malformed AST nodes gracefully', () => {
      const request: MapMasterRequest = {
        expressionId: 'test-expr',
        invariantSetId: 'test-invariants',
        engineView: { 
          ast: { kind: 'Unknown', someProperty: 'value' } 
        } as any,
        clientEvent: { type: 'click', astPath: [] } as any,
        policy: null,
        tsaSelection: null
      } as any;

      const candidates = ruleProvider.buildCandidates(request);

      expect(Array.isArray(candidates)).toBe(true);
      // Malformed AST won't match any rules
      expect(candidates.length).toBe(0);
    });

    it('handles empty invariant rules gracefully', () => {
      // Clear all rules
      invariantRegistry.clearRules();

      const expr = makeTestExpression_1over7_plus_3over7();
      const request = makeTestRequestForRootClick(expr);

      const candidates = ruleProvider.buildCandidates(request);

      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBe(0);
    });
  });
});
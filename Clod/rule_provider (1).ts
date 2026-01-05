/**
 * MapMaster Rule Provider
 * 
 * Orchestrates the process of:
 * 1. Normalizing user selection to an anchor
 * 2. Resolving a semantic window around the anchor
 * 3. Querying invariant rules applicable to the window
 * 4. Delegating to rule modules to generate step candidates
 */

import type { MapMasterRequest, MapMasterStepCandidate } from './mapmaster.core';
import type { AstHelpers, AstPath, ExpressionAstNode } from './mapmaster.ast-helpers';
import type { SelectionNormalizer, AnchorKind } from './mapmaster.selection.normalizer';
import type { InvariantRegistryAdapter } from './mapmaster.invariant-registry';
import type { RuleContext } from './mapmaster.rules.common';

import { 
  buildCandidatesForFractionsStage1,
  buildCandidatesForIntegersStage1,
  buildCandidatesForMixedStage1
} from './mapmaster.rules.stage1';

/**
 * Interface for providing MapMaster rules and candidates.
 */
export interface MapMasterRuleProvider {
  /**
   * Build step candidates for a given request.
   * @param request - The MapMaster request
   * @returns Array of step candidates
   */
  buildCandidates(request: MapMasterRequest): MapMasterStepCandidate[];
}

/**
 * Default implementation of MapMasterRuleProvider.
 * 
 * This class orchestrates the full pipeline:
 * - Selection normalization
 * - Semantic window resolution
 * - Invariant rule querying
 * - Candidate generation via rule modules
 */
export class DefaultMapMasterRuleProvider implements MapMasterRuleProvider {
  constructor(
    private readonly selectionNormalizer: SelectionNormalizer,
    private readonly astHelpers: AstHelpers,
    private readonly invariantRegistry: InvariantRegistryAdapter,
    private readonly logger?: { debug: (msg: string) => void; warn: (msg: string) => void }
  ) {}

  /**
   * Build step candidates for the given request.
   */
  buildCandidates(request: MapMasterRequest): MapMasterStepCandidate[] {
    // Step 1: Normalize the selection to get an anchor
    const normalized = this.selectionNormalizer.normalizeSelection(request);
    
    if (!normalized) {
      this.logger?.debug('MapMaster: Could not normalize selection, returning empty candidates');
      return [];
    }

    this.logger?.debug(
      `MapMaster: Normalized selection - anchorPath=[${normalized.anchorPath.join(', ')}], ` +
      `anchorKind=${normalized.anchorKind}, trace="${normalized.trace}"`
    );

    // Step 2: Get the root AST from the engine view
    const rootAst = request.engineView?.ast;
    if (!rootAst) {
      this.logger?.warn('MapMaster: No AST available in engine view');
      return [];
    }

    // Step 3: Resolve the semantic window around the anchor
    const windowResult = this.resolveSemanticWindow(
      rootAst,
      normalized.anchorPath,
      normalized.anchorKind
    );

    if (!windowResult) {
      this.logger?.warn('MapMaster: Could not resolve semantic window');
      return [];
    }

    const { windowRootPath, windowRootNode } = windowResult;

    this.logger?.debug(
      `MapMaster: Resolved semantic window - path=[${windowRootPath.join(', ')}], ` +
      `kind=${windowRootNode.kind}`
    );

    // Step 4: Query invariant rules applicable to this window
    const invariantRules = this.invariantRegistry.getInvariantRulesForRequest(
      request,
      windowRootPath,
      windowRootNode
    );

    this.logger?.debug(`MapMaster: Found ${invariantRules.length} applicable invariant rules`);

    // Step 5: Build rule context
    const ruleContext: RuleContext = {
      request,
      windowRootPath,
      windowRootNode,
      invariantRules,
      astHelpers: this.astHelpers
    };

    // Step 6: Delegate to rule modules to build candidates
    const candidates: MapMasterStepCandidate[] = [];

    // Fractions stage 1
    const fractionCandidates = buildCandidatesForFractionsStage1(ruleContext);
    candidates.push(...fractionCandidates);

    // Integers stage 1
    const integerCandidates = buildCandidatesForIntegersStage1(ruleContext);
    candidates.push(...integerCandidates);

    // Mixed stage 1
    const mixedCandidates = buildCandidatesForMixedStage1(ruleContext);
    candidates.push(...mixedCandidates);

    this.logger?.debug(`MapMaster: Generated ${candidates.length} total candidates`);

    return candidates;
  }

  /**
   * Resolve the semantic window around an anchor.
   * 
   * The semantic window is the minimal sub-expression that should be considered
   * for step generation. The resolution strategy depends on the anchor kind:
   * 
   * - For Operator anchors: Use the operator's binary operation node as the window
   * - For Operand anchors: Use the operand itself, or its parent binary operation if applicable
   * 
   * @returns Object with windowRootPath and windowRootNode, or null if resolution fails
   */
  private resolveSemanticWindow(
    rootAst: ExpressionAstNode,
    anchorPath: AstPath,
    anchorKind: AnchorKind
  ): { windowRootPath: AstPath; windowRootNode: ExpressionAstNode } | null {
    // Get the anchor node
    const anchorNode = this.astHelpers.getNodeByPath(rootAst, anchorPath);
    if (!anchorNode) {
      return null;
    }

    if (anchorKind === 'Operator') {
      // For operators, the semantic window is the operator node itself
      // (which should be a binary operation containing left and right operands)
      return {
        windowRootPath: anchorPath,
        windowRootNode: anchorNode
      };
    } else {
      // For operands, we have two strategies:
      // 1. If the operand's parent is a binary operation, use the parent as the window
      //    (this gives more context for potential transformations)
      // 2. Otherwise, use the operand itself as the window

      const parentPath = this.astHelpers.getParentPath(anchorPath);
      
      if (parentPath && parentPath.length > 0) {
        const parentNode = this.astHelpers.getNodeByPath(rootAst, parentPath);
        
        if (parentNode && this.isBinaryOperation(parentNode)) {
          // Use parent binary operation as window
          return {
            windowRootPath: parentPath,
            windowRootNode: parentNode
          };
        }
      }

      // Fall back to using the operand itself as the window
      return {
        windowRootPath: anchorPath,
        windowRootNode: anchorNode
      };
    }
  }

  /**
   * Check if a node is any kind of binary operation.
   */
  private isBinaryOperation(node: ExpressionAstNode): boolean {
    return node.kind === 'BinaryOp' || node.kind === 'BinaryOperation';
  }
}

/**
 * Dummy implementation for testing.
 * @deprecated Use DefaultMapMasterRuleProvider instead
 */
export class DummyMapMasterRuleProvider implements MapMasterRuleProvider {
  buildCandidates(_request: MapMasterRequest): MapMasterStepCandidate[] {
    return [];
  }
}
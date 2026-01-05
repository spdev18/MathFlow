/**
 * MapMaster Rule Provider
 * 
 * Orchestrates the process of:
 * 1. Normalizing user selection to an anchor
 * 2. Resolving a semantic window around the anchor
 * 3. Querying invariant rules applicable to the window
 * 4. Delegating to rule modules to generate step candidates
 */

import type { MapMasterInput, MapMasterStepCandidate } from './mapmaster.core';
import type { AstHelpers, AstPath, ExpressionAstNode } from './mapmaster.ast-helpers';
import type { SelectionNormalizer, AnchorKind } from './mapmaster.selection.normalizer';
import type { InvariantRegistryAdapter } from './mapmaster.invariants.registry-adapter';
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
     * @param rootAst - The parsed AST (since MapMasterInput doesn't contain it directly)
     * @returns Array of step candidates
     */
    buildCandidates(request: MapMasterInput, rootAst: ExpressionAstNode): MapMasterStepCandidate[];
}

/**
 * Default implementation of MapMasterRuleProvider.
 */
export class DefaultMapMasterRuleProvider implements MapMasterRuleProvider {
    constructor(
        private readonly selectionNormalizer: SelectionNormalizer,
        private readonly astHelpers: AstHelpers,
        private readonly invariantRegistry: InvariantRegistryAdapter,
        private readonly logger?: { debug: (msg: string) => void; warn: (msg: string) => void }
    ) { }

    /**
     * Build step candidates for the given request.
     */
    buildCandidates(request: MapMasterInput, rootAst: ExpressionAstNode): MapMasterStepCandidate[] {
        // Step 1: Normalize the selection to get an anchor
        const normalized = this.selectionNormalizer.normalizeSelection(request, rootAst);

        if (!normalized) {
            this.logger?.debug('MapMaster: Could not normalize selection, returning empty candidates');
            return [];
        }

        this.logger?.debug(
            `MapMaster: Normalized selection - anchorPath=[${normalized.anchorPath.join(', ')}], ` +
            `anchorKind=${normalized.anchorKind}, trace="${normalized.trace}"`
        );

        // Step 2: Resolve the semantic window around the anchor
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
            `kind=${windowRootNode.type}`
        );

        // Step 3: Query invariant rules applicable to this window
        const invariantRules = this.invariantRegistry.getInvariantRulesForRequest(
            request,
            windowRootPath,
            windowRootNode
        );

        this.logger?.debug(`MapMaster: Found ${invariantRules.length} applicable invariant rules`);

        // Step 4: Build rule context
        const ruleContext: RuleContext = {
            request,
            windowRootPath,
            windowRootNode,
            invariantRules
        };

        // Step 5: Delegate to rule modules to build candidates
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
            return {
                windowRootPath: anchorPath,
                windowRootNode: anchorNode
            };
        } else {
            // For operands, we have two strategies:
            // 1. If the operand's parent is a binary operation, use the parent as the window
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
        return node.type === 'binaryOp';
    }
}

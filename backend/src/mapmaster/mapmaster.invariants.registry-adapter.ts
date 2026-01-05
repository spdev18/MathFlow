/**
 * MapMaster Invariant Registry Adapter
 * 
 * Adapts the invariant registry for use in MapMaster rule modules.
 * Provides intelligent filtering of invariants based on the AST window
 * and request context.
 */

import type { MapMasterInput } from './mapmaster.core';
import type { AstPath, ExpressionAstNode, AstHelpers } from './mapmaster.ast-helpers';
import type { InMemoryInvariantRegistry } from '../invariants/invariants.registry';
import type { InvariantRuleDefinition } from '../invariants/invariants.model';
import { findPatternForRule, findDomainForRule, InvariantPattern } from './mapmaster.invariants.registry';

/**
 * Extended Invariant Rule for MapMaster usage.
 * Includes the pattern metadata needed for local filtering.
 */
export interface InvariantRule extends InvariantRuleDefinition {
    domain: string;
    pattern?: InvariantPattern;
}

/**
 * Interface for querying invariants relevant to a MapMaster request.
 */
export interface InvariantRegistryAdapter {
    /**
     * Get invariant rules applicable to a semantic window.
     * 
     * @param request - The MapMaster request
     * @param windowRootPath - Path to the window root in the AST
     * @param windowRootNode - The AST node at the window root
     * @returns Array of applicable invariant rules
     */
    getInvariantRulesForRequest(
        request: MapMasterInput,
        windowRootPath: AstPath,
        windowRootNode: ExpressionAstNode
    ): InvariantRule[];
}

/**
 * Default implementation of InvariantRegistryAdapter.
 * 
 * Uses the core InMemoryInvariantRegistry to fetch rules, then augments them
 * with local pattern metadata and applies filtering.
 */
export class DefaultInvariantRegistryAdapter implements InvariantRegistryAdapter {

    constructor(
        private readonly registry: InMemoryInvariantRegistry,
        private readonly astHelpers?: AstHelpers
    ) { }

    /**
     * Get invariant rules applicable to the request and window.
     */
    getInvariantRulesForRequest(
        request: MapMasterInput,
        _windowRootPath: AstPath,
        windowRootNode: ExpressionAstNode
    ): InvariantRule[] {
        // Step 1: Fetch all active rules from the registry based on request.invariantSetIds
        const activeRules: InvariantRuleDefinition[] = [];

        for (const setId of request.invariantSetIds) {
            const set = this.registry.getInvariantSetById(setId);
            if (set) {
                activeRules.push(...set.rules);
            }
        }

        // Step 2: Augment rules with local metadata (domain, pattern)
        const augmentedRules: InvariantRule[] = activeRules.map(rule => {
            const domain = findDomainForRule(rule.id) || 'Other';
            const pattern = findPatternForRule(rule.id);
            return {
                ...rule,
                domain,
                pattern
            };
        });

        // Step 3: Determine candidate domains based on the window
        const candidateDomains = this.determineDomains(windowRootNode);

        // Step 4: Filter invariants by domain
        let candidates = augmentedRules.filter(rule => {
            // Match domain
            if (!candidateDomains.includes(rule.domain)) {
                return false;
            }
            return true;
        });

        // Step 5: Apply pattern-based filtering
        if (this.astHelpers) {
            candidates = candidates.filter(rule =>
                this.matchesPattern(rule, windowRootNode)
            );
        }

        return candidates;
    }

    /**
     * Determine candidate domains based on the AST window.
     */
    private determineDomains(windowRootNode: ExpressionAstNode): string[] {
        const domains: Set<string> = new Set();

        // Check for single integer
        if (this.isInteger(windowRootNode)) {
            domains.add('Integers');
        }

        // Check for single fraction
        const isSelfFraction = this.astHelpers?.isFraction(windowRootNode) ?? this.isFractionFallback(windowRootNode);
        if (isSelfFraction) {
            domains.add('FractionsSameDen');
        }

        // Check if this is a binary operation
        if (!this.isBinaryOperation(windowRootNode)) {
            // Not a binary operation - could be other types
            // If we already added domains (e.g. Integers), we should return those + Other?
            // Or just return what we have?
            // If we added domains, we return them. "Other" is fallback.
            if (domains.size > 0) return Array.from(domains);

            domains.add('Other');
            return Array.from(domains);
        }

        // Get operands
        const operands = this.getOperands(windowRootNode);
        if (!operands) {
            domains.add('Other');
            return Array.from(domains);
        }

        const { left, right } = operands;

        // Check for fractions
        const leftIsFraction = this.astHelpers?.isFraction(left) ?? this.isFractionFallback(left);
        const rightIsFraction = this.astHelpers?.isFraction(right) ?? this.isFractionFallback(right);

        if (leftIsFraction && rightIsFraction) {
            // Both are fractions - check denominators
            const sameDenominator = this.haveSameDenominator(left, right);

            // Generic "Fractions" domain applies to all fraction pairs
            domains.add('Fractions');

            if (sameDenominator) {
                domains.add('FractionsSameDen');
            } else {
                domains.add('FractionsDiffDen');
            }

            return Array.from(domains);
        }

        // Check for integers
        const leftIsInteger = this.isInteger(left);
        const rightIsInteger = this.isInteger(right);

        if (leftIsInteger && rightIsInteger) {
            domains.add('Integers');
            return Array.from(domains);
        }

        // Mixed: one integer, one fraction
        if ((leftIsInteger && rightIsFraction) || (leftIsFraction && rightIsInteger)) {
            domains.add('Mixed');
            return Array.from(domains);
        }

        // Fallback
        domains.add('Other');
        return Array.from(domains);
    }

    /**
     * Check if a rule's pattern matches the window node.
     */
    private matchesPattern(rule: InvariantRule, windowRootNode: ExpressionAstNode): boolean {
        const pattern = rule.pattern;
        if (!pattern) {
            // No pattern specified - rule applies
            return true;
        }

        // Check operator
        if (pattern.operator) {
            const nodeOperator = this.getOperator(windowRootNode);
            if (nodeOperator !== pattern.operator) {
                return false;
            }
        }

        // Check if fractions are required
        if (pattern.requiresFractions) {
            // Check if node itself is a fraction
            const isSelfFraction = this.astHelpers?.isFraction(windowRootNode) ?? this.isFractionFallback(windowRootNode);

            if (isSelfFraction) {
                if (pattern.requireSameDenominator) return false; // Single fraction cannot have "same denominator" with itself in this context
            } else {
                const operands = this.getOperands(windowRootNode);
                if (!operands) {
                    return false;
                }

                const leftIsFraction = this.astHelpers?.isFraction(operands.left) ??
                    this.isFractionFallback(operands.left);
                const rightIsFraction = this.astHelpers?.isFraction(operands.right) ??
                    this.isFractionFallback(operands.right);

                if (!leftIsFraction || !rightIsFraction) {
                    return false;
                }

                // Check same denominator if required
                if (pattern.requireSameDenominator) {
                    if (!this.haveSameDenominator(operands.left, operands.right)) {
                        return false;
                    }
                }
            }
        }

        // Check if integers are required
        if (pattern.requiresIntegers) {
            // Check if node itself is an integer
            const isSelfInteger = this.isInteger(windowRootNode);

            if (!isSelfInteger) {
                const operands = this.getOperands(windowRootNode);
                if (!operands) {
                    return false;
                }

                if (!this.isInteger(operands.left) || !this.isInteger(operands.right)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Check if a node is a binary operation.
     */
    private isBinaryOperation(node: ExpressionAstNode): boolean {
        return node.type === 'binaryOp';
    }

    /**
     * Get the operator from a binary operation node.
     */
    private getOperator(node: ExpressionAstNode): string | null {
        if (!this.isBinaryOperation(node)) {
            return null;
        }
        return (node as any).op || null;
    }

    /**
     * Get operands from a binary operation node.
     */
    private getOperands(node: ExpressionAstNode): { left: ExpressionAstNode; right: ExpressionAstNode } | null {
        if (!this.isBinaryOperation(node)) {
            return null;
        }

        const left = (node as any).left;
        const right = (node as any).right;

        if (!left || !right) {
            return null;
        }

        return { left, right };
    }

    /**
     * Fallback check for fraction nodes (when astHelpers not available).
     */
    private isFractionFallback(node: ExpressionAstNode): boolean {
        return node.type === 'fraction';
    }

    /**
     * Check if a node is an integer.
     */
    private isInteger(node: ExpressionAstNode): boolean {
        return node.type === 'integer';
    }

    /**
     * Check if two fraction nodes have the same denominator.
     */
    private haveSameDenominator(left: ExpressionAstNode, right: ExpressionAstNode): boolean {
        if (!this.astHelpers) {
            // Without astHelpers, do a simple structural check
            return this.haveSameDenominatorFallback(left, right);
        }

        const leftParts = this.astHelpers.getFractionParts(left);
        const rightParts = this.astHelpers.getFractionParts(right);

        if (!leftParts || !rightParts) {
            return false;
        }

        // Simple structural comparison
        return this.areNodesEqual(leftParts.denominator, rightParts.denominator);
    }

    /**
     * Fallback denominator check (without astHelpers).
     */
    private haveSameDenominatorFallback(left: ExpressionAstNode, right: ExpressionAstNode): boolean {
        const leftDenom = (left as any).denominator;
        const rightDenom = (right as any).denominator;

        if (!leftDenom || !rightDenom) {
            return false;
        }

        // In ast.ts, denominator is string.
        return leftDenom === rightDenom;
    }

    /**
     * Check if two AST nodes are structurally equal.
     */
    private areNodesEqual(node1: ExpressionAstNode, node2: ExpressionAstNode): boolean {
        // Kind must match
        if (node1.type !== node2.type) {
            return false;
        }

        // For integer literals, compare values
        if (node1.type === 'integer') {
            return node1.value === (node2 as any).value;
        }

        // For variables, compare names
        if (node1.type === 'variable') {
            return node1.name === (node2 as any).name;
        }

        // For complex nodes, use JSON comparison as fallback
        return JSON.stringify(node1) === JSON.stringify(node2);
    }
}

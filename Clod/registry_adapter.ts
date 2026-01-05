/**
 * MapMaster Invariant Registry Adapter
 * 
 * Adapts the invariant registry for use in MapMaster rule modules.
 * Provides intelligent filtering of invariants based on the AST window
 * and request context.
 */

import type { MapMasterRequest } from './mapmaster.core';
import type { AstPath, ExpressionAstNode, AstHelpers } from './mapmaster.ast-helpers';
import type { InvariantSet, InvariantPattern } from './mapmaster.invariants.registry';
import { getAllInvariants, STAGE1_INVARIANT_SETS } from './mapmaster.invariants.registry';

/**
 * Supported MapMaster domains.
 */
export type MapMasterDomain = 
  | 'FractionsSameDen'
  | 'FractionsDiffDen'
  | 'Integers'
  | 'Mixed'
  | 'Decimals'
  | 'Algebra'
  | 'Other';

/**
 * Minimal representation of an invariant rule.
 */
export interface InvariantRule {
  /**
   * Unique identifier for this invariant.
   */
  id: string;

  /**
   * Stage this invariant belongs to (e.g., "Stage1", "Stage2").
   */
  stage: string;

  /**
   * Domain this invariant applies to.
   */
  domain: MapMasterDomain;

  /**
   * Operation type (e.g., "Add", "Sub", "Mul", "Div").
   */
  operation?: string;

  /**
   * Primitive operation IDs from the Engine.
   */
  primitiveIds: string[];

  /**
   * Human-readable description.
   */
  description?: string;

  /**
   * Pattern specification for when this rule applies.
   */
  pattern?: InvariantPattern;

  /**
   * Additional metadata.
   */
  metadata?: Record<string, any>;
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
    request: MapMasterRequest,
    windowRootPath: AstPath,
    windowRootNode: ExpressionAstNode
  ): InvariantRule[];
}

/**
 * Default implementation of InvariantRegistryAdapter.
 * 
 * Uses an in-memory registry and applies intelligent filtering based on:
 * - The stage specified in the request
 * - The domain(s) detected from the AST window
 * - Quick pattern matching to eliminate obviously inapplicable rules
 */
export class DefaultInvariantRegistryAdapter implements InvariantRegistryAdapter {
  private readonly allInvariants: InvariantRule[];

  constructor(
    private readonly sets: InvariantSet[] = STAGE1_INVARIANT_SETS,
    private readonly astHelpers?: AstHelpers
  ) {
    this.allInvariants = getAllInvariants(sets);
  }

  /**
   * Get invariant rules applicable to the request and window.
   */
  getInvariantRulesForRequest(
    request: MapMasterRequest,
    _windowRootPath: AstPath,
    windowRootNode: ExpressionAstNode
  ): InvariantRule[] {
    // Step 1: Determine the target stage
    const targetStage = this.determineStage(request);

    // Step 2: Determine candidate domains based on the window
    const candidateDomains = this.determineDomains(windowRootNode);

    // Step 3: Filter invariants by stage and domain
    let candidates = this.allInvariants.filter(rule => {
      // Match stage
      if (rule.stage !== targetStage) {
        return false;
      }

      // Match domain
      if (!candidateDomains.includes(rule.domain)) {
        return false;
      }

      return true;
    });

    // Step 4: Apply pattern-based filtering
    if (this.astHelpers) {
      candidates = candidates.filter(rule => 
        this.matchesPattern(rule, windowRootNode)
      );
    }

    return candidates;
  }

  /**
   * Determine the target stage from the request.
   */
  private determineStage(request: MapMasterRequest): string {
    // Check request policy for stage
    if (request.policy && (request.policy as any).stage) {
      return (request.policy as any).stage;
    }

    // Check request directly for stage
    if ((request as any).stage) {
      return (request as any).stage;
    }

    // Default to Stage1
    return 'Stage1';
  }

  /**
   * Determine candidate domains based on the AST window.
   */
  private determineDomains(windowRootNode: ExpressionAstNode): MapMasterDomain[] {
    const domains: Set<MapMasterDomain> = new Set();

    // Check if this is a binary operation
    if (!this.isBinaryOperation(windowRootNode)) {
      // Not a binary operation - could be other types
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

    // Check if integers are required
    if (pattern.requiresIntegers) {
      const operands = this.getOperands(windowRootNode);
      if (!operands) {
        return false;
      }

      if (!this.isInteger(operands.left) || !this.isInteger(operands.right)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if a node is a binary operation.
   */
  private isBinaryOperation(node: ExpressionAstNode): boolean {
    return node.kind === 'BinaryOp' || node.kind === 'BinaryOperation';
  }

  /**
   * Get the operator from a binary operation node.
   */
  private getOperator(node: ExpressionAstNode): string | null {
    if (!this.isBinaryOperation(node)) {
      return null;
    }
    return (node as any).operator || (node as any).op || null;
  }

  /**
   * Get operands from a binary operation node.
   */
  private getOperands(node: ExpressionAstNode): { left: ExpressionAstNode; right: ExpressionAstNode } | null {
    if (!this.isBinaryOperation(node)) {
      return null;
    }

    const left = (node as any).left || (node as any).lhs;
    const right = (node as any).right || (node as any).rhs;

    if (!left || !right) {
      return null;
    }

    return { left, right };
  }

  /**
   * Fallback check for fraction nodes (when astHelpers not available).
   */
  private isFractionFallback(node: ExpressionAstNode): boolean {
    return node.kind === 'Fraction' || node.kind === 'Rational';
  }

  /**
   * Check if a node is an integer.
   */
  private isInteger(node: ExpressionAstNode): boolean {
    return node.kind === 'Integer' || node.kind === 'IntegerLiteral';
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
    const leftDenom = (left as any).denominator || (left as any).denom;
    const rightDenom = (right as any).denominator || (right as any).denom;

    if (!leftDenom || !rightDenom) {
      return false;
    }

    return this.areNodesEqual(leftDenom, rightDenom);
  }

  /**
   * Check if two AST nodes are structurally equal.
   */
  private areNodesEqual(node1: ExpressionAstNode, node2: ExpressionAstNode): boolean {
    // Kind must match
    if (node1.kind !== node2.kind) {
      return false;
    }

    // For integer literals, compare values
    if (node1.kind === 'Integer' || node1.kind === 'IntegerLiteral') {
      const val1 = (node1 as any).value || (node1 as any).val;
      const val2 = (node2 as any).value || (node2 as any).val;
      return val1 === val2;
    }

    // For variables, compare names
    if (node1.kind === 'Variable' || node1.kind === 'Identifier') {
      const name1 = (node1 as any).name || (node1 as any).id;
      const name2 = (node2 as any).name || (node2 as any).id;
      return name1 === name2;
    }

    // For complex nodes, use JSON comparison as fallback
    return JSON.stringify(node1) === JSON.stringify(node2);
  }
}

/**
 * Empty implementation that returns no invariants.
 * Useful for testing scenarios where you want to verify behavior without invariants.
 */
export class EmptyInvariantRegistryAdapter implements InvariantRegistryAdapter {
  getInvariantRulesForRequest(
    _request: MapMasterRequest,
    _windowRootPath: AstPath,
    _windowRootNode: ExpressionAstNode
  ): InvariantRule[] {
    return [];
  }
}
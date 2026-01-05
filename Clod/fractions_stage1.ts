/**
 * MapMaster Stage-1 Fraction Rules
 * 
 * Handles fraction operations where both operands have the same denominator.
 * Domain: FractionsSameDen
 * 
 * Examples:
 * - 1/7 + 3/7 → 4/7
 * - 5/7 - 2/7 → 3/7
 */

import type { MapMasterStepCandidate } from './mapmaster.core';
import type { RuleContext } from './mapmaster.rules.common';
import type { AstHelpers, ExpressionAstNode } from './mapmaster.ast-helpers';

/**
 * Build step candidates for Stage-1 fraction operations with same denominator.
 * 
 * This function identifies binary operations (+ or -) on two fractions that share
 * the same denominator, and generates appropriate step candidates using matching
 * invariant rules from the registry.
 */
export function buildCandidatesForFractionsStage1(ctx: RuleContext): MapMasterStepCandidate[] {
  const candidates: MapMasterStepCandidate[] = [];

  // Step 1: Check if the window is a binary operation
  const windowNode = ctx.windowRootNode;
  if (!windowNode || !isBinaryOperation(windowNode)) {
    return [];
  }

  // Step 2: Determine the operator type
  const operator = getOperator(windowNode);
  if (operator !== '+' && operator !== '-') {
    return [];
  }

  // Step 3: Extract left and right operands
  const operands = getOperands(windowNode);
  if (!operands) {
    return [];
  }

  const { left, right } = operands;

  // Step 4: Get AstHelpers (from request or create a default instance)
  const astHelpers = getAstHelpers(ctx);
  if (!astHelpers) {
    return [];
  }

  // Step 5: Check if both operands are fractions
  if (!astHelpers.isFraction(left) || !astHelpers.isFraction(right)) {
    return [];
  }

  // Step 6: Extract fraction parts
  const leftParts = astHelpers.getFractionParts(left);
  const rightParts = astHelpers.getFractionParts(right);

  if (!leftParts || !rightParts) {
    return [];
  }

  // Step 7: Check if denominators are the same
  if (!areDenominatorsEqual(leftParts.denominator, rightParts.denominator)) {
    return [];
  }

  // Step 8: Find matching invariant rules
  const matchingRules = ctx.invariantRules.filter(rule => {
    // Filter for FractionsSameDen domain
    if (rule.domain !== 'FractionsSameDen') {
      return false;
    }

    // Filter for Stage1
    if (rule.stage !== 'Stage1') {
      return false;
    }

    // Match operator type (if rule has operation metadata)
    const ruleOperation = (rule as any).operation || inferOperationFromRuleId(rule.id);
    if (operator === '+' && ruleOperation !== 'Add') {
      return false;
    }
    if (operator === '-' && ruleOperation !== 'Sub') {
      return false;
    }

    return true;
  });

  // Step 9: Generate candidates for each matching rule
  for (const rule of matchingRules) {
    const candidate = buildCandidate(ctx, rule, operator);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

/**
 * Build a single step candidate for a matching invariant rule.
 */
function buildCandidate(
  ctx: RuleContext,
  rule: any, // InvariantRule type from registry
  operator: '+' | '-'
): MapMasterStepCandidate | null {
  // Generate a stable candidate ID
  const candidateId = `${rule.id}#${ctx.windowRootPath.join('.')}`;

  // Determine operation name
  const operation = operator === '+' ? 'Add' : 'Sub';

  // Create human-readable labels
  const humanLabel = operator === '+' 
    ? 'Add fractions with the same denominator'
    : 'Subtract fractions with the same denominator';

  const shortDescription = operator === '+'
    ? 'Add numerators, keep denominator'
    : 'Subtract numerators, keep denominator';

  // Build the engine request draft
  const engineRequest = {
    targetPath: ctx.windowRootPath,
    primitiveIds: rule.primitiveIds || [],
    invariantRuleId: rule.id,
    operation: operation,
    domain: 'FractionsSameDen'
  };

  // Build the step candidate
  const candidate: MapMasterStepCandidate = {
    id: candidateId,
    invariantId: rule.id,
    primitiveIds: rule.primitiveIds || [],
    domain: 'FractionsSameDen',
    stage: 'Stage1',
    operation: operation,
    
    // Selection describes what this step applies to
    selection: {
      targetPath: ctx.windowRootPath,
      targetKind: 'BinaryOperation',
      operatorSymbol: operator
    },

    // Engine request draft for later execution
    engineRequest: engineRequest,

    // Safety assessment
    safety: {
      level: 'Safe',
      requiresValidation: false,
      potentialSideEffects: []
    },

    // Human-readable descriptions
    humanLabel: humanLabel,
    shortDescription: shortDescription,
    detailedDescription: `Apply the rule: ${humanLabel}. ${shortDescription}.`,

    // Priority (Stage-1 operations are typically high priority)
    priority: 100,

    // Metadata for debugging
    metadata: {
      windowNodeKind: ctx.windowRootNode.kind,
      operator: operator,
      ruleId: rule.id
    }
  };

  return candidate;
}

/**
 * Check if a node is a binary operation.
 */
function isBinaryOperation(node: ExpressionAstNode): boolean {
  return node.kind === 'BinaryOp' || node.kind === 'BinaryOperation';
}

/**
 * Extract the operator symbol from a binary operation node.
 */
function getOperator(node: ExpressionAstNode): string | null {
  if (!isBinaryOperation(node)) {
    return null;
  }

  // Try common property names for operator
  const operator = (node as any).operator || (node as any).op || (node as any).symbol;
  return operator || null;
}

/**
 * Extract left and right operands from a binary operation node.
 */
function getOperands(node: ExpressionAstNode): { left: ExpressionAstNode; right: ExpressionAstNode } | null {
  if (!isBinaryOperation(node)) {
    return null;
  }

  const left = (node as any).left || (node as any).lhs || (node as any).leftOperand;
  const right = (node as any).right || (node as any).rhs || (node as any).rightOperand;

  if (!left || !right) {
    return null;
  }

  // Verify both are valid AST nodes
  if (!isValidAstNode(left) || !isValidAstNode(right)) {
    return null;
  }

  return { left, right };
}

/**
 * Check if a value is a valid AST node.
 */
function isValidAstNode(value: any): value is ExpressionAstNode {
  return value && typeof value === 'object' && 'kind' in value;
}

/**
 * Get AstHelpers instance from the context.
 */
function getAstHelpers(ctx: RuleContext): AstHelpers | null {
  // AstHelpers might be available through the request or context
  // Try multiple possible locations
  const astHelpers = (ctx as any).astHelpers || 
                     (ctx.request as any).astHelpers ||
                     (ctx.request.engineView as any).astHelpers;

  return astHelpers || null;
}

/**
 * Check if two denominator nodes are equal.
 * 
 * This is a structural equality check - we compare the AST structure
 * to determine if both fractions have the same denominator.
 */
function areDenominatorsEqual(denom1: ExpressionAstNode, denom2: ExpressionAstNode): boolean {
  // For now, use a simple structural comparison
  // A more sophisticated implementation might use Engine's equality checking
  
  // Check if both are the same kind
  if (denom1.kind !== denom2.kind) {
    return false;
  }

  // For integer literals, compare values
  if (denom1.kind === 'Integer' || denom1.kind === 'IntegerLiteral') {
    const val1 = (denom1 as any).value || (denom1 as any).val;
    const val2 = (denom2 as any).value || (denom2 as any).val;
    return val1 === val2;
  }

  // For variables, compare names
  if (denom1.kind === 'Variable' || denom1.kind === 'Identifier') {
    const name1 = (denom1 as any).name || (denom1 as any).id;
    const name2 = (denom2 as any).name || (denom2 as any).id;
    return name1 === name2;
  }

  // For more complex expressions, do a deep structural comparison
  // This is a simplified version - a full implementation would be more thorough
  return JSON.stringify(denom1) === JSON.stringify(denom2);
}

/**
 * Infer the operation type from a rule ID.
 * This is a fallback heuristic if the rule doesn't have explicit operation metadata.
 */
function inferOperationFromRuleId(ruleId: string): string {
  const lowerRuleId = ruleId.toLowerCase();
  
  if (lowerRuleId.includes('add') || lowerRuleId.includes('addition') || lowerRuleId.includes('plus')) {
    return 'Add';
  }
  
  if (lowerRuleId.includes('sub') || lowerRuleId.includes('subtract') || lowerRuleId.includes('minus')) {
    return 'Sub';
  }
  
  // Default to Add if unclear
  return 'Add';
}
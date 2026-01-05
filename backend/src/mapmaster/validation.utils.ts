/**
 * Validation Utils for Smart Operator Selection
 * 
 * Determines whether an operator action can be executed directly (GREEN)
 * or requires preparation steps (YELLOW).
 */

import { parseExpression, getNodeAt, type AstNode, type BinaryOpNode, type FractionNode } from './ast';

/**
 * Validation result type.
 * - "direct": Operation can be executed immediately (GREEN highlight)
 * - "requires-prep": Operation requires preparation (YELLOW highlight)
 */
export type ValidationType = 'direct' | 'requires-prep';

export interface ValidationResult {
    validationType: ValidationType;
    reason: string;
    operatorType?: string;
    leftOperandType?: string;
    rightOperandType?: string;
}

/**
 * Extract the denominator value from a node.
 * Returns undefined if node is not a fraction or the denominator is not a simple integer.
 */
function getDenominator(node: AstNode): string | undefined {
    if (node.type === 'fraction') {
        return (node as FractionNode).denominator;
    }
    return undefined;
}

/**
 * Check if a node represents a simple integer.
 */
function isInteger(node: AstNode): boolean {
    return node.type === 'integer';
}

/**
 * Check if a node represents a fraction.
 */
function isFraction(node: AstNode): boolean {
    return node.type === 'fraction';
}

/**
 * Validate an operator context to determine if the operation can be executed directly.
 * 
 * @param latex - The LaTeX expression
 * @param operatorPath - Path to the operator node in AST (e.g., "root", "term[0]")
 * @returns ValidationResult with type and reason
 */
export function validateOperatorContext(
    latex: string,
    operatorPath: string = 'root'
): ValidationResult | null {
    // Parse the expression
    const ast = parseExpression(latex);
    if (!ast) {
        return null;
    }

    // Get the operator node
    const node = getNodeAt(ast, operatorPath);
    if (!node) {
        return null;
    }

    // Only binary operators can be validated
    if (node.type !== 'binaryOp') {
        return null;
    }

    const opNode = node as BinaryOpNode;
    const { op, left, right } = opNode;

    const leftType = left.type;
    const rightType = right.type;

    // === ADDITION / SUBTRACTION ===
    if (op === '+' || op === '-') {
        // Case 1: Both operands are integers → DIRECT
        if (isInteger(left) && isInteger(right)) {
            return {
                validationType: 'direct',
                reason: 'integer-arithmetic',
                operatorType: op,
                leftOperandType: leftType,
                rightOperandType: rightType,
            };
        }

        // Case 2: Both operands are fractions
        if (isFraction(left) && isFraction(right)) {
            const leftDenom = getDenominator(left);
            const rightDenom = getDenominator(right);

            // Same denominator → DIRECT
            if (leftDenom && rightDenom && leftDenom === rightDenom) {
                return {
                    validationType: 'direct',
                    reason: 'same-denominator',
                    operatorType: op,
                    leftOperandType: leftType,
                    rightOperandType: rightType,
                };
            }

            // Different denominators → REQUIRES-PREP
            return {
                validationType: 'requires-prep',
                reason: 'different-denominators',
                operatorType: op,
                leftOperandType: leftType,
                rightOperandType: rightType,
            };
        }

        // Case 3: Mixed (integer + fraction or fraction + integer) → REQUIRES-PREP
        if ((isInteger(left) && isFraction(right)) || (isFraction(left) && isInteger(right))) {
            return {
                validationType: 'requires-prep',
                reason: 'mixed-operand-types',
                operatorType: op,
                leftOperandType: leftType,
                rightOperandType: rightType,
            };
        }
    }

    // === MULTIPLICATION ===
    if (op === '*') {
        // Integers → DIRECT
        if (isInteger(left) && isInteger(right)) {
            return {
                validationType: 'direct',
                reason: 'integer-arithmetic',
                operatorType: op,
                leftOperandType: leftType,
                rightOperandType: rightType,
            };
        }

        // Fractions can always be multiplied directly (cross multiply)
        if (isFraction(left) && isFraction(right)) {
            return {
                validationType: 'direct',
                reason: 'fraction-multiplication',
                operatorType: op,
                leftOperandType: leftType,
                rightOperandType: rightType,
            };
        }

        // Integer * Fraction → DIRECT (still a valid multiplication)
        if ((isInteger(left) && isFraction(right)) || (isFraction(left) && isInteger(right))) {
            return {
                validationType: 'direct',
                reason: 'mixed-multiplication',
                operatorType: op,
                leftOperandType: leftType,
                rightOperandType: rightType,
            };
        }
    }

    // === DIVISION ===
    if (op === '/' || op === '\\div') {
        // Integers → DIRECT if divisible, REQUIRES-PREP otherwise
        if (isInteger(left) && isInteger(right)) {
            // Check if exactly divisible
            const leftVal = parseInt((left as any).value, 10);
            const rightVal = parseInt((right as any).value, 10);

            if (!isNaN(leftVal) && !isNaN(rightVal) && rightVal !== 0 && leftVal % rightVal === 0) {
                return {
                    validationType: 'direct',
                    reason: 'exact-division',
                    operatorType: op,
                    leftOperandType: leftType,
                    rightOperandType: rightType,
                };
            }

            return {
                validationType: 'requires-prep',
                reason: 'non-exact-division',
                operatorType: op,
                leftOperandType: leftType,
                rightOperandType: rightType,
            };
        }

        // Fraction division → DIRECT (multiply by reciprocal)
        if (isFraction(left) && isFraction(right)) {
            return {
                validationType: 'direct',
                reason: 'fraction-division',
                operatorType: op,
                leftOperandType: leftType,
                rightOperandType: rightType,
            };
        }
    }

    // Default: if we can't determine, assume requires-prep
    return {
        validationType: 'requires-prep',
        reason: 'unknown-operation-pattern',
        operatorType: op,
        leftOperandType: leftType,
        rightOperandType: rightType,
    };
}

/**
 * Convenience function to validate from a full expression.
 * Validates the root operator.
 */
export function validateRootOperator(latex: string): ValidationResult | null {
    return validateOperatorContext(latex, 'root');
}

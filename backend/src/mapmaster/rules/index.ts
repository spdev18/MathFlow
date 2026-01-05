/**
 * MapMaster Rule Matchers (TzV1.1)
 * 
 * Defines the interface for rule matchers and implements them for the core rules.
 */

import { AstNode, getNodeAt, NodeType } from "../ast";

export interface RuleMatcher {
    primitiveId: string;
    matches(ast: AstNode, selectionPath: string): boolean;
}

// --- Helper Functions ---

function isInteger(node: AstNode | undefined): boolean {
    return node?.type === "integer";
}

function isFraction(node: AstNode | undefined): boolean {
    return node?.type === "fraction";
}

function isMixed(node: AstNode | undefined): boolean {
    return node?.type === "mixed";
}

function hasCommonFactor(numStr: string, denStr: string): boolean {
    const num = Math.abs(parseInt(numStr, 10));
    const den = Math.abs(parseInt(denStr, 10));
    if (isNaN(num) || isNaN(den) || den === 0) return false;

    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    return gcd(num, den) > 1;
}

// --- Matcher Implementations ---

export const Matchers: RuleMatcher[] = [
    // P.FRAC_WHOLE_TO_OVER_ONE: Integer -> Integer/1
    {
        primitiveId: "P.FRAC_WHOLE_TO_OVER_ONE",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            return isInteger(node);
        }
    },

    // P.FRAC_ADD_SAME_DEN: a/b + c/b
    {
        primitiveId: "P.FRAC_ADD_SAME_DEN",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            if (node?.type === "binaryOp" && node.op === "+") {
                if (isFraction(node.left) && isFraction(node.right)) {
                    const left = node.left as any;
                    const right = node.right as any;
                    return left.denominator === right.denominator;
                }
            }
            return false;
        }
    },

    // P.FRAC_SIMPLIFY_BASIC: a/b -> simplified
    {
        primitiveId: "P.FRAC_SIMPLIFY_BASIC",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            if (isFraction(node)) {
                const frac = node as any;
                return hasCommonFactor(frac.numerator, frac.denominator);
            }
            return false;
        }
    },

    // P.MUL_BY_ONE: a/b -> a/b * 1
    {
        primitiveId: "P.MUL_BY_ONE",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            return isFraction(node);
        }
    },

    // P.ONE_TO_FRAC: 1 -> n/n
    {
        primitiveId: "P.ONE_TO_FRAC",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            if (isInteger(node)) {
                return (node as any).value === "1";
            }
            return false;
        }
    },

    // P.MIXED_SPLIT: A B/C -> A + B/C
    {
        primitiveId: "P.MIXED_SPLIT",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            return isMixed(node);
        }
    },

    // P.INT_ADD: a + b (Integers)
    {
        primitiveId: "P.INT_ADD",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            if (node?.type === "binaryOp" && node.op === "+") {
                return isInteger(node.left) && isInteger(node.right);
            }
            return false;
        }
    },

    // P.INT_SUB: a - b
    {
        primitiveId: "P.INT_SUB",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            if (node?.type === "binaryOp" && node.op === "-") {
                return isInteger(node.left) && isInteger(node.right);
            }
            return false;
        }
    },
    // P.INT_MUL: a * b
    {
        primitiveId: "P.INT_MUL",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            if (node?.type === "binaryOp" && node.op === "*") {
                return isInteger(node.left) && isInteger(node.right);
            }
            return false;
        }
    },
    // P.INT_DIV_EXACT: a / b
    {
        primitiveId: "P.INT_DIV_EXACT",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);

            if (node?.type === "binaryOp" && node.op === "/") {
                const leftInt = isInteger(node.left);
                const rightInt = isInteger(node.right);
                return leftInt && rightInt;
            }

            if (node?.type === "fraction") {
                // FractionNode has string numerator/denominator
                // Assume they are integers if they are in FractionNode (parser ensures it)
                return true;
            }

            return false;
        }
    },
    // P.INT_DIV_TO_FRAC: a / b -> a/b
    {
        primitiveId: "P.INT_DIV_TO_FRAC",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            if (node?.type === "binaryOp" && node.op === "/") {
                return isInteger(node.left) && isInteger(node.right);
            }
            return false;
        }
    },
    // P4.FRAC_ADD_BASIC: a/b + c/d (Generic fraction addition)
    {
        primitiveId: "P4.FRAC_ADD_BASIC",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            if (node?.type === "binaryOp" && node.op === "+") {
                return isFraction(node.left) && isFraction(node.right);
            }
            return false;
        }
    },
    // P0.FRAC_SIMPLIFY: a/b -> simplified
    {
        primitiveId: "P0.FRAC_SIMPLIFY",
        matches: (ast, path) => {
            const node = getNodeAt(ast, path);
            if (isFraction(node)) {
                const frac = node as any;
                return hasCommonFactor(frac.numerator, frac.denominator);
            }
            return false;
        }
    }
];

/**
 * MapMaster AST Helpers
 * 
 * Adapts generic AST navigation and inspection from CLOD to work with
 * the concrete AstNode types in this repository.
 */

import { AstNode, getNodeAt as astGetNodeAt } from './ast';

/**
 * Path to a node in the AST, represented as an array of keys/indices.
 * String elements represent object keys, number elements represent array indices.
 */
export type AstPath = Array<string | number>;

/**
 * Minimal interface representing any node in the expression AST.
 * We use the concrete AstNode type from ./ast.ts.
 */
export type ExpressionAstNode = AstNode;

/**
 * Interface for AST navigation and inspection utilities.
 */
export interface AstHelpers {
    /**
     * Navigate to a node in the AST using a path.
     * @param root - The root AST node
     * @param path - Array of keys/indices to follow
     * @returns The node at the path, or undefined if path is invalid
     */
    getNodeByPath(root: ExpressionAstNode, path: AstPath): ExpressionAstNode | undefined;

    /**
     * Get the parent path of a given path.
     * @param path - The path to get the parent of
     * @returns The parent path, or undefined if path is root
     */
    getParentPath(path: AstPath): AstPath | undefined;

    /**
     * Check if a node is a binary operator with the given symbol.
     * @param node - The node to check
     * @param symbol - The operator symbol to match (e.g., "+", "-", "*", "/")
     * @returns True if the node is a binary operator with the given symbol
     */
    isBinaryOperator(node: ExpressionAstNode, symbol: string): boolean;

    /**
     * Check if a node represents a fraction.
     * @param node - The node to check
     * @returns True if the node is a fraction
     */
    isFraction(node: ExpressionAstNode): boolean;

    /**
     * Extract the numerator and denominator from a fraction node.
     * @param node - The fraction node
     * @returns Object with numerator and denominator (parsed as nodes if possible, or created as literals), or undefined
     */
    getFractionParts(node: ExpressionAstNode): { numerator: ExpressionAstNode; denominator: ExpressionAstNode } | undefined;

    /**
     * Find the path to the Nth binary operator in the AST (0-indexed, DFS order).
     * @param root - The root AST node
     * @param operatorIndex - The index of the operator to find
     * @returns The path to the operator, or undefined if not found
     */
    findNthOperator(root: ExpressionAstNode, operatorIndex: number): AstPath | undefined;
}

/**
 * Concrete implementation of AstHelpers.
 */
export class MapMasterAstHelpers implements AstHelpers {
    /**
     * Navigate to a node by following a path through the AST.
     * Adapts array-based path to the dot-notation path expected by ast.ts if needed,
     * or implements direct traversal.
     * 
     * Since ast.ts uses specific path strings like "term[0]", we should try to map
     * our generic AstPath to that format OR implement generic traversal that matches
     * the structure of AstNode.
     * 
     * AstNode structure:
     * BinaryOp: left, right
     * Fraction: numerator, denominator (strings!) -> Wait, ast.ts FractionNode has string num/den.
     * Mixed: whole, numerator, denominator (strings)
     * 
     * CLOD expected object traversal.
     * 
     * If we use generic traversal, we need to handle the fact that `numerator` in FractionNode is a string,
     * not a Node. But `getFractionParts` expects Nodes.
     * We might need to wrap the string values into IntegerNodes for consistency with CLOD's expectations?
     */
    getNodeByPath(root: ExpressionAstNode, path: AstPath): ExpressionAstNode | undefined {
        let current: any = root;

        for (const segment of path) {
            if (current === null || current === undefined) {
                return undefined;
            }

            // Handle specific AstNode structure mapping if necessary
            // For now, assume path segments match property names (left, right, etc.)
            // Note: ast.ts `getNodeAt` uses "term[0]" for left, "term[1]" for right.
            // If `path` comes from `findNthOperator`, it will be constructed by us.
            // If it comes from client, it might be array of strings.

            if (typeof segment === 'string') {
                // Support ast.ts-style paths like "term[0]" / "term[1]" (left/right for binary ops)
                // and generic "prop[index]" for array-like children.
                const m = /^([a-zA-Z_][a-zA-Z0-9_]*)\[(\d+)\]$/.exec(segment);
                if (m) {
                    const key = m[1];
                    const idx = Number(m[2]);

                    // Special case: term[0]/term[1] for binary operators (left/right)
                    if (key === 'term' && current && typeof current === 'object' && (('left' in current) || ('right' in current))) {
                        if (idx === 0) {
                            current = (current as any).left;
                            continue;
                        }
                        if (idx === 1) {
                            current = (current as any).right;
                            continue;
                        }
                        return undefined;
                    }

                    const container = (current as any)?.[key];
                    if (Array.isArray(container)) {
                        current = container[idx];
                        continue;
                    }

                    return undefined;
                }

                current = current[segment];
            } else if (typeof segment === 'number') {
                if (Array.isArray(current)) {
                    current = current[segment];
                } else {
                    return undefined;
                }
            }
        }

        if (current && typeof current === 'object' && 'type' in current) {
            return current as ExpressionAstNode;
        }

        // If we navigated to a string property (like fraction numerator), we might need to wrap it?
        // CLOD's `ExpressionAstNode` implies an object.
        // If `current` is a string (e.g. "5"), we can wrap it in an IntegerNode.
        if (typeof current === 'string') {
            // Heuristic: check if it looks like a number
            if (/^-?\d+$/.test(current)) {
                return { type: 'integer', value: current };
            }
            // Variable?
            if (/^[a-zA-Z]+$/.test(current)) {
                return { type: 'variable', name: current };
            }
        }

        return undefined;
    }

    getParentPath(path: AstPath): AstPath | undefined {
        if (path.length === 0) {
            return undefined;
        }
        return path.slice(0, -1);
    }

    isBinaryOperator(node: ExpressionAstNode, symbol: string): boolean {
        if (!node || node.type !== 'binaryOp') {
            return false;
        }
        return node.op === symbol;
    }

    isFraction(node: ExpressionAstNode): boolean {
        if (!node) return false;
        return node.type === 'fraction';
    }

    getFractionParts(node: ExpressionAstNode): { numerator: ExpressionAstNode; denominator: ExpressionAstNode } | undefined {
        if (!this.isFraction(node)) {
            return undefined;
        }

        const frac = node as any; // Cast to access concrete fields
        // In ast.ts, numerator and denominator are STRINGS.
        // We need to return ExpressionAstNode.
        // So we wrap them in IntegerNodes (or VariableNodes).

        const numVal = frac.numerator;
        const denVal = frac.denominator;

        const numNode: ExpressionAstNode = /^-?\d+$/.test(numVal)
            ? { type: 'integer', value: numVal }
            : { type: 'variable', name: numVal };

        const denNode: ExpressionAstNode = /^-?\d+$/.test(denVal)
            ? { type: 'integer', value: denVal }
            : { type: 'variable', name: denVal };

        return { numerator: numNode, denominator: denNode };
    }

    findNthOperator(root: ExpressionAstNode, operatorIndex: number): AstPath | undefined {
        let count = 0;
        const result = this.dfsForOperator(root, [], operatorIndex, { count });
        return result;
    }

    private dfsForOperator(
        node: any,
        currentPath: AstPath,
        targetIndex: number,
        state: { count: number }
    ): AstPath | undefined {
        if (!node || typeof node !== 'object' || !('type' in node)) {
            return undefined;
        }

        // Check if this node is a binary operator
        if (node.type === 'binaryOp') {
            if (state.count === targetIndex) {
                return currentPath;
            }
            state.count++;

            // Traverse children: left then right
            const leftRes = this.dfsForOperator(node.left, [...currentPath, 'left'], targetIndex, state);
            if (leftRes) return leftRes;

            const rightRes = this.dfsForOperator(node.right, [...currentPath, 'right'], targetIndex, state);
            if (rightRes) return rightRes;

            return undefined;
        }

        // Traverse other node types if they contain children
        // Fraction/Mixed have string children in this AST, so no recursion needed for operators inside them
        // (unless we change AST definition to allow nested expressions in fractions, which ast.ts parser supports but types say string?)
        // ast.ts: FractionNode { numerator: string; denominator: string; }
        // So we stop at fractions.

        return undefined;
    }
}

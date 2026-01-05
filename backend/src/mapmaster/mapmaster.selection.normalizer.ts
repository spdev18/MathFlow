/**
 * MapMaster Selection Normalizer
 * 
 * Normalizes user selection (from various sources like client events or TSA)
 * into a canonical "Anchor" that rules can operate on.
 */

import type { MapMasterInput } from './mapmaster.core';
import type {
    AstHelpers,
    AstPath,
    ExpressionAstNode,
} from './mapmaster.ast-helpers';

/**
 * Kind of the anchor that selection normalization produced.
 * - "Operator"  → anchor points to a binary operator node
 * - "Operand"   → anchor points to a value (fraction, integer, etc.)
 */
export type AnchorKind = 'Operator' | 'Operand';

/**
 * Normalized selection that MapMaster rule provider will use as an anchor.
 */
export interface NormalizedSelection {
    /** Path to the anchor node in the expression AST */
    anchorPath: AstPath;
    /** Whether the anchor is an operator or an operand */
    anchorKind: AnchorKind;
    /**
     * Human-readable trace of where the selection came from,
     * e.g. "clientEvent.astPath", "clientEvent.operatorIndex:0th operator",
     * "tsaSelection.astPath"
     */
    trace: string;
}

/**
 * Interface for selection normalizers.
 */
export interface SelectionNormalizer {
    normalizeSelection(input: MapMasterInput, rootAst: ExpressionAstNode): NormalizedSelection | null;
}

/**
 * Default implementation of MapMaster selection normalization.
 *
 * Priority of selection sources:
 *  1) input.selectionPath (if valid path)
 *  2) input.operatorIndex
 *
 * If none of these yield a valid AST location, returns null.
 */
export class MapMasterSelectionNormalizer implements SelectionNormalizer {
    constructor(private readonly astHelpers: AstHelpers) { }

    normalizeSelection(input: MapMasterInput, rootAst: ExpressionAstNode): NormalizedSelection | null {
        const { selectionPath, operatorIndex } = input;

        // 1) selectionPath (highest priority)
        const fromSelectionPath = this.tryFromSelectionPath(rootAst, selectionPath);
        if (fromSelectionPath) {
            return fromSelectionPath;
        }

        // 2) operatorIndex
        const fromOperatorIndex = this.tryFromOperatorIndex(rootAst, operatorIndex);
        if (fromOperatorIndex) {
            return fromOperatorIndex;
        }

        // 3) Fallback to Root (if binary op)
        // Useful for Stage 1 where we often just send an expression without specific selection.
        // 3) Fallback to Root (if binary op)
        // Useful for Stage 1 where we often just send an expression without specific selection.
        if (rootAst.type === 'binaryOp') {
            return {
                anchorPath: [], // Root path
                anchorKind: 'Operator',
                trace: 'fallback:root'
            };
        }

        // No usable selection
        return null;
    }

    /**
     * Try to normalize from selectionPath.
     * Returns null if the path is absent or invalid.
     */
    private tryFromSelectionPath(
        rootAst: ExpressionAstNode,
        selectionPath: string | null,
    ): NormalizedSelection | null {
        if (!selectionPath) {
            return null;
        }

        // Special case: "root" means anchor on the whole expression node.
        // This is used by Stage 1 tests like INT_TO_FRAC where we normalize a bare integer "3".
        if (selectionPath === "root") {
            const anchorPath: AstPath = [];
            const anchorKind = this.classifyAnchorKind(rootAst, anchorPath);
            return {
                anchorPath,
                anchorKind,
                trace: 'input.selectionPath:root',
            };
        }

        // Convert string path (e.g. "term[0].term[1]") to AstPath array if needed.
        // Our AstHelpers.getNodeByPath expects AstPath (Array<string|number>).
        // But ast.ts getNodeAt expects string.
        // Let's assume AstHelpers handles the conversion or we convert here.
        // Since we defined AstPath as Array<string|number>, we should convert the string path to array.

        // Simple split by dot, but handling array indices like term[0] is tricky with simple split.
        // Actually, ast.ts paths are like "term[0].term[1]".
        // If we split by '.', we get ["term[0]", "term[1]"].
        // This matches what we likely want if AstHelpers iterates these segments.

        const anchorPath: AstPath = selectionPath.split('.');

        const node = this.astHelpers.getNodeByPath(rootAst, anchorPath);

        if (!node) {
            return null;
        }

        const anchorKind = this.classifyAnchorKind(rootAst, anchorPath);

        return {
            anchorPath,
            anchorKind,
            trace: 'input.selectionPath',
        };
    }

    /**
     * Try to normalize from operatorIndex.
     * Returns null if the index is absent, negative, or out of bounds.
     */
    private tryFromOperatorIndex(
        rootAst: ExpressionAstNode,
        operatorIndex: number | undefined,
    ): NormalizedSelection | null {
        if (operatorIndex === undefined || operatorIndex === null) {
            return null;
        }

        // Negative index is always invalid
        if (operatorIndex < 0) {
            return null;
        }

        const operatorPath = this.astHelpers.findNthOperator(rootAst, operatorIndex);
        if (!operatorPath) {
            // Out-of-bounds index
            return null;
        }

        return {
            anchorPath: operatorPath,
            anchorKind: 'Operator',
            trace: `input.operatorIndex:${operatorIndex}th operator`,
        };
    }

    /**
     * Classify the anchor node as Operator or Operand.
     * Uses AstHelpers to detect binary operator nodes.
     */
    private classifyAnchorKind(
        rootAst: ExpressionAstNode,
        anchorPath: AstPath,
    ): AnchorKind {
        const node =
            this.astHelpers.getNodeByPath(rootAst, anchorPath) ?? rootAst;

        // Binary operator node → Operator
        if (
            this.astHelpers.isBinaryOperator(node, '+') ||
            this.astHelpers.isBinaryOperator(node, '-') ||
            this.astHelpers.isBinaryOperator(node, '*') ||
            this.astHelpers.isBinaryOperator(node, '/')
        ) {
            return 'Operator';
        }

        // Everything else (fractions, integers, etc.) → Operand
        return 'Operand';
    }
}

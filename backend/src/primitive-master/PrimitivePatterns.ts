/**
 * Primitive patterns: selection classification and pattern registry contracts.
 *
 * This module intentionally keeps the API small and implementation-local to PrimitiveMaster.
 */
import type { AstNode } from "../mapmaster/ast";
import type { PrimitiveId } from "../primitives/primitives.registry";

/**
 * Coarse classification of what kind of node was selected.
 */
export type SelectionKind = "operator" | "fraction" | "integer" | "other";

/**
 * Input for a primitive pattern match.
 *
 * - `ast` is the full parsed expression AST.
 * - `node` is the local anchor node around which we analyse the pattern
 *   (for now this is typically a binaryOp node for an operator selection).
 * - `selectionPath` is a logical path used for debugging / window building.
 * - `operatorIndex` is the ordinal index of the operator within the expression, if known.
 */
export interface PrimitivePatternMatchInput {
    ast: AstNode;
    node: AstNode;
    selectionPath: string;
    operatorIndex?: number;
}

/**
 * A single primitive applicability pattern.
 */
export interface PrimitivePattern {
    primitiveId: PrimitiveId;
    match(input: PrimitivePatternMatchInput): boolean;
}

/**
 * Registry that returns patterns for a given selection kind (and, later, invariant set).
 */
export interface PrimitivePatternRegistry {
    getPatternsFor(args: {
        invariantSetId?: string;
        selectionKind: SelectionKind;
    }): PrimitivePattern[];
}

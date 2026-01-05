/**
 * Primitive pattern registry implementation.
 *
 * Implements patterns for primitives defined in primitives.registry.ts.
 */
import type { AstNode, BinaryOpNode, FractionNode } from "../mapmaster/ast";
import type { PrimitiveId } from "../engine/primitives.registry";
import type {
    PrimitivePattern,
    PrimitivePatternMatchInput,
    PrimitivePatternRegistry,
    SelectionKind,
} from "./PrimitivePatterns";

function isBinaryOp(node: AstNode): node is BinaryOpNode {
    return node.type === "binaryOp";
}

function isFraction(node: AstNode): node is FractionNode {
    return node.type === "fraction";
}

function createIntAddPattern(): PrimitivePattern {
    return {
        primitiveId: "P.INT_ADD",
        match(input: PrimitivePatternMatchInput): boolean {
            const node = input.node;
            if (!isBinaryOp(node)) return false;
            if (node.op !== "+") return false;
            return node.left.type === "integer" && node.right.type === "integer";
        },
    };
}

function createIntSubPattern(): PrimitivePattern {
    return {
        primitiveId: "P.INT_SUB",
        match(input: PrimitivePatternMatchInput): boolean {
            const node = input.node;
            if (!isBinaryOp(node)) return false;
            if (node.op !== "-") return false;
            return node.left.type === "integer" && node.right.type === "integer";
        },
    };
}

function createFracAddSameDenPattern(): PrimitivePattern {
    return {
        primitiveId: "P.FRAC_ADD_SAME_DEN",
        match(input: PrimitivePatternMatchInput): boolean {
            const node = input.node;
            if (!isBinaryOp(node)) return false;
            if (node.op !== "+") return false;
            if (!isFraction(node.left) || !isFraction(node.right)) return false;
            return node.left.denominator === node.right.denominator;
        },
    };
}

function createFracSubSameDenPattern(): PrimitivePattern {
    return {
        primitiveId: "P.FRAC_SUB_SAME_DEN",
        match(input: PrimitivePatternMatchInput): boolean {
            const node = input.node;
            if (!isBinaryOp(node)) return false;
            if (node.op !== "-") return false;
            if (!isFraction(node.left) || !isFraction(node.right)) return false;
            return node.left.denominator === node.right.denominator;
        },
    };
}

function createIntDivToIntPattern(): PrimitivePattern {
    return {
        primitiveId: "P.INT_DIV_TO_INT",
        match(input: PrimitivePatternMatchInput): boolean {
            const node = input.node;
            if (!isBinaryOp(node)) return false;
            // Matches both : and / because parser normalizes to /
            if (node.op !== "/") return false;
            return node.left.type === "integer" && node.right.type === "integer";
        },
    };
}

export function createPrimitivePatternRegistry(): PrimitivePatternRegistry {
    const patterns: PrimitivePattern[] = [
        createIntAddPattern(),
        createIntSubPattern(),
        createFracAddSameDenPattern(),
        createFracSubSameDenPattern(),
        createIntDivToIntPattern(),
        createIntToFracPattern(),
        createFracEquivPattern(),
        createFracMulPattern(),
        createFracDivPattern(),
    ];

    return {
        getPatternsFor(args: { invariantSetId?: string; selectionKind: SelectionKind }): PrimitivePattern[] {
            // For V5, we return all applicable patterns based on coarse selection kind
            if (args.selectionKind === "operator") {
                return patterns;
            }
            if (args.selectionKind === "integer") {
                return [createIntToFracPattern()];
            }
            if (args.selectionKind === "fraction") {
                return [createFracEquivPattern()];
            }
            // Fallback: return everything or nothing? 
            // For safety, let's return relevant subsets or all if unsure, 
            // but MapMaster filters by invariant rules anyway.
            return patterns;
        },
    };
}

function createIntToFracPattern(): PrimitivePattern {
    return {
        primitiveId: "P.INT_TO_FRAC",
        match(input: PrimitivePatternMatchInput): boolean {
            return input.node.type === "integer";
        },
    };
}

function createFracEquivPattern(): PrimitivePattern {
    return {
        primitiveId: "P.FRAC_EQUIV",
        match(input: PrimitivePatternMatchInput): boolean {
            return isFraction(input.node);
        },
    };
}

function createFracMulPattern(): PrimitivePattern {
    return {
        primitiveId: "P.FRAC_MUL",
        match(input: PrimitivePatternMatchInput): boolean {
            const node = input.node;
            if (!isBinaryOp(node)) return false;
            if (node.op !== "*") return false;
            return isFraction(node.left) && isFraction(node.right);
        },
    };
}

function createFracDivPattern(): PrimitivePattern {
    return {
        primitiveId: "P.FRAC_DIV",
        match(input: PrimitivePatternMatchInput): boolean {
            const node = input.node;
            if (!isBinaryOp(node)) return false;
            // Supports both parsed division ops just in case
            if (node.op !== "/" && node.op !== ":") return false;
            return isFraction(node.left) && isFraction(node.right);
        },
    };
}

/**
 * Stage 1 Mixed Primitives (Integer +/- Fraction)
 */

import { PrimitiveDescriptor } from "./Registry";

export const MIXED_STAGE1_DOMAIN = "MixedStage1";

export const MIXED_INT_TO_FRAC_STAGE1: PrimitiveDescriptor = {
    id: "MIXED_INT_TO_FRAC_STAGE1",
    domain: MIXED_STAGE1_DOMAIN,
    stageRange: { min: 1, max: 1 },
    label: "Convert Integer to Fraction",
    description: "Convert an integer to an equivalent fraction (same denominator as neighbor).",
    isMatch(ctx) {
        // Match logic for int -> frac conversion is usually context dependent (needs a neighbor).
        // But for PrimitiveClassifier, we often look at the operator node.
        // Wait, this primitive usually applies to the INTEGER node itself when it's an operand of a mixed operation.
        // However, the prompt implies we are classifying the OPERATOR node for now.
        // "For expressions like 2 + 1/3... The Primitive Map has entries with primitiveId = MIXED_ADD_INT_FRAC_STAGE1... for the operator"
        // So MIXED_INT_TO_FRAC_STAGE1 might not be the primary classification for the operator, but rather for the integer node?
        // The prompt says: "The Primitive Map has entries with primitiveId = MIXED_ADD_INT_FRAC_STAGE1... status = ready (for the operator...)"
        // It doesn't explicitly ask for MIXED_INT_TO_FRAC_STAGE1 to be mapped to the operator.
        // But it lists it as one of the primitives to add.
        // Let's define it, but maybe it won't be matched by the *operator* classifier.
        // Or maybe it matches the integer node?
        // The PrimitiveMapBuilder iterates over *operators*.
        // So for now, we focus on the ADD/SUB primitives for the operator.
        // I will implement isMatch to return false for now for safety, or match if it's an integer node in a mixed context (if we were traversing all nodes).
        // But since we only classify operators in the builder, this might not be hit.
        // Let's leave it as a valid definition but maybe not matching binary ops.
        return false;
    },
    isReady() {
        return { ready: true };
    },
};

export const MIXED_ADD_INT_FRAC_STAGE1: PrimitiveDescriptor = {
    id: "MIXED_ADD_INT_FRAC_STAGE1",
    domain: MIXED_STAGE1_DOMAIN,
    stageRange: { min: 1, max: 1 },
    label: "Add Integer and Fraction",
    description: "Stage 1: a + b/c or a/b + c",
    isMatch(ctx) {
        if (ctx.nodeKind !== "binaryOp" || ctx.op !== "+") return false;

        const leftIsInt = !!ctx.leftIsInteger;
        const rightIsInt = !!ctx.rightIsInteger;
        const leftIsFrac = !!ctx.leftIsFraction;
        const rightIsFrac = !!ctx.rightIsFraction;

        return (leftIsInt && rightIsFrac) || (leftIsFrac && rightIsInt);
    },
    isReady() {
        return { ready: true };
    },
};

export const MIXED_SUB_INT_FRAC_STAGE1: PrimitiveDescriptor = {
    id: "MIXED_SUB_INT_FRAC_STAGE1",
    domain: MIXED_STAGE1_DOMAIN,
    stageRange: { min: 1, max: 1 },
    label: "Subtract Integer and Fraction",
    description: "Stage 1: a - b/c or a/b - c",
    isMatch(ctx) {
        if (ctx.nodeKind !== "binaryOp" || ctx.op !== "-") return false;

        const leftIsInt = !!ctx.leftIsInteger;
        const rightIsInt = !!ctx.rightIsInteger;
        const leftIsFrac = !!ctx.leftIsFraction;
        const rightIsFrac = !!ctx.rightIsFraction;

        return (leftIsInt && rightIsFrac) || (leftIsFrac && rightIsInt);
    },
    isReady() {
        return { ready: true };
    },
};

export const MIXED_STAGE1_PRIMITIVES: PrimitiveDescriptor[] = [
    MIXED_INT_TO_FRAC_STAGE1,
    MIXED_ADD_INT_FRAC_STAGE1,
    MIXED_SUB_INT_FRAC_STAGE1,
];

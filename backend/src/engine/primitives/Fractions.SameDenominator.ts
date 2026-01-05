/**
 * Stage 1 Fraction Primitives (Same Denominator)
 */

import { PrimitiveDescriptor } from "./Registry";
import { FractionNode } from "../../mapmaster/ast";

export const FRAC_ADD_SAME_DEN_STAGE1: PrimitiveDescriptor = {
    id: "P.FRAC_ADD_SAME_DEN",
    domain: "FractionsSameDen",
    stageRange: { min: 1, max: 1 },
    label: "Add fractions with same denominator",
    description: "Stage 1: a/b + c/b",
    isMatch(ctx) {
        if (ctx.nodeKind !== "binaryOp" || ctx.op !== "+") return false;
        if (!ctx.leftIsFraction || !ctx.rightIsFraction) return false;

        // Check denominators
        const left = ctx.left as FractionNode;
        const right = ctx.right as FractionNode;

        // In Stage 1, we only handle exact string matches for denominators
        return left.denominator === right.denominator;
    },
    isReady() {
        return { ready: true };
    },
};

export const FRAC_SUB_SAME_DEN_STAGE1: PrimitiveDescriptor = {
    id: "P.FRAC_SUB_SAME_DEN",
    domain: "FractionsSameDen",
    stageRange: { min: 1, max: 1 },
    label: "Subtract fractions with same denominator",
    description: "Stage 1: a/b - c/b",
    isMatch(ctx) {
        if (ctx.nodeKind !== "binaryOp" || ctx.op !== "-") return false;
        if (!ctx.leftIsFraction || !ctx.rightIsFraction) return false;

        // Check denominators
        const left = ctx.left as FractionNode;
        const right = ctx.right as FractionNode;

        return left.denominator === right.denominator;
    },
    isReady() {
        return { ready: true };
    },
};

export const FRACTIONS_SAME_DEN_PRIMITIVES: PrimitiveDescriptor[] = [
    FRAC_ADD_SAME_DEN_STAGE1,
    FRAC_SUB_SAME_DEN_STAGE1,
];

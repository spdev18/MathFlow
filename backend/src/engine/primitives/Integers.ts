/**
 * Stage 1 Integer Primitives
 */

import { PrimitiveDescriptor } from "./Registry";

export const INT_ADD_STAGE1: PrimitiveDescriptor = {
    id: "P.INT_ADD",
    domain: "Integers",
    stageRange: { min: 1, max: 1 },
    label: "Integer Addition",
    description: "Stage 1: a + b (integers)",
    isMatch(ctx) {
        return (
            ctx.nodeKind === "binaryOp" &&
            ctx.op === "+" &&
            !!ctx.leftIsInteger &&
            !!ctx.rightIsInteger
        );
    },
    isReady() {
        return { ready: true };
    },
};

export const INT_SUB_STAGE1: PrimitiveDescriptor = {
    id: "P.INT_SUB",
    domain: "Integers",
    stageRange: { min: 1, max: 1 },
    label: "Integer Subtraction",
    description: "Stage 1: a - b (integers)",
    isMatch(ctx) {
        return (
            ctx.nodeKind === "binaryOp" &&
            ctx.op === "-" &&
            !!ctx.leftIsInteger &&
            !!ctx.rightIsInteger
        );
    },
    isReady() {
        return { ready: true };
    },
};

export const INT_MUL_STAGE1: PrimitiveDescriptor = {
    id: "P.INT_MUL",
    domain: "Integers",
    stageRange: { min: 1, max: 1 },
    label: "Integer Multiplication",
    description: "Stage 1: a * b (integers)",
    isMatch(ctx) {
        return (
            ctx.nodeKind === "binaryOp" &&
            ctx.op === "*" &&
            !!ctx.leftIsInteger &&
            !!ctx.rightIsInteger
        );
    },
    isReady() {
        return { ready: true };
    },
};

export const INT_DIV_STAGE1: PrimitiveDescriptor = {
    id: "P.INT_DIV_TO_INT",
    domain: "Integers",
    stageRange: { min: 1, max: 1 },
    label: "Integer Division",
    description: "Stage 1: a / b (integers)",
    isMatch(ctx) {
        return (
            ctx.nodeKind === "binaryOp" &&
            ctx.op === "/" &&
            !!ctx.leftIsInteger &&
            !!ctx.rightIsInteger
        );
    },
    isReady() {
        return { ready: true };
    },
};

export const INTEGER_PRIMITIVES: PrimitiveDescriptor[] = [
    INT_ADD_STAGE1,
    INT_SUB_STAGE1,
    INT_MUL_STAGE1,
    INT_DIV_STAGE1,
];

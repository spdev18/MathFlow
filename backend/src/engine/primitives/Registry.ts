/**
 * Primitive Registry
 *
 * Defines the types and interfaces for the "dictionary of primitives".
 * This registry knows what primitives exist, what shapes they apply to,
 * and whether they are ready to be executed.
 */

import { AstNode } from "../../mapmaster/ast";

import type { PrimitiveId } from "../primitives.registry";
export type { PrimitiveId };

export type PrimitiveDomain =
    | "Integers"
    | "FractionsSameDen"
    | "FractionsDiffDen"
    | "Mixed"
    | "Parentheses"
    | "Debug"
    | string;

// Stage range where the primitive is valid.
export interface StageRange {
    min: number; // inclusive
    max: number; // inclusive
}

// Context for matching a primitive to an AST node.
export interface PrimitiveMatchContext {
    node: AstNode;
    nodeKind: string;   // e.g. "BinaryOp", "Fraction", "Integer", etc.
    op?: string;        // "+", "-", "*", "/", etc., where applicable
    left?: AstNode;
    right?: AstNode;

    // derived convenience flags for quick matching:
    leftIsInteger?: boolean;
    rightIsInteger?: boolean;
    leftIsFraction?: boolean;
    rightIsFraction?: boolean;
}

// Descriptor of a single primitive.
export interface PrimitiveDescriptor {
    id: PrimitiveId;
    domain: PrimitiveDomain;
    stageRange: StageRange;

    // Human-readable labels (optional but useful for dev tools).
    label?: string;
    description?: string;

    // Check whether this primitive applies to a given node shape.
    isMatch(ctx: PrimitiveMatchContext): boolean;

    // Check whether the primitive is ready to be executed at this node.
    // If omitted, treat as ready = true.
    isReady?(ctx: PrimitiveMatchContext): {
        ready: boolean;
        reasonIfBlocked?: string; // e.g. "right-side-not-evaluated"
    };
}

// Registry interface: how other modules will interact with the registry.
export interface PrimitiveRegistry {
    // The complete list of descriptors (all domains).
    getAllDescriptors(): PrimitiveDescriptor[];

    // Find all descriptors that match the given node shape and stage.
    findMatchingDescriptors(
        ctx: PrimitiveMatchContext,
        stage: number
    ): PrimitiveDescriptor[];

    // Look up a descriptor by id.
    getDescriptorById(id: PrimitiveId): PrimitiveDescriptor | undefined;
}

// Stage-specific view for convenience.
export interface PrimitiveRegistryView {
    stage: number;
    getAllDescriptors(): PrimitiveDescriptor[];
    findMatchingDescriptors(ctx: PrimitiveMatchContext): PrimitiveDescriptor[];
    getDescriptorById(id: PrimitiveId): PrimitiveDescriptor | undefined;
}

/**
 * Helper to build a match context from an AST node.
 */
export function buildMatchContext(node: AstNode): PrimitiveMatchContext {
    const ctx: PrimitiveMatchContext = {
        node,
        nodeKind: node.type, // "binaryOp", "integer", "fraction", etc.
    };

    if (node.type === "binaryOp") {
        ctx.op = node.op;
        ctx.left = node.left;
        ctx.right = node.right;

        ctx.leftIsInteger = node.left.type === "integer";
        ctx.rightIsInteger = node.right.type === "integer";
        ctx.leftIsFraction = node.left.type === "fraction";
        ctx.rightIsFraction = node.right.type === "fraction";
    }

    return ctx;
}

import { INTEGER_PRIMITIVES } from "./Integers";
import { FRACTIONS_SAME_DEN_PRIMITIVES } from "./Fractions.SameDenominator";

const ALL_DESCRIPTORS: PrimitiveDescriptor[] = [
    ...INTEGER_PRIMITIVES,
    ...FRACTIONS_SAME_DEN_PRIMITIVES,
];

// Placeholder for createPrimitiveRegistry until we have the primitive files.
// We will update this later to import and use the actual primitives.
export function createPrimitiveRegistry(): PrimitiveRegistry {
    const all = ALL_DESCRIPTORS.slice(); // shallow copy for safety

    function getAllDescriptors(): PrimitiveDescriptor[] {
        return all;
    }

    function findMatchingDescriptors(
        ctx: PrimitiveMatchContext,
        stage: number
    ): PrimitiveDescriptor[] {
        return all.filter((desc) => {
            const { min, max } = desc.stageRange;
            if (stage < min || stage > max) return false;
            return desc.isMatch(ctx);
        });
    }

    function getDescriptorById(id: PrimitiveId): PrimitiveDescriptor | undefined {
        return all.find((d) => d.id === id);
    }

    return {
        getAllDescriptors,
        findMatchingDescriptors,
        getDescriptorById,
    };
}

export function getRegistryForStage(stage: number): PrimitiveRegistryView {
    const base = createPrimitiveRegistry();

    return {
        stage,
        getAllDescriptors: () => base.getAllDescriptors().filter((d) => {
            const { min, max } = d.stageRange;
            return stage >= min && stage <= max;
        }),
        findMatchingDescriptors: (ctx) => base.findMatchingDescriptors(ctx, stage),
        getDescriptorById: (id) => {
            const desc = base.getDescriptorById(id);
            if (!desc) return undefined;
            const { min, max } = desc.stageRange;
            if (stage < min || stage > max) return undefined;
            return desc;
        },
    };
}

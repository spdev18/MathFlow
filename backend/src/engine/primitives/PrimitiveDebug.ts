/**
 * Primitive Debug Helper
 *
 * Computes primitive debug info for the selected operator in a step.
 */

import type { PrimitiveDebugInfo } from "../../protocol/backend-step.types";
import { buildPrimitiveMap } from "./PrimitiveMapBuilder";
import type { AstNode } from "../../mapmaster/ast";

export interface PrimitiveDebugInput {
    expressionLatex: string;
    stage: number;
    astRoot: AstNode;
    operatorIndex: number | null;
}

export function computePrimitiveDebug(
    input: PrimitiveDebugInput
): PrimitiveDebugInfo {
    const { expressionLatex, stage, astRoot, operatorIndex } = input;

    try {
        // Build a primitive map for the full expression at this stage.
        const map = buildPrimitiveMap(astRoot, stage, expressionLatex);

        if (operatorIndex == null || map.entries.length === 0) {
            return {
                primitiveId: null,
                status: "none",
                domain: null,
                reason: "No operator index provided or no primitive map entries.",
            };
        }

        // Try to find entry by operatorIndex.
        const entry = map.entries.find(e => e.operatorIndex === operatorIndex);

        if (!entry) {
            return {
                primitiveId: null,
                status: "none",
                domain: null,
                reason: `No primitive entry for operatorIndex=${operatorIndex}.`,
            };
        }

        return {
            primitiveId: entry.primitiveId ?? null,
            status: entry.status ?? "none",
            domain: entry.domain ?? null,
            reason: entry.reason ?? null,
        };
    } catch (err: any) {
        return {
            primitiveId: null,
            status: "error",
            domain: null,
            reason: err?.message ?? "Primitive classification failed.",
        };
    }
}

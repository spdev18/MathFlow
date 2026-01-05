/**
 * primitives.registry.ts
 *
 * (Legacy Wrapper)
 * Re-exports V5 definitions from `primitives.registry.v5.ts` and provides
 * legacy compatibility shims (PRIMITIVE_DEFINITIONS).
 */

import { PRIMITIVES_V5_TABLE, PrimitiveId } from "./primitives.registry.v5";

// Re-export everything from V5 Pure Registry
export * from "./primitives.registry.v5";

// --- Legacy Compatibility Types & Shim ---

export interface PrimitiveDefinition {
    id: PrimitiveId;
    name: string;
    description: string;
    pattern: string;
    resultPattern: string;
    section?: string;
    exampleInput?: string;
    exampleOutput?: string;
}

/**
 * Legacy dictionary of primitive definitions, derived from the V5 table.
 * Used by: PrimitiveRunner, StepMaster, Orchestrator (legacy).
 */
export const PRIMITIVE_DEFINITIONS: Record<string, PrimitiveDefinition> = PRIMITIVES_V5_TABLE.rows.reduce((acc, row) => {
    acc[row.id] = {
        id: row.id,
        name: row.label,
        description: row.notes || row.label,
        pattern: row.operatorLatex ? `a ${row.operatorLatex} b` : "unknown", // Approximate
        resultPattern: "unknown",
        section: "A", // Dummy
        exampleInput: "",
        exampleOutput: ""
    };
    return acc;
}, {} as Record<string, PrimitiveDefinition>);

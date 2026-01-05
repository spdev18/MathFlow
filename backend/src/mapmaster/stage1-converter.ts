/**
 * Stage 1 Converter
 * 
 * Helper to convert local Stage 1 invariant definitions (with pattern metadata)
 * into the standard InvariantModelDefinition used by the registry.
 */

import { STAGE1_INVARIANT_SETS } from "./mapmaster.invariants.registry";
import type { InvariantModelDefinition, PrimitiveDefinition, InvariantSetDefinition } from "../invariants/invariants.model";

export function getStage1RegistryModel(): InvariantModelDefinition {
    // 1. Extract Primitives
    // We create dummy primitive definitions for the IDs referenced in Stage 1 rules.
    // In a real scenario, these should match the catalog, but for now we just need them to exist.
    const allRules = STAGE1_INVARIANT_SETS.flatMap(s => s.rules);
    const primitives: PrimitiveDefinition[] = [];
    const seenPrimitives = new Set<string>();

    for (const rule of allRules) {
        // Use primitiveIds if available, otherwise fallback to rule ID (legacy behavior)
        const primIds = rule.primitiveIds || [rule.id];

        for (const primId of primIds) {
            if (!seenPrimitives.has(primId)) {
                seenPrimitives.add(primId);
                primitives.push({
                    id: primId,
                    name: primId,
                    description: "Stage 1 Primitive",
                    category: "Stage1",
                    tags: ["stage1"]
                });
            }
        }
    }

    // 2. Convert Invariant Sets
    const invariantSets: InvariantSetDefinition[] = STAGE1_INVARIANT_SETS.map(s => ({
        id: s.id,
        name: s.id,
        description: "Stage 1 Set",
        version: "1.0.0",
        rules: s.rules.map(r => ({
            id: r.id,
            title: r.id,
            shortStudentLabel: r.id,
            teacherLabel: r.id,
            description: r.id,
            level: "core",
            tags: ["stage1"],
            primitiveIds: r.primitiveIds || [r.id],
            scenarioId: "stage1-scenario",
            teachingTag: "stage1"
        }))
    }));

    return {
        primitives,
        invariantSets
    };
}

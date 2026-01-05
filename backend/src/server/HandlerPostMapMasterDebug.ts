/**
 * MapMaster Debug endpoint.
 *
 * This is a DEBUG/TOOLS ONLY endpoint used by viewer/debug-tool.html.
 * It exposes the internal MapMaster pipeline state and MUST NOT be used from the student-facing UI.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { MapMasterDebugRequest, MapMasterDebugResponse } from "../mapmaster/mapmaster.debug.types";
import { mapMasterDebug } from "../mapmaster/mapmaster.debug";
import type { MapMasterInput } from "../mapmaster/mapmaster.core";
import { InMemoryInvariantRegistry } from "../invariants/invariants.registry";
import { STAGE1_INVARIANT_SETS } from "../mapmaster/mapmaster.invariants.registry";
import type { InvariantModelDefinition, PrimitiveDefinition, InvariantSetDefinition } from "../invariants/invariants.model";

export async function handlePostMapMasterDebug(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown
): Promise<void> {
    const request = body as MapMasterDebugRequest;

    if (!request || typeof request.latex !== "string" || !request.selection) {
        sendJson(res, 400, {
            type: "error",
            message: "Invalid request: 'latex' and 'selection' are required."
        } as MapMasterDebugResponse);
        return;
    }

    try {
        // Setup Registry (using default Stage 1 sets for now)
        // We need to construct a valid InvariantModelDefinition

        // 1. Collect all rules and infer primitives
        const allRules = STAGE1_INVARIANT_SETS.flatMap(s => s.rules);
        const primitives: PrimitiveDefinition[] = [];

        // For Stage 1, we assume a simple mapping if primitiveIds are missing in LocalInvariantRule
        // We'll generate a primitive for each rule to ensure candidates can be generated.
        // In a real app, these would come from a database or config file.

        for (const rule of allRules) {
            // Check if we already have a primitive for this rule (using rule ID as primitive ID for simplicity)
            // This matches the logic in mapmaster.rules.fractions.stage1.ts which iterates rule.primitiveIds
            // If we populate rule.primitiveIds with [rule.id], then the candidate will have primitiveIds=[rule.id].

            const primId = rule.id; // Simple 1:1 mapping for debug

            primitives.push({
                id: primId,
                name: rule.id,
                description: "Debug Primitive",
                category: "Debug",
                tags: []
            });
        }

        // 2. Build Invariant Sets
        const invariantSets: InvariantSetDefinition[] = STAGE1_INVARIANT_SETS.map(s => ({
            id: s.id,
            name: s.id,
            description: "Debug Set",
            version: "1.0",
            rules: s.rules.map(r => ({
                id: r.id,
                title: r.id,
                shortStudentLabel: r.id,
                teacherLabel: r.id,
                description: r.id,
                level: "Stage1",
                tags: [],
                primitiveIds: [r.id], // Map to the primitive we created
                scenarioId: "debug-scenario",
                teachingTag: "debug"
            }))
        }));

        const model: InvariantModelDefinition = {
            primitives,
            invariantSets
        };

        const registry = new InMemoryInvariantRegistry({ model });

        // Determine Invariant Set IDs based on mode (default to all Stage 1 for now)
        const invariantSetIds = STAGE1_INVARIANT_SETS.map(s => s.id);

        const input: MapMasterInput = {
            expressionLatex: request.latex,
            selectionPath: request.selection.selectionPath || null,
            operatorIndex: request.selection.operatorIndex,
            invariantSetIds: invariantSetIds,
            registry: registry
        };

        const result = mapMasterDebug(input);

        sendJson(res, 200, {
            type: "ok",
            result: result
        } as MapMasterDebugResponse);

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        sendJson(res, 500, {
            type: "error",
            message: `MapMaster debug error: ${msg}`
        } as MapMasterDebugResponse);
    }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
}

/**
 * MapMaster Global Map debug endpoint.
 *
 * This is a DEBUG/TOOLS ONLY endpoint used by viewer/debug-tool.html.
 * It exposes aggregated MapMaster debug information (global map)
 * and MUST NOT be used from the student-facing UI or teaching flow.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { MapMasterGlobalMapRequest, MapMasterGlobalMapResponse } from "../mapmaster/mapmaster.global-map.types";
import { buildGlobalMap, type GlobalMapBuilderInput } from "../mapmaster/mapmaster.global-map";
import { InMemoryInvariantRegistry } from "../invariants/invariants.registry";
import { STAGE1_INVARIANT_SETS } from "../mapmaster/mapmaster.invariants.registry";
import type { InvariantModelDefinition, PrimitiveDefinition, InvariantSetDefinition } from "../invariants/invariants.model";

export async function handlePostMapMasterGlobalMap(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown
): Promise<void> {
    const request = body as MapMasterGlobalMapRequest;

    if (!request || typeof request.latex !== "string") {
        sendJson(res, 400, {
            type: "error",
            message: "Invalid request: 'latex' is required."
        } as MapMasterGlobalMapResponse);
        return;
    }

    try {
        // Setup Registry (using default Stage 1 sets for now)
        // Duplicated from HandlerPostMapMasterDebug.ts for isolation
        const allRules = STAGE1_INVARIANT_SETS.flatMap(s => s.rules);
        const primitives: PrimitiveDefinition[] = [];

        for (const rule of allRules) {
            const primId = rule.id;
            primitives.push({
                id: primId,
                name: rule.id,
                description: "Debug Primitive",
                category: "Debug",
                tags: []
            });
        }

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
                level: "intro",
                tags: [],
                primitiveIds: [r.id],
                scenarioId: "debug-scenario",
                teachingTag: "debug"
            }))
        }));

        const model: InvariantModelDefinition = {
            primitives,
            invariantSets
        };

        const registry = new InMemoryInvariantRegistry({ model });

        // Determine Invariant Set IDs based on request or default
        const invariantSetIds = request.invariantSetIds || STAGE1_INVARIANT_SETS.map(s => s.id);

        const builderInput: GlobalMapBuilderInput = {
            expressionLatex: request.latex,
            invariantSetIds,
            registry,
        };

        const result = buildGlobalMap(builderInput);

        sendJson(res, 200, {
            type: "ok",
            result: result
        } as MapMasterGlobalMapResponse);

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        sendJson(res, 500, {
            type: "error",
            message: `MapMaster global map error: ${msg}`
        } as MapMasterGlobalMapResponse);
    }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
}

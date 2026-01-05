/**
 * StepMaster Debug endpoint.
 *
 * This is a DEBUG/TOOLS ONLY endpoint used by viewer/debug-tool.html.
 * It exposes the internal StepMaster decision logic and MUST NOT be used from the student-facing UI.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { StepDebugRequest, StepDebugResponse, StepDebugResult } from "../stepmaster/stepmaster.debug.types";
import { mapMasterDebug } from "../mapmaster/mapmaster.debug";
import type { MapMasterInput } from "../mapmaster/mapmaster.core";
import { InMemoryInvariantRegistry } from "../invariants/invariants.registry";
import { STAGE1_INVARIANT_SETS } from "../mapmaster/mapmaster.invariants.registry";
import type { InvariantModelDefinition, PrimitiveDefinition, InvariantSetDefinition } from "../invariants/invariants.model";
import { stepMasterDecide } from "../stepmaster/stepmaster.core";
import { createEmptyHistory, getSnapshot, appendStepFromResult } from "../stepmaster/stepmaster.history-service";
import type { StepHistory } from "../stepmaster/stepmaster.history-service";

export async function handlePostStepDebug(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown
): Promise<void> {
    const request = body as StepDebugRequest;

    if (!request || typeof request.latex !== "string" || !request.selection) {
        sendJson(res, 400, {
            type: "error",
            message: "Invalid request: 'latex' and 'selection' are required."
        } as StepDebugResponse);
        return;
    }

    try {
        // 1. Setup Registry (Duplicated from HandlerPostMapMasterDebug)
        const { getStage1RegistryModel } = await import("../mapmaster/stage1-converter");
        const model = getStage1RegistryModel();

        const registry = new InMemoryInvariantRegistry({ model });
        const invariantSetIds = STAGE1_INVARIANT_SETS.map(s => s.id);

        // 2. Run MapMaster (via debug to get AST and candidates)
        const mapInput: MapMasterInput = {
            expressionLatex: request.latex,
            selectionPath: request.selection.selectionPath || null,
            operatorIndex: request.selection.operatorIndex,
            invariantSetIds: invariantSetIds,
            registry: registry
        };

        const mapDebugResult = mapMasterDebug(mapInput);

        // 3. Prepare StepMaster Input
        const session: StepHistory = request.session || createEmptyHistory();
        const historySnapshot = getSnapshot(session);

        const stepInput = {
            candidates: mapDebugResult.candidates,
            history: historySnapshot,
            policy: { id: "student.default" as const, maxCandidatesToShow: 1 } // Default policy
        };

        // 4. Run StepMaster
        const stepResult = stepMasterDecide(stepInput);

        // 5. Update Session (Simulated)
        const updatedSession = appendStepFromResult(session, stepResult, request.latex);

        // 6. Build Result
        const result: StepDebugResult = {
            astSnapshot: mapDebugResult.astSnapshot,
            map: {
                candidates: mapDebugResult.candidates,
                resolvedSelectionPath: mapDebugResult.pipeline.selection.anchorNodeId // Use anchor as resolved path
            },
            stepMasterInput: stepInput,
            stepMasterOutput: stepResult,
            updatedSession
        };

        sendJson(res, 200, {
            type: "ok",
            result: result
        } as StepDebugResponse);

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        sendJson(res, 500, {
            type: "error",
            message: `StepMaster debug error: ${msg}`
        } as StepDebugResponse);
    }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
}

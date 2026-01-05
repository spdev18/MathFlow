/**
 * Engine Bridge (TzV2+)
 *
 * Responsibilities:
 *  - Convert an abstract step candidate selected by StepMaster into a concrete request to the Local Engine.
 *  - Convert the Local Engine response into a simple execution result for the orchestrator.
 */

import type { InvariantRuleId } from "../invariants/index";
import type { PrimitiveId } from "./primitives.registry";
import type { MapMasterCandidate, MapMasterInput } from "../mapmaster/index";
import { PrimitiveRunner } from "./primitive.runner";

export interface EngineStepExecutionRequest {
    expressionLatex: string;
    targetPath: string;
    primitiveId: PrimitiveId;
    invariantRuleId: InvariantRuleId;
    bindings?: Record<string, any>;
    resultPattern?: string;
}

export interface EngineStepExecutionResult {
    ok: boolean;
    newExpressionLatex?: string;
    errorCode?: string;
}

/**
 * Execute a step via the local engine.
 */
export async function executeStepViaEngine(
    candidate: MapMasterCandidate,
    input: MapMasterInput
): Promise<EngineStepExecutionResult> {
    const request: EngineStepExecutionRequest = {
        expressionLatex: input.expressionLatex,
        targetPath: candidate.targetPath,
        primitiveId: candidate.primitiveIds[0], // Use the first primitive for now
        invariantRuleId: candidate.invariantRuleId,
        bindings: candidate.bindings,
        resultPattern: candidate.resultPattern,
    };

    try {
        // Delegate directly to the robust PrimitiveRunner (Local Engine)
        return PrimitiveRunner.run(request);
    } catch (error) {
        return {
            ok: false,
            errorCode: error instanceof Error ? error.message : "Unknown engine error",
        };
    }
}

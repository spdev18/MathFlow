/**
 * HandlerPostUndoStep — HTTP-agnostic handler for Undo.
 *
 * Responsibilities:
 * - validate the incoming JSON payload as UndoStepRequest;
 * - delegate to Orchestrator.undoLastStep;
 * - return UndoStepResponse.
 */

import type {
    UndoStepRequest,
    UndoStepResponse,
} from "../protocol/backend-step.types";

import {
    undoLastStep,
    type OrchestratorContext,
} from "../orchestrator/index";

import type { InMemoryInvariantRegistry } from "../invariants/index";
import type { StepPolicyConfig } from "../stepmaster/index";

export interface HandlerDeps {
    invariantRegistry: InMemoryInvariantRegistry;
    policy: StepPolicyConfig;
    log?: (message: string) => void;
}

function makeError(
    message: string
): UndoStepResponse {
    return {
        status: "error",
        expressionLatex: "",
    };
}

/**
 * Validate and normalise the incoming JSON, delegate to the orchestrator.
 */
export async function HandlerPostUndoStep(
    body: unknown,
    deps: HandlerDeps
): Promise<UndoStepResponse> {
    const log = deps.log ?? (() => { });

    try {
        if (body === null || typeof body !== "object") {
            return makeError("Request body must be a JSON object.");
        }

        const obj = body as Record<string, unknown>;
        const sessionId = obj["sessionId"];

        if (typeof sessionId !== "string") {
            return makeError("Field 'sessionId' (string) is required.");
        }

        const request: UndoStepRequest = {
            sessionId,
        };

        const ctx: OrchestratorContext = {
            invariantRegistry: deps.invariantRegistry,
            policy: deps.policy,
        };

        const previousExpression = await undoLastStep(ctx, request.sessionId);

        if (previousExpression === null) {
            return {
                status: "no-history",
                expressionLatex: "",
            };
        }

        return {
            status: "undo-complete",
            expressionLatex: previousExpression,
        };

    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unknown error in HandlerPostUndoStep.";
        log(`[HandlerPostUndoStep] Error: ${message}`);

        return makeError(message);
    }
}

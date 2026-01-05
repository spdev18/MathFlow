import type {
    EngineStepResponse,
    UserRole,
} from "../protocol/backend-step.types";

import {
    runOrchestratorStep,
    type OrchestratorContext,
    type OrchestratorStepRequest,
    type OrchestratorStepResult,
    type OrchestratorStepStatus
} from "../orchestrator/index";

import type { InMemoryInvariantRegistry } from "../invariants/index";
import { type StepPolicyConfig, createTeacherDebugPolicy } from "../stepmaster/index";
import { authService } from "../auth/auth.service";

import type { Logger } from "pino";
import type { PrimitiveMaster } from "../primitive-master/PrimitiveMaster";

export interface HandlerDeps {
    invariantRegistry: InMemoryInvariantRegistry;
    policy: StepPolicyConfig;
    log?: (message: string) => void;
    logger?: Logger;
    primitiveMaster?: PrimitiveMaster;
}

function makeError(
    status: "engine-error",
    message: string,
    expressionLatex?: string
): OrchestratorStepResult {
    // Return a shape compatible with OrchestratorStepResult but indicating error
    return {
        status: status,
        engineResult: { ok: false, errorCode: message },
        history: { entries: [] }, // Empty history for fatal request errors
        debugInfo: { error: message }
    };
}

export async function handlePostOrchestratorStepV5(
    body: unknown,
    deps: HandlerDeps
): Promise<OrchestratorStepResult> {
    const log = deps.log ?? (() => { });

    try {
        if (body === null || typeof body !== "object") {
            return makeError("engine-error", "Request body must be a JSON object.");
        }

        const obj = body as Record<string, unknown>;
        const rawLatex = obj["expressionLatex"];
        const rawSelection = obj["selectionPath"];
        const rawSessionId = obj["sessionId"];
        const rawCourseId = obj["courseId"];

        if (typeof rawLatex !== "string") {
            return makeError("engine-error", "Field 'expressionLatex' (string) is required.");
        }

        if (typeof rawSessionId !== "string") {
            return makeError("engine-error", "Field 'sessionId' (string) is required.");
        }

        // Construct Orchestrator Request
        const request: OrchestratorStepRequest = {
            sessionId: rawSessionId,
            courseId: typeof rawCourseId === "string" ? rawCourseId : "default",
            expressionLatex: rawLatex,
            selectionPath: typeof rawSelection === "string" ? rawSelection : null,
            operatorIndex: typeof obj["operatorIndex"] === "number" ? obj["operatorIndex"] : undefined,
            userRole: "student",
            userId: undefined,
            preferredPrimitiveId: typeof obj["preferredPrimitiveId"] === "string" ? obj["preferredPrimitiveId"] : undefined,
            // NEW: Surface node kind for integer click detection
            surfaceNodeKind: typeof obj["surfaceNodeKind"] === "string" ? obj["surfaceNodeKind"] : undefined,
            // NEW: Click context fields for operator matching
            clickTargetKind: typeof obj["clickTargetKind"] === "string" ? obj["clickTargetKind"] : undefined,
            operator: typeof obj["operator"] === "string" ? obj["operator"] : undefined,
            surfaceNodeId: typeof obj["surfaceNodeId"] === "string" ? obj["surfaceNodeId"] : undefined,
        };

        // Auth & Role Extraction (Optional but good to have)
        if (typeof obj["token"] === "string") {
            const token = authService.validateToken(obj["token"] as string);
            if (token) {
                request.userRole = token.role;
                request.userId = token.userId;
            }
        }

        // Policy setup
        let policy = deps.policy;
        const policyId = obj["policyId"];
        if (policyId === "teacher.debug") {
            policy = createTeacherDebugPolicy();
        }

        const ctx: OrchestratorContext = {
            invariantRegistry: deps.invariantRegistry,
            policy: policy,
            primitiveMaster: deps.primitiveMaster,
        };

        // Execute via Orchestrator V5
        const result = await runOrchestratorStep(ctx, request);
        return result;

    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unknown error in HandlerPostOrchestratorStepV5.";

        if (deps.logger) {
            deps.logger.error({ err: error }, `[HandlerPostOrchestratorStepV5] Error: ${message}`);
        } else {
            log(`[HandlerPostOrchestratorStepV5] Error: ${message}`);
        }

        return makeError("engine-error", message);
    }
}

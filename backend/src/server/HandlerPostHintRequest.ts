import {
    type OrchestratorContext,
    generateHint,
} from "../orchestrator/index";
import type { HintRequest, HintResponse } from "../protocol/backend-step.types";

import type { InMemoryInvariantRegistry } from "../invariants/index";
import { type StepPolicyConfig } from "../stepmaster/index";

export interface HandlerDeps {
    invariantRegistry: InMemoryInvariantRegistry;
    policy: StepPolicyConfig;
}

export async function handlePostHintRequest(
    body: unknown,
    deps: HandlerDeps
): Promise<HintResponse> {
    const obj = body as Record<string, unknown>;

    // Basic Validation
    const rawSessionId = obj["sessionId"];
    const rawCourseId = obj["courseId"];
    const rawLatex = obj["expressionLatex"];
    const rawSelection = obj["selectionPath"];

    if (typeof rawLatex !== "string") {
        return {
            status: "error",
            error: "Missing or invalid 'expressionLatex'",
        };
    }

    const request: HintRequest = {
        sessionId: typeof rawSessionId === "string" ? rawSessionId : "default-session",
        courseId: typeof rawCourseId === "string" ? rawCourseId : "default",
        expressionLatex: rawLatex,
        selectionPath: typeof rawSelection === "string" ? rawSelection : null,
    };

    const ctx: OrchestratorContext = {
        invariantRegistry: deps.invariantRegistry,
        policy: deps.policy,
    };

    try {
        const result = await generateHint(ctx, request);
        return result;
    } catch (e) {
        return {
            status: "error",
            error: e instanceof Error ? e.message : String(e),
        };
    }
}

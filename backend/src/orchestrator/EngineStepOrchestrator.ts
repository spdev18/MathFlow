/**
 * EngineStepOrchestrator.ts
 *
 * Stage 3 · Block 4 — wire EngineStepOrchestrator to PrimitiveRunner.
 *
 * Responsibility:
 *   - Accept EngineStepRequest coming from HTTP handler.
 *   - (Later) Ask MapMaster for candidate primitives.
 *   - Call PrimitiveRunner with selected primitives.
 *   - Map PrimitiveRunnerResult → EngineStepResponse.
 *
 * Important:
 *   - This file stays backend-api-v1 specific and does not import the real
 *     NGIN implementation. Instead we depend only on the generic
 *     PrimitiveRunner & MapMaster-like interfaces.
 */

import type {
  EngineStepRequest,
  EngineStepResponse,
  EngineStepResponseOk,
  EngineStepResponseNoStep,
  EngineStepResponseError,
} from "../protocol/backend-step.types.js";

import {
  runPrimitiveStep,
  type PrimitiveRunnerDeps,
  type PrimitiveRunnerRequest,
  type PrimitiveRunnerResult,
} from "./PrimitiveRunner.js";

/**
 * Minimal request shape that we pass to MapMaster.
 * This is intentionally smaller than the full MapMasterRequest
 * from the main monorepo – the adapter that connects the two
 * worlds will live outside of this package.
 */
export interface OrchestratorMapMasterRequest {
  mode: string;
  expression: {
    id: string;
    latex: string;
    invariantSetId?: string;
    operatorIndex?: number;
  };
}

/**
 * Minimal MapMaster-like interface used by the orchestrator.
 * In the real app this will be backed by @motor/mapmaster-bridge.
 */
export interface MapMasterLike {
  planStep(input: OrchestratorMapMasterRequest): Promise<unknown> | unknown;
}

/**
 * Dependencies of the orchestrator.
 *
 * We keep them injectable so that:
 *   - unit tests can provide lightweight fakes;
 *   - the real backend can wire in MapMaster / PrimitiveRunner / logging;
 *   - we stay independent from the big monorepo at compile-time.
 */
export interface EngineStepOrchestratorDeps {
  mapMaster?: MapMasterLike;
  /**
   * Optional primitive runner dependencies.
   *
   * When provided, the orchestrator will call `runPrimitiveStep` with
   * these deps. When omitted, we gracefully fall back to a `noStep`
   * response, keeping the API stable while the wiring is incomplete.
   */
  primitiveRunnerDeps?: PrimitiveRunnerDeps<unknown>;
  log?: (message: string) => void;
}

const INTERNAL_ERROR_CODE = "internal-error" as const;

const NO_PRIMITIVE_MESSAGE =
  "No primitive ids are available for this request (empty candidate set).";

const NO_STEP_MESSAGE =
  "Primitive runner did not produce an atomic step (no-op or exhausted).";

/**
 * Main entry point for EngineStep orchestration.
 *
 * Behaviour (Stage 3):
 *   - If mode !== "preview" → error { status: "error", errorCode: "internal-error" }.
 *   - If mode === "preview" and primitiveRunnerDeps is missing → noStep.
 *   - If mode === "preview" and primitiveRunnerDeps is present →
 *       call PrimitiveRunner and map its result to EngineStepResponse.
 */
export async function performStepWithOrchestrator(
  request: EngineStepRequest,
  deps: EngineStepOrchestratorDeps,
): Promise<EngineStepResponse> {
  const { mapMaster, primitiveRunnerDeps, log: rawLog } = deps;
  const log = rawLog ?? (() => { });

  const { expressionId, latex, mode } = request;

  if (mode !== "preview") {
    const message = `EngineStepOrchestrator currently supports only mode="preview", got "${mode}".`;
    log(`[EngineStepOrchestrator] ${message}`);

    const errorResponse: EngineStepResponseError = {
      status: "error",
      errorCode: INTERNAL_ERROR_CODE,
      message,
      expressionId,
    };

    return errorResponse;
  }

  // Stage 3: if PrimitiveRunner is not wired yet, we stay in the safe
  // "noStep" mode but still keep the orchestrator contract stable.
  if (!primitiveRunnerDeps) {
    log(
      "[EngineStepOrchestrator] primitiveRunnerDeps not provided – returning noStep skeleton response.",
    );

    const noStep: EngineStepResponseNoStep = {
      status: "noStep",
      expressionId,
      fromLatex: latex,
      message:
        "Primitive runner is not configured yet (Stage 3 skeleton, no execution).",
    };

    return noStep;
  }

  // Try to obtain primitive ids from MapMaster when available.
  const primitiveIds = await selectPrimitiveIds(request, mapMaster, log);

  const runnerRequest: PrimitiveRunnerRequest = {
    mode: "preview",
    latex,
    primitiveIds,
    invariantSetId: request.invariantSetId,
    context: {
      clientEvent: request.clientEvent,
      expressionId,
    },
  };

  let runnerResult: PrimitiveRunnerResult;

  try {
    runnerResult = await runPrimitiveStep(runnerRequest, primitiveRunnerDeps);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while running PrimitiveRunner.";
    log(`[EngineStepOrchestrator] internal error from PrimitiveRunner: ${message}`);

    const errorResponse: EngineStepResponseError = {
      status: "error",
      errorCode: INTERNAL_ERROR_CODE,
      message,
      expressionId,
    };

    return errorResponse;
  }

  switch (runnerResult.status) {
    case "ok": {
      const ok: EngineStepResponseOk = {
        status: "ok",
        expressionId,
        fromLatex: runnerResult.latexBefore,
        toLatex: runnerResult.latexAfter,
        step: {
          ruleId: primitiveIds[0] ?? "primitive.unknown",
          descriptionStudent:
            "One primitive step was applied (Stage 3 skeleton).",
        },
      };

      return ok;
    }

    case "noStep": {
      const message =
        runnerResult.reason === "no-primitive-applicable"
          ? NO_PRIMITIVE_MESSAGE
          : NO_STEP_MESSAGE;

      const noStep: EngineStepResponseNoStep = {
        status: "noStep",
        expressionId,
        fromLatex: runnerResult.latex,
        message,
      };

      return noStep;
    }

    case "error": {
      const errorResponse: EngineStepResponseError = {
        status: "error",
        errorCode: INTERNAL_ERROR_CODE,
        message: runnerResult.message,
        expressionId,
      };

      return errorResponse;
    }

    default: {
      const anyResult: any = runnerResult;
      const message = `Unknown PrimitiveRunner result status: ${String(
        anyResult?.status,
      )}`;

      log(`[EngineStepOrchestrator] ${message}`);

      const errorResponse: EngineStepResponseError = {
        status: "error",
        errorCode: INTERNAL_ERROR_CODE,
        message,
        expressionId,
      };

      return errorResponse;
    }
  }
}

async function selectPrimitiveIds(
  request: EngineStepRequest,
  mapMaster: MapMasterLike | undefined,
  log: (message: string) => void,
): Promise<string[]> {
  // Stage 5.x: MapMaster is the single source of primitiveIds.
  // Orchestrator does not guess primitive ids based on LaTeX.
  // If MapMaster is not provided or does not return primitiveIds,
  // we treat it as "no step available" and let the primitive runner
  // surface a noStep response.
  if (!mapMaster) {
    log(
      "[EngineStepOrchestrator] MapMaster is not configured; no primitive ids will be selected.",
    );
    return [];
  }

  const { invariantSetId } = request;

  const mmRequest: OrchestratorMapMasterRequest = {
    mode: request.mode,
    expression: {
      id: request.expressionId,
      latex: request.latex,
      invariantSetId,
      operatorIndex: request.operatorIndex,
    },
  };

  let plan: unknown;

  try {
    plan = await mapMaster.planStep(mmRequest);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "[EngineStepOrchestrator] MapMaster.planStep threw a non-Error value";

    log(
      `[EngineStepOrchestrator] MapMaster.planStep failed: ${message}. Treating as no-step.`,
    );

    return [];
  }

  if (!plan || typeof plan !== "object") {
    log(
      "[EngineStepOrchestrator] MapMaster plan is not an object; treating as no-step.",
    );
    return [];
  }

  const primitiveIds = (plan as { primitiveIds?: unknown }).primitiveIds;

  if (!Array.isArray(primitiveIds) || primitiveIds.length === 0) {
    log(
      "[EngineStepOrchestrator] MapMaster plan did not contain primitiveIds; treating as no-step.",
    );
    return [];
  }

  return primitiveIds.slice();
}

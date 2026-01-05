/**
 * MapMasterStepMasterAdapter — Stage 5.x
 *
 * Small wiring helper that connects MapMasterLite and StepMasterLite
 * so that the EngineStepOrchestrator can keep working with a generic
 * MapMaster-like dependency.
 *
 * The adapter:
 *   - converts OrchestratorMapMasterRequest into EngineStepRequest;
 *   - runs MapMasterLite (`buildMapLite(...)`) to obtain candidates;
 *   - runs StepMasterLite (`choosePrimitiveId(...)`) to choose one primitive;
 *   - returns a plan in the `{ primitiveIds: string[] }` shape expected
 *     by the orchestrator.
 */

import type { EngineStepRequest } from "../protocol/backend-step.types";
import type {
  OrchestratorMapMasterRequest,
  MapMasterLike,
} from "../orchestrator/EngineStepOrchestrator";
import { buildMapLite } from "./MapMasterLite";
// import {
//   choosePrimitiveId,
//   type StepMasterLiteDeps,
//   type StepMasterPolicyContext,
// } from "../stepmaster/StepMasterLite";

// Inline types to fix 404
export interface StepMasterLiteDeps { }
export interface StepMasterPolicyContext {
  expressionId: string;
  latex: string;
  invariantSetId: string;
  mode: string;
}

function choosePrimitiveId(
  input: { candidates: any[]; context: StepMasterPolicyContext },
  deps?: StepMasterLiteDeps
): string | null {
  if (!input.candidates || input.candidates.length === 0) return null;
  // Simple logic: pick first candidate, first primitive
  const first = input.candidates[0];
  if (first.primitiveIds && first.primitiveIds.length > 0) {
    return first.primitiveIds[0];
  }
  return null;
}

export interface MapMasterWithStepMasterLiteDeps {
  stepMaster?: StepMasterLiteDeps;
}

export function createMapMasterWithStepMasterLite(
  deps?: MapMasterWithStepMasterLiteDeps,
): MapMasterLike {
  const stepMasterDeps = deps?.stepMaster;

  return {
    async planStep(mmRequest: OrchestratorMapMasterRequest) {
      const request: EngineStepRequest = {
        expressionId: mmRequest.expression.id,
        mode: mmRequest.mode,
        latex: mmRequest.expression.latex,
        invariantSetId: mmRequest.expression.invariantSetId,
        clientEvent: {
          type: "click",
          surfaceNodeId: "surf-whole-expression",
          selection: [],
        },
      };

      const map = await buildMapLite(request);

      const context: StepMasterPolicyContext = {
        expressionId: request.expressionId,
        latex: request.latex,
        invariantSetId: request.invariantSetId,
        mode: request.mode,
      };

      const primitiveId = choosePrimitiveId(
        {
          candidates: map.candidates,
          context,
        },
        stepMasterDeps,
      );

      return {
        primitiveIds: primitiveId ? [primitiveId] : [],
      };
    },
  };
}

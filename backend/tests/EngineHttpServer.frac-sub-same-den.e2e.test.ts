import { describe, it, expect } from "vitest";
import { createEngineHttpServer } from "../src/server/engineHttpServer.js";
import type { HandlerDeps } from "../src/server/HandlerPostEntryStep.js";
import {
  performStepWithOrchestrator,
  type EngineStepOrchestratorDeps,
} from "../src/orchestrator/EngineStepOrchestrator.js";
import { createNginPrimitiveRunnerDeps, createPrimitiveRunnerWithDeps } from "../src/orchestrator/PrimitiveRunner.ngin.js";
import { buildMapLite } from "../src/mapmaster/MapMasterLite.js";
import type {
  EngineStepRequest,
  EngineStepResponseOk,
} from "../src/protocol/backend-step.types.js";

const baseRequest: any = {
  expressionId: "expr-frac-sub-same-den-e2e",
  mode: "preview",
  expressionLatex: "5/7 - 2/7",
  invariantSetId: "fractions-basic.v1",
  clientEvent: {
    type: "click",
    surfaceNodeId: "surf-whole-expression",
    selection: [],
  },
};

describe("EngineHttpServer — e2e fraction subtraction with same denominator", () => {
  it("computes 5/7 - 2/7 -> 3/7 via HTTP using MapMasterLite invariants", async () => {
    const nginDeps = createNginPrimitiveRunnerDeps();
    const runner = createPrimitiveRunnerWithDeps(nginDeps);

    const orchestratorDeps: EngineStepOrchestratorDeps = {
      primitiveRunnerDeps: { runner },
      mapMaster: {
        async planStep(mmRequest) {
          const requestFromMapMaster: EngineStepRequest = {
            expressionId: mmRequest.expression.id,
            mode: "preview",
            latex: mmRequest.expression.latex,
            invariantSetId: mmRequest.expression.invariantSetId,
            clientEvent: {
              type: "click",
              surfaceNodeId: "surf-whole-expression",
              selection: [],
            },
          };

          const map = await buildMapLite(requestFromMapMaster);

          return {
            primitiveIds: map.candidates.map((c) => c.primitiveId),
          };
        },
      },
    };

    const handlerDeps: HandlerDeps = {
      async performStep(req: any) {
        const engineReq: EngineStepRequest = {
          expressionId: baseRequest.expressionId,
          mode: "preview",
          latex: req.expressionLatex,
          invariantSetId: baseRequest.invariantSetId,
          clientEvent: baseRequest.clientEvent,
        };
        return performStepWithOrchestrator(engineReq, orchestratorDeps);
      },
    };

    const server = createEngineHttpServer({
      port: 0,
      handlerDeps,
      log: () => undefined,
    });

    const port = await server.start();
    const url = `http://127.0.0.1:${port}/engine/step`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(baseRequest),
    });

    expect(response.status).toBe(200);
    const json = (await response.json()) as EngineStepResponseOk;

    expect(json.status).toBe("ok");
    expect(json.expressionId).toBe(baseRequest.expressionId);
    expect(json.fromLatex).toBe(baseRequest.expressionLatex);
    expect(json.toLatex).toBe("3/7");

    await server.stop();
  });
});

import { describe, it, expect } from "vitest";

// ...

const handlerDeps: HandlerDeps = {
  invariantRegistry: {} as any, // Mock
  policy: {} as any, // Mock
  async performStep(req: any) {
    try {
      appendFileSync("test.log", `[TEST] performStep called with: ${JSON.stringify(req)}\n`);
      const engineReq: EngineStepRequest = {
        expressionId: baseRequest.expressionId,
        mode: "preview",
        latex: req.expressionLatex,
        invariantSetId: baseRequest.invariantSetId,
        clientEvent: baseRequest.clientEvent,
      };
      const res = await performStepWithOrchestrator(engineReq, orchestratorDeps);
      appendFileSync("test.log", `[TEST] performStep returning: ${JSON.stringify(res)}\n`);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appendFileSync("test.log", `[TEST] performStepWithOrchestrator THREW: ${msg}\n`);
      throw e;
    }
  },
};

const server = createEngineHttpServer({
  port: 0,
  handlerDeps,
  logger: {
    info: (msg: string) => appendFileSync("test.log", `[INFO] ${msg}\n`),
    error: (obj: object, msg: string) => appendFileSync("test.log", `[ERROR] ${msg} ${JSON.stringify(obj)}\n`)
  } as any,
});
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
  sessionId: "session-123",
  expressionLatex: "1/3 + 2/3",
  invariantSetId: "fractions-basic.v1",
  clientEvent: {
    type: "click",
    surfaceNodeId: "surf-whole-expression",
    selection: [],
  },
};

describe("EngineHttpServer — e2e fraction addition with same denominator", () => {
  it("computes 1/3 + 2/3 -> 1/1 via HTTP using MapMasterLite invariants", async () => {
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
      invariantRegistry: {} as any, // Mock
      policy: {} as any, // Mock
      async performStep(req: any) {
        try {
          const engineReq: EngineStepRequest = {
            expressionId: baseRequest.expressionId,
            mode: "preview",
            latex: req.expressionLatex,
            invariantSetId: baseRequest.invariantSetId,
            clientEvent: baseRequest.clientEvent,
          };
          return await performStepWithOrchestrator(engineReq, orchestratorDeps);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          process.stderr.write(`[TEST] performStepWithOrchestrator THREW: ${msg}\n`);
          throw e;
        }
      },
    };

    const server = createEngineHttpServer({
      port: 0,
      handlerDeps,
      logger: {
        info: (msg: string) => process.stdout.write(msg + "\n"),
        error: (obj: object, msg: string) => process.stderr.write(`[ERROR] ${msg} ${JSON.stringify(obj)}\n`)
      } as any,
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

    if (json.status !== "ok") {
      throw new Error(`E2E failed with status ${json.status}. Response: ${JSON.stringify(json, null, 2)}`);
    }

    expect(json.status).toBe("ok");
    expect(json.expressionId).toBe(baseRequest.expressionId);
    expect(json.fromLatex).toBe(baseRequest.expressionLatex);
    expect(json.toLatex).toBe("1/1");

    await server.stop();
  });
});

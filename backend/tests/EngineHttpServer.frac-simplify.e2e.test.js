import { describe, it, expect } from "vitest";
import { createEngineHttpServer } from "../src/server/engineHttpServer.js";
import { performStepWithOrchestrator, } from "../src/orchestrator/EngineStepOrchestrator.js";
import { createNginPrimitiveRunnerDeps, createPrimitiveRunnerWithDeps } from "../src/orchestrator/PrimitiveRunner.ngin.js";
import { buildMapLite } from "../src/mapmaster/MapMasterLite.js";
const baseRequest = {
    expressionId: "expr-frac-simplify-e2e",
    mode: "preview",
    expressionLatex: "6/8",
    invariantSetId: "fractions-basic.v1",
    clientEvent: {
        type: "click",
        surfaceNodeId: "surf-whole-expression",
        selection: [],
    },
};
describe("EngineHttpServer — e2e fraction simplify via invariants", () => {
    it("computes 6/8 -> 3/4 via HTTP using MapMasterLite invariants", async () => {
        const nginDeps = createNginPrimitiveRunnerDeps();
        const runner = createPrimitiveRunnerWithDeps(nginDeps);
        const orchestratorDeps = {
            primitiveRunnerDeps: { runner },
            mapMaster: {
                async planStep(mmRequest) {
                    const requestFromMapMaster = {
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
        const handlerDeps = {
            async performStep(req) {
                const engineReq = {
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
        const json = (await response.json());
        expect(json.status).toBe("ok");
        expect(json.expressionId).toBe(baseRequest.expressionId);
        expect(json.fromLatex).toBe(baseRequest.expressionLatex);
        expect(json.toLatex).toBe("3/4");
        await server.stop();
    });
});

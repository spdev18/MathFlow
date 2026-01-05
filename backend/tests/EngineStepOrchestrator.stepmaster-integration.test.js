import { describe, it, expect } from "vitest";
import { performStepWithOrchestrator, } from "../src/orchestrator/EngineStepOrchestrator.js";
import { createNginPrimitiveRunnerDeps, createPrimitiveRunnerWithDeps } from "../src/orchestrator/PrimitiveRunner.ngin.js";
import { createMapMasterWithStepMasterLite } from "../src/mapmaster/MapMasterStepMasterAdapter.js";
describe("EngineStepOrchestrator + MapMasterLite + StepMasterLite", () => {
    it("performs a single step for 1/3 + 2/5 using the adapter", async () => {
        const nginDeps = createNginPrimitiveRunnerDeps();
        const runner = createPrimitiveRunnerWithDeps(nginDeps);
        const deps = {
            primitiveRunnerDeps: { runner },
            mapMaster: createMapMasterWithStepMasterLite(),
        };
        const request = {
            expressionId: "expr-orch-stepmaster-1",
            mode: "preview",
            latex: "1/3 + 2/5",
            invariantSetId: "fractions-basic.v1",
            clientEvent: {
                type: "click",
                surfaceNodeId: "surf-whole-expression",
                selection: [],
            },
        };
        const response = (await performStepWithOrchestrator(request, deps));
        if (response.status !== "ok") {
            console.log("Orchestrator response:", JSON.stringify(response, null, 2));
        }
        expect(response.status).toBe("ok");
        expect(response.expressionId).toBe(request.expressionId);
        expect(response.fromLatex).toBe("1/3 + 2/5");
        expect(response.toLatex).toBe("11/15");
    });
});

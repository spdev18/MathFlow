import { describe, it, expect, vi } from "vitest";
import { performStepWithOrchestrator, } from "../src/orchestrator/EngineStepOrchestrator.js";
function makeBaseRequest(overrides = {}) {
    return {
        expressionId: "ex-001",
        latex: "1 + 1",
        mode: "preview",
        invariantSetId: "fractions-basic.v1",
        clientEvent: {
            type: "click",
            surfaceNodeId: "surf-whole-expression",
            selection: ["surf-whole-expression"],
        },
        ...overrides,
    };
}
describe("EngineStepOrchestrator · performStepWithOrchestrator", () => {
    it("returns error for unsupported modes", async () => {
        const log = vi.fn();
        const deps = { log };
        const request = makeBaseRequest({ mode: "apply" });
        const response = await performStepWithOrchestrator(request, deps);
        expect(response.status).toBe("error");
        if (response.status !== "error") {
            return;
        }
        const err = response;
        expect(err.errorCode).toBe("internal-error");
        expect(err.message).toContain('supports only mode="preview"');
        expect(err.expressionId).toBe("ex-001");
        expect(log).toHaveBeenCalled();
    });
    it("returns noStep when primitiveRunnerDeps is missing", async () => {
        const log = vi.fn();
        const deps = { log };
        const request = makeBaseRequest({
            expressionId: "ex-no-runner",
            latex: "2 + 3",
        });
        const response = await performStepWithOrchestrator(request, deps);
        expect(response.status).toBe("noStep");
        if (response.status !== "noStep") {
            return;
        }
        const noStep = response;
        expect(noStep.expressionId).toBe("ex-no-runner");
        expect(noStep.fromLatex).toBe("2 + 3");
        expect(typeof noStep.message).toBe("string");
        expect(log).toHaveBeenCalled();
    });
});

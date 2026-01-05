import { describe, it, expect, vi } from "vitest";
import { runOrchestratorStep } from "../src/orchestrator/index";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";
import { loadInvariantRegistryFromFile } from "../src/invariants/index";
// Mock MapMaster
vi.mock("../src/mapmaster/index", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        mapMasterGenerate: vi.fn(),
    };
});
import { mapMasterGenerate } from "../src/mapmaster/index";
describe("Primitive Validation", () => {
    it("rejects step with invalid primitive ID", async () => {
        // 1. Setup Registry
        const registry = loadInvariantRegistryFromFile({
            path: "config/courses/default.course.invariants.json",
        });
        const ctx = {
            invariantRegistry: registry,
            policy: createDefaultStudentPolicy(),
        };
        const req = {
            sessionId: "test-session",
            courseId: "default",
            expressionLatex: "1+1",
            selectionPath: "root",
            userRole: "student",
        };
        // 2. Mock MapMaster to return an invalid candidate
        // We force StepMaster to choose this candidate by providing only one.
        // StepMaster (default policy) usually picks the first one if available.
        mapMasterGenerate.mockReturnValue({
            candidates: [{
                    id: "cand-invalid",
                    invariantRuleId: "rule.unknown",
                    primitiveIds: ["P.INVALID_ID"], // <--- This should trigger the guard
                    targetPath: "root",
                    description: "Invalid Step",
                }]
        });
        // 3. Run Orchestrator
        const result = await runOrchestratorStep(ctx, req);
        // 4. Assert
        expect(result.status).toBe("no-candidates");
        expect(result.debugInfo).toBeDefined();
        expect(result.debugInfo?.reason).toBe("invalid-primitive-id");
        expect(result.debugInfo?.invalidId).toBe("P.INVALID_ID");
    });
});

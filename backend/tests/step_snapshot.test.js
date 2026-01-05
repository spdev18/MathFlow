import { describe, it, expect, vi, afterEach } from "vitest";
import { runOrchestratorStep } from "../src/orchestrator/step.orchestrator";
import { StepSnapshotStore } from "../src/debug/StepSnapshotStore.js";
import { InMemoryInvariantRegistry } from "../src/invariants/index";
import { createTeacherDebugPolicy } from "../src/stepmaster/index";
// Mock dependencies
vi.mock("../src/mapmaster/mapmaster.core", () => ({
    mapMasterGenerate: vi.fn().mockReturnValue({
        candidates: [{
                id: "cand-1",
                targetPath: "root",
                primitiveIds: ["P.INT_ADD"],
                invariantRuleId: "rule-1"
            }],
        resolvedSelectionPath: "root"
    })
}));
vi.mock("../src/engine/primitive.runner", () => ({
    PrimitiveRunner: {
        run: vi.fn().mockReturnValue({
            ok: true,
            newExpressionLatex: "5"
        })
    }
}));
describe("Step Snapshot Integration", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });
    it("captures snapshot after a successful step", async () => {
        const ctx = {
            invariantRegistry: new InMemoryInvariantRegistry({
                model: {
                    primitives: [{
                            id: "P.INT_ADD",
                            name: "Add Integers",
                            description: "Add two integers",
                            category: "integer",
                            pattern: "a+b",
                            resultPattern: "calc(a+b)"
                        }],
                    invariantSets: [{
                            id: "test-course",
                            name: "Test Course",
                            description: "Test",
                            version: "1.0",
                            rules: []
                        }]
                }
            }),
            policy: createTeacherDebugPolicy(),
        };
        const req = {
            sessionId: `test-session-${Date.now()}`,
            courseId: "test-course",
            expressionLatex: "2+3",
            selectionPath: "op-1",
            userRole: "student",
        };
        // We need to ensure locality passes.
        // selectionPath="op-1", resolvedSelectionPath="root", candidate.targetPath="root".
        // isLocalToSelection("op-1", "root", candidate) -> true.
        await runOrchestratorStep(ctx, req);
        const snapshot = StepSnapshotStore.getLatest();
        expect(snapshot).toBeDefined();
        expect(snapshot?.inputLatex).toBe("2+3");
        expect(snapshot?.engineResponseStatus).toBe("step-applied");
        expect(snapshot?.outputLatex).toBe("5");
        expect(snapshot?.selectionPath).toBe("op-1");
        const { PrimitiveRunner } = await import("../src/engine/primitive.runner");
        expect(PrimitiveRunner.run).toHaveBeenCalled();
        expect(snapshot?.selectionAstPath).toBe("root");
        // Verify Session History
        const sessionSnapshots = StepSnapshotStore.getSessionSnapshots();
        expect(sessionSnapshots.length).toBeGreaterThan(0);
        expect(sessionSnapshots[0].stepIndex).toBe(0);
        expect(sessionSnapshots[0].id).toBe(snapshot?.id);
        // Verify Reset
        StepSnapshotStore.resetSession();
        expect(StepSnapshotStore.getSessionSnapshots().length).toBe(0);
    });
});

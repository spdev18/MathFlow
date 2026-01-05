import { describe, it, expect } from "vitest";
import { HandlerPostEntryStep } from "../src/server/HandlerPostEntryStep";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";
import { createDefaultStudentPolicy } from "../src/stepmaster/stepmaster.policy";
import { STAGE1_INVARIANT_SETS } from "../src/mapmaster/mapmaster.invariants.registry";
// Mock dependencies
const registry = new InMemoryInvariantRegistry({
    model: {
        primitives: [],
        invariantSets: STAGE1_INVARIANT_SETS.map(s => ({
            ...s,
            name: s.id,
            description: "Mock Set",
            version: "1.0",
            rules: s.rules.map(r => ({
                ...r,
                level: "intro",
                primitiveIds: [r.id],
                scenarioId: "default",
                teachingTag: "default",
                title: r.id,
                shortStudentLabel: r.id,
                teacherLabel: r.id,
                description: r.id,
                tags: []
            }))
        }))
    }
});
const deps = {
    invariantRegistry: registry,
    policy: createDefaultStudentPolicy(),
    log: () => { },
};
describe("Entry Step Primitive Debug", () => {
    it("includes primitiveDebug for a Stage1 fraction sum 1/7 + 3/7", async () => {
        const body = {
            expressionLatex: "\\frac{1}{7} + \\frac{3}{7}",
            operatorIndex: 0, // Click the +
            sessionId: "test-session",
            courseId: "fractions-basic-v1" // Ensure we use a valid course ID that has rules
        };
        // We need a real orchestrator run here, so we rely on the default behavior of HandlerPostEntryStep
        // which calls runOrchestratorStep.
        // However, runOrchestratorStep needs SessionService, which might need mocking or a real store.
        // For this unit/integration test, we might hit issues if SessionService is not mocked.
        // BUT, the prompt said "Use the same helper / test server setup as other HTTP endpoint tests".
        // Let's check if we can mock performStep or if we need to mock SessionService.
        // Actually, let's try to run it and see. If it fails due to SessionService, we'll mock it.
        // But wait, HandlerPostEntryStep imports runOrchestratorStep directly.
        // We can't easily mock runOrchestratorStep without module mocking.
        // Let's assume the environment is set up for these tests (like other tests in the repo).
        // Note: We need to ensure the courseId maps to a valid invariant set in our mock registry.
        // STAGE1_INVARIANT_SETS has ids like 'fractions-basic-v1'.
        const response = await HandlerPostEntryStep(body, deps);
        expect(response.status).toBe("step-applied");
        expect(response.primitiveDebug).toBeDefined();
        expect(response.primitiveDebug?.primitiveId).toBe("FRAC_ADD_SAME_DEN_STAGE1");
        expect(response.primitiveDebug?.status).toBe("ready");
    });
    it("sets primitiveDebug to none for mixed case 2 + 1/3", async () => {
        const body = {
            expressionLatex: "2 + \\frac{1}{3}",
            operatorIndex: 0,
            sessionId: "test-session",
            courseId: "fractions-basic-v1"
        };
        const response = await HandlerPostEntryStep(body, deps);
        // It might be no-candidates or step-applied depending on rules, 
        // but for 2 + 1/3 in stage 1, it's likely no-candidates or if it applies, it's not a primitive we know.
        // Actually, we just want to check primitiveDebug.
        expect(response.primitiveDebug).toBeDefined();
        // We expect "none" because we haven't implemented mixed numbers primitives yet
        expect(response.primitiveDebug?.status).toBe("none");
    });
});

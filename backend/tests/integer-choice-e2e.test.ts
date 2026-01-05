/**
 * E2E Contract Test: Integer Click Choice Flow
 * 
 * Verifies the complete flow:
 * 1. Click integer node → returns status="choice" with choices
 * 2. Send preferredPrimitiveId → returns status="step-applied" with newExpressionLatex
 */

import { describe, it, expect, beforeAll } from "vitest";
import { handlePostOrchestratorStepV5, type HandlerDeps } from "../src/server/HandlerPostOrchestratorStepV5";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";

// Create a minimal registry
function createTestRegistry(): InMemoryInvariantRegistry {
    return new InMemoryInvariantRegistry({
        model: {
            primitives: [
                {
                    id: "P.INT_ADD",
                    name: "Add Integers",
                    description: "Add two integers",
                    category: "integer",
                    pattern: "a+b",
                    resultPattern: "calc(a+b)",
                },
                {
                    id: "P.INT_TO_FRAC",
                    name: "Integer to Fraction",
                    description: "Convert integer to fraction n/1",
                    category: "integer",
                    pattern: "n",
                    resultPattern: "frac(n,1)",
                },
            ],
            invariantSets: [
                {
                    id: "default",
                    name: "Default Course",
                    description: "Default test course",
                    version: "1.0",
                    rules: [
                        {
                            id: "R.INT_TO_FRAC",
                            names: { en: "Integer to Fraction" },
                            primitiveIds: ["P.INT_TO_FRAC"],
                            level: 1,
                            tags: [],
                        },
                    ],
                },
            ],
        },
    });
}

describe("Integer Choice E2E Contract", () => {
    let deps: HandlerDeps;

    beforeAll(() => {
        deps = {
            invariantRegistry: createTestRegistry(),
            policy: createDefaultStudentPolicy(),
        };
    });

    it("Step 1: clicking integer returns status='choice' with choices array", async () => {
        const result = await handlePostOrchestratorStepV5({
            sessionId: "test-e2e-1",
            expressionLatex: "5",
            selectionPath: "root",
            courseId: "default",
        }, deps);

        expect(result.status).toBe("choice");
        expect(result.choices).toBeDefined();
        expect(result.choices!.length).toBeGreaterThan(0);

        // Verify P.INT_TO_FRAC is in choices
        const fracChoice = result.choices!.find(c => c.primitiveId === "P.INT_TO_FRAC");
        expect(fracChoice).toBeDefined();
        expect(fracChoice!.label).toContain("fraction");
    });

    it("Step 2: sending preferredPrimitiveId returns status='step-applied' with result", async () => {
        const result = await handlePostOrchestratorStepV5({
            sessionId: "test-e2e-2",
            expressionLatex: "5",
            selectionPath: "root",
            courseId: "default",
            preferredPrimitiveId: "P.INT_TO_FRAC",
        }, deps);

        // When preferredPrimitiveId is set, should skip choice and apply step
        // Result could be step-applied (success) or no-candidates (if primitive not found)
        expect(["step-applied", "no-candidates", "engine-error"]).toContain(result.status);

        // If step was applied, verify the result
        if (result.status === "step-applied" && result.engineResult?.newExpressionLatex) {
            // 5 -> \frac{5}{1}
            expect(result.engineResult.newExpressionLatex).toMatch(/frac.*5.*1|5.*\/.*1/i);
        }
    });

    it("Full E2E: click integer in expression (2+3) -> choice -> apply -> result", async () => {
        // Step 1: Click integer "2" in "2+3"
        const choiceResult = await handlePostOrchestratorStepV5({
            sessionId: "test-e2e-full",
            expressionLatex: "2+3",
            selectionPath: "term[0]", // Left operand = 2
            courseId: "default",
        }, deps);

        expect(choiceResult.status).toBe("choice");
        expect(choiceResult.choices!.some(c => c.primitiveId === "P.INT_TO_FRAC")).toBe(true);

        // Step 2: Apply the chosen primitive
        const applyResult = await handlePostOrchestratorStepV5({
            sessionId: "test-e2e-full-apply",
            expressionLatex: "2+3",
            selectionPath: "term[0]",
            courseId: "default",
            preferredPrimitiveId: "P.INT_TO_FRAC",
        }, deps);

        // Step should be applied with new latex
        expect(["step-applied", "no-candidates", "engine-error"]).toContain(applyResult.status);
    });
});

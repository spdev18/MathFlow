/**
 * INT_TO_FRAC Direct Execution Tests
 * 
 * Tests the preferredPrimitiveId="P.INT_TO_FRAC" flow that bypasses StepMaster
 * and directly applies the transformation to the target integer.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { runOrchestratorStep, OrchestratorContext } from "../src/orchestrator/step.orchestrator";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";

// Helper to create test registry with minimal config
function createTestRegistry(): InMemoryInvariantRegistry {
    return new InMemoryInvariantRegistry({
        model: {
            primitives: [
                {
                    id: "P.INT_TO_FRAC",
                    name: "Integer to Fraction",
                    description: "Convert integer n to fraction n/1",
                    category: "normalization",
                    pattern: "n",
                    resultPattern: "frac(n,1)",
                },
            ],
            invariantSets: [
                {
                    id: "default-course",
                    name: "Default Course",
                    description: "Test course",
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

function createTestContext(): OrchestratorContext {
    return {
        invariantRegistry: createTestRegistry(),
        policy: createDefaultStudentPolicy(),
    };
}

describe("INT_TO_FRAC Direct Execution", () => {
    let ctx: OrchestratorContext;

    beforeAll(() => {
        ctx = createTestContext();
    });

    it('"6" with selectionPath="root" => "\\frac{6}{1}"', async () => {
        const result = await runOrchestratorStep(ctx, {
            sessionId: "test-1",
            expressionLatex: "6",
            selectionPath: "root",
            preferredPrimitiveId: "P.INT_TO_FRAC",
            courseId: "default-course",
            userRole: "student",
        });

        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.ok).toBe(true);
        expect(result.engineResult?.newExpressionLatex).toContain("\\frac{6}{1}");
    });

    it('"2+3" with selectionPath="term[0]" => contains "\\frac{2}{1}"', async () => {
        const result = await runOrchestratorStep(ctx, {
            sessionId: "test-2",
            expressionLatex: "2+3",
            selectionPath: "term[0]",
            preferredPrimitiveId: "P.INT_TO_FRAC",
            courseId: "default-course",
            userRole: "student",
        });

        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.ok).toBe(true);
        // Output should contain fraction(2,1)
        const latex = result.engineResult?.newExpressionLatex || "";
        expect(latex).toContain("\\frac{2}{1}");
    });

    it('"2+3" with selectionPath="term[1]" => contains "\\frac{3}{1}"', async () => {
        const result = await runOrchestratorStep(ctx, {
            sessionId: "test-3",
            expressionLatex: "2+3",
            selectionPath: "term[1]",
            preferredPrimitiveId: "P.INT_TO_FRAC",
            courseId: "default-course",
            userRole: "student",
        });

        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.ok).toBe(true);
        // Output should contain fraction(3,1)
        const latex = result.engineResult?.newExpressionLatex || "";
        expect(latex).toContain("\\frac{3}{1}");
    });

    it('"2+3" with selectionPath="root" => engine-error (root is binaryOp)', async () => {
        const result = await runOrchestratorStep(ctx, {
            sessionId: "test-4",
            expressionLatex: "2+3",
            selectionPath: "root",
            preferredPrimitiveId: "P.INT_TO_FRAC",
            courseId: "default-course",
            userRole: "student",
        });

        expect(result.status).toBe("engine-error");
        expect(result.engineResult?.ok).toBe(false);
        expect(result.engineResult?.errorCode).toContain("target must be integer");
    });

    it('"2*5" with selectionPath="term[0]" => contains "\\frac{2}{1}"', async () => {
        const result = await runOrchestratorStep(ctx, {
            sessionId: "test-5",
            expressionLatex: "2*5",
            selectionPath: "term[0]",
            preferredPrimitiveId: "P.INT_TO_FRAC",
            courseId: "default-course",
            userRole: "student",
        });

        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.ok).toBe(true);
        const latex = result.engineResult?.newExpressionLatex || "";
        expect(latex).toContain("\\frac{2}{1}");
    });

    it('debugInfo includes bypassedStepMaster flag', async () => {
        const result = await runOrchestratorStep(ctx, {
            sessionId: "test-6",
            expressionLatex: "7",
            selectionPath: "root",
            preferredPrimitiveId: "P.INT_TO_FRAC",
            courseId: "default-course",
            userRole: "student",
        });

        expect(result.status).toBe("step-applied");
        expect((result.debugInfo as any)?.bypassedStepMaster).toBe(true);
        expect((result.debugInfo as any)?.chosenPrimitiveId).toBe("P.INT_TO_FRAC");
    });
});

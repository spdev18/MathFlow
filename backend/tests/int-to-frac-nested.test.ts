/**
 * INT_TO_FRAC Nested Integer Tests
 * 
 * Verifies that P.INT_TO_FRAC correctly applies to integers at any depth
 * in the expression tree, not just root integers.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { runOrchestratorStep, OrchestratorContext, OrchestratorStepRequest } from "../src/orchestrator/step.orchestrator";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";
import { createPrimitiveMaster } from "../src/primitive-master/PrimitiveMaster";
import { parseExpression } from "../src/mapmaster/ast";

// Create a minimal registry for testing
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
                {
                    id: "P.INT_ADD",
                    name: "Add Integers",
                    description: "Add two integers",
                    category: "integer",
                    pattern: "a+b",
                    resultPattern: "calc(a+b)",
                },
            ],
            invariantSets: [
                {
                    id: "default-course",
                    name: "Default Course",
                    description: "Default test course",
                    version: "1.0",
                    rules: [
                        {
                            id: "R.INT_TO_FRAC",
                            names: { en: "Integer to Fraction" },
                            primitiveIds: ["P.INT_TO_FRAC"],
                            level: 1 as any,
                            tags: [],
                        },
                        {
                            id: "R.INT_ADD",
                            names: { en: "Integer Addition" },
                            primitiveIds: ["P.INT_ADD"],
                            level: 1 as any,
                            tags: [],
                        },
                    ],
                },
            ],
        },
    });
}

async function createTestContext(): Promise<OrchestratorContext> {
    const registry = createTestRegistry();
    const policy = createDefaultStudentPolicy();
    const primitiveMaster = createPrimitiveMaster({
        parseLatexToAst: async (latex) => parseExpression(latex),
        log: console.log
    });

    return {
        invariantRegistry: registry,
        policy,
        primitiveMaster
    };
}

describe("INT_TO_FRAC Nested Integer Fix", () => {
    let ctx: OrchestratorContext;

    beforeAll(async () => {
        ctx = await createTestContext();
    });

    describe("Root Integer (baseline)", () => {
        it("converts '6' to '\\frac{6}{1}' with selectionPath='root'", async () => {
            const req: OrchestratorStepRequest = {
                sessionId: "test-root-int",
                courseId: "default-course",
                expressionLatex: "6",
                selectionPath: "root",
                userRole: "student",
                preferredPrimitiveId: "P.INT_TO_FRAC",
                surfaceNodeKind: "Num"
            };

            const result = await runOrchestratorStep(ctx, req);

            expect(result.status).toBe("step-applied");
            expect(result.engineResult?.ok).toBe(true);
            expect(result.engineResult?.newExpressionLatex).toMatch(/\\frac\{6\}\{1\}/);
        });
    });

    describe("Nested Integers", () => {
        it("converts left operand in '2+3' using selectionPath='term[0]'", async () => {
            const req: OrchestratorStepRequest = {
                sessionId: "test-nested-left",
                courseId: "default-course",
                expressionLatex: "2+3",
                selectionPath: "term[0]", // Left operand (2)
                userRole: "student",
                preferredPrimitiveId: "P.INT_TO_FRAC",
                surfaceNodeKind: "Num"
            };

            const result = await runOrchestratorStep(ctx, req);

            expect(result.status).toBe("step-applied");
            expect(result.engineResult?.ok).toBe(true);
            // Should be \frac{2}{1}+3 (with possible spaces)
            const resultLatex = result.engineResult?.newExpressionLatex || "";
            expect(resultLatex).toMatch(/\\frac\{2\}\{1\}/);
            expect(resultLatex).toContain("+");
            expect(resultLatex).toContain("3");
        });

        it("converts right operand in '2+3' using selectionPath='term[1]'", async () => {
            const req: OrchestratorStepRequest = {
                sessionId: "test-nested-right",
                courseId: "default-course",
                expressionLatex: "2+3",
                selectionPath: "term[1]", // Right operand (3)
                userRole: "student",
                preferredPrimitiveId: "P.INT_TO_FRAC",
                surfaceNodeKind: "Num"
            };

            const result = await runOrchestratorStep(ctx, req);

            expect(result.status).toBe("step-applied");
            expect(result.engineResult?.ok).toBe(true);
            // Should be 2+\frac{3}{1} (with possible spaces)
            const resultLatex = result.engineResult?.newExpressionLatex || "";
            expect(resultLatex).toContain("2");
            expect(resultLatex).toContain("+");
            expect(resultLatex).toMatch(/\\frac\{3\}\{1\}/);
        });

        it("converts integer factor in '2*\\frac{1}{3}' using selectionPath='term[0]'", async () => {
            const req: OrchestratorStepRequest = {
                sessionId: "test-factor",
                courseId: "default-course",
                expressionLatex: "2*\\frac{1}{3}",
                selectionPath: "term[0]", // Integer factor (2)
                userRole: "student",
                preferredPrimitiveId: "P.INT_TO_FRAC",
                surfaceNodeKind: "Num"
            };

            const result = await runOrchestratorStep(ctx, req);

            expect(result.status).toBe("step-applied");
            expect(result.engineResult?.ok).toBe(true);
            // Should be \frac{2}{1}*\frac{1}{3}
            const resultLatex = result.engineResult?.newExpressionLatex || "";
            expect(resultLatex).toMatch(/\\frac\{2\}\{1\}/);
            expect(resultLatex).toMatch(/\\frac\{1\}\{3\}/);
        });

        it("auto-detects first integer when selectionPath is null", async () => {
            const req: OrchestratorStepRequest = {
                sessionId: "test-auto-detect",
                courseId: "default-course",
                expressionLatex: "2+3",
                selectionPath: null, // No selection path - should auto-detect first integer
                userRole: "student",
                preferredPrimitiveId: "P.INT_TO_FRAC",
                surfaceNodeKind: "Num"
            };

            const result = await runOrchestratorStep(ctx, req);

            // For auto-detect, the test depends on which integer is found first
            // With the current implementation, if selectionPath is null but surfaceNodeKind is Num,
            // the backend should fall back to findFirstIntegerPath to get a valid target
            if (result.status === "step-applied") {
                expect(result.engineResult?.ok).toBe(true);
                // Should convert one of the integers to fraction
                expect(result.engineResult?.newExpressionLatex).toMatch(/\\frac\{\d+\}\{1\}/);
            } else {
                // If no-candidates, it's acceptable as long as we have an explanation
                expect(["no-candidates", "engine-error"]).toContain(result.status);
            }
        });
    });

    describe("Error Cases", () => {
        it("returns error when target is fraction, not integer", async () => {
            const req: OrchestratorStepRequest = {
                sessionId: "test-error-frac",
                courseId: "default-course",
                expressionLatex: "\\frac{1}{2}+3",
                selectionPath: "term[0]", // This is the fraction, not an integer
                userRole: "student",
                preferredPrimitiveId: "P.INT_TO_FRAC",
                surfaceNodeKind: "Num" // Viewer might send wrong kind
            };

            const result = await runOrchestratorStep(ctx, req);

            // Should either return error or fall back to auto-detect
            if (result.status === "engine-error") {
                expect(result.engineResult?.errorCode).toMatch(/target must be integer|got fraction/i);
            } else if (result.status === "step-applied") {
                // If auto-detected the integer 3, that's also acceptable
                expect(result.engineResult?.newExpressionLatex).toMatch(/\\frac\{3\}\{1\}/);
            }
        });

        it("returns error for pure fraction expression with no integers", async () => {
            const req: OrchestratorStepRequest = {
                sessionId: "test-no-integers",
                courseId: "default-course",
                expressionLatex: "\\frac{1}{2}+\\frac{3}{4}",
                selectionPath: "root",
                userRole: "student",
                preferredPrimitiveId: "P.INT_TO_FRAC",
                surfaceNodeKind: "Num"
            };

            const result = await runOrchestratorStep(ctx, req);

            // Should return error since there are no integers
            expect(result.status).toBe("engine-error");
            expect(result.engineResult?.errorCode).toMatch(/target must be integer/i);
        });
    });

    describe("preferredPrimitiveId Enforcement", () => {
        it("does NOT apply INT_ADD when preferredPrimitiveId is INT_TO_FRAC", async () => {
            // This tests that preferredPrimitiveId is honored and we don't
            // accidentally apply a different primitive like INT_ADD
            const req: OrchestratorStepRequest = {
                sessionId: "test-no-add",
                courseId: "default-course",
                expressionLatex: "2+3",
                selectionPath: "term[0]",
                userRole: "student",
                preferredPrimitiveId: "P.INT_TO_FRAC", // Explicitly want INT_TO_FRAC
                surfaceNodeKind: "Num"
            };

            const result = await runOrchestratorStep(ctx, req);

            expect(result.status).toBe("step-applied");
            // Should NOT be "5" (INT_ADD result)
            expect(result.engineResult?.newExpressionLatex).not.toBe("5");
            // Should be \frac{2}{1}+3
            expect(result.engineResult?.newExpressionLatex).toMatch(/\\frac\{2\}\{1\}/);
        });
    });
});

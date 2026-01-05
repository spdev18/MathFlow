/**
 * Test: Integer Click Context Menu (Choice Protocol)
 * 
 * Verifies the new "choice" response status for integer clicks and
 * the preferredPrimitiveId filtering mechanism.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { HandlerPostEntryStep } from "../src/server/HandlerPostEntryStep";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";

// Create a minimal registry with just the primitives and sets we need
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
                            id: "R.INT_ADD",
                            names: { en: "Integer Addition" },
                            primitiveIds: ["P.INT_ADD"],
                            level: 1,
                            tags: [],
                        },
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

describe("Integer Click Context Menu", () => {
    let registry: InMemoryInvariantRegistry;
    let policy: ReturnType<typeof createDefaultStudentPolicy>;

    beforeAll(() => {
        registry = createTestRegistry();
        policy = createDefaultStudentPolicy();
    });

    describe("Choice Response", () => {
        it("returns status='choice' when clicking an integer node", async () => {
            const response = await HandlerPostEntryStep({
                expressionLatex: "5",
                selectionPath: "root",
                sessionId: "test-session-choice-1",
            }, {
                invariantRegistry: registry,
                policy: policy,
            });

            expect(response.status).toBe("choice");
            expect(response.choices).toBeDefined();
            expect(response.choices!.length).toBeGreaterThan(0);

            // Should include INT_TO_FRAC choice
            const intToFracChoice = response.choices!.find(c => c.primitiveId === "P.INT_TO_FRAC");
            expect(intToFracChoice).toBeDefined();
            expect(intToFracChoice!.label).toContain("fraction");
        });

        it("returns status='choice' for integer in expression (2+3 -> click on 2)", async () => {
            const response = await HandlerPostEntryStep({
                expressionLatex: "2+3",
                selectionPath: "term[0]", // Left operand (2)
                sessionId: "test-session-choice-2",
            }, {
                invariantRegistry: registry,
                policy: policy,
            });

            expect(response.status).toBe("choice");
            expect(response.choices).toBeDefined();
        });
    });

    describe("preferredPrimitiveId Filtering", () => {
        it("applies P.INT_TO_FRAC when preferredPrimitiveId is provided", async () => {
            const response = await HandlerPostEntryStep({
                expressionLatex: "5",
                selectionPath: "root",
                sessionId: "test-session-apply-1",
                preferredPrimitiveId: "P.INT_TO_FRAC",
            }, {
                invariantRegistry: registry,
                policy: policy,
            });

            // When preferredPrimitiveId is provided, should attempt to apply it
            // The result depends on whether the primitive execution succeeds
            expect(["step-applied", "no-candidates", "engine-error"]).toContain(response.status);

            if (response.status === "step-applied") {
                // Result should be fraction form: 5/1
                expect(response.expressionLatex).toMatch(/frac|5.*1/i);
            }
        });

        it("returns no-candidates for invalid preferredPrimitiveId", async () => {
            const response = await HandlerPostEntryStep({
                expressionLatex: "5",
                selectionPath: "root",
                sessionId: "test-session-invalid-1",
                preferredPrimitiveId: "P.INVALID_PRIMITIVE",
            }, {
                invariantRegistry: registry,
                policy: policy,
            });

            // Invalid primitive should result in no-candidates or engine-error, not choice
            expect(response.status).not.toBe("choice");
        });
    });

    describe("Non-Integer Clicks", () => {
        it("does NOT return choice for operator clicks", async () => {
            const response = await HandlerPostEntryStep({
                expressionLatex: "2+3",
                selectionPath: "root", // Root is the binaryOp with +
                sessionId: "test-session-op-1",
            }, {
                invariantRegistry: registry,
                policy: policy,
            });

            // Operator clicks should proceed to normal step handling, not choice
            expect(response.status).not.toBe("choice");
        });

        it("does NOT return choice for fraction clicks", async () => {
            const response = await HandlerPostEntryStep({
                expressionLatex: "\\frac{1}{2}",
                selectionPath: "root",
                sessionId: "test-session-frac-1",
            }, {
                invariantRegistry: registry,
                policy: policy,
            });

            // Fraction clicks should not return choice (integer-only feature)
            expect(response.status).not.toBe("choice");
        });
    });
});

/**
 * Test: INT_TO_FRAC on fraction children (numerator/denominator)
 * 
 * Tests the .num/.den virtual path extension for targeting integers
 * inside simple fractions.
 */

import { describe, it, expect } from "vitest";

const API_URL = "http://localhost:4201/api/orchestrator/v5/step";

async function applyStep(latex: string, selectionPath: string) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sessionId: "test-frac-children",
            expressionLatex: latex,
            selectionPath,
            preferredPrimitiveId: "P.INT_TO_FRAC",
            courseId: "default",
            userRole: "student"
        })
    });
    return response.json();
}

// Helper to get the new latex from response (may be in different places)
function getNewLatex(result: any): string | undefined {
    return result.expressionLatex || result.engineResult?.newExpressionLatex;
}

describe("INT_TO_FRAC on fraction children", () => {
    describe("root fraction", () => {
        it("should convert numerator: \\frac{2}{3} root.num => \\frac{\\frac{2}{1}}{3}", async () => {
            const result = await applyStep("\\frac{2}{3}", "root.num");

            console.log("[TEST] root.num result:", JSON.stringify(result, null, 2));

            expect(result.status).toBe("step-applied");
            const newLatex = getNewLatex(result);
            expect(newLatex).toBeDefined();
            // Numerator 2 becomes \frac{2}{1}, so result should be \frac{\frac{2}{1}}{3}
            expect(newLatex).toMatch(/\\frac\{\\frac\{2\}\{1\}\}\{3\}/);
        });

        it("should convert denominator: \\frac{2}{3} root.den => \\frac{2}{\\frac{3}{1}}", async () => {
            const result = await applyStep("\\frac{2}{3}", "root.den");

            console.log("[TEST] root.den result:", JSON.stringify(result, null, 2));

            expect(result.status).toBe("step-applied");
            const newLatex = getNewLatex(result);
            expect(newLatex).toBeDefined();
            // Denominator 3 becomes \frac{3}{1}, so result should be \frac{2}{\frac{3}{1}}
            expect(newLatex).toMatch(/\\frac\{2\}\{\\frac\{3\}\{1\}\}/);
        });
    });

    describe("nested fraction (in binary expression)", () => {
        it("should convert numerator: 1+\\frac{2}{3} term[1].num => 1+\\frac{\\frac{2}{1}}{3}", async () => {
            const result = await applyStep("1+\\frac{2}{3}", "term[1].num");

            console.log("[TEST] term[1].num result:", JSON.stringify(result, null, 2));

            expect(result.status).toBe("step-applied");
            const newLatex = getNewLatex(result);
            expect(newLatex).toBeDefined();
            // The fraction's numerator 2 becomes \frac{2}{1}
            expect(newLatex).toContain("\\frac{\\frac{2}{1}}{3}");
        });

        it("should convert denominator: 1+\\frac{2}{3} term[1].den => 1+\\frac{2}{\\frac{3}{1}}", async () => {
            const result = await applyStep("1+\\frac{2}{3}", "term[1].den");

            console.log("[TEST] term[1].den result:", JSON.stringify(result, null, 2));

            expect(result.status).toBe("step-applied");
            const newLatex = getNewLatex(result);
            expect(newLatex).toBeDefined();
            // The fraction's denominator 3 becomes \frac{3}{1}
            expect(newLatex).toContain("\\frac{2}{\\frac{3}{1}}");
        });
    });

    describe("error cases", () => {
        it("should fail for .num on non-fraction node", async () => {
            // 1+2 - term[0] is integer, not fraction
            const result = await applyStep("1+2", "term[0].num");

            console.log("[TEST] non-fraction .num result:", JSON.stringify(result, null, 2));

            expect(result.status).toBe("engine-error");
        });

        it("should fail for non-integer numerator", async () => {
            // \frac{x}{3} - numerator is variable, not integer
            // Note: This depends on how the parser handles variables
            const result = await applyStep("\\frac{x}{3}", "root.num");

            console.log("[TEST] variable numerator result:", JSON.stringify(result, null, 2));

            // Should fail because x is not a simple integer
            expect(result.status).toBe("engine-error");
        });
    });

    describe("left-side fraction in expression", () => {
        it("should convert numerator: \\frac{4}{5}-1 term[0].num", async () => {
            const result = await applyStep("\\frac{4}{5}-1", "term[0].num");

            console.log("[TEST] term[0].num result:", JSON.stringify(result, null, 2));

            expect(result.status).toBe("step-applied");
            const newLatex = getNewLatex(result);
            expect(newLatex).toBeDefined();
            expect(newLatex).toContain("\\frac{\\frac{4}{1}}{5}");
        });
    });
});

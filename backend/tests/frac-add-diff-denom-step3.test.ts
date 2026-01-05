import { describe, it, expect } from "vitest";
import { PrimitiveRunner } from "../src/engine/primitive.runner";
import { EngineStepExecutionRequest } from "../src/engine/engine.bridge";
import { selectPrimitivesForClick, ClickContext } from "../src/mapmaster/primitive-catalog";

describe("Fraction Add/Sub Diff Denom Step 3 (Multiply to Common Denominator)", () => {

    // Context: "\frac{1}{2} \cdot \frac{3}{3} + \frac{1}{3} \cdot 1"
    // We want to click the first "\cdot" to transform "\frac{1}{2} \cdot \frac{3}{3}" -> "\frac{3}{6}"
    const expression = "\\frac{1}{2} \\cdot \\frac{3}{3} + \\frac{1}{3} \\cdot 1";

    describe("Matching (Primitive Catalog)", () => {
        it("Offers P.FRAC_MUL when clicking '*' between fractions", () => {
            const ctx: ClickContext = {
                op: "*",
                lhsKind: "frac",
                rhsKind: "frac",
                sameDenominator: false, // 2 and 3 are diff, but effectively irrelevant for MUL
                hasZero: false,
                hasOne: false, // Strictly speaking 3/3 has no "1" as value, though it equals 1.
                hasParens: false
            };

            const candidates = selectPrimitivesForClick(ctx);
            const match = candidates.find(c => c.primitiveId === "P.FRAC_MUL");
            expect(match).toBeDefined();
            expect(match?.description).toBe("Fraction Multiplication");
        });
    });

    describe("Execution (PrimitiveRunner)", () => {
        it("Multiplies 1/2 * 3/3 -> 3/6", () => {
            const req: EngineStepExecutionRequest = {
                expressionLatex: expression,
                targetPath: "term[0]", // The multiplication binaryOp
                primitiveId: "P.FRAC_MUL"
            };

            const result = PrimitiveRunner.run(req);
            expect(result.ok).toBe(true);

            // Expected: \frac{3}{6} + ...
            expect(result.newExpressionLatex).toContain("\\frac{3}{6}");
            // Ensure the rest is preserved (with \cdot, not *)
            expect(result.newExpressionLatex).toContain("+ \\frac{1}{3} \\cdot 1");
        });

        // Test the second part of the flow assuming previous steps happened
        // Context: "3/6 + 1/3 * 2/2"
        it("Multiplies 1/3 \\cdot 2/2 -> 2/6", () => {
            const expr2 = "\\frac{3}{6} + \\frac{1}{3} \\cdot \\frac{2}{2}";
            const req: EngineStepExecutionRequest = {
                expressionLatex: expr2,
                targetPath: "term[1]", // The second multiplication
                primitiveId: "P.FRAC_MUL"
            };

            const result = PrimitiveRunner.run(req);
            expect(result.ok).toBe(true);

            // Expected: \frac{3}{6} + \frac{2}{6}
            expect(result.newExpressionLatex).toContain("\\frac{3}{6}");
            expect(result.newExpressionLatex).toContain("\\frac{2}{6}");
            expect(result.newExpressionLatex).toBe("\\frac{3}{6} + \\frac{2}{6}");
        });
    });
});

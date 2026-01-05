import { describe, it, expect } from "vitest";
import { PrimitiveRunner } from "../src/engine/primitive.runner";
import { EngineStepExecutionRequest } from "../src/engine/engine.bridge";
import { selectPrimitivesForClick, ClickContext } from "../src/mapmaster/primitive-catalog";

describe("Fraction Add/Sub Diff Denom Step 4 (Add Same Denominator)", () => {

    // Context: "\frac{3}{6} + \frac{2}{6}"
    const expression = "\\frac{3}{6} + \\frac{2}{6}";

    describe("Matching (Primitive Catalog)", () => {
        it("Offers P.FRAC_ADD_SAME_DEN when clicking '+' between same-denom fractions", () => {
            const ctx: ClickContext = {
                op: "+",
                lhsKind: "frac",
                rhsKind: "frac",
                sameDenominator: true, // Key condition
                hasZero: false,
                hasOne: false,
                hasParens: false
            };

            const candidates = selectPrimitivesForClick(ctx);
            const match = candidates.find(c => c.primitiveId === "P.FRAC_ADD_SAME_DEN");
            expect(match).toBeDefined();
            expect(match?.description).toBe("Fraction Add (Same Denominator)");
        });
    });

    describe("Execution (PrimitiveRunner)", () => {
        it("Adds 3/6 + 2/6 -> 5/6", () => {
            const req: EngineStepExecutionRequest = {
                expressionLatex: expression,
                targetPath: "root", // The "root" is the binaryOp "+"
                primitiveId: "P.FRAC_ADD_SAME_DEN"
            };

            const result = PrimitiveRunner.run(req);
            expect(result.ok).toBe(true);

            // Expected: \frac{5}{6}
            expect(result.newExpressionLatex).toBe("\\frac{5}{6}");
        });
    });
});

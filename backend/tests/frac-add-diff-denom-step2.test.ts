import { describe, it, expect } from "vitest";
import { PrimitiveRunner } from "../src/engine/primitive.runner";
import { EngineStepExecutionRequest } from "../src/engine/engine.bridge";
import { selectPrimitivesForClick, ClickContext } from "../src/mapmaster/primitive-catalog";

describe("Fraction Add/Sub Diff Denom Step 2 (Convert 1 to d/d)", () => {

    // Context: "1/2 \cdot 1 + 1/3 \cdot 1"
    const expression = "\\frac{1}{2} \\cdot 1 + \\frac{1}{3} \\cdot 1";

    describe("Matching (Primitive Catalog)", () => {
        it("Offers P.ONE_TO_TARGET_DENOM when clicking '1'", () => {
            const ctx: ClickContext = {
                op: "literal",
                lhsKind: "one",
                rhsKind: "none",
                sameDenominator: false
            };

            const candidates = selectPrimitivesForClick(ctx);
            const match = candidates.find(c => c.primitiveId === "P.ONE_TO_TARGET_DENOM");
            expect(match).toBeDefined();
            expect(match?.description).toBe("Convert 1 to d/d");
        });
    });

    describe("Execution (PrimitiveRunner)", () => {
        it("Converts left 1 to 3/3 (d from right term)", () => {
            const req: EngineStepExecutionRequest = {
                expressionLatex: expression,
                targetPath: "term[0].term[1]", // The "1" attached to 1/2
                primitiveId: "P.ONE_TO_TARGET_DENOM"
            };

            const result = PrimitiveRunner.run(req);
            expect(result.ok).toBe(true);

            // Should become \frac{1}{2} \cdot \frac{3}{3} + \frac{1}{3} \cdot 1
            expect(result.newExpressionLatex).toContain("\\frac{3}{3}");
            // Ensure the other 1 remains (with \cdot, not *)
            expect(result.newExpressionLatex).toContain("\\cdot 1");
        });

        it("Converts right 1 to 2/2 (d from left term)", () => {
            const req: EngineStepExecutionRequest = {
                expressionLatex: expression,
                targetPath: "term[1].term[1]", // The "1" attached to 1/3
                primitiveId: "P.ONE_TO_TARGET_DENOM"
            };

            const result = PrimitiveRunner.run(req);
            expect(result.ok).toBe(true);

            // Should become \frac{1}{2} \cdot 1 + \frac{1}{3} \cdot \frac{2}{2}
            expect(result.newExpressionLatex).toContain("\\frac{2}{2}");
            // Also verify \cdot is used (not *)
            expect(result.newExpressionLatex).toContain("\\cdot");
        });

        it("Fails if target is not 1 (e.g. click on the fraction)", () => {
            // Path to 1/2 is term[0].term[0]
            const req: EngineStepExecutionRequest = {
                expressionLatex: expression,
                targetPath: "term[0].term[0]",
                primitiveId: "P.ONE_TO_TARGET_DENOM"
            };
            const result = PrimitiveRunner.run(req);
            expect(result.ok).toBe(false);
            expect(result.errorCode).toBe("primitive-failed");
        });
    });
});

// DISABLED: This test hangs due to open handles. DO NOT REMOVE THIS LINE.
throw new Error("DISABLED (HANGING TEST): Do not run this file. Use tests/frac-add-diff-denom-step1.unit.test.ts instead.");

import { describe, it, expect } from "vitest";
import { PrimitiveRunner } from "../src/engine/primitive.runner";
import { EngineStepExecutionRequest } from "../src/engine/engine.bridge";
import { selectPrimitivesForClick, ClickContext } from "../src/mapmaster/primitive-catalog";

/**
 * QUARANTINED: This test file causes Vitest to hang due to open handles.
 * See: /reports/README.Tests.Hanging.frac-add-diff-denom-step1.2024-12-14.md
 * 
 * Replacement: tests/frac-add-diff-denom-step1.unit.test.ts (pure unit test, no HTTP)
 * Run replacement with:
 *   npx vitest run tests/frac-add-diff-denom-step1.unit.test.ts --testTimeout=15000 --hookTimeout=15000 --threads=false
 */
describe.skip("Fraction Add/Sub Diff Denom Step 1 (Multiply by 1) - QUARANTINED", () => {

    describe("Execution Logic (PrimitiveRunner)", () => {
        it("Applies P.FRAC_ADD_DIFF_DEN_MUL1 correctly to 1/2 + 1/3", () => {
            const req: EngineStepExecutionRequest = {
                expressionLatex: "1/2+1/3",
                targetPath: "", // Root
                primitiveId: "P.FRAC_ADD_DIFF_DEN_MUL1",
                expressionId: "test-expr"
            };

            const result = PrimitiveRunner.run(req);

            expect(result.ok).toBe(true);
            expect(result.newExpressionLatex).toContain("\\frac{1}{2}");
            expect(result.newExpressionLatex).toContain("\\frac{1}{3}");

            const hasMul = result.newExpressionLatex.includes("\\cdot 1") || result.newExpressionLatex.includes("* 1");
            expect(hasMul).toBe(true);
        });

        it("Applies P.FRAC_SUB_DIFF_DEN_MUL1 correctly to 2/3 - 1/5", () => {
            const req: EngineStepExecutionRequest = {
                expressionLatex: "2/3-1/5",
                targetPath: "",
                primitiveId: "P.FRAC_SUB_DIFF_DEN_MUL1",
                expressionId: "test-expr"
            };

            const result = PrimitiveRunner.run(req);

            expect(result.ok).toBe(true);
            expect(result.newExpressionLatex).toContain("-");
            expect(result.newExpressionLatex).toContain("\\frac{2}{3}");

            const hasMul = result.newExpressionLatex.includes("\\cdot 1") || result.newExpressionLatex.includes("* 1");
            expect(hasMul).toBe(true);
        });

        it("Fails if denominators are equal (e.g. 1/2 + 3/2)", () => {
            const req: EngineStepExecutionRequest = {
                expressionLatex: "1/2 + 3/2",
                targetPath: "",
                primitiveId: "P.FRAC_ADD_DIFF_DEN_MUL1",
                expressionId: "test-expr"
            };
            const result = PrimitiveRunner.run(req);
            expect(result.ok).toBe(false);
        });

        it("Fails if operands are not fractions (e.g. 1 + 1/3)", () => {
            const req: EngineStepExecutionRequest = {
                expressionLatex: "1 + 1/3",
                targetPath: "",
                primitiveId: "P.FRAC_ADD_DIFF_DEN_MUL1",
                expressionId: "test-expr"
            };
            const result = PrimitiveRunner.run(req);
            expect(result.ok).toBe(false);
        });
    });

    describe("Primitive Selection (Matching Logic)", () => {
        it("Offers P.FRAC_ADD_DIFF_DEN_MUL1 for 1/2 + 1/3 (diff denom)", () => {
            const ctx: ClickContext = {
                op: "+",
                lhsKind: "frac",
                rhsKind: "frac",
                sameDenominator: false,
                hasZero: false,
                hasOne: false
            };
            const candidates = selectPrimitivesForClick(ctx);
            const match = candidates.find(c => c.primitiveId === "P.FRAC_ADD_DIFF_DEN_MUL1");
            expect(match).toBeDefined();
        });

        it("Describes the primitive correctly", () => {
            const ctx: ClickContext = {
                op: "+",
                lhsKind: "frac",
                rhsKind: "frac",
                sameDenominator: false,
                hasZero: false,
                hasOne: false
            };
            const candidates = selectPrimitivesForClick(ctx);
            const match = candidates.find(c => c.primitiveId === "P.FRAC_ADD_DIFF_DEN_MUL1");
            expect(match?.description).toBe("Fraction Add (Diff Denom Step 1)");
        });

        it("Does NOT offer for same denominator (1/2 + 3/2)", () => {
            const ctx: ClickContext = {
                op: "+",
                lhsKind: "frac",
                rhsKind: "frac",
                sameDenominator: true,
                hasZero: false,
                hasOne: false
            };
            const candidates = selectPrimitivesForClick(ctx);
            const match = candidates.find(c => c.primitiveId === "P.FRAC_ADD_DIFF_DEN_MUL1");
            expect(match).toBeUndefined();
        });

        it("Offers P.FRAC_SUB_DIFF_DEN_MUL1 for subtraction", () => {
            const ctx: ClickContext = {
                op: "-",
                lhsKind: "frac",
                rhsKind: "frac",
                sameDenominator: false,
                hasZero: false,
                hasOne: false
            };
            const candidates = selectPrimitivesForClick(ctx);
            const match = candidates.find(c => c.primitiveId === "P.FRAC_SUB_DIFF_DEN_MUL1");
            expect(match).toBeDefined();
        });
    });

});

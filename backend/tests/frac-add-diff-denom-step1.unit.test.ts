/**
 * Unit Test: Fraction Add/Sub Different Denominators - Step 1 (Multiply by 1)
 *
 * This test validates primitive P.FRAC_ADD_DIFF_DEN_MUL1 and P.FRAC_SUB_DIFF_DEN_MUL1.
 * These primitives transform:
 *   \frac{a}{b} + \frac{c}{d} => \frac{a}{b} \cdot 1 + \frac{c}{d} \cdot 1
 *
 * This is PURELY a unit test calling PrimitiveRunner directly. NO HTTP, NO servers.
 *
 * Run with:
 *   npx vitest run tests/frac-add-diff-denom-step1.unit.test.ts --testTimeout=15000 --hookTimeout=15000 --threads=false
 */

import { describe, it, expect } from 'vitest';
import { PrimitiveRunner } from '../src/engine/primitive.runner';
import { selectPrimitivesForClick, ClickContext } from '../src/mapmaster/primitive-catalog';

describe('Fraction Add/Sub Different Denom Step 1 - UNIT Test (No HTTP)', () => {

    describe('PrimitiveRunner Execution', () => {

        it('P.FRAC_ADD_DIFF_DEN_MUL1: \\frac{1}{2} + \\frac{1}{3} => multiply both by 1', () => {
            const result = PrimitiveRunner.run({
                expressionLatex: "\\frac{1}{2} + \\frac{1}{3}",
                targetPath: "root",
                primitiveId: "P.FRAC_ADD_DIFF_DEN_MUL1",
                invariantRuleId: "test-rule",
                bindings: {}
            });

            expect(result.ok).toBe(true);
            // Output should be: \frac{1}{2} \cdot 1 + \frac{1}{3} \cdot 1
            // or variant spacing. Check essential structure.
            expect(result.newExpressionLatex).toContain("\\frac{1}{2}");
            expect(result.newExpressionLatex).toContain("\\frac{1}{3}");
            expect(result.newExpressionLatex).toContain("\\cdot 1");
            expect(result.newExpressionLatex).toContain("+");
        });

        it('P.FRAC_SUB_DIFF_DEN_MUL1: \\frac{2}{3} - \\frac{1}{5} => multiply both by 1', () => {
            const result = PrimitiveRunner.run({
                expressionLatex: "\\frac{2}{3} - \\frac{1}{5}",
                targetPath: "root",
                primitiveId: "P.FRAC_SUB_DIFF_DEN_MUL1",
                invariantRuleId: "test-rule",
                bindings: {}
            });

            expect(result.ok).toBe(true);
            expect(result.newExpressionLatex).toContain("\\frac{2}{3}");
            expect(result.newExpressionLatex).toContain("\\frac{1}{5}");
            expect(result.newExpressionLatex).toContain("\\cdot 1");
            expect(result.newExpressionLatex).toContain("-");
        });

        it('NEGATIVE: P.FRAC_ADD_DIFF_DEN_MUL1 fails for SAME denominator', () => {
            const result = PrimitiveRunner.run({
                expressionLatex: "\\frac{1}{2} + \\frac{3}{2}",
                targetPath: "root",
                primitiveId: "P.FRAC_ADD_DIFF_DEN_MUL1",
                invariantRuleId: "test-rule",
                bindings: {}
            });

            // Should fail because denominators are equal (2 == 2)
            expect(result.ok).toBe(false);
        });

        it('NEGATIVE: P.FRAC_ADD_DIFF_DEN_MUL1 fails for non-fraction operands', () => {
            const result = PrimitiveRunner.run({
                expressionLatex: "1 + \\frac{1}{3}",
                targetPath: "root",
                primitiveId: "P.FRAC_ADD_DIFF_DEN_MUL1",
                invariantRuleId: "test-rule",
                bindings: {}
            });

            // Should fail because left operand is not a fraction
            expect(result.ok).toBe(false);
        });
    });

    describe('Primitive Selection (Catalog Matching)', () => {

        it('Selects P.FRAC_ADD_DIFF_DEN_MUL1 for diff denom addition', () => {
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
            expect(match?.description).toBe("Fraction Add (Diff Denom Step 1)");
        });

        it('Does NOT select P.FRAC_ADD_DIFF_DEN_MUL1 for SAME denominator', () => {
            const ctx: ClickContext = {
                op: "+",
                lhsKind: "frac",
                rhsKind: "frac",
                sameDenominator: true, // <-- Same denom
                hasZero: false,
                hasOne: false
            };

            const candidates = selectPrimitivesForClick(ctx);
            const match = candidates.find(c => c.primitiveId === "P.FRAC_ADD_DIFF_DEN_MUL1");

            expect(match).toBeUndefined();
        });

        it('Selects P.FRAC_SUB_DIFF_DEN_MUL1 for diff denom subtraction', () => {
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
            expect(match?.description).toBe("Fraction Sub (Diff Denom Step 1)");
        });
    });
});

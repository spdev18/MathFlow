import { describe, it, expect } from 'vitest';
import { PrimitiveRunner } from '../src/engine/primitive.runner';
describe('V5 Primitive Verification: P.FRAC_ADD_SAME_DEN', () => {
    it('Case 1: 1/7 + 3/7 -> 4/7', () => {
        const result = PrimitiveRunner.run({
            expressionLatex: "1/7 + 3/7",
            targetPath: "root", // targeting the + operation (binaryOp)
            primitiveId: "P.FRAC_ADD_SAME_DEN",
            invariantRuleId: "test-rule",
            bindings: {}
        });
        expect(result.ok).toBe(true);
        // The output latex formatting might vary slightly (spaces), so we check essential content
        // Expected: 4/7
        expect(result.newExpressionLatex).toContain("4");
        expect(result.newExpressionLatex).toContain("7");
        // Precise string match if possible
        expect(result.newExpressionLatex).toBe("\\frac{4}{7}");
    });
    it('Case 2: 5/7 + 2/7 -> 7/7', () => {
        const result = PrimitiveRunner.run({
            expressionLatex: "\\frac{5}{7} + \\frac{2}{7}",
            targetPath: "root",
            primitiveId: "P.FRAC_ADD_SAME_DEN",
            invariantRuleId: "test-rule",
            bindings: {}
        });
        expect(result.ok).toBe(true);
        expect(result.newExpressionLatex).toBe("\\frac{7}{7}");
    });
    it('Case 3: 5/7 - 2/7 -> 3/7 (Legacy Logic Check)', () => {
        const result = PrimitiveRunner.run({
            expressionLatex: "\\frac{5}{7} - \\frac{2}{7}",
            targetPath: "root",
            primitiveId: "P.FRAC_SUB_SAME_DEN",
            invariantRuleId: "test-rule",
            bindings: {}
        });
        expect(result.ok).toBe(true);
        expect(result.newExpressionLatex).toBe("\\frac{3}{7}");
    });
    it('Case 4: Guard Failure (Different Denominators)', () => {
        const result = PrimitiveRunner.run({
            expressionLatex: "\\frac{1}{2} + \\frac{1}{3}",
            targetPath: "root",
            primitiveId: "P.FRAC_ADD_SAME_DEN",
            invariantRuleId: "test-rule",
            bindings: {}
        });
        // Should accept failure with specific error code or generic error
        expect(result.ok).toBe(false);
        // Our new implementation throws "guards-mismatch: denominators-equal"
        expect(result.errorCode).toContain("guards-mismatch");
    });
});

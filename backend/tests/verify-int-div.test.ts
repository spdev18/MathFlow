import { test, expect } from 'vitest';
import { PrimitiveRunner } from '../src/engine/primitive.runner';
import { EngineStepExecutionRequest } from '../src/engine/engine.bridge';

test('Verify Integer Division Runner Logic', async () => {
    // Helper to run primitive via public API
    const runPrim = (latex: string, id: string): string | undefined => {
        const req: EngineStepExecutionRequest = {
            sessionId: "test-session",
            expressionLatex: latex,
            primitiveId: id,
            targetPath: "root", // Assume we are operating on the root node
            bindings: {},
            // No resultPattern -> forcing fallback to applyPrimitive
        } as any;

        const res = PrimitiveRunner.run(req);
        if (res.ok) return res.newExpressionLatex;
        // If failed (e.g. guard failure returning undefined -> errorCode), return undefined
        return undefined;
    };

    // Case 1: Exact Integer Division
    // 10 \div 2 -> 5
    const res1 = runPrim("10 \\div 2", "P.INT_DIV_EXACT");
    expect(res1).toBe("5");

    // Case 2: Non-Exact Integer Division -> Fraction
    // 7 \div 2 -> \frac{7}{2}
    const res2 = runPrim("7 \\div 2", "P.INT_DIV_TO_FRAC");
    expect(res2).toBe("\\frac{7}{2}");

    // Case 3: Decimal input (Guard check)
    // 1.5 \div 0.5 -> Should fail (return undefined)
    const res3 = runPrim("1.5 \\div 0.5", "P.INT_DIV_EXACT");
    expect(res3).toBeUndefined();

    const res4 = runPrim("1.5 \\div 0.5", "P.INT_DIV_TO_FRAC");
    expect(res4).toBeUndefined();

    // Case 4: Division by Zero
    // 10 \div 0 -> PrimitiveRunner catches error and returns { ok: false, errorCode: "division-by-zero" }
    const reqZero: EngineStepExecutionRequest = {
        sessionId: "test", expressionLatex: "10 \\div 0", primitiveId: "P.INT_DIV_EXACT", targetPath: "root", bindings: {}
    } as any;
    const resZero = PrimitiveRunner.run(reqZero);
    expect(resZero.ok).toBe(false);
    expect(resZero.errorCode).toBe("division-by-zero");
});


import { test, expect } from 'vitest';
import { runOrchestratorStep } from '../src/orchestrator/step.orchestrator';
import { createPrimitiveMaster } from '../src/primitive-master/PrimitiveMaster';
import { InMemoryInvariantRegistry } from '../src/invariants';
import { createDefaultStudentPolicy } from '../src/stepmaster';
import { parseExpression } from '../src/mapmaster/ast';

test('Verify Fraction Multiplication Selection', async () => {
    // Setup Context
    const mockDeps = {
        parseLatexToAst: async (l: string) => parseExpression(l)
    };
    const registry = new InMemoryInvariantRegistry({
        model: { primitives: [], invariantSets: [{ id: 'default', name: 'Default', description: '', version: '1.0.0', rules: [] }] }
    });
    const primitiveMaster = createPrimitiveMaster(mockDeps);
    const ctx = { invariantRegistry: registry, policy: createDefaultStudentPolicy(), primitiveMaster };

    // Helper to run step
    const run = async (latex: string) => {
        return await runOrchestratorStep(ctx, {
            sessionId: 'verify-frac-mul-' + Date.now(),
            courseId: 'default',
            userRole: 'student',
            expressionLatex: latex,
            selectionPath: 'root'
        } as any);
    };

    // Case 1: Fraction * Fraction
    // 1/2 * 3/5
    const result1 = await run("1/2 * 3/5");
    console.log("1/2 * 3/5 result:", result1.status, result1.engineResult?.newExpressionLatex);

    // Expect P.FRAC_MUL
    expect(result1.status).toBe("step-applied");
    // We can't easily check primitiveId from result without peeking deeper or trusting the output
    // But if result is 3/10, it MUST be P.FRAC_MUL because P.INT_MUL would fail (or zero out if using old logic?)
    // P.FRAC_DIV_AS_MUL would return 5/6 (division).

    // 1/2 * 3/5 = 3/10. Latex: \frac{3}{10}
    expect(result1.engineResult?.newExpressionLatex).toBe("\\frac{3}{10}");

    // Case 2: Integer * Integer (Regression check)
    const result2 = await run("2 * 3");
    console.log("2 * 3 result:", result2.status, result2.engineResult?.newExpressionLatex);

    expect(result2.status).toBe("step-applied");
    expect(result2.engineResult?.newExpressionLatex).toBe("6");
});

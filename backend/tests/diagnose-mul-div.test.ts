
import { describe, it } from 'vitest';
import { runOrchestratorStep } from '../src/orchestrator/step.orchestrator';
import { createPrimitiveMaster } from '../src/primitive-master/PrimitiveMaster';
import { InMemoryInvariantRegistry } from '../src/invariants';
import { createDefaultStudentPolicy } from '../src/stepmaster';
import { parseExpression } from '../src/mapmaster/ast';

/*
  DIAGNOSTIC TEST FOR MULTIPLICATION AND DIVISION
  Scopes: Integers, Fractions, Decimals
*/

async function runDiagnostic(latex: string, name: string) {
    console.log(`\n--- [DIAGNOSIS] ${name}: ${latex} ---`);
    const mockDeps = {
        parseLatexToAst: async (l: string) => parseExpression(l)
    };
    const registry = new InMemoryInvariantRegistry({
        model: { primitives: [], invariantSets: [{ id: 'default', name: 'Default', description: '', version: '1.0.0', rules: [] }] }
    });
    const primitiveMaster = createPrimitiveMaster(mockDeps);
    const ctx = { invariantRegistry: registry, policy: createDefaultStudentPolicy(), primitiveMaster };

    // Try to find the operator node to click
    const ast = parseExpression(latex);
    if (!ast) { console.log("Failed to parse"); return; }

    // Simple heuristic to find root operator or first binary op
    let selectionPath = 'root'; // default

    try {
        const result = await runOrchestratorStep(ctx, {
            sessionId: 'diag-mul-div-' + Date.now(),
            courseId: 'default',
            userRole: 'student',
            expressionLatex: latex,
            selectionPath: selectionPath
        } as any);

        console.log(`RESULT: Status=${result.status}`);
        if (result.engineResult) {
            console.log(`OUTPUT: ${result.engineResult.newExpressionLatex}`);
            console.log(`ERROR: ${result.engineResult.errorCode}`);
        } else {
            console.log("No engine result");
        }
    } catch (e) {
        console.log("CRASH:", e);
    }
}

describe('Multiplication Division Diagnostics', () => {
    // 1. Integers
    it('Integer Multiplication', async () => await runDiagnostic('2 * 3', 'Int Mul'));
    it('Integer Division Exact', async () => await runDiagnostic('10 / 2', 'Int Div Exact')); // Check if parsed as / or :
    it('Integer Division Frac', async () => await runDiagnostic('7 / 2', 'Int Div Frac'));

    // 2. Fractions
    // Note: LaTeX for fractions might be \frac{1}{2}, usually parser handles \frac
    it('Fraction Multiplication', async () => await runDiagnostic('\\frac{1}{2} * \\frac{3}{5}', 'Frac Mul'));
    it('Fraction Division', async () => await runDiagnostic('\\frac{2}{3} / \\frac{4}{5}', 'Frac Div'));

    // 3. Decimals
    it('Decimal Multiplication', async () => await runDiagnostic('1.2 * 0.5', 'Dec Mul'));
    it('Decimal Division', async () => await runDiagnostic('1.5 / 0.5', 'Dec Div'));
});


import { describe, it, expect } from 'vitest';
import { runOrchestratorStep } from '../src/orchestrator/step.orchestrator';
import { createPrimitiveMaster } from '../src/primitive-master/PrimitiveMaster';
import { InMemoryInvariantRegistry } from '../src/invariants';
import { createDefaultStudentPolicy } from '../src/stepmaster';
import { parseExpression } from '../src/mapmaster/ast';

describe('Decimal Diagnosis', () => {
    it('parses decimals as integers', () => {
        const ast = parseExpression('12.5');
        console.log('AST for 12.5:', JSON.stringify(ast, null, 2));
        expect((ast as any).type).toBe('integer');
        expect((ast as any).value).toBe('12.5');
    });

    it('truncates decimals in addition', async () => {
        // Use real parser for deps to verify the full flow
        const mockDeps = {
            parseLatexToAst: async (latex: string) => parseExpression(latex)
        };
        const registry = new InMemoryInvariantRegistry({
            model: {
                primitives: [],
                invariantSets: [{
                    id: 'default',
                    name: 'Default Set',
                    description: 'Test Set',
                    version: '1.0.0',
                    rules: []
                }]
            }
        });
        const primitiveMaster = createPrimitiveMaster(mockDeps);
        const ctx = { invariantRegistry: registry, policy: createDefaultStudentPolicy(), primitiveMaster };

        // 12.5 + 0.75
        // Click on "+" (root)
        // With normalization, click "12.5" -> "+"

        const result = await runOrchestratorStep(ctx, {
            sessionId: 'diag-decimal',
            courseId: 'default',
            userRole: 'student',
            expressionLatex: '12.5 + 0.75',
            selectionPath: 'root'
        } as any);

        console.log("Decimal Add Result:", JSON.stringify(result, null, 2));

        // We expect result to be 13.25 (12.5 + 0.75)
        expect(result.status).toBe('step-applied');
        expect(result.engineResult?.newExpressionLatex).toBe('13.25');
    });
});

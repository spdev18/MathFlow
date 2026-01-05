
import { describe, it, expect } from 'vitest';
import { runOrchestratorStep } from '../src/orchestrator/step.orchestrator';
import { createPrimitiveMaster } from '../src/primitive-master/PrimitiveMaster';
import { InMemoryInvariantRegistry } from '../src/invariants';
import { createDefaultStudentPolicy } from '../src/stepmaster';

// Mock deps
const mockDeps = {
    parseLatexToAst: async (latex: string) => {
        if (latex === '2 + 3') {
            return {
                type: 'binaryOp',
                op: '+',
                left: { type: 'integer', value: '2' },
                right: { type: 'integer', value: '3' }
            } as any;
        }
        if (latex === '1') {
            return {
                type: 'integer',
                value: '1'
            } as any;
        }
        return undefined;
    }
};

describe('V5 Integer Diagnosis', () => {
    // V5 Status Contract for Integer Clicks:
    // - Without preferredPrimitiveId: returns 'choice' (user sees context menu with INT_TO_FRAC option)
    // - With preferredPrimitiveId: returns 'step-applied' (direct execution, e.g., P1 double-click)
    //
    // This aligns with the P1 behavior: single-click shows choices, double-click applies directly.

    it('diagnose 2 + 3 click 2 - returns choice without preferredPrimitiveId', async () => {
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
        const result = await runOrchestratorStep(ctx, {
            sessionId: 'diag',
            courseId: 'default',
            userRole: 'student',
            expressionLatex: '2 + 3',
            selectionPath: 'term[0]' // "2"
        } as any);
        console.log("DIAG RESULT 2+3:", JSON.stringify(result, null, 2));

        // V5 Contract: integer click without preferredPrimitiveId returns 'choice'
        expect(result.status).toBe('choice');
        expect(result.choices).toBeDefined();
        // Should include INT_TO_FRAC as an option
        const hasIntToFrac = result.choices?.some((c: any) => c.primitiveId === 'P.INT_TO_FRAC');
        expect(hasIntToFrac).toBe(true);
    });

    it('diagnose 1 click 1 - returns choice without preferredPrimitiveId', async () => {
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
        const result = await runOrchestratorStep(ctx, {
            sessionId: 'diag',
            courseId: 'default',
            userRole: 'student',
            expressionLatex: '1',
            selectionPath: 'root'
        } as any);
        console.log("DIAG RESULT 1:", JSON.stringify(result, null, 2));

        // V5 Contract: integer click without preferredPrimitiveId returns 'choice'
        expect(result.status).toBe('choice');
        expect(result.choices).toBeDefined();
    });
});

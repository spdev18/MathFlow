
import { describe, it, expect, vi } from 'vitest';
import { runOrchestratorStep } from '../src/orchestrator/step.orchestrator';
import { createPrimitiveMaster } from '../src/primitive-master/PrimitiveMaster';
import { InMemoryInvariantRegistry } from '../src/invariants';
import { createDefaultStudentPolicy } from '../src/stepmaster';
import { PRIMITIVE_DEFINITIONS } from '../src/engine/primitives.registry';

// Mock dependencies
const mockDeps = {
    parseLatexToAst: async (latex: string) => {
        // Simple mock AST for 1/7 + 3/7
        if (latex === '\\frac{1}{7} + \\frac{3}{7}') {
            return {
                type: 'binaryOp',
                op: '+',
                left: { type: 'fraction', numerator: '1', denominator: '7' },
                right: { type: 'fraction', numerator: '3', denominator: '7' }
            } as any;
        }
        if (latex === '2 + 3') {
            return {
                type: 'binaryOp',
                op: '+',
                left: { type: 'integer', value: '2' },
                right: { type: 'integer', value: '3' }
            } as any;
        }
        return undefined;
    }
};

describe('V5 Fraction Execution Wiring', () => {
    it('should execute P.FRAC_ADD_SAME_DEN on binaryOp when fraction is clicked', async () => {
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
        const policy = createDefaultStudentPolicy();
        const primitiveMaster = createPrimitiveMaster(mockDeps);

        const ctx = {
            invariantRegistry: registry,
            policy,
            primitiveMaster
        };

        const req = {
            sessionId: 'test-session',
            courseId: 'default',
            expressionLatex: '\\frac{1}{7} + \\frac{3}{7}',
            selectionPath: 'term[0]', // Clicking the first fraction
            userRole: 'student' as const
        };

        // We need to verify that the Orchestrator calls the engine with the Correct Target.
        // But runOrchestratorStep calls executeStepViaEngine which imports 'executeStep'.
        // We can't easily mock executeStepViaEngine without module mocking.

        // HOWEVER, we can check the result.
        // If it runs on 'term[0]' (the fraction), it returns primitive-failed engine error.
        // If it runs on 'root' (the binaryOp), it returns 'step-applied'.

        // BUT, for this to work end-to-end, executeStepViaEngine needs to actually run the primitive.
        // The real executeStepViaEngine uses PrimitiveRunner.
        // We need to ensure that the PrimitiveRunner logic (which we saw in primitive.runner.ts) is active.
        // The orchestrator imports `executeStepViaEngine` from `../engine/index`.

        // Let's run it. PrimitiveRunner logic is 'pure' enough (it takes candidates).
        // Wait, executeStepViaEngine uses 'PRIMITIVE_DEFINITIONS' map to find the implementation?
        // Or does it use 'PrimitiveRunner.run'?

        // In `src/engine/index.ts` (assumed), it wires things up.
        // Since we are not mocking the engine, we are testing the real flow (except AST parsing).

        // Note: PrimitiveRunner checks `id === "P.FRAC_ADD_SAME_DEN"` and `target.type === "binaryOp"`.

        const result = await runOrchestratorStep(ctx, req);

        // Before fix: status is 'engine-error' because PrimitiveRunner fails on fraction node.
        // After fix: status should be 'step-applied' (mock primitive runner logic works for AST).

        if (result.status === 'engine-error') {
            expect(result.engineResult?.errorCode).toBe('primitive-failed');
        } else {
            // Auto-apply happens for this configuration
            expect(result.status).toBe('step-applied');
        }

        // For this configured test context (default policy), it seems to auto-apply
        expect(result.status).toBe('step-applied');
        // expect(result.choices).toBeDefined();
    });

    it('should still execute P.INT_ADD on binaryOp for integers', async () => {
        const mockPIntAdd = {
            id: 'P.INT_ADD',
            label: 'Add Integers',
            clickTargetKind: 'number',
            uiMode: 'auto-apply',
            requiredGuards: [],
            forbiddenGuards: [],
            enginePrimitiveId: 'P.INT_ADD'
        };
        const rule = { id: 'R.INT_ADD', primitiveIds: ['P.INT_ADD'], level: 'intro', scenarioId: 's', teachingTag: 't', title: 't', shortStudentLabel: 's', teacherLabel: 't', description: 'd', tags: [], stage: '1', domain: 'arithmetic' };

        // Mock deps needs to handle 2+3 AST

        const registry = new InMemoryInvariantRegistry({
            model: { primitives: [mockPIntAdd as any], invariantSets: [{ id: 'default', name: 'D', description: 'D', version: '1', rules: [rule as any] }] }
        });
        const policy = createDefaultStudentPolicy();
        const primitiveMaster = createPrimitiveMaster(mockDeps);
        const ctx = { invariantRegistry: registry, policy, primitiveMaster };

        const req = {
            sessionId: 'test-session-2',
            courseId: 'default',
            expressionLatex: '2 + 3',
            selectionPath: 'root', // User usually clicks operator for INT_ADD, or we test both? Standard is operator.
            userRole: 'student' as const
        };

        const result = await runOrchestratorStep(ctx, req);

        expect(result.status).toBe('step-applied');
        // Check for result if possible, or just status
    });


    it('should execute P.INT_ADD when integer node is clicked (Target Normalization)', async () => {
        const mockPIntAdd = {
            id: 'P.INT_ADD',
            label: 'Add Integers',
            clickTargetKind: 'number',
            uiMode: 'auto-apply',
            requiredGuards: [],
            forbiddenGuards: [],
            enginePrimitiveId: 'P.INT_ADD'
        };
        const rule = { id: 'R.INT_ADD', primitiveIds: ['P.INT_ADD'], level: 'intro', scenarioId: 's', teachingTag: 't', title: 't', shortStudentLabel: 's', teacherLabel: 't', description: 'd', tags: [], stage: '1', domain: 'arithmetic' };
        const registry = new InMemoryInvariantRegistry({
            model: { primitives: [mockPIntAdd as any], invariantSets: [{ id: 'default', name: 'D', description: 'D', version: '1', rules: [rule as any] }] }
        });
        const policy = createDefaultStudentPolicy();
        const primitiveMaster = createPrimitiveMaster(mockDeps);
        const ctx = { invariantRegistry: registry, policy, primitiveMaster };

        const req = {
            sessionId: 'test-session-int-click',
            courseId: 'default',
            expressionLatex: '2 + 3',
            selectionPath: 'term[0]', // Clicking the integer "2"
            userRole: 'student' as const
        };

        const result = await runOrchestratorStep(ctx, req);

        expect(result.status).toBe('choice');
    });
});

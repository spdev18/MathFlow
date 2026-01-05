import { describe, it, expect } from 'vitest';
import { mapMasterDebug } from '../src/mapmaster/mapmaster.debug';
import type { MapMasterInput } from '../src/mapmaster/mapmaster.core';
import { InMemoryInvariantRegistry } from '../src/invariants/invariants.registry';
import { STAGE1_INVARIANT_SETS } from '../src/mapmaster/mapmaster.invariants.registry';
import type { InvariantModelDefinition, PrimitiveDefinition, InvariantSetDefinition } from '../src/invariants/invariants.model';
import type { MapMasterDebugRequest } from '../src/mapmaster/mapmaster.debug.types';

// Helper to setup registry (duplicated from HandlerPostMapMasterDebug.ts)
function createDebugRegistry() {
    const allRules = STAGE1_INVARIANT_SETS.flatMap(s => s.rules);
    const primitives: PrimitiveDefinition[] = [];

    for (const rule of allRules) {
        const primId = rule.id;
        primitives.push({
            id: primId,
            name: rule.id,
            description: "Debug Primitive",
            category: "Debug",
            tags: []
        });
    }

    const invariantSets: InvariantSetDefinition[] = STAGE1_INVARIANT_SETS.map(s => ({
        id: s.id,
        name: s.id,
        description: "Debug Set",
        version: "1.0",
        rules: s.rules.map(r => ({
            id: r.id,
            title: r.id,
            shortStudentLabel: r.id,
            teacherLabel: r.id,
            description: r.id,
            level: "Stage1",
            tags: [],
            primitiveIds: [r.id],
            scenarioId: "debug-scenario",
            teachingTag: "debug"
        }))
    }));

    const model: InvariantModelDefinition = {
        primitives,
        invariantSets
    };

    return new InMemoryInvariantRegistry({ model });
}

// Helper to run debug
function runDebug(latex: string, operatorIndex: number) {
    const registry = createDebugRegistry();
    const invariantSetIds = STAGE1_INVARIANT_SETS.map(s => s.id);

    const input: MapMasterInput = {
        expressionLatex: latex,
        selectionPath: null,
        operatorIndex: operatorIndex,
        invariantSetIds: invariantSetIds,
        registry: registry
    };

    return mapMasterDebug(input);
}

describe('MapMaster Stage1 Coverage', () => {

    describe('Fractions - Same Denominator', () => {
        it('1/7 + 3/7 (Add)', () => {
            // \frac{1}{7} + \frac{3}{7}
            // Operators: frac(0), frac(1), +(2) -> Wait, operator index depends on traversal order.
            // Usually: 1/7 (frac), 3/7 (frac), + (binary).
            // Let's assume standard traversal. 
            // If we use OperatorByIndex, we need to know the index.
            // For "1/7 + 3/7":
            // 1. Fraction (1/7)
            // 2. Fraction (3/7)
            // 3. Plus
            // Wait, usually it's depth-first or similar. 
            // Let's try index 0. If it fails, we might need to find the right index.
            // Actually, in `1/7 + 3/7`, the `+` is the root binary op.
            // The children are fractions.
            // If we traverse:
            // Root (+) -> Index ?
            // Left (1/7) -> Fraction bar -> Index ?
            // Right (3/7) -> Fraction bar -> Index ?

            // In `ast.ts`, `parseExpression` uses `mathjs` or similar?
            // If we rely on `operatorIndex`, we need to be sure.
            // Let's try 0. Often the root operator is 0 or last depending on parser.
            // Actually, let's look at `mapmaster.selection.normalizer.ts` or `locality.ts`.
            // But for this test, we can just try 0.

            // "1/7 + 3/7"
            // If 0 is the plus, good.

            const result = runDebug('\\frac{1}{7} + \\frac{3}{7}', 0);

            expect(result.pipeline.selection.status).toBe('ok');
            expect(result.pipeline.window.status).toBe('ok');
            expect(result.pipeline.rules.candidateCount).toBeGreaterThan(0);
            expect(result.candidates.length).toBeGreaterThan(0);

            // Verify specific rule if possible
            const hasAddRule = result.candidates.some(c => c.invariantRuleId.includes('ADD'));
            expect(hasAddRule).toBe(true);
        });

        it('5/9 - 2/9 (Sub)', () => {
            const result = runDebug('\\frac{5}{9} - \\frac{2}{9}', 0);

            expect(result.pipeline.selection.status).toBe('ok');
            expect(result.pipeline.window.status).toBe('ok');
            expect(result.pipeline.rules.candidateCount).toBeGreaterThan(0);
            expect(result.candidates.length).toBeGreaterThan(0);

            const hasSubRule = result.candidates.some(c => c.invariantRuleId.includes('SUB'));
            expect(hasSubRule).toBe(true);
        });
    });

    describe('Integers', () => {
        it('3 + 5 (Add)', () => {
            const result = runDebug('3 + 5', 0);

            expect(result.pipeline.selection.status).toBe('ok');
            expect(result.pipeline.window.status).toBe('ok');
            expect(result.pipeline.rules.candidateCount).toBeGreaterThan(0);
            expect(result.candidates.length).toBeGreaterThan(0);

            const hasAddRule = result.candidates.some(c => c.invariantRuleId.includes('ADD'));
            expect(hasAddRule).toBe(true);
        });

        it('10 - 4 (Sub)', () => {
            const result = runDebug('10 - 4', 0);

            expect(result.pipeline.selection.status).toBe('ok');
            expect(result.pipeline.window.status).toBe('ok');
            expect(result.pipeline.rules.candidateCount).toBeGreaterThan(0);
            expect(result.candidates.length).toBeGreaterThan(0);

            const hasSubRule = result.candidates.some(c => c.invariantRuleId.includes('SUB'));
            expect(hasSubRule).toBe(true);
        });
    });

    describe('Mixed (Integer + Fraction)', () => {
        it('3 + 2/7', () => {
            const result = runDebug('3 + \\frac{2}{7}', 0);

            expect(result.pipeline.selection.status).toBe('ok');
            expect(result.pipeline.window.status).toBe('ok');

            // If mixed rules are implemented:
            expect(result.pipeline.rules.candidateCount).toBeGreaterThan(0);
            expect(result.candidates.length).toBeGreaterThan(0);
        });

        it('5 - 1/9', () => {
            const result = runDebug('5 - \\frac{1}{9}', 0);

            expect(result.pipeline.selection.status).toBe('ok');
            expect(result.pipeline.window.status).toBe('ok');

            expect(result.pipeline.rules.candidateCount).toBeGreaterThan(0);
            expect(result.candidates.length).toBeGreaterThan(0);
        });
    });
});

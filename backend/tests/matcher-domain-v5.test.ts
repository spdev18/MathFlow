
import { describe, it, expect } from 'vitest';
import { PrimitiveMatcher } from '../src/engine/v5/PrimitiveMatcher';
import { PRIMITIVES_V5_TABLE, NodeContext, ClickTarget } from '../src/engine/primitives.registry.v5';

describe('V5 Primitive Matcher - Domain Logic', () => {
    const matcher = new PrimitiveMatcher();

    it('should match P.INT_ADD for integer operands', () => {
        const ctx: NodeContext = {
            expressionId: 'test-int',
            nodeId: 'root',
            clickTarget: { nodeId: 'root', kind: 'operator' },
            operatorLatex: '+',
            leftOperandType: 'int',
            rightOperandType: 'int',
            guards: {}
        };

        const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });
        const intAdd = matches.find(m => m.row.id === 'P.INT_ADD');
        const fracAdd = matches.find(m => m.row.id === 'P.FRAC_ADD_SAME_DEN');

        expect(intAdd).toBeDefined();
        // P.FRAC_ADD should NOT match integers (once fixed)
        // usage of "should" implies expectation of fix. 
        // Current behavior: P.FRAC_ADD might technically match if it doesn't check domain either?
        // Actually P.FRAC_ADD usually has "denominators-equal" guard?
        // Let's check the registry. P.FRAC_ADD_SAME_DEN doesn't seem to have required guards in registry inspection (it wasn't fully shown).
        // But regardless, for 100% correct behavior:
        expect(fracAdd).toBeUndefined();
    });

    it('should match P.FRAC_ADD_SAME_DEN for fraction operands (same den)', () => {
        const ctx: NodeContext = {
            expressionId: 'test-frac',
            nodeId: 'root', // hypothetical match
            clickTarget: { nodeId: 'root', kind: 'operator' },
            operatorLatex: '+',
            leftOperandType: 'fraction',
            rightOperandType: 'fraction',
            guards: {
                'denominators-equal': true
            }
        };

        const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });
        const intAdd = matches.find(m => m.row.id === 'P.INT_ADD');
        const fracAdd = matches.find(m => m.row.id === 'P.FRAC_ADD_SAME_DEN');

        // This is the CRITICAL failure point currently:
        // P.INT_ADD matches because it ignores type/domain
        expect(intAdd).toBeUndefined();

        expect(fracAdd).toBeDefined();
    });
});

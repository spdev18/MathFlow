import { describe, it, expect } from 'vitest';
import { GenericPatternMatcher } from '../src/mapmaster/GenericPatternMatcher';
import { parseExpression, toLatex } from '../src/mapmaster/ast';
import { PrimitiveRunner } from '../src/engine/primitive.runner';

describe('GenericPatternMatcher', () => {
    it('matches simple integer addition', () => {
        const matcher = new GenericPatternMatcher('a + b');
        const ast = parseExpression('2 + 3');
        const bindings = matcher.matches(ast!);

        expect(bindings).not.toBeNull();
        expect(bindings!['a'].type).toBe('integer');
        expect((bindings!['a'] as any).value).toBe('2');
        expect(bindings!['b'].type).toBe('integer');
        expect((bindings!['b'] as any).value).toBe('3');
    });

    it('matches fraction addition with same denominator', () => {
        const matcher = new GenericPatternMatcher('a/c + b/c');
        const ast = parseExpression('1/7 + 3/7');
        const bindings = matcher.matches(ast!);

        expect(bindings).not.toBeNull();
        expect((bindings!['a'] as any).value).toBe('1');
        expect((bindings!['b'] as any).value).toBe('3');
        expect((bindings!['c'] as any).value).toBe('7');
    });

    it('fails when structure does not match', () => {
        const matcher = new GenericPatternMatcher('a + b');
        const ast = parseExpression('2 * 3');
        const bindings = matcher.matches(ast!);
        expect(bindings).toBeNull();
    });

    it('fails when variable constraints are not met', () => {
        const matcher = new GenericPatternMatcher('a/c + b/c');
        const ast = parseExpression('1/7 + 3/8'); // Different denominators
        const bindings = matcher.matches(ast!);
        expect(bindings).toBeNull();
    });
});

describe('PrimitiveRunner with Patterns', () => {
    it('executes P.INT_ADD using pattern', () => {
        const req = {
            expressionLatex: '2 + 3',
            targetPath: 'root',
            primitiveId: 'P.INT_ADD',
            invariantRuleId: 'test-rule',
            bindings: {
                a: { type: 'integer', value: '2' },
                b: { type: 'integer', value: '3' }
            },
            resultPattern: 'calc(a+b)'
        };

        const result = PrimitiveRunner.run(req as any);
        expect(result.ok).toBe(true);
        expect(result.newExpressionLatex).toBe('5');
    });

    it('executes P.FRAC_ADD_SAME using pattern', () => {
        const req = {
            expressionLatex: '1/7 + 3/7',
            targetPath: 'root',
            primitiveId: 'P.FRAC_ADD_SAME',
            invariantRuleId: 'test-rule',
            bindings: {
                a: { type: 'integer', value: '1' },
                b: { type: 'integer', value: '3' },
                c: { type: 'integer', value: '7' }
            },
            resultPattern: '(a + b) / c'
        };

        const result = PrimitiveRunner.run(req as any);
        expect(result.ok).toBe(true);
        expect(result.newExpressionLatex).toBe('(1 + 3) \\div 7');
    });
});

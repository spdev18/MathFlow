/**
 * Unit tests for validation.utils.ts
 * Tests the Smart Operator Selection validation logic
 */

import { describe, it, expect } from 'vitest';
import { validateOperatorContext, validateRootOperator, type ValidationType } from '../src/mapmaster/validation.utils';

describe('validateOperatorContext', () => {
    describe('Integer Arithmetic', () => {
        it('should return DIRECT for integer addition', () => {
            const result = validateRootOperator('2 + 3');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('direct');
            expect(result!.reason).toBe('integer-arithmetic');
        });

        it('should return DIRECT for integer subtraction', () => {
            const result = validateRootOperator('5 - 2');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('direct');
            expect(result!.reason).toBe('integer-arithmetic');
        });

        it('should return DIRECT for integer multiplication', () => {
            const result = validateRootOperator('4 * 3');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('direct');
            expect(result!.reason).toBe('integer-arithmetic');
        });

        it('should return DIRECT for exact integer division', () => {
            // Note: Using \div creates binaryOp node; plain / creates fraction node
            const result = validateRootOperator('6 \\div 2');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('direct');
            expect(result!.reason).toBe('exact-division');
        });

        it('should return REQUIRES-PREP for non-exact integer division', () => {
            const result = validateRootOperator('7 \\div 2');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('requires-prep');
            expect(result!.reason).toBe('non-exact-division');
        });
    });

    describe('Fraction Arithmetic - Same Denominator', () => {
        it('should return DIRECT for fraction addition with same denominator', () => {
            const result = validateRootOperator('\\frac{1}{3} + \\frac{2}{3}');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('direct');
            expect(result!.reason).toBe('same-denominator');
        });

        it('should return DIRECT for fraction subtraction with same denominator', () => {
            const result = validateRootOperator('\\frac{5}{7} - \\frac{2}{7}');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('direct');
            expect(result!.reason).toBe('same-denominator');
        });
    });

    describe('Fraction Arithmetic - Different Denominator', () => {
        it('should return REQUIRES-PREP for fraction addition with different denominators', () => {
            const result = validateRootOperator('\\frac{1}{2} + \\frac{1}{3}');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('requires-prep');
            expect(result!.reason).toBe('different-denominators');
        });

        it('should return REQUIRES-PREP for fraction subtraction with different denominators', () => {
            const result = validateRootOperator('\\frac{3}{4} - \\frac{1}{2}');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('requires-prep');
            expect(result!.reason).toBe('different-denominators');
        });
    });

    describe('Fraction Multiplication and Division', () => {
        it('should return DIRECT for fraction multiplication', () => {
            const result = validateRootOperator('\\frac{1}{2} * \\frac{3}{4}');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('direct');
            expect(result!.reason).toBe('fraction-multiplication');
        });

        it('should return DIRECT for fraction division', () => {
            const result = validateRootOperator('\\frac{1}{2} / \\frac{3}{4}');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('direct');
            expect(result!.reason).toBe('fraction-division');
        });
    });

    describe('Mixed Operand Types', () => {
        it('should return REQUIRES-PREP for integer + fraction', () => {
            const result = validateRootOperator('2 + \\frac{1}{3}');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('requires-prep');
            expect(result!.reason).toBe('mixed-operand-types');
        });

        it('should return DIRECT for integer * fraction', () => {
            const result = validateRootOperator('2 * \\frac{1}{3}');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('direct');
            expect(result!.reason).toBe('mixed-multiplication');
        });
    });

    describe('Nested Path Navigation', () => {
        it('should validate operator at nested path', () => {
            // Expression: (1/2 + 1/3) * 2
            // Root is *, inner is + with different denoms
            const result = validateOperatorContext('\\left(\\frac{1}{2} + \\frac{1}{3}\\right) * 2', 'term[0]');
            expect(result).not.toBeNull();
            expect(result!.validationType).toBe('requires-prep');
            expect(result!.reason).toBe('different-denominators');
        });
    });

    describe('Edge Cases', () => {
        it('should return null for non-operator node', () => {
            const result = validateOperatorContext('2 + 3', 'term[0]');
            expect(result).toBeNull();
        });

        it('should return null for invalid path', () => {
            const result = validateOperatorContext('2 + 3', 'invalid.path');
            expect(result).toBeNull();
        });

        it('should return null for unparseable expression', () => {
            const result = validateRootOperator('???');
            expect(result).toBeNull();
        });
    });
});

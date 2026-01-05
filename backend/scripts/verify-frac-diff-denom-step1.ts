/**
 * Standalone Verification Script: Fraction Add/Sub Different Denominators Step 1
 * 
 * This script verifies the P.FRAC_ADD_DIFF_DEN_MUL1 and P.FRAC_SUB_DIFF_DEN_MUL1 primitives
 * WITHOUT using vitest (which hangs due to open handles).
 * 
 * Run with:
 *   npx tsx scripts/verify-frac-diff-denom-step1.ts
 * 
 * Expected output: All tests PASS with green checkmarks.
 */

import { PrimitiveRunner } from '../src/engine/primitive.runner';
import { selectPrimitivesForClick, ClickContext } from '../src/mapmaster/primitive-catalog';

// Simple test framework
let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean): void {
    try {
        const result = fn();
        if (result) {
            console.log(`✓ PASS: ${name}`);
            passed++;
        } else {
            console.log(`✗ FAIL: ${name}`);
            failed++;
        }
    } catch (e) {
        console.log(`✗ FAIL: ${name} - Exception: ${e}`);
        failed++;
    }
}

console.log('\n=== Fraction Add/Sub Different Denom Step 1 Verification ===\n');

// --- Test 1: P.FRAC_ADD_DIFF_DEN_MUL1 execution ---
test('P.FRAC_ADD_DIFF_DEN_MUL1: 1/2 + 1/3 => multiply both by 1', () => {
    const result = PrimitiveRunner.run({
        expressionLatex: "\\frac{1}{2} + \\frac{1}{3}",
        targetPath: "root",
        primitiveId: "P.FRAC_ADD_DIFF_DEN_MUL1",
        invariantRuleId: "test-rule",
        bindings: {}
    });

    if (!result.ok) {
        console.log(`    -> Error: ${result.errorCode}`);
        return false;
    }

    const latex = result.newExpressionLatex || '';
    console.log(`    -> Output: ${latex}`);

    // Check essential structure
    const hasFrac12 = latex.includes('\\frac{1}{2}');
    const hasFrac13 = latex.includes('\\frac{1}{3}');
    const hasCdot1 = latex.includes('\\cdot 1');
    const hasPlus = latex.includes('+');

    return hasFrac12 && hasFrac13 && hasCdot1 && hasPlus;
});

// --- Test 2: P.FRAC_SUB_DIFF_DEN_MUL1 execution ---
test('P.FRAC_SUB_DIFF_DEN_MUL1: 2/3 - 1/5 => multiply both by 1', () => {
    const result = PrimitiveRunner.run({
        expressionLatex: "\\frac{2}{3} - \\frac{1}{5}",
        targetPath: "root",
        primitiveId: "P.FRAC_SUB_DIFF_DEN_MUL1",
        invariantRuleId: "test-rule",
        bindings: {}
    });

    if (!result.ok) {
        console.log(`    -> Error: ${result.errorCode}`);
        return false;
    }

    const latex = result.newExpressionLatex || '';
    console.log(`    -> Output: ${latex}`);

    const hasFrac23 = latex.includes('\\frac{2}{3}');
    const hasFrac15 = latex.includes('\\frac{1}{5}');
    const hasCdot1 = latex.includes('\\cdot 1');
    const hasMinus = latex.includes('-');

    return hasFrac23 && hasFrac15 && hasCdot1 && hasMinus;
});

// --- Test 3: NEGATIVE - fails for same denominator ---
test('NEGATIVE: P.FRAC_ADD_DIFF_DEN_MUL1 fails for same denominator (1/2 + 3/2)', () => {
    const result = PrimitiveRunner.run({
        expressionLatex: "\\frac{1}{2} + \\frac{3}{2}",
        targetPath: "root",
        primitiveId: "P.FRAC_ADD_DIFF_DEN_MUL1",
        invariantRuleId: "test-rule",
        bindings: {}
    });

    // Should fail because denominators are equal
    console.log(`    -> ok=${result.ok}, errorCode=${result.errorCode || 'none'}`);
    return result.ok === false;
});

// --- Test 4: NEGATIVE - fails for non-fraction operands ---
test('NEGATIVE: P.FRAC_ADD_DIFF_DEN_MUL1 fails for non-fraction operand (1 + 1/3)', () => {
    const result = PrimitiveRunner.run({
        expressionLatex: "1 + \\frac{1}{3}",
        targetPath: "root",
        primitiveId: "P.FRAC_ADD_DIFF_DEN_MUL1",
        invariantRuleId: "test-rule",
        bindings: {}
    });

    console.log(`    -> ok=${result.ok}, errorCode=${result.errorCode || 'none'}`);
    return result.ok === false;
});

// --- Test 5: Catalog selection - diff denom addition ---
test('Catalog: Selects P.FRAC_ADD_DIFF_DEN_MUL1 for diff denom addition', () => {
    const ctx: ClickContext = {
        op: "+",
        lhsKind: "frac",
        rhsKind: "frac",
        sameDenominator: false,
        hasZero: false,
        hasOne: false
    };

    const candidates = selectPrimitivesForClick(ctx);
    const match = candidates.find(c => c.primitiveId === "P.FRAC_ADD_DIFF_DEN_MUL1");

    console.log(`    -> Found: ${match ? 'yes' : 'no'}`);
    return match !== undefined;
});

// --- Test 6: Catalog selection - does NOT select for same denom ---
test('Catalog: Does NOT select P.FRAC_ADD_DIFF_DEN_MUL1 for same denominator', () => {
    const ctx: ClickContext = {
        op: "+",
        lhsKind: "frac",
        rhsKind: "frac",
        sameDenominator: true, // <-- Same denom
        hasZero: false,
        hasOne: false
    };

    const candidates = selectPrimitivesForClick(ctx);
    const match = candidates.find(c => c.primitiveId === "P.FRAC_ADD_DIFF_DEN_MUL1");

    console.log(`    -> Found: ${match ? 'yes (BAD)' : 'no (GOOD)'}`);
    return match === undefined;
});

// --- Test 7: Catalog selection - subtraction ---
test('Catalog: Selects P.FRAC_SUB_DIFF_DEN_MUL1 for diff denom subtraction', () => {
    const ctx: ClickContext = {
        op: "-",
        lhsKind: "frac",
        rhsKind: "frac",
        sameDenominator: false,
        hasZero: false,
        hasOne: false
    };

    const candidates = selectPrimitivesForClick(ctx);
    const match = candidates.find(c => c.primitiveId === "P.FRAC_SUB_DIFF_DEN_MUL1");

    console.log(`    -> Found: ${match ? 'yes' : 'no'}`);
    return match !== undefined;
});

// --- Summary ---
console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
    console.log('\n❌ VERIFICATION FAILED');
    process.exit(1);
} else {
    console.log('\n✅ ALL TESTS PASSED');
    process.exit(0);
}

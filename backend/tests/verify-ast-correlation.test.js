/**
 * Test: Verify AST correlation for mixed operator expressions
 * 
 * This test verifies that the Viewer correctly maps operator clicks
 * to AST node IDs for the expression "2 * 5 - 3 * 8 * 4"
 */

import { buildASTFromLatex, enumerateOperators } from '../../viewer/app/ast-parser.js';

console.log("=".repeat(80));
console.log("TEST: AST Correlation for Mixed Operator Expression");
console.log("=".repeat(80));

// Test 1: Parse and augment AST
console.log("\nTest 1: Parse and Augment AST");
console.log("-".repeat(40));

const latex = "2 * 5 - 3 * 8 * 4";
const ast = buildASTFromLatex(latex);

if (!ast) {
    console.error("❌ FAIL: Failed to parse LaTeX");
    process.exit(1);
}

console.log("✅ PASS: AST parsed successfully");
console.log("AST Structure:", JSON.stringify(ast, null, 2));

// Test 2: Enumerate operators
console.log("\nTest 2: Enumerate Operators");
console.log("-".repeat(40));

const operators = enumerateOperators(ast);

console.log(`Found ${operators.length} operators:`);
operators.forEach((op, i) => {
    console.log(`  ${i + 1}. ${op.operator} → nodeId: ${op.nodeId} (position: ${op.position})`);
});

// Expected operators:
// 1. * → term[0] (2 * 5)
// 2. * → term[1].term[0] (3 * 8)
// 3. * → term[1] (outer multiplication)
// 4. - → root (subtraction)

const expectedOperators = [
    { operator: "*", nodeId: "term[0]" },
    { operator: "*", nodeId: "term[1].term[0]" },
    { operator: "*", nodeId: "term[1]" },
    { operator: "-", nodeId: "root" }
];

let allMatch = true;
for (let i = 0; i < expectedOperators.length; i++) {
    const expected = expectedOperators[i];
    const actual = operators[i];

    if (!actual) {
        console.error(`❌ FAIL: Missing operator at position ${i}`);
        allMatch = false;
        continue;
    }

    if (actual.operator !== expected.operator || actual.nodeId !== expected.nodeId) {
        console.error(`❌ FAIL: Operator ${i} mismatch`);
        console.error(`  Expected: ${expected.operator} → ${expected.nodeId}`);
        console.error(`  Actual:   ${actual.operator} → ${actual.nodeId}`);
        allMatch = false;
    } else {
        console.log(`✅ PASS: Operator ${i} matches (${actual.operator} → ${actual.nodeId})`);
    }
}

if (allMatch) {
    console.log("\n✅ ALL TESTS PASSED");
} else {
    console.log("\n❌ SOME TESTS FAILED");
    process.exit(1);
}

// Test 3: Test after simplification
console.log("\nTest 3: After Simplification (10 - 3 * 8 * 4)");
console.log("-".repeat(40));

const latex2 = "10 - 3 * 8 * 4";
const ast2 = buildASTFromLatex(latex2);
const operators2 = enumerateOperators(ast2);

console.log(`Found ${operators2.length} operators:`);
operators2.forEach((op, i) => {
    console.log(`  ${i + 1}. ${op.operator} → nodeId: ${op.nodeId}`);
});

// Test 4: Test final state
console.log("\nTest 4: Final State (10 - 24 * 4)");
console.log("-".repeat(40));

const latex3 = "10 - 24 * 4";
const ast3 = buildASTFromLatex(latex3);
const operators3 = enumerateOperators(ast3);

console.log(`Found ${operators3.length} operators:`);
operators3.forEach((op, i) => {
    console.log(`  ${i + 1}. ${op.operator} → nodeId: ${op.nodeId}`);
});

// Verify that 24 * 4 is now at term[1] (not term[1].term[0])
const multiplyOp = operators3.find(op => op.operator === "*");
if (multiplyOp && multiplyOp.nodeId === "term[1]") {
    console.log("✅ PASS: 24 * 4 correctly mapped to term[1]");
} else {
    console.error("❌ FAIL: 24 * 4 not correctly mapped");
    console.error(`  Expected nodeId: term[1]`);
    console.error(`  Actual nodeId: ${multiplyOp ? multiplyOp.nodeId : 'not found'}`);
}

console.log("\n" + "=".repeat(80));
console.log("TEST COMPLETE");
console.log("=".repeat(80));

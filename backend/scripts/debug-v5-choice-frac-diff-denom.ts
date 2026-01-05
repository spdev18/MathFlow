/**
 * Debug V5 Choice Selection for Fraction Diff Denom
 * 
 * This script goes through the SAME selection pipeline as /api/orchestrator/v5/step
 * to verify that P.FRAC_ADD_DIFF_DEN_MUL1 is selected for fraction+fraction with different denominators.
 * 
 * Run: npx tsx scripts/debug-v5-choice-frac-diff-denom.ts
 */

import { parseExpression, toLatex, getNodeAt } from "../src/mapmaster/ast";
import { PrimitiveRunner } from "../src/engine/primitive.runner";
import { PRIMITIVES_V5_TABLE } from "../src/engine/primitives.registry.v5";

const EXPRESSION = "\\frac{1}{2} + \\frac{1}{3}";
const OPERATOR = "+";
const CLICK_TARGET_KIND = "operator";

console.log("=".repeat(60));
console.log("DEBUG: V5 Choice Selection for Fraction Diff Denom");
console.log("=".repeat(60));
console.log(`Expression: ${EXPRESSION}`);
console.log(`Click Target: ${CLICK_TARGET_KIND}, Operator: ${OPERATOR}`);
console.log("");

// Step 1: Parse AST
const ast = parseExpression(EXPRESSION);
if (!ast) {
    console.error("[FAIL] Could not parse expression");
    process.exit(1);
}
console.log("[1] Parsed AST:");
console.log(`    Type: ${ast.type}`);
if (ast.type === "binaryOp") {
    console.log(`    Operator: ${ast.op}`);
    console.log(`    Left: ${ast.left?.type} ${ast.left?.type === "fraction" ? `(${ast.left.numerator}/${ast.left.denominator})` : ""}`);
    console.log(`    Right: ${ast.right?.type} ${ast.right?.type === "fraction" ? `(${ast.right.numerator}/${ast.right.denominator})` : ""}`);
}
console.log("");

// Step 2: Find matching primitives from V5 table
console.log("[2] Matching primitives from V5 table:");
const matchingPrimitives = PRIMITIVES_V5_TABLE.rows.filter(row => {
    // Must match click target kind
    if (row.clickTargetKind !== CLICK_TARGET_KIND) return false;

    // Must match operator
    if (row.operatorLatex !== OPERATOR) return false;

    // Check operandTypes if specified
    if (row.operandTypes) {
        const leftType = ast.type === "binaryOp" && ast.left?.type;
        const rightType = ast.type === "binaryOp" && ast.right?.type;

        // Map AST types to operandType values
        const mapType = (t: string | undefined | false) => {
            if (t === "fraction") return "fraction";
            if (t === "integer") return "int";
            return t || "unknown";
        };

        const actualLeft = mapType(leftType);
        const actualRight = mapType(rightType);

        if (row.operandTypes.left && row.operandTypes.left !== actualLeft) {
            console.log(`    - ${row.id}: SKIPPED (left operand mismatch: req=${row.operandTypes.left}, actual=${actualLeft})`);
            return false;
        }
        if (row.operandTypes.right && row.operandTypes.right !== actualRight) {
            console.log(`    - ${row.id}: SKIPPED (right operand mismatch: req=${row.operandTypes.right}, actual=${actualRight})`);
            return false;
        }
    }

    return true;
});

console.log(`\n    Found ${matchingPrimitives.length} matching primitives:`);
matchingPrimitives.forEach((p, i) => {
    console.log(`    [${i + 1}] ${p.id} (${p.label})`);
    console.log(`        operandTypes: ${JSON.stringify(p.operandTypes)}`);
    console.log(`        forbiddenGuards: ${JSON.stringify(p.forbiddenGuards)}`);
    console.log(`        requiredGuards: ${JSON.stringify(p.requiredGuards)}`);
});
console.log("");

// Step 3: Expected primitive
const expectedPrimitiveId = "P.FRAC_ADD_DIFF_DEN_MUL1";
const found = matchingPrimitives.find(p => p.id === expectedPrimitiveId);

if (!found) {
    console.error(`[FAIL] Expected primitive ${expectedPrimitiveId} NOT in matching list!`);
    console.log("\nPossible causes:");
    console.log("  - operandTypes not matching fraction+fraction");
    console.log("  - clickTargetKind or operatorLatex mismatch");
    process.exit(1);
}

console.log(`[3] Expected primitive ${expectedPrimitiveId} is in matching list: YES`);
console.log("");

// Step 4: Execute the primitive
console.log("[4] Executing P.FRAC_ADD_DIFF_DEN_MUL1:");
const result = PrimitiveRunner.run({
    expressionLatex: EXPRESSION,
    primitiveId: expectedPrimitiveId,
    targetPath: "root",
    bindings: undefined,
    resultPattern: undefined
});

if (result.ok) {
    console.log(`    Status: SUCCESS`);
    console.log(`    Result: ${result.newExpressionLatex}`);

    // Verify result contains "\cdot 1"
    if (result.newExpressionLatex && result.newExpressionLatex.includes("\\cdot 1")) {
        console.log(`    Contains "\\cdot 1": YES`);
        console.log("\n[PASS] V5 selection and execution working correctly!");
    } else {
        console.log(`    Contains "\\cdot 1": NO`);
        console.error("\n[FAIL] Result does not contain expected '\\cdot 1'");
        process.exit(1);
    }
} else {
    console.error(`    Status: FAILED`);
    console.error(`    Error: ${result.errorCode}`);
    process.exit(1);
}

// Check that DIFF_PREP is NOT matching
console.log("\n[5] Verifying P.FRAC_ADD_DIFF_PREP is excluded:");
const diffPrepMatch = matchingPrimitives.find(p => p.id === "P.FRAC_ADD_DIFF_PREP");
if (diffPrepMatch) {
    console.error(`    [FAIL] P.FRAC_ADD_DIFF_PREP should NOT match fraction+fraction!`);
    process.exit(1);
} else {
    console.log(`    P.FRAC_ADD_DIFF_PREP NOT in matching list: YES (correct)`);
    console.log("\n[PASS] All checks passed!");
}

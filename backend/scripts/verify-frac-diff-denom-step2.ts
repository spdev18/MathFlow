/**
 * Verification Script: Fraction Diff Denom Step 2
 * 
 * Tests P.ONE_TO_TARGET_DENOM: clicking "1" in fraction*1 transforms it to d/d
 * where d is the opposite fraction's denominator.
 * 
 * Expression: \frac{1}{2} \cdot 1 + \frac{1}{3} \cdot 1
 * 
 * Run: npx tsx scripts/verify-frac-diff-denom-step2.ts
 */

import { parseExpression, toLatex, getNodeAt as getNodeAtFn } from "../src/mapmaster/ast";
import { PrimitiveRunner } from "../src/engine/primitive.runner";

// Augment AST with IDs for path resolution
function augmentAstWithIds(root: any) {
    if (!root) return;
    const traverse = (node: any, path: string) => {
        if (!node || typeof node !== 'object') return;
        node.id = path;

        if (node.type === "binaryOp") {
            if (node.left) traverse(node.left, path === "root" ? "term[0]" : `${path}.term[0]`);
            if (node.right) traverse(node.right, path === "root" ? "term[1]" : `${path}.term[1]`);
        }
    };
    traverse(root, "root");
    return root;
}

// DFS to find integer nodes with value "1"
function findIntegerOnes(ast: any): Array<{ path: string, node: any }> {
    const results: Array<{ path: string, node: any }> = [];

    const traverse = (node: any, path: string) => {
        if (!node) return;

        if (node.type === "integer" && node.value === "1") {
            results.push({ path, node });
        }

        if (node.type === "binaryOp") {
            traverse(node.left, path === "root" ? "term[0]" : `${path}.term[0]`);
            traverse(node.right, path === "root" ? "term[1]" : `${path}.term[1]`);
        }
    };

    traverse(ast, "root");
    return results;
}

const EXPRESSION = "\\frac{1}{2} \\cdot 1 + \\frac{1}{3} \\cdot 1";

console.log("=".repeat(70));
console.log("VERIFICATION: Fraction Diff Denom Step 2 (P.ONE_TO_TARGET_DENOM)");
console.log("=".repeat(70));
console.log(`Expression: ${EXPRESSION}`);
console.log("");

// Step 1: Parse and augment AST
const ast = parseExpression(EXPRESSION);
if (!ast) {
    console.error("[FAIL] Could not parse expression");
    process.exit(1);
}
augmentAstWithIds(ast);

console.log("[1] Parsed AST structure:");
console.log(`    Root: ${ast.type} (id: ${ast.id})`);
if (ast.type === "binaryOp") {
    console.log(`    Operator: ${ast.op}`);
    console.log(`    Left: ${ast.left?.type} (id: ${ast.left?.id})`);
    console.log(`    Right: ${ast.right?.type} (id: ${ast.right?.id})`);
}
console.log("");

// Step 2: Find all "1" integers
const ones = findIntegerOnes(ast);
console.log(`[2] Found ${ones.length} integer "1" nodes:`);
ones.forEach((o, i) => {
    console.log(`    [${i}] path="${o.path}" value="${o.node.value}"`);
});
console.log("");

if (ones.length < 2) {
    console.error("[FAIL] Expected at least 2 integer '1' nodes");
    process.exit(1);
}

// Step 3: Test clicking the LEFT "1" (should become 3/3)
console.log("[3] Testing click on LEFT '1' (should become 3/3):");
const leftOnePath = ones[0].path;
console.log(`    Target path: ${leftOnePath}`);

const resultLeft = PrimitiveRunner.run({
    expressionLatex: EXPRESSION,
    primitiveId: "P.ONE_TO_TARGET_DENOM",
    targetPath: leftOnePath,
    bindings: undefined,
    resultPattern: undefined
});

if (resultLeft.ok) {
    console.log(`    Status: SUCCESS`);
    console.log(`    Result: ${resultLeft.newExpressionLatex}`);

    if (resultLeft.newExpressionLatex?.includes("\\frac{3}{3}")) {
        console.log(`    Contains "\\frac{3}{3}": YES`);
    } else {
        console.error(`    Contains "\\frac{3}{3}": NO`);
        console.error("[FAIL] Left '1' should become 3/3 (opposite denom is 3)");
        process.exit(1);
    }
} else {
    console.error(`    Status: FAILED`);
    console.error(`    Error: ${resultLeft.errorCode}`);
    process.exit(1);
}
console.log("");

// Step 4: Test clicking the RIGHT "1" (should become 2/2)
console.log("[4] Testing click on RIGHT '1' (should become 2/2):");
const rightOnePath = ones[1].path;
console.log(`    Target path: ${rightOnePath}`);

const resultRight = PrimitiveRunner.run({
    expressionLatex: EXPRESSION,
    primitiveId: "P.ONE_TO_TARGET_DENOM",
    targetPath: rightOnePath,
    bindings: undefined,
    resultPattern: undefined
});

if (resultRight.ok) {
    console.log(`    Status: SUCCESS`);
    console.log(`    Result: ${resultRight.newExpressionLatex}`);

    if (resultRight.newExpressionLatex?.includes("\\frac{2}{2}")) {
        console.log(`    Contains "\\frac{2}{2}": YES`);
    } else {
        console.error(`    Contains "\\frac{2}{2}": NO`);
        console.error("[FAIL] Right '1' should become 2/2 (opposite denom is 2)");
        process.exit(1);
    }
} else {
    console.error(`    Status: FAILED`);
    console.error(`    Error: ${resultRight.errorCode}`);
    process.exit(1);
}
console.log("");

console.log("=".repeat(70));
console.log("[PASS] All Step 2 tests passed!");
console.log("=".repeat(70));
console.log("");
console.log("Summary:");
console.log(`  - Click left '1':  becomes \\frac{3}{3} (opposite denom = 3)`);
console.log(`  - Click right '1': becomes \\frac{2}{2} (opposite denom = 2)`);

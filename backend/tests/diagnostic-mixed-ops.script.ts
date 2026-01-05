import { parseExpression, toLatex } from '../src/mapmaster/ast';
import { NodeContextBuilder } from '../src/engine/v5/NodeContextBuilder';
import { PrimitiveMatcher } from '../src/engine/v5/PrimitiveMatcher';
import { PRIMITIVES_V5_TABLE } from '../src/engine/primitives.registry.v5';
import { PrimitiveSelector } from '../src/engine/v5/PrimitiveSelector';
import { PrimitiveRunner } from '../src/engine/primitive.runner';

console.log("=".repeat(80));
console.log("DIAGNOSTIC: Linear Mixed-Operator Expression Handling");
console.log("Expression: 2 * 5 - 3 * 8 * 4");
console.log("=".repeat(80));

// Augment AST with IDs
function augmentAstWithIds(root: any) {
    if (!root) return;
    const traverse = (node: any, path: string) => {
        if (!node) return;
        node.id = path;
        if (node.type === "binaryOp") {
            traverse(node.left, path === "root" ? "term[0]" : `${path}.term[0]`);
            traverse(node.right, path === "root" ? "term[1]" : `${path}.term[1]`);
        }
    };
    traverse(root, "root");
    return root;
}

// Simulate a click and return diagnostic info
function simulateClick(latex: string, nodeId: string, kind: string = "operator") {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`SIMULATING CLICK: nodeId="${nodeId}", kind="${kind}"`);
    console.log(`Expression: ${latex}`);
    console.log(`${"=".repeat(80)}`);

    const ast = parseExpression(latex);
    if (!ast) {
        console.error("Parse failed!");
        return;
    }

    augmentAstWithIds(ast);
    console.log("\nAST Structure:");
    console.log(JSON.stringify(ast, null, 2));

    // Build context
    const builder = new NodeContextBuilder();
    const click = { nodeId, kind };
    const ctx = builder.buildContext({
        expressionId: "test",
        ast: ast,
        click: click as any
    });

    console.log("\nNodeContext:");
    console.log(`  nodeId: ${ctx.nodeId}`);
    console.log(`  operatorLatex: ${ctx.operatorLatex}`);
    console.log(`  leftOperandType: ${ctx.leftOperandType}`);
    console.log(`  rightOperandType: ${ctx.rightOperandType}`);
    console.log(`  actionNodeId: ${ctx.actionNodeId}`);
    console.log(`  guards:`, ctx.guards);

    // Match primitives
    const matcher = new PrimitiveMatcher();
    const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });

    console.log(`\nMatched Primitives: ${matches.length}`);
    matches.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.row.id} (${m.row.color}) - ${m.row.label}`);
    });

    // Select primitive
    const selector = new PrimitiveSelector();
    const outcome = selector.select(matches);

    console.log(`\nSelected Outcome:`);
    console.log(`  kind: ${outcome.kind}`);
    console.log(`  primitive: ${outcome.primitive?.id || "none"}`);

    if (outcome.primitive) {
        // Try to run
        const res = PrimitiveRunner.run({
            expressionLatex: latex,
            primitiveId: outcome.primitive.id,
            targetPath: nodeId,
            sessionId: "test",
            courseId: "test",
            bindings: {},
            resultPattern: ""
        } as any);

        console.log(`\nExecution Result:`);
        console.log(`  ok: ${res.ok}`);
        console.log(`  newExpressionLatex: ${res.newExpressionLatex || "null"}`);
        console.log(`  errorCode: ${res.errorCode || "null"}`);

        return res.newExpressionLatex;
    }

    return null;
}

// Test Scenario 1: Click on first multiplication (2 * 5)
console.log("\n\n" + "#".repeat(80));
console.log("SCENARIO 1: Click on first multiplication (2 * 5)");
console.log("#".repeat(80));
const result1 = simulateClick("2 * 5 - 3 * 8 * 4", "term[0]", "operator");

// Test Scenario 2: Click on second multiplication (3 * 8)
console.log("\n\n" + "#".repeat(80));
console.log("SCENARIO 2: Click on second multiplication (3 * 8)");
console.log("#".repeat(80));
const result2 = simulateClick("2 * 5 - 3 * 8 * 4", "term[1].term[0]", "operator");

// Test Scenario 3: Click on third multiplication (8 * 4)
console.log("\n\n" + "#".repeat(80));
console.log("SCENARIO 3: Click on third multiplication (8 * 4)");
console.log("#".repeat(80));
const result3 = simulateClick("2 * 5 - 3 * 8 * 4", "term[1]", "operator");

// Test Scenario 4: After first step (10 - 3 * 8 * 4), click on 3 * 8
if (result1) {
    console.log("\n\n" + "#".repeat(80));
    console.log("SCENARIO 4: After 2*5→10, click on 3 * 8");
    console.log("#".repeat(80));
    const result4 = simulateClick(result1, "term[1].term[0]", "operator");

    // Test Scenario 5: After 3*8→24 (10 - 24 * 4), click on 24 * 4
    if (result4) {
        console.log("\n\n" + "#".repeat(80));
        console.log("SCENARIO 5: After 3*8→24 (10 - 24 * 4), click on 24 * 4");
        console.log("#".repeat(80));
        simulateClick(result4, "term[1]", "operator");
    }
}

console.log("\n\n" + "=".repeat(80));
console.log("DIAGNOSTIC COMPLETE");
console.log("=".repeat(80));

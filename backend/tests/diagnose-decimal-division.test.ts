import { test, expect } from 'vitest';
import { parseExpression } from '../src/mapmaster/ast';
import { NodeContextBuilder } from '../src/engine/v5/NodeContextBuilder';
import { PrimitiveMatcher } from '../src/engine/v5/PrimitiveMatcher';
import { PRIMITIVES_V5_TABLE } from '../src/engine/primitives.registry.v5';
import { PrimitiveSelector } from '../src/engine/v5/PrimitiveSelector';
import { PrimitiveRunner } from '../src/engine/primitive.runner'; // Adjust path if needed

// Replicate the orchestrator's augmentAstWithIds function (the fixed version)
function augmentAstWithIds(root: any) {
    if (!root) return;

    const traverse = (node: any, path: string) => {
        if (!node || typeof node !== 'object') return;

        // Assign ID to this node
        node.id = path;

        // Handle different node types
        switch (node.type) {
            case "binaryOp":
                if (node.left) {
                    traverse(node.left, path === "root" ? "term[0]" : `${path}.term[0]`);
                }
                if (node.right) {
                    traverse(node.right, path === "root" ? "term[1]" : `${path}.term[1]`);
                }
                break;

            case "fraction":
            case "mixed":
            case "integer":
            case "variable":
                // Leaf nodes or nodes with string children
                break;

            default:
                if (node.left) traverse(node.left, `${path}.left`);
                if (node.right) traverse(node.right, `${path}.right`);
                break;
        }
    };

    traverse(root, "root");
    return root;
}

async function diagnoseDecimal(latex: string, desc: string) {
    console.log(`\n--- DIAGNOSING: ${desc} [ ${latex} ] ---`);
    const ast = parseExpression(latex);
    if (!ast) {
        console.error("Failed to parse");
        return;
    }

    // 1. AST Analysis
    augmentAstWithIds(ast);
    const root = ast as any;
    console.log(`[AST] Type: ${root.type}, Op: ${root.op}`);
    if (root.left) console.log(`[AST] Left: type=${root.left.type}, value="${root.left.value}"`);
    if (root.right) console.log(`[AST] Right: type=${root.right.type}, value="${root.right.value}"`);

    // 2. NodeContext
    const clickTarget = { nodeId: "root", kind: "operator" };
    const builder = new NodeContextBuilder();
    const ctx = builder.buildContext({
        expressionId: "diag",
        ast: ast,
        click: clickTarget
    });

    console.log("[CTX] Operator:", ctx.operatorLatex);
    console.log("[CTX] Operand Types:", ctx.leftOperandType, ctx.rightOperandType);
    console.log("[CTX] Guards:", JSON.stringify(ctx.guards, null, 2));

    // 3. Matcher
    const matcher = new PrimitiveMatcher();
    const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });

    console.log(`[MATCHER] Found ${matches.length} candidates:`);
    matches.forEach(m => {
        console.log(`  - ${m.row.id} (${m.color})`);
    });

    if (matches.length === 0) {
        console.log("[MATCHER] No candidates found. Identifying rejections...");
        // Hacky way to see rejections? No, we just deduce from requirements.
        // We can inspect the table manually in the report.
    }

    // 4. Selector
    const selector = new PrimitiveSelector();
    const outcome = selector.select(matches);
    console.log(`[SELECTOR] Outcome kind: ${outcome.kind}`);
    if (outcome.primitive) {
        console.log(`[SELECTOR] Selected: ${outcome.primitive.id}`);

        // 5. Runner (if selected)
        // We need to mock the EngineStepExecutionRequest
        // This part is tricky without a full mock environment, but checking selection is usually enough for this diagnostic.
        // If strict guards fail, we won't even get here.
    } else {
        console.log("[SELECTOR] No primitive selected.");
    }
}

test('Diagnose Decimal Division Scenarios', async () => {
    await diagnoseDecimal("12.5 \\div 0.5", "Exact Decimal Division");
    await diagnoseDecimal("12.5 \\div 0.75", "Non-integer Quotient");
    await diagnoseDecimal("1.5 \\div 0.25", "Small Exact Decimal");
    await diagnoseDecimal("12.5 \\div 5", "Decimal div Integer");
    await diagnoseDecimal("5 \\div 0.5", "Integer div Decimal");
});

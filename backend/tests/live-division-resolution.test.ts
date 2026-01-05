import { test, expect } from 'vitest';
import { parseExpression } from '../src/mapmaster/ast';
import { NodeContextBuilder } from '../src/engine/v5/NodeContextBuilder';
import { PrimitiveMatcher } from '../src/engine/v5/PrimitiveMatcher';
import { PRIMITIVES_V5_TABLE } from '../src/engine/primitives.registry.v5';
import { PrimitiveSelector } from '../src/engine/v5/PrimitiveSelector';

/**
 * This test simulates the LIVE pipeline flow:
 * 1. Parse expression to AST
 * 2. Augment AST with IDs (like orchestrator does)
 * 3. Resolve click target
 * 4. Build NodeContext
 * 5. Match primitives
 * 6. Select primitive
 * 
 * This ensures division works end-to-end in LIVE environment.
 */

// Replicate the orchestrator's augmentAstWithIds function
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

test('LIVE-like: 15 div 5 -> P.INT_DIV_EXACT with correct guards', () => {
    const latex = "15 \\div 5";
    const ast = parseExpression(latex);
    expect(ast).toBeDefined();

    // Augment like orchestrator does
    augmentAstWithIds(ast);

    // Simulate click on root (the division operator)
    const clickTarget = { nodeId: "root", kind: "operator" };

    // Build context
    const builder = new NodeContextBuilder();
    const ctx = builder.buildContext({
        expressionId: "test",
        ast: ast!,
        click: clickTarget
    });

    // Verify context
    expect(ctx.operatorLatex).toBe("\\div");
    expect(ctx.leftOperandType).toBe("int");
    expect(ctx.rightOperandType).toBe("int");
    expect(ctx.guards["divisor-nonzero"]).toBe(true);
    expect(ctx.guards["remainder-zero"]).toBe(true);
    expect(ctx.guards["remainder-nonzero"]).toBe(false);

    // Match
    const matcher = new PrimitiveMatcher();
    const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });

    // Should find P.INT_DIV_EXACT
    const exactMatch = matches.find(m => m.row.id === "P.INT_DIV_EXACT");
    expect(exactMatch).toBeDefined();

    // Select
    const selector = new PrimitiveSelector();
    const outcome = selector.select(matches);

    expect(outcome.kind).toBe("green-primitive");
    expect(outcome.primitive?.id).toBe("P.INT_DIV_EXACT");
});

test('LIVE-like: 12 div 5 -> P.INT_DIV_TO_FRAC with correct guards', () => {
    const latex = "12 \\div 5";
    const ast = parseExpression(latex);
    expect(ast).toBeDefined();

    augmentAstWithIds(ast);
    const clickTarget = { nodeId: "root", kind: "operator" };

    const builder = new NodeContextBuilder();
    const ctx = builder.buildContext({
        expressionId: "test",
        ast: ast!,
        click: clickTarget
    });

    expect(ctx.operatorLatex).toBe("\\div");
    expect(ctx.leftOperandType).toBe("int");
    expect(ctx.rightOperandType).toBe("int");
    expect(ctx.guards["divisor-nonzero"]).toBe(true);
    expect(ctx.guards["remainder-zero"]).toBe(false);
    expect(ctx.guards["remainder-nonzero"]).toBe(true);

    const matcher = new PrimitiveMatcher();
    const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });

    const fracMatch = matches.find(m => m.row.id === "P.INT_DIV_TO_FRAC");
    expect(fracMatch).toBeDefined();

    const selector = new PrimitiveSelector();
    const outcome = selector.select(matches);

    expect(outcome.kind).toBe("green-primitive");
    expect(outcome.primitive?.id).toBe("P.INT_DIV_TO_FRAC");
});

test('LIVE-like: 1/2 div 3/5 -> P.FRAC_DIV_AS_MUL', () => {
    const latex = "\\frac{1}{2} \\div \\frac{3}{5}";
    const ast = parseExpression(latex);
    expect(ast).toBeDefined();

    augmentAstWithIds(ast);
    const clickTarget = { nodeId: "root", kind: "operator" };

    const builder = new NodeContextBuilder();
    const ctx = builder.buildContext({
        expressionId: "test",
        ast: ast!,
        click: clickTarget
    });

    expect(ctx.operatorLatex).toBe("\\div");
    expect(ctx.leftOperandType).toBe("fraction");
    expect(ctx.rightOperandType).toBe("fraction");

    const matcher = new PrimitiveMatcher();
    const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });

    const fracDivMatch = matches.find(m => m.row.id === "P.FRAC_DIV_AS_MUL");
    expect(fracDivMatch).toBeDefined();

    const selector = new PrimitiveSelector();
    const outcome = selector.select(matches);

    expect(outcome.kind).toBe("green-primitive");
    expect(outcome.primitive?.id).toBe("P.FRAC_DIV_AS_MUL");
});

test('LIVE-like: 10 div 0 -> P.DIV_BY_ZERO', () => {
    const latex = "10 \\div 0";
    const ast = parseExpression(latex);
    expect(ast).toBeDefined();

    augmentAstWithIds(ast);
    const clickTarget = { nodeId: "root", kind: "operator" };

    const builder = new NodeContextBuilder();
    const ctx = builder.buildContext({
        expressionId: "test",
        ast: ast!,
        click: clickTarget
    });

    expect(ctx.operatorLatex).toBe("\\div");
    expect(ctx.guards["divisor-zero"]).toBe(true);
    expect(ctx.guards["divisor-nonzero"]).toBe(false);

    const matcher = new PrimitiveMatcher();
    const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });

    const divByZeroMatch = matches.find(m => m.row.id === "P.DIV_BY_ZERO");
    expect(divByZeroMatch).toBeDefined();

    const selector = new PrimitiveSelector();
    const outcome = selector.select(matches);

    // Red diagnostic should be selected over other matches
    expect(outcome.kind).toBe("red-diagnostic");
    expect(outcome.primitive?.id).toBe("P.DIV_BY_ZERO");
});

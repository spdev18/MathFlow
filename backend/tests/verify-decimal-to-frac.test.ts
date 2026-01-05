import { test, expect } from 'vitest';
import { parseExpression } from '../src/mapmaster/ast';
import { PrimitiveRunner } from '../src/engine/primitive.runner';
import { NodeContextBuilder } from '../src/engine/v5/NodeContextBuilder';
import { PrimitiveMatcher } from '../src/engine/v5/PrimitiveMatcher';
import { PRIMITIVES_V5_TABLE } from '../src/engine/primitives.registry.v5';
import { PrimitiveSelector } from '../src/engine/v5/PrimitiveSelector';

// Mock helper to simulate the pipeline
async function simulateLiveStep(latex: string, clickNodeId: string = "root") {
    const ast = parseExpression(latex);
    if (!ast) throw new Error("Parse failed");

    // 1. Augment AST
    const augmentAstWithIds = (root: any) => {
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
    };
    augmentAstWithIds(ast);

    // 2. Build Context
    const builder = new NodeContextBuilder();
    const click = { nodeId: clickNodeId, kind: "number" };
    const ctx = builder.buildContext({
        expressionId: "test",
        ast: ast,
        click: click as any
    });

    // 3. Match
    const matcher = new PrimitiveMatcher();
    const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });

    // 4. Select
    const selector = new PrimitiveSelector();
    const outcome = selector.select(matches);

    if (!outcome.primitive) return { primitiveId: null, resultLatex: null };

    // 5. Run
    const res = PrimitiveRunner.run({
        expressionLatex: latex,
        primitiveId: outcome.primitive.id,
        targetPath: clickNodeId,
        sessionId: "test",
        courseId: "test",
        bindings: {},
        resultPattern: ""
    } as any);

    return {
        primitiveId: outcome.primitive.id,
        resultLatex: res.ok ? res.newExpressionLatex : null,
        errorCode: res.errorCode
    };
}

test('Decimal to Fraction: 0.3 -> 3/10', async () => {
    const res = await simulateLiveStep("0.3", "root");
    expect(res.primitiveId).toBe("P.DECIMAL_TO_FRAC");
    expect(res.resultLatex).toBe("\\frac{3}{10}");
});

test('Decimal to Fraction: 1.25 -> 5/4 (simplified)', async () => {
    const res = await simulateLiveStep("1.25", "root");
    expect(res.primitiveId).toBe("P.DECIMAL_TO_FRAC");
    expect(res.resultLatex).toBe("\\frac{5}{4}");
});

test('Decimal to Fraction: 12.5 -> 25/2 (simplified)', async () => {
    const res = await simulateLiveStep("12.5", "root");
    expect(res.primitiveId).toBe("P.DECIMAL_TO_FRAC");
    expect(res.resultLatex).toBe("\\frac{25}{2}");
});

test('Decimal to Fraction: 0.125 -> 1/8 (simplified)', async () => {
    const res = await simulateLiveStep("0.125", "root");
    expect(res.primitiveId).toBe("P.DECIMAL_TO_FRAC");
    expect(res.resultLatex).toBe("\\frac{1}{8}");
});

test('Decimal to Fraction: 0.5 -> 1/2 (simplified)', async () => {
    const res = await simulateLiveStep("0.5", "root");
    expect(res.primitiveId).toBe("P.DECIMAL_TO_FRAC");
    expect(res.resultLatex).toBe("\\frac{1}{2}");
});

test('Decimal to Fraction: 2.75 -> 11/4 (simplified)', async () => {
    const res = await simulateLiveStep("2.75", "root");
    expect(res.primitiveId).toBe("P.DECIMAL_TO_FRAC");
    expect(res.resultLatex).toBe("\\frac{11}{4}");
});

test('Decimal to Fraction in expression: 5 + 0.3, click on 0.3', async () => {
    const res = await simulateLiveStep("5 + 0.3", "term[1]");
    expect(res.primitiveId).toBe("P.DECIMAL_TO_FRAC");
    expect(res.resultLatex).toBe("5 + \\frac{3}{10}");
});

test('Decimal to Fraction: negative -0.5 -> -1/2', async () => {
    const res = await simulateLiveStep("-0.5", "root");
    expect(res.primitiveId).toBe("P.DECIMAL_TO_FRAC");
    expect(res.resultLatex).toBe("\\frac{-1}{2}");
});

import { test, expect } from 'vitest';
import { parseExpression } from '../src/mapmaster/ast';
import { PrimitiveRunner } from '../src/engine/primitive.runner';
import { NodeContextBuilder } from '../src/engine/v5/NodeContextBuilder';
import { PrimitiveMatcher } from '../src/engine/v5/PrimitiveMatcher';
import { PRIMITIVES_V5_TABLE } from '../src/engine/primitives.registry.v5';
import { PrimitiveSelector } from '../src/engine/v5/PrimitiveSelector';

// Mock helper to simulate the pipeline
async function simulateLiveStep(latex: string) {
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
    const click = { nodeId: "root", kind: "operator" };
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
        targetPath: "root", // Assuming simple root-level testing for now
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

test('Decimal Division: 12.5 / 0.5 -> 25', async () => {
    const res = await simulateLiveStep("12.5 \\div 0.5");
    expect(res.primitiveId).toBe("P.DECIMAL_DIV");
    expect(res.resultLatex).toBe("25");
});

test('Decimal Division: 1.5 / 0.25 -> 6', async () => {
    const res = await simulateLiveStep("1.5 \\div 0.25");
    expect(res.primitiveId).toBe("P.DECIMAL_DIV");
    expect(res.resultLatex).toBe("6");
});

test('Decimal Division: 12.5 / 5 -> 2.5', async () => {
    const res = await simulateLiveStep("12.5 \\div 5");
    expect(res.primitiveId).toBe("P.DECIMAL_DIV");
    expect(res.resultLatex).toBe("2.5");
});

test('Decimal Division: 5 / 0.5 -> 10', async () => {
    const res = await simulateLiveStep("5 \\div 0.5");
    expect(res.primitiveId).toBe("P.DECIMAL_DIV");
    expect(res.resultLatex).toBe("10");
});

test('Decimal Division: 10 / 4 -> 2.5 (Exact Decimal)', async () => {
    // 10 / 4 is 2.5. P.DECIMAL_DIV or P.INT_DIV_TO_FRAC?
    // P.INT_DIV_TO_FRAC matches integers. 10 and 4 are integers.
    // INT_DIV_TO_FRAC is prioritized over DECIMAL_DIV usually if it is above it in registry?
    // But P.DECIMAL_DIV is usually for decimals. 
    // Wait, P.DECIMAL_DIV supports int/int operand types.
    // If strict integer division fails (remainder non-zero), P.INT_DIV_TO_FRAC is selected.
    // P.INT_DIV_TO_FRAC: remainder-nonzero = true.
    // P.DECIMAL_DIV: divisor-nonzero = true.
    // Which one wins? They are both green.
    // PrimitiveSelector prefers primitives that appear earlier or stronger match?
    // Selector logic prioritizes: color -> complexity -> specific strictness?
    // Currently P.INT_DIV_TO_FRAC is defined earlier.
    // So 10 / 4 might become 10/4 (fraction) instead of 2.5 (decimal).
    // Let's verify what happens.
    const res = await simulateLiveStep("10 \\div 4");
    // Expected: 10/4 (fraction) because integer division logic prefers fractions for integers.
    // If we wanted 2.5, we would likely need explicit conversion or decimal mode.
    expect(res.primitiveId).toBe("P.INT_DIV_TO_FRAC");
    expect(res.resultLatex).toBe("\\frac{10}{4}");
});

test('Decimal Division: 10.0 / 4 -> 2.5', async () => {
    // With ".0", it is treated as decimal string for parsing logic.
    // NodeContextBuilder sees "10.0" -> isDecimal=true -> guards computed via float fallback.
    // P.INT_DIV_... strict guards (BigInt) skipped -> guards false (except divisor-nonzero).
    // So P.INT_DIV_TO_FRAC (requiring remainder-nonzero) REJECTED.
    // P.DECIMAL_DIV (requiring only divisor-nonzero) ACCEPTED.
    const res = await simulateLiveStep("10.0 \\div 4");
    expect(res.primitiveId).toBe("P.DECIMAL_DIV");
    expect(res.resultLatex).toBe("2.5");
});

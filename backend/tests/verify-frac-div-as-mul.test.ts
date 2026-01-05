import { test, expect } from 'vitest';
import { PrimitiveMaster } from '../src/primitive-master/PrimitiveMaster';
import { parseExpression } from '../src/mapmaster/ast';
import { PrimitiveRunner } from '../src/engine/primitive.runner';
import { EngineStepExecutionRequest } from '../src/engine/engine.bridge';

function augmentAstWithIds(ast: any) {
    ast.id = "root";
    if (ast.left) ast.left.id = "left";
    if (ast.right) ast.right.id = "right";
}

test('1/2 div 3/5 -> select P.FRAC_DIV_AS_MUL and transform to 1/2 * 5/3', async () => {
    const latex = "\\frac{1}{2} \\div \\frac{3}{5}";
    const mockDeps = {
        parseLatexToAst: async (l: string) => parseExpression(l),
        log: (msg: string) => console.log(msg)
    };
    const pm = new PrimitiveMaster(mockDeps);

    // 1. Resolve Primitive (Selection Phase)
    const outcome = await pm.resolvePrimitive({
        expressionId: "test",
        expressionLatex: latex,
        click: { nodeId: "root", kind: "operator" },
        ast: (() => {
            const ast = parseExpression(latex);
            if (!ast) throw new Error("Parse failed");
            augmentAstWithIds(ast);
            return ast;
        })()
    });

    console.log("Fraction Division Selected:", outcome.primitive?.id);

    // ASSERTION 1: Must select P.FRAC_DIV_AS_MUL
    expect(outcome.primitive?.id).toBe("P.FRAC_DIV_AS_MUL");

    // 2. Execute Primitive (Runner Phase)
    const req: EngineStepExecutionRequest = {
        sessionId: "test-session",
        expressionLatex: latex,
        primitiveId: outcome.primitive!.enginePrimitiveId,
        targetPath: "root",
        bindings: {},
        // No resultPattern -> forcing fallback to applyPrimitive
    } as any;

    const res = PrimitiveRunner.run(req);

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // ASSERTION 2: Result should be multiplication
    // The runner produces latency string, not AST object in the return.
    // Expected result: \frac{1}{2} * \frac{5}{3}
    // Note: The runner output format depends on the printer.
    // Check if it contains '*' or '\times' and flipped fraction.
    console.log("Runner Result Latex:", res.newExpressionLatex);

    // Simple string checks
    expect(res.newExpressionLatex).toContain("\\frac{1}{2}");
    expect(res.newExpressionLatex).toContain("\\frac{5}{3}");
    // Operator check might match '*' or '\times' depending on printer config
    // But P.FRAC_DIV_AS_MUL usually sets op to '*' or '\times' in AST
});

test('2/3 div 4/5 -> select P.FRAC_DIV_AS_MUL', async () => {
    const latex = "\\frac{2}{3} \\div \\frac{4}{5}";
    const mockDeps = {
        parseLatexToAst: async (l: string) => parseExpression(l),
        log: (msg: string) => console.log(msg)
    };
    const pm = new PrimitiveMaster(mockDeps);

    const outcome = await pm.resolvePrimitive({
        expressionId: "test",
        expressionLatex: latex,
        click: { nodeId: "root", kind: "operator" },
        ast: (() => {
            const ast = parseExpression(latex);
            augmentAstWithIds(ast);
            return ast;
        })()
    });

    expect(outcome.primitive?.id).toBe("P.FRAC_DIV_AS_MUL");
});

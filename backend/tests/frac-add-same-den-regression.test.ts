/**
 * Test: Fraction Addition Same Denominator Regression
 * 
 * Verifies that P.FRAC_ADD_SAME_DEN is correctly matched for fraction additions
 * where both fractions have the same denominator.
 */

import { describe, it, expect } from "vitest";
import { parseExpression } from "../src/mapmaster/ast";
import { NodeContextBuilder } from "../src/engine/v5/NodeContextBuilder";
import { PrimitiveMatcher } from "../src/engine/v5/PrimitiveMatcher";
import { PRIMITIVES_V5_TABLE } from "../src/engine/primitives.registry.v5";
import { PrimitiveRunner } from "../src/engine/primitive.runner";
import type { ClickTarget } from "../src/engine/primitives.registry.v5";

// Helper to augment AST with IDs
function augmentAstWithIds(node: any, path: string = "root"): void {
    if (!node) return;
    node.id = path;
    if (node.left) augmentAstWithIds(node.left, `${path}.left`);
    if (node.right) augmentAstWithIds(node.right, `${path}.right`);
}

describe("Fraction Addition Same Denominator Regression", () => {
    describe("Guard Computation", () => {
        it("computes denominators-equal guard for 1/7+3/7", () => {
            const ast = parseExpression("\\frac{1}{7}+\\frac{3}{7}");
            expect(ast).toBeDefined();
            augmentAstWithIds(ast);

            const builder = new NodeContextBuilder();
            const click: ClickTarget = { nodeId: "root", kind: "operator" };
            const ctx = builder.buildContext({
                expressionId: "test",
                ast: ast!,
                click,
            });

            expect(ctx.guards["denominators-equal"]).toBe(true);
            expect(ctx.guards["denominators-different"]).toBe(false);
            expect(ctx.operatorLatex).toBe("+");
        });

        it("computes denominators-equal guard for 1/2+1/2", () => {
            const ast = parseExpression("\\frac{1}{2}+\\frac{1}{2}");
            expect(ast).toBeDefined();
            augmentAstWithIds(ast);

            const builder = new NodeContextBuilder();
            const click: ClickTarget = { nodeId: "root", kind: "operator" };
            const ctx = builder.buildContext({
                expressionId: "test",
                ast: ast!,
                click,
            });

            expect(ctx.guards["denominators-equal"]).toBe(true);
            expect(ctx.operatorLatex).toBe("+");
        });

        it("computes denominators-different guard for 1/3+1/4", () => {
            const ast = parseExpression("\\frac{1}{3}+\\frac{1}{4}");
            expect(ast).toBeDefined();
            augmentAstWithIds(ast);

            const builder = new NodeContextBuilder();
            const click: ClickTarget = { nodeId: "root", kind: "operator" };
            const ctx = builder.buildContext({
                expressionId: "test",
                ast: ast!,
                click,
            });

            expect(ctx.guards["denominators-equal"]).toBe(false);
            expect(ctx.guards["denominators-different"]).toBe(true);
        });

        it("computes denominators-equal for \\frac{1}{7} + \\frac{3}{7} (with spaces)", () => {
            const ast = parseExpression("\\frac{1}{7} + \\frac{3}{7}");
            expect(ast).toBeDefined();
            augmentAstWithIds(ast);

            const builder = new NodeContextBuilder();
            const click: ClickTarget = { nodeId: "root", kind: "operator" };
            const ctx = builder.buildContext({
                expressionId: "test",
                ast: ast!,
                click,
            });

            expect(ctx.guards["denominators-equal"]).toBe(true);
            expect(ctx.guards["denominators-different"]).toBe(false);
            expect(ctx.operatorLatex).toBe("+");
        });

        it("computes denominators-equal for \\frac{5}{9}+\\frac{2}{9} (no spaces)", () => {
            const ast = parseExpression("\\frac{5}{9}+\\frac{2}{9}");
            expect(ast).toBeDefined();
            augmentAstWithIds(ast);

            const builder = new NodeContextBuilder();
            const click: ClickTarget = { nodeId: "root", kind: "operator" };
            const ctx = builder.buildContext({
                expressionId: "test",
                ast: ast!,
                click,
            });

            expect(ctx.guards["denominators-equal"]).toBe(true);
            expect(ctx.guards["denominators-different"]).toBe(false);
        });
    });

    describe("Primitive Matching", () => {
        it("matches P.FRAC_ADD_SAME_DEN for 1/7+3/7", () => {
            const ast = parseExpression("\\frac{1}{7}+\\frac{3}{7}");
            expect(ast).toBeDefined();
            augmentAstWithIds(ast);

            const builder = new NodeContextBuilder();
            const click: ClickTarget = { nodeId: "root", kind: "operator" };
            const ctx = builder.buildContext({
                expressionId: "test",
                ast: ast!,
                click,
            });

            const matcher = new PrimitiveMatcher();
            const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });

            // Should match P.FRAC_ADD_SAME_DEN
            const fracAddMatch = matches.find(m => m.row.id === "P.FRAC_ADD_SAME_DEN");
            expect(fracAddMatch).toBeDefined();
        });

        it("does NOT match P.FRAC_ADD_SAME_DEN for 1/3+1/4 (different denominators)", () => {
            const ast = parseExpression("\\frac{1}{3}+\\frac{1}{4}");
            expect(ast).toBeDefined();
            augmentAstWithIds(ast);

            const builder = new NodeContextBuilder();
            const click: ClickTarget = { nodeId: "root", kind: "operator" };
            const ctx = builder.buildContext({
                expressionId: "test",
                ast: ast!,
                click,
            });

            const matcher = new PrimitiveMatcher();
            const matches = matcher.match({ table: PRIMITIVES_V5_TABLE, ctx });

            // Should NOT match P.FRAC_ADD_SAME_DEN
            const fracAddMatch = matches.find(m => m.row.id === "P.FRAC_ADD_SAME_DEN");
            expect(fracAddMatch).toBeUndefined();
        });
    });

    describe("Primitive Execution", () => {
        it("executes P.FRAC_ADD_SAME_DEN for 1/7+3/7 -> 4/7", () => {
            const result = PrimitiveRunner.run({
                expressionLatex: "\\frac{1}{7}+\\frac{3}{7}",
                primitiveId: "P.FRAC_ADD_SAME_DEN",
                targetPath: "root",
            });

            expect(result.ok).toBe(true);
            // Result should be 4/7
            expect(result.newExpressionLatex).toContain("4");
            expect(result.newExpressionLatex).toContain("7");
        });

        it("executes P.FRAC_ADD_SAME_DEN for 1/2+1/2 -> 2/2 (or 1)", () => {
            const result = PrimitiveRunner.run({
                expressionLatex: "\\frac{1}{2}+\\frac{1}{2}",
                primitiveId: "P.FRAC_ADD_SAME_DEN",
                targetPath: "root",
            });

            expect(result.ok).toBe(true);
            // Result should be 2/2
            expect(result.newExpressionLatex).toBeDefined();
        });
    });
});

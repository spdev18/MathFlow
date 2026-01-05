/**
 * Contract-level tests for PrimitiveRunner.
 *
 * These tests focus on the TypeScript contract and high-level control flow.
 * They use createPrimitiveRunnerWithDeps(...) with lightweight stubs instead
 * of the real NGIN Lite engine.
 */
import { describe, it, expect } from "vitest";
import { createPrimitiveRunnerWithDeps, } from "../src/orchestrator/PrimitiveRunner.ngin";
const baseRequest = {
    mode: "preview",
    latex: "\\frac{1}{3} + \\frac{2}{5}",
    primitiveIds: ["test-primitive"],
    invariantSetId: "fractions-basic.v1",
    context: { selection: ["surf-frac-1", "surf-plus", "surf-frac-2"] },
};
describe("PrimitiveRunner — OK / noStep / error scenarios", () => {
    it("OK scenario — primitive applied and AST changed", async () => {
        const deps = {
            async parseLatexToAst(latex) {
                return { kind: "ast", latex };
            },
            async applyPrimitives(ast, primitiveIds) {
                const before = ast;
                return {
                    ast: { kind: "ast", latex: before.latex.replace("+", "-") },
                    appliedPrimitiveIds: primitiveIds.slice(0, 1),
                };
            },
            async printAstToLatex(ast) {
                return ast.latex;
            },
        };
        const runner = createPrimitiveRunnerWithDeps(deps);
        const result = await runner(baseRequest);
        expect(result.status).toBe("ok");
        const ok = result;
        expect(ok.latexBefore).toBe(baseRequest.latex);
        expect(ok.latexAfter).not.toBe(baseRequest.latex);
        expect(ok.appliedPrimitiveIds).toEqual(["test-primitive"]);
        expect(ok.astChanged).toBe(true);
    });
    it("NO STEP — no primitive applicable", async () => {
        const deps = {
            async parseLatexToAst(latex) {
                return { kind: "ast", latex };
            },
            async applyPrimitives(ast, primitiveIds) {
                return {
                    ast,
                    appliedPrimitiveIds: [],
                    alreadySimplified: false,
                };
            },
            async printAstToLatex(ast) {
                return ast.latex ?? String(ast);
            },
        };
        const runner = createPrimitiveRunnerWithDeps(deps);
        const result = await runner(baseRequest);
        expect(result.status).toBe("noStep");
        const noStep = result;
        expect(noStep.reason).toBe("no-primitive-applicable");
        expect(noStep.latex).toBe(baseRequest.latex);
    });
    it("NO STEP — expression already simplified", async () => {
        const deps = {
            async parseLatexToAst(latex) {
                return { kind: "ast", latex };
            },
            async applyPrimitives(ast, primitiveIds) {
                return {
                    ast,
                    appliedPrimitiveIds: [],
                    alreadySimplified: true,
                };
            },
            async printAstToLatex(ast) {
                return ast.latex ?? String(ast);
            },
        };
        const runner = createPrimitiveRunnerWithDeps(deps);
        const result = await runner(baseRequest);
        expect(result.status).toBe("noStep");
        const noStep = result;
        expect(noStep.reason).toBe("expression-already-simplified");
        expect(noStep.latex).toBe(baseRequest.latex);
    });
    it("PARSE-ERROR — parser throws ParseError", async () => {
        const deps = {
            async parseLatexToAst() {
                const err = new Error("Broken LaTeX");
                err.name = "ParseError";
                throw err;
            },
            async applyPrimitives(ast, primitiveIds) {
                return { ast, appliedPrimitiveIds: primitiveIds };
            },
            async printAstToLatex(ast) {
                return String(ast);
            },
        };
        const runner = createPrimitiveRunnerWithDeps(deps);
        const result = await runner(baseRequest);
        expect(result.status).toBe("error");
        const error = result;
        expect(error.errorCode).toBe("parse-error");
        expect(error.message).toContain("Broken LaTeX");
    });
    it("ENGINE-ERROR — engine throws generic error", async () => {
        const deps = {
            async parseLatexToAst(latex) {
                return { kind: "ast", latex };
            },
            async applyPrimitives() {
                throw new Error("Engine exploded");
            },
            async printAstToLatex(ast) {
                return ast.latex ?? String(ast);
            },
        };
        const runner = createPrimitiveRunnerWithDeps(deps);
        const result = await runner(baseRequest);
        expect(result.status).toBe("error");
        const error = result;
        expect(error.errorCode).toBe("engine-error");
        expect(error.message).toContain("Engine exploded");
    });
    it("CONFIG-ERROR — empty primitiveIds list", async () => {
        const deps = {
            async parseLatexToAst(latex) {
                return { kind: "ast", latex };
            },
            async applyPrimitives(ast, primitiveIds) {
                return { ast, appliedPrimitiveIds: primitiveIds };
            },
            async printAstToLatex(ast) {
                return ast.latex ?? String(ast);
            },
        };
        const runner = createPrimitiveRunnerWithDeps(deps);
        const badRequest = {
            ...baseRequest,
            primitiveIds: [],
        };
        const result = await runner(badRequest);
        expect(result.status).toBe("error");
        const error = result;
        expect(error.errorCode).toBe("config-error");
    });
});

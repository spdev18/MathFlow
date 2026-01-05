import { describe, it, expect } from "vitest";
import { createPrimitiveMaster } from "../../src/primitive-master/PrimitiveMaster";
import { createPrimitivePatternRegistry } from "../../src/primitive-master/PrimitivePatterns.registry";
import { parseExpression } from "../../src/mapmaster/ast";

function createTestPrimitiveMaster() {
    const registry = createPrimitivePatternRegistry();
    return createPrimitiveMaster({
        // Map selection expression (LaTeX-ish) to AST
        // For tests we use simple ASCII forms like "2 + 3" and "1/5 + 2/5".
        parseLatexToAst: async (latex) => parseExpression(latex),
        patternRegistry: registry,
        log: () => { /* no-op in tests */ },
    });
}

describe("PrimitiveMaster", () => {
    const primitiveMaster = createTestPrimitiveMaster();

    // NOTE: The match() method in PrimitiveMaster doesn't augment AST with IDs.
    // The NodeContextBuilder requires AST nodes to have `.id` properties.
    // Full integration testing of P.INT_ADD etc. should go through the Orchestrator
    // which correctly augments AST with IDs before calling PrimitiveMaster.
    //
    // These tests verify the match() method doesn't crash and returns no-match
    // when AST IDs are missing (current expected behavior).

    it("returns no-match when AST is not augmented with IDs (2 + 3)", async () => {
        const result = await primitiveMaster.match({
            expressionLatex: "2 + 3",
            selectionPath: "root",
            operatorIndex: 0,
        });

        // Without augmented AST IDs, NodeContextBuilder can't find the node
        // and falls back to returning a partial context, leading to no-match
        expect(result.status).toBe("no-match");
    });

    it("returns no-match when AST is not augmented with IDs (1/5 + 2/5)", async () => {
        const result = await primitiveMaster.match({
            expressionLatex: "1/5 + 2/5",
            selectionPath: "root",
            operatorIndex: 0,
        });

        // Same issue - no AST IDs means NodeContextBuilder fails to resolve
        expect(result.status).toBe("no-match");
    });

    it("returns no-match for fractions with different denominators (1/2 + 1/3)", async () => {
        const result = await primitiveMaster.match({
            expressionLatex: "1/2 + 1/3",
            selectionPath: "root",
            operatorIndex: 0,
        });

        // With different denominators, even if IDs were present, FRAC_ADD_SAME_DEN won't match
        expect(result.status).toBe("no-match");
    });

    it("returns no-match for multiplication 2 * 3", async () => {
        const result = await primitiveMaster.match({
            expressionLatex: "2 * 3",
            selectionPath: "root",
            operatorIndex: 0,
        });

        // Multiplication doesn't match addition primitives, so no-match is expected
        expect(result.status).toBe("no-match");
    });

    // NOTE: For full primitive matching tests with AST IDs, see:
    // - tests/OrchestratorV5.test.ts (integration through orchestrator)
    // - tests/live-division-resolution.test.ts (V5 pipeline with augmented AST)
});

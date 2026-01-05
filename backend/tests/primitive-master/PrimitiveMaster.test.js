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
        log: () => { },
    });
}
describe("PrimitiveMaster", () => {
    const primitiveMaster = createTestPrimitiveMaster();
    it("matches P.INT_ADD for 2 + 3", async () => {
        const result = await primitiveMaster.match({
            expressionLatex: "2 + 3",
            // Click on the operator "+" (see getNodeByOperatorIndex: binaryOp is index 1)
            selectionPath: "term[0].op",
            operatorIndex: 1,
        });
        expect(result.status).toBe("match-found");
        if (result.status === "match-found") {
            expect(result.primitiveId).toBe("P.INT_ADD");
        }
    });
    it("matches P.FRAC_ADD_SAME for 1/5 + 2/5", async () => {
        const result = await primitiveMaster.match({
            expressionLatex: "1/5 + 2/5",
            // Same reasoning: the single binaryOp "+" has operatorIndex 1
            selectionPath: "term[0].op",
            operatorIndex: 1,
        });
        expect(result.status).toBe("match-found");
        if (result.status === "match-found") {
            expect(result.primitiveId).toBe("P.FRAC_ADD_SAME");
        }
    });
    it("returns no-match for fractions with different denominators (1/2 + 1/3)", async () => {
        const result = await primitiveMaster.match({
            expressionLatex: "1/2 + 1/3",
            selectionPath: "term[0].op",
            operatorIndex: 1,
        });
        expect(result.status).toBe("no-match");
        if (result.status === "no-match") {
            // Verify that P.FRAC_ADD_SAME was considered but rejected
            const candidate = result.debug?.candidates?.find((c) => c.primitiveId === "P.FRAC_ADD_SAME");
            expect(candidate).toBeDefined();
            expect(candidate?.verdict).toBe("not-applicable");
        }
    });
    it("returns no-match for unknown operator (e.g. multiplication 2 * 3)", async () => {
        // Assuming P.INT_MUL is not yet implemented in the registry
        const result = await primitiveMaster.match({
            expressionLatex: "2 * 3",
            selectionPath: "term[0].op",
            operatorIndex: 1,
        });
        expect(result.status).toBe("no-match");
    });
});

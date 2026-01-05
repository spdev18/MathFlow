import { describe, it, expect } from "vitest";
import { createPrimitiveMaster } from "../PrimitiveMaster";
import { createPrimitivePatternRegistry } from "../PrimitivePatterns.registry";
import { parseExpression } from "../../mapmaster/ast";

function createTestPrimitiveMaster() {
    const registry = createPrimitivePatternRegistry();
    return createPrimitiveMaster({
        parseLatexToAst: async (latex) => parseExpression(latex),
        patternRegistry: registry,
        log: () => { } // No-op logger for tests
    });
}

describe("PrimitiveMaster", () => {
    const primitiveMaster = createTestPrimitiveMaster();

    it("matches P.INT_ADD for 2 + 3", async () => {
        const result = await primitiveMaster.match({
            expressionLatex: "2 + 3",
            selectionPath: "term[0].op", // Standard path for the first binary operator
            operatorIndex: 0
        });

        expect(result.status).toBe("match-found");
        if (result.status === "match-found") {
            expect(result.primitiveId).toBe("P.INT_ADD");
            expect(result.window.centerPath).toBe("term[0]"); // The operator node path (stripped of .op)

            // Verify debug info
            expect(result.debug?.candidates).toBeDefined();
            const candidate = result.debug?.candidates?.find(c => c.primitiveId === "P.INT_ADD");
            expect(candidate).toBeDefined();
            expect(candidate?.verdict).toBe("applicable");
        }
    });

    it("matches P.FRAC_ADD_SAME_DEN for 1/5 + 2/5", async () => {
        const result = await primitiveMaster.match({
            expressionLatex: "\\frac{1}{5} + \\frac{2}{5}",
            selectionPath: "term[0].op",
            operatorIndex: 0
        });

        expect(result.status).toBe("match-found");
        if (result.status === "match-found") {
            expect(result.primitiveId).toBe("P.FRAC_ADD_SAME_DEN");
            expect(result.window.centerPath).toBe("term[0]");
        }
    });

    it("returns no-match for fractions with different denominators (1/2 + 1/3)", async () => {
        const result = await primitiveMaster.match({
            expressionLatex: "\\frac{1}{2} + \\frac{1}{3}",
            selectionPath: "term[0].op",
            operatorIndex: 0
        });

        expect(result.status).toBe("no-match");
        if (result.status === "no-match") {
            expect(result.reason).toBe("no-primitive-for-selection");

            // Verify P.FRAC_ADD_SAME_DEN was considered but rejected
            const candidate = result.debug?.candidates?.find(c => c.primitiveId === "P.FRAC_ADD_SAME_DEN");
            expect(candidate).toBeDefined();
            expect(candidate?.verdict).toBe("not-applicable");
        }
    });

    it("returns no-match for unknown operator (e.g. multiplication 2 * 3)", async () => {
        // Assuming P.INT_MUL is not yet implemented in the registry
        const result = await primitiveMaster.match({
            expressionLatex: "2 * 3",
            selectionPath: "term[0].op",
            operatorIndex: 0
        });

        expect(result.status).toBe("no-match");
    });
});

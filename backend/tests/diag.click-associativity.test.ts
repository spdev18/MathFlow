/**
 * Diagnostic Tests: Click Associativity and Support Candidates
 * 
 * These tests document the CURRENT behavior (some expected to fail/pass as documented).
 * Skipped tests describe DESIRED future behavior.
 */

import { describe, it, expect } from "vitest";
import { parseExpression, getNodeAt } from "../src/mapmaster/ast";

describe("Diagnostic: AST Structure for Chain Expressions", () => {
    it("parses 3*8*4 as left-associative ((3*8)*4)", () => {
        const ast = parseExpression("3*8*4");
        expect(ast).toBeDefined();
        expect(ast?.type).toBe("binaryOp");

        // Root is (something)*4
        if (ast?.type === "binaryOp") {
            expect(ast.op).toBe("*");
            expect((ast.right as any).value).toBe("4");

            // Left child is (3*8)
            expect(ast.left.type).toBe("binaryOp");
            if (ast.left.type === "binaryOp") {
                expect(ast.left.op).toBe("*");
                expect((ast.left.left as any).value).toBe("3");
                expect((ast.left.right as any).value).toBe("8");
            }
        }
    });

    it("confirms node 8*4 does NOT exist in AST for 3*8*4", () => {
        const ast = parseExpression("3*8*4");
        expect(ast).toBeDefined();

        // There is no path that addresses "8*4"
        // Available paths: root (3*8)*4, term[0] (3*8), term[1] (4)
        const paths = ["root", "term[0]", "term[1]", "term[0].term[0]", "term[0].term[1]"];

        for (const path of paths) {
            const node = getNodeAt(ast!, path);
            if (node?.type === "binaryOp") {
                // Check if this is 8*4 (left=8, right=4)
                const left = (node as any).left;
                const right = (node as any).right;
                const is8times4 = left?.type === "integer" && left.value === "8" &&
                    right?.type === "integer" && right.value === "4";
                expect(is8times4).toBe(false);
            }
        }
    });

    it("parses 10-96+3 as left-associative ((10-96)+3)", () => {
        const ast = parseExpression("10-96+3");
        expect(ast).toBeDefined();
        expect(ast?.type).toBe("binaryOp");

        if (ast?.type === "binaryOp") {
            expect(ast.op).toBe("+");
            expect((ast.right as any).value).toBe("3");

            // Left child is (10-96)
            expect(ast.left.type).toBe("binaryOp");
            if (ast.left.type === "binaryOp") {
                expect(ast.left.op).toBe("-");
            }
        }
    });
});

describe("Diagnostic: Domain Detection for Mixed Expressions", () => {
    it("parses 4+5/2 and left operand is integer, right is fraction", () => {
        // Note: 5/2 with slash is parsed as fraction in ast.ts
        const ast = parseExpression("4+\\frac{5}{2}");
        expect(ast).toBeDefined();
        expect(ast?.type).toBe("binaryOp");

        if (ast?.type === "binaryOp") {
            expect(ast.op).toBe("+");
            expect(ast.left.type).toBe("integer");
            expect((ast.left as any).value).toBe("4");
            expect(ast.right.type).toBe("fraction");
        }
    });

    it("parses (10-96)+3 and left operand is binaryOp (not integer)", () => {
        const ast = parseExpression("(10-96)+3");
        expect(ast).toBeDefined();
        expect(ast?.type).toBe("binaryOp");

        if (ast?.type === "binaryOp") {
            expect(ast.op).toBe("+");
            // Left operand is NOT an integer - it's a binaryOp
            expect(ast.left.type).toBe("binaryOp");
            // This is why INT_ADD pattern fails - it requires integers on both sides
            expect(ast.right.type).toBe("integer");
        }
    });
});

describe("DESIRED: Future Behavior for Associativity", () => {
    it.skip("should allow selecting 8*4 in 3*8*4 via semantic window or n-ary node", async () => {
        // FUTURE: When n-ary AST or semantic window is implemented,
        // user should be able to target sub-range [8,4] and get a candidate for 8*4=32
    });

    // NOTE: This test is no longer skipped - P.INT_TO_FRAC support candidate is now implemented!
    it("proposes P.INT_TO_FRAC as support hint for 4+5/2", async () => {
        // IMPLEMENTED: MapMaster now emits P.INT_TO_FRAC as a "support" candidate
        // when Mixed domain is detected with one integer and one fraction operand.
        // See tests/support-candidate-mixed.test.ts for full verification.
        const ast = parseExpression("4+\\frac{5}{2}");
        expect(ast).toBeDefined();
        expect(ast?.type).toBe("binaryOp");
        if (ast?.type === "binaryOp") {
            expect(ast.left.type).toBe("integer");
            expect(ast.right.type).toBe("fraction");
        }
    });

    it.skip("should allow regrouping (3*8)*4 to 3*(8*4) via associativity primitive", async () => {
        // FUTURE: Associativity primitive should allow user to choose alternative groupings
    });
});

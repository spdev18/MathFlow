import { parseExpression } from "../src/mapmaster/ast";
import { describe, test, expect } from "vitest";

describe("E2 Fix: Interactivity for '\\cdot' and '\\div'", () => {

    // 1. UNIT TESTS: PARSER
    describe("AST Parser", () => {
        test("should parse '2 \\cdot 5' as binary multiplication (*)", () => {
            const ast = parseExpression("2 \\cdot 5");
            expect(ast).toBeDefined();
            expect(ast?.type).toBe("binaryOp");
            if (ast?.type === "binaryOp") {
                expect(ast.op).toBe("*");
                expect((ast.left as any).value).toBe("2");
                expect((ast.right as any).value).toBe("5");
            }
        });

        test("should parse '3 \\times 8' as binary multiplication (*)", () => {
            const ast = parseExpression("3 \\times 8");
            expect(ast).toBeDefined();
            expect(ast?.type).toBe("binaryOp");
            if (ast?.type === "binaryOp") {
                expect(ast.op).toBe("*");
            }
        });

        test("should normalize '/' to '\\div'", () => {
            const ast = parseExpression("8/4");
            expect(ast).toBeDefined();
            if (ast?.type === "binaryOp") {
                expect(ast.op).toBe("\\div");
            }
        });

        test("should normalize ':' to '\\div'", () => {
            const ast = parseExpression("5:2");
            expect(ast).toBeDefined();
            if (ast?.type === "binaryOp") {
                expect(ast.op).toBe("\\div");
            }
        });

        test("should parse mixed expression '2\\cdot 5 - 3\\cdot 8 \\div 4 + 5 \\div 2' correctly", () => {
            const latex = "2\\cdot 5 - 3\\cdot 8 \\div 4 + 5 \\div 2";
            const ast = parseExpression(latex);
            expect(ast).toBeDefined();
            // Basic structural check
            // Expected structure:
            // + 
            //  L: -
            //     L: 2*5 (op: *)
            //     R: 3*8 div 4 (op: \div, L:3*8, R:4)
            //  R: 5 div 2 (op: \div)

            if (ast?.type === "binaryOp") {
                expect(ast.op).toBe("+");

                const right = ast.right as any;
                expect(right.type).toBe("binaryOp");
                expect(right.op).toBe("\\div");
                expect(right.left.value).toBe("5");
                expect(right.right.value).toBe("2");

                const left = ast.left as any;
                expect(left.type).toBe("binaryOp");
                expect(left.op).toBe("-");

                const ll = left.left as any; // 2 \cdot 5
                expect(ll.type).toBe("binaryOp");
                expect(ll.op).toBe("*");

                const lr = left.right as any; // 3 \cdot 8 \div 4
                expect(lr.type).toBe("binaryOp");
                expect(lr.op).toBe("\\div");

                const lrl = lr.left as any; // 3 \cdot 8
                expect(lrl.type).toBe("binaryOp");
                expect(lrl.op).toBe("*");
            }
        });
    });
});

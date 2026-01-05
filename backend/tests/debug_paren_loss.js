import { parseExpression, toLatex, replaceNodeAt } from '../src/mapmaster/ast';
function test() {
    console.log("--- Testing Parenthesis Preservation ---");
    const latex = "(1+1) - (2+2)";
    console.log("Input:", latex);
    const ast = parseExpression(latex);
    if (!ast) {
        console.error("Parse failed");
        return;
    }
    // Simulate simplifying (1+1) -> 2
    // Path to (1+1) is term[0] (left of minus)
    // Wait, parser might strip outer parens of (1+1) if it's just a group?
    // No, (1+1) is binaryOp(+).
    // Root is binaryOp(-).
    // Left is binaryOp(+).
    // Let's replace left node with Integer(2)
    const newAst = replaceNodeAt(ast, "term[0]", { type: "integer", value: "2" });
    const output = toLatex(newAst);
    console.log("Output:", output);
    if (output === "2 - (2 + 2)" || output === "2 - \\left(2 + 2\\right)") {
        console.log("PASS");
    }
    else {
        console.log("FAIL: Expected parens around 2+2");
    }
}
test();

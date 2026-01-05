import { parseExpression, toLatex } from '../src/mapmaster/ast';

// Test expression: 2 * 5 - 3 * 8 * 4
const latex = "2 * 5 - 3 * 8 * 4";
const ast = parseExpression(latex);

console.log("=== AST Structure for: 2 * 5 - 3 * 8 * 4 ===");
console.log(JSON.stringify(ast, null, 2));

// Augment with IDs
function augmentAstWithIds(root: any) {
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
}

const augmented = augmentAstWithIds(JSON.parse(JSON.stringify(ast)));
console.log("\n=== Augmented AST with IDs ===");
console.log(JSON.stringify(augmented, null, 2));

// Test back to LaTeX
console.log("\n=== Back to LaTeX ===");
console.log(toLatex(ast!));

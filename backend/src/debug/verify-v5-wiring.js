
// Minimal JS mock of the AST logic to verify the recursion algorithm
function augmentAstWithIds(root) {
    if (!root) return;
    const traverse = (node, path) => {
        if (!node) return;
        node.id = path; // Assign ID
        if (node.type === "binaryOp") {
            traverse(node.left, path === "root" ? "term[0]" : `${path}.term[0]`);
            traverse(node.right, path === "root" ? "term[1]" : `${path}.term[1]`);
        }
    };
    traverse(root, "root");
    return root;
}

// Mock AST structure matching backend types
const mockAst = {
    type: "binaryOp",
    op: "+",
    left: { type: "integer", value: "2" },
    right: { type: "integer", value: "3" }
};

console.log("Verifying V5 Surface AST Wiring (JS Mock)...");

// Apply augmentation
augmentAstWithIds(mockAst);

console.log("Checking Root ID:", mockAst.id);
if (mockAst.id !== "root") {
    console.error("FAIL: Root ID missing or incorrect");
    process.exit(1);
}

console.log("Checking Left Child ID:", mockAst.left.id);
if (mockAst.left.id !== "term[0]") {
    console.error("FAIL: Left Child ID missing or incorrect");
    process.exit(1);
}

console.log("Checking Right Child ID:", mockAst.right.id);
if (mockAst.right.id !== "term[1]") {
    console.error("FAIL: Right Child ID missing or incorrect");
    process.exit(1);
}

console.log("SUCCESS: AST Augmented Correctly");

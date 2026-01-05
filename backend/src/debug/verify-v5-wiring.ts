
import { parseExpression } from "../mapmaster/ast";
import { PrimitiveMaster } from "../primitive-master/PrimitiveMaster";

// Mock AST helpers from Orchestrator step
function augmentAstWithIds(root: any) {
    if (!root) return;
    const traverse = (node: any, path: string) => {
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

async function verify() {
    console.log("Verifying V5 Surface AST Wiring...");

    const expression = "2+3";
    const ast = parseExpression(expression);

    if (!ast) {
        console.error("Failed to parse expression");
        return;
    }

    // Apply augmentation (same logic as in orchestrator)
    augmentAstWithIds(ast);

    console.log("Checking Root ID:", (ast as any).id);
    if ((ast as any).id !== "root") {
        console.error("FAIL: Root ID missing or incorrect");
        process.exit(1);
    }

    console.log("Checking Child ID:", (ast as any).left?.id);
    if ((ast as any).left?.id !== "term[0]") {
        console.error("FAIL: Left Child ID missing or incorrect");
        process.exit(1);
    }

    console.log("SUCCESS: AST Augmented Correctly");
}

verify();

import { parseExpression, AstNode } from '../src/mapmaster/ast';
import { GenericPatternMatcher } from '../src/mapmaster/GenericPatternMatcher';
import { mapMasterGenerate, MapMasterInput } from '../src/mapmaster/mapmaster.core';
import { InMemoryInvariantRegistry } from '../src/invariants/invariants.registry';

// Simple recursive printer for AST X-Ray
function printAst(node: AstNode, indent: string = ""): void {
    const type = node.type;
    let info = "";
    if (type === "integer") info = `value=${(node as any).value}`;
    if (type === "variable") info = `name=${(node as any).name}`;
    if (type === "binaryOp") info = `op=${(node as any).op}`;
    if (type === "fraction") info = `num=${(node as any).numerator}, den=${(node as any).denominator}`;
    if (type === "mixed") info = `whole=${(node as any).whole}, num=${(node as any).numerator}, den=${(node as any).denominator}`;

    console.log(`${indent}[${type}] ${info}`);

    if (type === "group") {
        printAst((node as any).content, indent + "  ");
    } else if (type === "binaryOp") {
        printAst((node as any).left, indent + "  L: ");
        printAst((node as any).right, indent + "  R: ");
    }
}

// Diagnosis function
function diagnose(latex: string) {
    console.log(`\n--- Diagnosis for: "${latex}" ---`);
    const ast = parseExpression(latex);
    if (!ast) {
        console.error("Parse failed");
        return;
    }

    console.log("AST X-Ray:");
    printAst(ast);

    // Setup MapMaster with manual registry
    const model = {
        primitives: [{
            id: "P.INT_ADD",
            name: "Integer Addition",
            description: "Adds two integers",
            category: "integer",
            tags: [],
            pattern: "a+b", // The pattern we want to test
            resultPattern: "calc(a+b)"
        }],
        invariantSets: [{
            id: "default",
            name: "Default Set",
            description: "Default",
            version: "1.0.0",
            rules: [{
                id: "rule-add",
                title: "Add Integers",
                shortStudentLabel: "Add",
                description: "Add two integers",
                level: "core",
                tags: [],
                primitiveIds: ["P.INT_ADD"]
            }]
        }]
    };

    const registry = new InMemoryInvariantRegistry({ model: model as any });

    // We need to simulate clicking on '+'
    // In 1/(2+3), + is likely operator index 3 (based on previous analysis)
    // 1 (int), / (op), 2 (int), + (op), 3 (int).

    const input: MapMasterInput = {
        expressionLatex: latex,
        selectionPath: null,
        operatorIndex: 3, // Target the + inside the group
        invariantSetIds: ["default"],
        registry: registry
    };

    console.log("\nRunning MapMaster...");
    const result = mapMasterGenerate(input);

    console.log(`Found ${result.candidates.length} candidates.`);
    result.candidates.forEach(c => {
        console.log(`- [${c.invariantRuleId}] ${c.description} (Target: ${c.targetPath})`);
    });

    if (result.candidates.length > 0) {
        console.log("SUCCESS: MapMaster found candidates.");
    } else {
        console.log("FAILURE: No candidates found.");
    }
}

// Main execution
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log("Usage: npx tsx tools/debug-math-core.ts <latex>");
    console.log("Example: npx tsx tools/debug-math-core.ts '1/(2+3)'");
    process.exit(1);
}

const latex = args[0];

diagnose(latex);

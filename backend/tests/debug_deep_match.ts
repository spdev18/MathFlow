import { mapMasterGenerate } from '../src/mapmaster/mapmaster.core';
import { InMemoryInvariantRegistry } from '../src/invariants/invariants.registry';
import { validateInvariantModel } from '../src/invariants/invariants.model';
import * as fs from 'fs';
import * as path from 'path';

// Load the registry
const configPath = path.resolve(process.cwd(), 'config/courses/default.course.invariants.json');
const configContent = fs.readFileSync(configPath, 'utf-8');
const configJson = JSON.parse(configContent);
const validation = validateInvariantModel(configJson);

if (!validation.ok) {
    console.error("Invalid config:", validation.issues);
    process.exit(1);
}

const registry = new InMemoryInvariantRegistry({ model: validation.model! });

async function runTest(latex: string, opIndex: number, label: string) {
    console.log(`\n--- Testing ${label}: "${latex}" (OpIndex: ${opIndex}) ---`);

    // Try to inspect AST
    const { parseExpression, getNodeByOperatorIndex } = await import('../src/mapmaster/ast');
    const ast = parseExpression(latex);
    if (!ast) {
        console.error("Failed to parse AST");
        return;
    }

    const node = getNodeByOperatorIndex(ast, opIndex);
    console.log(`Node at index ${opIndex}:`, node ? node.node.type : "NOT FOUND");
    if (node) {
        console.log(`Node Path: ${node.path}`);
        if (node.node.type === 'binaryOp') {
            console.log(`Op: ${node.node.op}`);
        }
    }

    const input = {
        expressionLatex: latex,
        selectionPath: null,
        operatorIndex: opIndex,
        invariantSetIds: ["default"],
        registry: registry
    };

    const result = mapMasterGenerate(input);

    console.log("Candidates found:", result.candidates.length);
    result.candidates.forEach(c => {
        console.log(`- [${c.id}] Rule: ${c.invariantRuleId}, Primitive: ${c.primitiveIds.join(", ")}`);
        console.log(`  Target Path: ${c.targetPath}`);
    });
}

async function main() {
    // Case: (6/2 + 12/2) - (5/7 + 2/7)
    // We want to click the first '+' inside the first parens.
    // Let's find the index.
    // 6/2 (frac) -> 0
    // + (op) -> 1
    // 12/2 (frac) -> 2
    // - (op) -> 3
    // 5/7 (frac) -> 4
    // + (op) -> 5
    // 2/7 (frac) -> 6

    // So index 1 should be the first +.
    const latex = "(\\frac{6}{2} + \\frac{12}{2}) - (\\frac{5}{7} + \\frac{2}{7})";
    await runTest(latex, 1, "Deep Match: (6/2 + 12/2) - ... clicking +");
}

main();

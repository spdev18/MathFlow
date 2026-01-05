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
const registry = new InMemoryInvariantRegistry({ model: validation.model });
async function runTest(latex, opIndex, label) {
    console.log(`\n--- Testing ${label}: "${latex}" (OpIndex: ${opIndex}) ---`);
    // Try to inspect AST
    const { parseExpression, getNodeByOperatorIndex } = await import('../src/mapmaster/ast');
    const ast = parseExpression(latex);
    if (!ast) {
        console.error("Failed to parse AST");
        return;
    }
    console.log("AST:", JSON.stringify(ast, null, 2));
    const node = getNodeByOperatorIndex(ast, opIndex);
    console.log(`Node at index ${opIndex}:`, node ? node.node.type : "NOT FOUND");
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
        console.log(`  Bindings:`, c.bindings);
        console.log(`  Result Pattern:`, c.resultPattern);
    });
}
async function main() {
    // Case: 1/7 + 3/7. Clicking '+' (Index 1)
    await runTest("\\frac{1}{7} + \\frac{3}{7}", 1, "1/7 + 3/7 (Clicking +)");
}
main();

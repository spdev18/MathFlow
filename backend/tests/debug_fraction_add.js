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
// Test Case: 1/7 + 3/7
// Operator Index for + should be 1 (assuming 1/7 is 0, + is 1, 3/7 is 2)
const input = {
    expressionLatex: "1/7 + 3/7",
    selectionPath: null,
    operatorIndex: 1,
    invariantSetIds: ["default"],
    registry: registry
};
console.log("Testing MapMaster with input:", input);
const pFracAddSame = registry.getPrimitiveById("P.FRAC_ADD_SAME");
console.log("P.FRAC_ADD_SAME from registry:", JSON.stringify(pFracAddSame, null, 2));
const result = mapMasterGenerate(input);
console.log("Candidates found:", result.candidates.length);
result.candidates.forEach(c => {
    console.log(`- [${c.id}] Rule: ${c.invariantRuleId}, Primitive: ${c.primitiveIds.join(", ")}`);
    console.log(`  Target Path: ${c.targetPath}`);
    console.log(`  Bindings:`, c.bindings);
});
if (result.candidates.length === 0) {
    console.log("NO CANDIDATES FOUND. Debugging...");
    // Try to inspect AST
    const { parseExpression, getNodeByOperatorIndex } = await import('../src/mapmaster/ast');
    const ast = parseExpression(input.expressionLatex);
    if (!ast) {
        console.error("Failed to parse AST");
        process.exit(1);
    }
    console.log("AST:", JSON.stringify(ast, null, 2));
    const node = getNodeByOperatorIndex(ast, input.operatorIndex);
    console.log(`Node at index ${input.operatorIndex}:`, node);
}

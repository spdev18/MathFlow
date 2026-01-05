
import { executeStepViaEngine } from "../src/engine/engine.bridge";
import { MapMasterCandidate } from "../src/mapmaster/index";

async function runTest(name: string, latex: string, primitiveId: string, targetPath: string, expectedLatex: string | null, expectedError?: string) {
    console.log(`\n--- Test: ${name} ---`);
    console.log(`Input: ${latex}`);
    console.log(`Primitive: ${primitiveId}`);

    const candidate: MapMasterCandidate = {
        id: "c1" as any,
        invariantRuleId: "R.TEST",
        primitiveIds: [primitiveId],
        targetPath: targetPath,
        // stiffness: 0, // Removed in refactor
        // priority: 0   // Removed in refactor
    };

    const input: any = {
        expressionLatex: latex,
        selectionPath: "root",
        invariantSetIds: [],
        registry: {} as any
    };

    const result = await executeStepViaEngine(candidate, input);

    if (expectedError) {
        if (!result.ok && result.errorCode === expectedError) {
            console.log(`PASS: Got expected error '${expectedError}'`);
        } else {
            console.log(`FAIL: Expected error '${expectedError}', got ok=${result.ok}, error=${result.errorCode}`);
        }
    } else {
        if (result.ok && result.newExpressionLatex === expectedLatex) {
            console.log(`PASS: Got '${expectedLatex}'`);
        } else {
            console.log(`FAIL: Expected '${expectedLatex}', got '${result.newExpressionLatex}' (ok=${result.ok}, err=${result.errorCode})`);
        }
    }
}

async function main() {
    // Integer Ops
    await runTest("Int Add", "3 + 5", "P.INT_ADD", "root", "8");
    await runTest("Int Div Exact", "10 / 2", "P.INT_DIV_EXACT", "root", "5");
    await runTest("Int Div Error", "10 / 0", "P.INT_DIV_EXACT", "root", null, "division-by-zero");

    // Decimal Ops
    await runTest("Dec Add", "2.5 + 1.5", "P.DEC_ADD", "root", "4");
    await runTest("Dec Mul", "2.5 * 2", "P.DEC_MUL", "root", "5");

    // Structure Ops
    // 5 - (2 + 3) -> 5 - 2 - 3
    // targetPath needs to point to the MINUS op.
    await runTest("Distribute Neg", "5 - (2 + 3)", "P.DISTRIBUTE_NEG", "root", "5 - 2 - 3");

    // Double Neg
    // 5 - (-3) -> 5 + 3
    await runTest("Double Neg", "5 - (-3)", "P.NEG_NEG_TO_POS", "root", "5 + 3");
}

main().catch(console.error);

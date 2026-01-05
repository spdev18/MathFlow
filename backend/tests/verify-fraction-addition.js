/**
 * verify-fraction-addition.ts
 *
 * Verify the specific scenario: 3 + 2/5
 * Steps:
 * 1. 3 + 2/5 (Select 3) -> 3/1 + 2/5
 * 2. 3/1 + 2/5 (Select 3/1) -> 3/1 * 1 + 2/5
 * 3. 3/1 * 1 + 2/5 (Select 1) -> 3/1 * 5/5 + 2/5
 */
import { loadInvariantRegistryFromFile, } from "../src/invariants/index";
import { createDefaultStudentPolicy, } from "../src/stepmaster/index";
import { runOrchestratorStep, } from "../src/orchestrator/index";
async function main() {
    console.log("--- Starting Fraction Addition Verification ---");
    // 1. Load Registry
    const registry = loadInvariantRegistryFromFile({
        path: "config/courses/default.course.invariants.json",
    });
    const ctx = {
        invariantRegistry: registry,
        policy: createDefaultStudentPolicy(),
    };
    // Step 1: 3 + 2/5 -> 3/1 + 2/5
    console.log("\n[Step 1] Input: 3 + 2/5, Selection: 'term[0]' (3)");
    const res1 = await runOrchestratorStep(ctx, {
        expressionLatex: "3 + 2/5",
        selectionPath: "term[0]",
    });
    if (res1.status === "step-applied" && res1.engineResult?.newExpressionLatex === "3/1 + 2/5") {
        console.log("PASS: 3 -> 3/1");
    }
    else {
        console.log("FAIL: Expected 3/1 + 2/5, got", res1.engineResult?.newExpressionLatex || res1.status);
    }
    // Step 2: 3/1 + 2/5 -> 3/1 * 1 + 2/5
    // Selection: "term[0]" which is "3/1"
    console.log("\n[Step 2] Input: 3/1 + 2/5, Selection: 'term[0]' (3/1)");
    const res2 = await runOrchestratorStep(ctx, {
        expressionLatex: "3/1 + 2/5",
        selectionPath: "term[0]",
    });
    if (res2.status === "step-applied" && res2.engineResult?.newExpressionLatex === "3/1 * 1 + 2/5") {
        console.log("PASS: 3/1 -> 3/1 * 1");
    }
    else {
        console.log("FAIL: Expected 3/1 * 1 + 2/5, got", res2.engineResult?.newExpressionLatex || res2.status);
    }
    // Step 3: 3/1 * 1 + 2/5 -> 3/1 * 5/5 + 2/5
    // Selection: "term[0].term[1]" which is "1"
    console.log("\n[Step 3] Input: 3/1 * 1 + 2/5, Selection: 'term[0].term[1]' (1)");
    const res3 = await runOrchestratorStep(ctx, {
        expressionLatex: "3/1 * 1 + 2/5",
        selectionPath: "term[0].term[1]",
    });
    if (res3.status === "step-applied" && res3.engineResult?.newExpressionLatex === "3/1 * 5/5 + 2/5") {
        console.log("PASS: 1 -> 5/5");
    }
    else {
        console.log("FAIL: Expected 3/1 * 5/5 + 2/5, got status:", res3.status);
        if (res3.engineResult) {
            console.log("Engine Result:", JSON.stringify(res3.engineResult, null, 2));
        }
    }
    console.log("\n--- Verification Finished ---");
}
main().catch(console.error);

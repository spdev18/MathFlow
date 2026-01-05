/**
 * verify-mixed-number.ts
 *
 * Verify the scenario: 2 1/2 + 1/3
 * Steps:
 * 1. 2 1/2 + 1/3 (Select 2 1/2) -> 2 + 1/2 + 1/3
 */

import {
    loadInvariantRegistryFromFile,
} from "../src/invariants/index";
import {
    createDefaultStudentPolicy,
} from "../src/stepmaster/index";
import {
    runOrchestratorStep,
    type OrchestratorContext,
} from "../src/orchestrator/index";

async function main() {
    console.log("--- Starting Mixed Number Split Verification ---");

    // 1. Load Registry
    const registry = loadInvariantRegistryFromFile({
        path: "config/courses/default.course.invariants.json",
    });

    const ctx: OrchestratorContext = {
        invariantRegistry: registry,
        policy: createDefaultStudentPolicy(),
    };

    // Step 1: 2 1/2 + 1/3 -> 2 + 1/2 + 1/3
    // Selection: "term[0]" (assuming parser sees 2 1/2 as term[0])
    // Wait, my parser sees "2 1/2 + 1/3" as a SumNode where left is MixedNumberNode.
    // So "term[0]" should be the MixedNumberNode.

    console.log("\n[Step 1] Input: '2 1/2 + 1/3', Selection: 'term[0]' (2 1/2)");
    const res1 = await runOrchestratorStep(ctx, {
        expressionLatex: "2 1/2 + 1/3",
        selectionPath: "term[0]",
    });

    if (res1.status === "step-applied") {
        console.log("PASS: Step applied");
        console.log("New Latex:", res1.engineResult?.newExpressionLatex);

        if (res1.engineResult?.newExpressionLatex === "2 + 1/2 + 1/3") {
            console.log("PASS: Result matches expected '2 + 1/2 + 1/3'");
        } else {
            console.log("FAIL: Result mismatch. Expected '2 + 1/2 + 1/3'");
        }
    } else {
        console.log("FAIL: Step not applied. Status:", res1.status);
        if (res1.engineResult) {
            console.log("Engine Result:", JSON.stringify(res1.engineResult, null, 2));
        }
    }

    console.log("\n--- Verification Finished ---");
}

main().catch(console.error);

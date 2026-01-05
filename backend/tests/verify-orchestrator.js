/**
 * verify-orchestrator.ts
 *
 * Script to verify the Step Orchestrator flow.
 */
import { loadInvariantRegistryFromFile, } from "../src/invariants/index";
import { createDefaultStudentPolicy, } from "../src/stepmaster/index";
import { runOrchestratorStep, } from "../src/orchestrator/index";
async function main() {
    console.log("--- Starting Verification ---");
    // 1. Load Registry
    console.log("Loading registry...");
    const registry = loadInvariantRegistryFromFile({
        path: "config/courses/default.course.invariants.json",
    });
    console.log("Registry loaded. Primitives:", registry.getAllPrimitives().length);
    // 2. Create Context
    const ctx = {
        invariantRegistry: registry,
        policy: createDefaultStudentPolicy(),
    };
    // 3. Test Case 1: Whole to Fraction
    console.log("\n--- Test Case 1: 3 + 2/5 (Select '3') ---");
    const req1 = {
        sessionId: "test-session",
        courseId: "default",
        expressionLatex: "3 + 2/5",
        selectionPath: "term[0]", // Stub engine assumes this points to "3"
    };
    const res1 = await runOrchestratorStep(ctx, req1);
    console.log("Status:", res1.status);
    if (res1.engineResult) {
        console.log("New Latex:", res1.engineResult.newExpressionLatex);
    }
    if (res1.status === "step-applied" && res1.engineResult?.newExpressionLatex === "3/1 + 2/5") {
        console.log("PASS: 3 -> 3/1");
    }
    else {
        console.log("FAIL: Expected 3/1 + 2/5");
    }
    // 4. Test Case 2: Simplify Fraction
    console.log("\n--- Test Case 2: 10/20 (Select '10/20') ---");
    const req2 = {
        sessionId: "test-session",
        courseId: "default",
        expressionLatex: "10/20",
        selectionPath: "root",
    };
    const res2 = await runOrchestratorStep(ctx, req2);
    console.log("Status:", res2.status);
    if (res2.engineResult) {
        console.log("New Latex:", res2.engineResult.newExpressionLatex);
    }
    if (res2.status === "step-applied" && res2.engineResult?.newExpressionLatex === "1/2") {
        console.log("PASS: 10/20 -> 1/2");
    }
    else {
        console.log("FAIL: Expected 1/2");
    }
    // 5. Test Case 3: Add Same Denominator
    console.log("\n--- Test Case 3: 1/5 + 2/5 (Select 'root') ---");
    const req3 = {
        sessionId: "test-session",
        courseId: "default",
        expressionLatex: "1/5 + 2/5",
        selectionPath: "root",
    };
    const res3 = await runOrchestratorStep(ctx, req3);
    console.log("Status:", res3.status);
    if (res3.engineResult) {
        console.log("New Latex:", res3.engineResult.newExpressionLatex);
    }
    if (res3.status === "step-applied" && res3.engineResult?.newExpressionLatex === "3/5") {
        console.log("PASS: 1/5 + 2/5 -> 3/5");
    }
    else {
        console.log("FAIL: Expected 3/5");
    }
    console.log("\n--- Verification Finished ---");
}
main().catch(console.error);

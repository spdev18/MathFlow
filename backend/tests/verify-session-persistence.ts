
import { loadInvariantRegistryFromFile } from "../src/invariants/index";
import { createDefaultStudentPolicy } from "../src/stepmaster/stepmaster.policy";
import { runOrchestratorStep, OrchestratorContext, OrchestratorStepRequest } from "../src/orchestrator/step.orchestrator";
import { SessionService } from "../src/session/session.service";

async function runTest() {
    console.log("--- Starting Session Persistence Verification ---");

    // 1. Setup Dependencies
    const registry = loadInvariantRegistryFromFile({
        path: "config/courses/default.course.invariants.json"
    });
    console.log(`Registry loaded. Primitives: ${registry.getAllPrimitives().length}`);

    const policy = createDefaultStudentPolicy();
    const ctx: OrchestratorContext = {
        invariantRegistry: registry,
        policy: policy
    };

    const sessionId = "test-session-1";
    SessionService.clear(sessionId);

    // 2. Step 1: 3 + 2/5 -> 3/1 + 2/5
    console.log("\n[Step 1] Input: 3 + 2/5");
    const req1: OrchestratorStepRequest = {
        sessionId: sessionId,
        expressionLatex: "3 + 2/5",
        selectionPath: "term[0]" // Select '3'
    };

    const res1 = await runOrchestratorStep(ctx, req1);
    console.log(`Status: ${res1.status}`);
    console.log(`New Latex: ${res1.engineResult?.newExpressionLatex}`);

    if (res1.status !== "step-applied") {
        console.error("FAIL: Step 1 failed");
        process.exit(1);
    }

    // Verify history has 1 entry
    if (res1.history.entries.length !== 1) {
        console.error(`FAIL: Expected history length 1, got ${res1.history.entries.length}`);
        process.exit(1);
    }
    console.log("PASS: History has 1 entry");

    // 3. Step 2: 3/1 + 2/5 -> 3/1 * 1 + 2/5
    // We simulate a new request, but with the SAME sessionId.
    // The Orchestrator should load the history from Step 1.
    console.log("\n[Step 2] Input: 3/1 + 2/5");
    const req2: OrchestratorStepRequest = {
        sessionId: sessionId,
        expressionLatex: "3/1 + 2/5",
        selectionPath: "term[0]" // Select '3/1'
    };

    const res2 = await runOrchestratorStep(ctx, req2);
    console.log(`Status: ${res2.status}`);
    console.log(`New Latex: ${res2.engineResult?.newExpressionLatex}`);

    if (res2.status !== "step-applied") {
        console.error("FAIL: Step 2 failed");
        process.exit(1);
    }

    // Verify history has 2 entries (persisted from Step 1)
    if (res2.history.entries.length !== 2) {
        console.error(`FAIL: Expected history length 2, got ${res2.history.entries.length}`);
        process.exit(1);
    }
    console.log("PASS: History has 2 entries (persisted)");

    // 4. Verify Isolation (New Session)
    console.log("\n[Step 3] New Session Isolation");
    const session2 = "test-session-2";
    const req3: OrchestratorStepRequest = {
        sessionId: session2,
        expressionLatex: "3 + 2/5",
        selectionPath: "term[0]"
    };

    const res3 = await runOrchestratorStep(ctx, req3);
    if (res3.history.entries.length !== 1) {
        console.error(`FAIL: Expected history length 1 for new session, got ${res3.history.entries.length}`);
        process.exit(1);
    }
    console.log("PASS: New session starts with empty history");

    console.log("\n--- Verification Finished ---");
}

runTest().catch(console.error);


import { loadInvariantRegistryFromFile } from "../src/invariants/index";
import { createDefaultStudentPolicy } from "../src/stepmaster/stepmaster.policy";
import { runOrchestratorStep, undoLastStep, OrchestratorContext, OrchestratorStepRequest } from "../src/orchestrator/step.orchestrator";
import { SessionService } from "../src/session/session.service";

async function runTest() {
    console.log("--- Starting Undo Verification ---");

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

    const sessionId = "test-undo-session";
    SessionService.clear(sessionId);

    // 2. Step 1: 3 + 2/5 -> 3/1 + 2/5
    console.log("\n[Step 1] Input: 3 + 2/5");
    const req1: OrchestratorStepRequest = {
        sessionId: sessionId,
        expressionLatex: "3 + 2/5",
        selectionPath: "term[0]"
    };

    const res1 = await runOrchestratorStep(ctx, req1);
    if (res1.status !== "step-applied") {
        console.error("FAIL: Step 1 failed");
        process.exit(1);
    }
    console.log(`Step 1 Result: ${res1.engineResult?.newExpressionLatex}`);

    // 3. Step 2: 3/1 + 2/5 -> 3/1 * 1 + 2/5 (using P.ONE_TO_FRAC logic or similar)
    // Actually, let's just do another simple step.
    // Input: 3/1 + 2/5. Select 3/1.
    console.log("\n[Step 2] Input: 3/1 + 2/5");
    const req2: OrchestratorStepRequest = {
        sessionId: sessionId,
        expressionLatex: "3/1 + 2/5",
        selectionPath: "term[0]"
    };
    const res2 = await runOrchestratorStep(ctx, req2);
    if (res2.status !== "step-applied") {
        console.error("FAIL: Step 2 failed");
        process.exit(1);
    }
    console.log(`Step 2 Result: ${res2.engineResult?.newExpressionLatex}`);

    // Verify history has 2 entries
    const historyAfterStep2 = SessionService.getHistory(sessionId);
    if (historyAfterStep2.entries.length !== 2) {
        console.error(`FAIL: Expected history length 2, got ${historyAfterStep2.entries.length}`);
        process.exit(1);
    }

    // 4. Undo Step 2
    console.log("\n[Undo 1] Undoing Step 2...");
    const undoRes1 = await undoLastStep(ctx, sessionId);
    console.log(`Undo 1 Result (Previous Expression): ${undoRes1}`);

    if (undoRes1 !== "3/1 + 2/5") {
        console.error(`FAIL: Expected '3/1 + 2/5', got '${undoRes1}'`);
        process.exit(1);
    }

    // Verify history has 1 entry
    const historyAfterUndo1 = SessionService.getHistory(sessionId);
    if (historyAfterUndo1.entries.length !== 1) {
        console.error(`FAIL: Expected history length 1, got ${historyAfterUndo1.entries.length}`);
        process.exit(1);
    }
    console.log("PASS: Undo 1 correct");

    // 5. Undo Step 1
    console.log("\n[Undo 2] Undoing Step 1...");
    const undoRes2 = await undoLastStep(ctx, sessionId);
    console.log(`Undo 2 Result (Previous Expression): ${undoRes2}`);

    if (undoRes2 !== "3 + 2/5") {
        console.error(`FAIL: Expected '3 + 2/5', got '${undoRes2}'`);
        process.exit(1);
    }

    // Verify history has 0 entries
    const historyAfterUndo2 = SessionService.getHistory(sessionId);
    if (historyAfterUndo2.entries.length !== 0) {
        console.error(`FAIL: Expected history length 0, got ${historyAfterUndo2.entries.length}`);
        process.exit(1);
    }
    console.log("PASS: Undo 2 correct");

    // 6. Undo on Empty History
    console.log("\n[Undo 3] Undoing on empty history...");
    const undoRes3 = await undoLastStep(ctx, sessionId);
    console.log(`Undo 3 Result: ${undoRes3}`);

    if (undoRes3 !== null) {
        console.error(`FAIL: Expected null, got '${undoRes3}'`);
        process.exit(1);
    }
    console.log("PASS: Undo 3 correct (handled empty history)");

    console.log("\n--- Verification Finished ---");
}

runTest().catch(console.error);

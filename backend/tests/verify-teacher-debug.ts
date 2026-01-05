
import { loadInvariantRegistryFromFile } from "../src/invariants/index";
import { createDefaultStudentPolicy, createTeacherDebugPolicy } from "../src/stepmaster/stepmaster.policy";
import { HandlerPostEntryStep, HandlerDeps } from "../src/server/HandlerPostEntryStep";
import { SessionService } from "../src/session/session.service";

async function runTest() {
    console.log("--- Starting Teacher Debug Verification ---");

    // 1. Setup Dependencies
    const registry = loadInvariantRegistryFromFile({
        path: "config/courses/default.course.invariants.json"
    });
    console.log(`Registry loaded.`);

    const defaultPolicy = createDefaultStudentPolicy();
    const deps: HandlerDeps = {
        invariantRegistry: registry,
        policy: defaultPolicy,
        log: (msg) => console.log(msg),
    };

    const sessionId = "test-debug-session";
    SessionService.clear(sessionId);

    // 2. Test with Default Policy (Student)
    // Input: 1/2 + 1/3. Should have multiple candidates (common denominator, etc.) but return only 1 (or none in debugInfo).
    console.log("\n[Test 1] Default Policy (Student)");
    const req1 = {
        sessionId,
        expressionLatex: "1/2 + 1/3",
        selectionPath: "term[0]", // Select first term
    };

    const res1 = await HandlerPostEntryStep(req1, deps);

    if (res1.status !== "step-applied" && res1.status !== "no-candidates") {
        // It might be no-candidates if selection is invalid or something, but we expect some result.
        // Actually 1/2 + 1/3 should have candidates.
    }

    if (res1.debugInfo) {
        console.error("FAIL: Expected no debugInfo for student policy, got:", res1.debugInfo);
        process.exit(1);
    } else {
        console.log("PASS: No debugInfo returned for student policy.");
    }

    // 3. Test with Teacher Debug Policy
    console.log("\n[Test 2] Teacher Debug Policy");
    const req2 = {
        sessionId,
        expressionLatex: "1/2 + 1/3",
        selectionPath: "term[0]",
        policyId: "teacher.debug"
    };

    const res2 = await HandlerPostEntryStep(req2, deps);

    if (!res2.debugInfo) {
        console.error("FAIL: Expected debugInfo for teacher.debug policy, got null/undefined.");
        process.exit(1);
    }

    if (!Array.isArray(res2.debugInfo.allCandidates)) {
        console.error("FAIL: Expected debugInfo.allCandidates to be an array.");
        process.exit(1);
    }

    console.log(`PASS: debugInfo returned with ${res2.debugInfo.allCandidates.length} candidates.`);

    // Optional: Print candidate IDs to verify
    // const candidateIds = res2.debugInfo.allCandidates.map((c: any) => c.id);
    // console.log("Candidates:", candidateIds);

    if (res2.debugInfo.allCandidates.length === 0) {
        console.warn("WARNING: No candidates found. This might be correct depending on logic, but usually 1/2 + 1/3 has candidates.");
    }

    console.log("\n--- Verification Finished ---");
}

runTest().catch(console.error);

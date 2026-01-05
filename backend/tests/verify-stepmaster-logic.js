/**
 * verify-stepmaster-logic.ts
 *
 * Verify StepMaster logic:
 * 1. Loop prevention: Should not choose a candidate that repeats the last step.
 * 2. Default policy: Should choose the first valid candidate.
 */
import { stepMasterDecide } from "../src/stepmaster/stepmaster.core";
import { createDefaultStudentPolicy } from "../src/stepmaster/stepmaster.policy";
function createCandidate(id, ruleId, path) {
    return {
        id: id,
        invariantRuleId: ruleId,
        primitiveIds: [],
        targetPath: path,
        description: "test candidate"
    };
}
function runTest() {
    console.log("--- Starting StepMaster Logic Verification ---");
    const candidateA = createCandidate("c1", "R.TEST_A", "root");
    const candidateB = createCandidate("c2", "R.TEST_B", "root");
    // Case 1: No history, should pick first (A)
    console.log("\n[Case 1] No history");
    const input1 = {
        candidates: [candidateA, candidateB],
        history: { lastStep: null },
        policy: createDefaultStudentPolicy()
    };
    const res1 = stepMasterDecide(input1);
    if (res1.decision.status === "chosen" && res1.decision.chosenCandidateId === candidateA.id) {
        console.log("PASS: Chosen first candidate");
    }
    else {
        console.log("FAIL: Expected c1, got", res1.decision);
    }
    // Case 2: History has A, should pick B (A is repetitive)
    console.log("\n[Case 2] History has A (same rule, same path)");
    const input2 = {
        candidates: [candidateA, candidateB],
        history: {
            lastStep: {
                stepId: "s1",
                timestampIso: new Date().toISOString(),
                decisionStatus: "chosen",
                candidateId: "c1",
                invariantRuleId: "R.TEST_A",
                targetPath: "root",
            }
        },
        policy: createDefaultStudentPolicy()
    };
    const res2 = stepMasterDecide(input2);
    if (res2.decision.status === "chosen" && res2.decision.chosenCandidateId === candidateB.id) {
        console.log("PASS: Skipped repetitive A, chosen B");
    }
    else {
        console.log("FAIL: Expected c2, got", res2.decision);
    }
    // Case 3: History has A, but only candidate is A -> no-candidates
    console.log("\n[Case 3] History has A, only candidate is A");
    const input3 = {
        candidates: [candidateA],
        history: {
            lastStep: {
                stepId: "s1",
                timestampIso: new Date().toISOString(),
                decisionStatus: "chosen",
                candidateId: "c1",
                invariantRuleId: "R.TEST_A",
                targetPath: "root",
            }
        },
        policy: createDefaultStudentPolicy()
    };
    const res3 = stepMasterDecide(input3);
    if (res3.decision.status === "no-candidates") {
        console.log("PASS: Returned no-candidates (loop prevention)");
    }
    else {
        console.log("FAIL: Expected no-candidates, got", res3.decision);
    }
    console.log("\n--- Verification Finished ---");
}
runTest();

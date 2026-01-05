import { handlePostRegister, handlePostLogin } from "../src/server/HandlerAuth";
import { HandlerPostEntryStep, type HandlerDeps } from "../src/server/HandlerPostEntryStep";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";
import { createDefaultStudentPolicy } from "../src/stepmaster/stepmaster.policy";
import { loadAllCoursesFromDir } from "../src/invariants/invariants.course-loader";
import path from "path";
import assert from "assert";

async function runTest() {
    console.log("Starting verify-auth-roles test...");

    // 1. Setup Deps
    // 1. Setup Deps
    const coursesDir = path.join(process.cwd(), "config/courses");
    const registry = loadAllCoursesFromDir({ path: coursesDir });

    const deps: HandlerDeps = {
        invariantRegistry: registry,
        policy: createDefaultStudentPolicy(),
        log: (msg) => console.log(msg),
    };

    // 2. Test Register Teacher
    console.log("\n--- Testing Register Teacher ---");
    const regRes = await handlePostRegister({
        username: "new_teacher",
        password: "password123",
        role: "teacher"
    });
    assert.strictEqual(regRes.status, "ok");
    assert.ok(regRes.token, "Token should be returned");
    assert.strictEqual(regRes.role, "teacher");
    const teacherToken = regRes.token!;
    console.log("Teacher registered with token:", teacherToken);

    // 3. Test Login Student (using seeded student)
    console.log("\n--- Testing Login Student ---");
    const loginRes = await handlePostLogin({
        username: "student1",
        password: "pass"
    });
    assert.strictEqual(loginRes.status, "ok");
    assert.ok(loginRes.token, "Token should be returned");
    assert.strictEqual(loginRes.role, "student");
    const studentToken = loginRes.token!;
    console.log("Student logged in with token:", studentToken);

    // 4. Test Teacher Access (Should get debugInfo)
    console.log("\n--- Testing Teacher Access (teacher.debug) ---");
    const teacherReq = {
        sessionId: "sess_teacher",
        courseId: "default",
        expressionLatex: "1/2 + 1/3",
        selectionPath: null,
        policyId: "teacher.debug",
        token: teacherToken
    };
    const teacherStepRes = await HandlerPostEntryStep(teacherReq, deps);
    // With teacher.debug, we expect debugInfo to be populated
    if (teacherStepRes.debugInfo && teacherStepRes.debugInfo.allCandidates) {
        console.log("SUCCESS: Teacher received debugInfo.");
    } else {
        console.error("FAILURE: Teacher did NOT receive debugInfo.");
        process.exit(1);
    }

    // 5. Test Student Access Denied (Should NOT get debugInfo)
    console.log("\n--- Testing Student Access Denied (teacher.debug) ---");
    const studentReq = {
        sessionId: "sess_student",
        courseId: "default",
        expressionLatex: "1/2 + 1/3",
        selectionPath: null,
        policyId: "teacher.debug", // Trying to use teacher policy
        token: studentToken
    };
    const studentStepRes = await HandlerPostEntryStep(studentReq, deps);
    // Should fallback to student policy, so NO debugInfo
    if (!studentStepRes.debugInfo) {
        console.log("SUCCESS: Student did NOT receive debugInfo (Access Denied).");
    } else {
        console.error("FAILURE: Student received debugInfo! Security Breach.");
        process.exit(1);
    }

    // 6. Test Anonymous Access Denied
    console.log("\n--- Testing Anonymous Access Denied ---");
    const anonReq = {
        sessionId: "sess_anon",
        courseId: "default",
        expressionLatex: "1/2 + 1/3",
        selectionPath: null,
        policyId: "teacher.debug"
        // No token
    };
    const anonStepRes = await HandlerPostEntryStep(anonReq, deps);
    if (!anonStepRes.debugInfo) {
        console.log("SUCCESS: Anonymous user did NOT receive debugInfo.");
    } else {
        console.error("FAILURE: Anonymous user received debugInfo!");
        process.exit(1);
    }

    // 7. Test Tampered Token (Signature Verification)
    console.log("\n--- Testing Tampered Token ---");
    // Take a valid teacher token and modify the signature part
    const tamperedToken = teacherToken.substring(0, teacherToken.length - 5) + "xxxxx";
    const tamperedReq = {
        sessionId: "sess_tampered",
        courseId: "default",
        expressionLatex: "1/2 + 1/3",
        selectionPath: null,
        policyId: "teacher.debug",
        token: tamperedToken
    };
    const tamperedRes = await HandlerPostEntryStep(tamperedReq, deps);
    if (!tamperedRes.debugInfo) {
        console.log("SUCCESS: Tampered token treated as invalid (No debugInfo).");
    } else {
        console.error("FAILURE: Tampered token was accepted!");
        process.exit(1);
    }

    console.log("\nAll Auth/Role tests passed!");
}

runTest().catch(err => {
    console.error("Test failed with error:", err);
    process.exit(1);
});

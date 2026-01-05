import { handlePostRegister } from "../src/server/HandlerAuth";
import { handleGetStudentProgress } from "../src/server/HandlerReporting";
import { HandlerPostEntryStep } from "../src/server/HandlerPostEntryStep";
import { createTeacherDebugPolicy } from "../src/stepmaster/stepmaster.policy";
import { loadAllCoursesFromDir } from "../src/invariants/invariants.course-loader";
import path from "path";
import assert from "assert";
import { IncomingMessage, ServerResponse } from "http";
import { Socket } from "net";
// Mock Request/Response helpers
function createMockReq(url, headers = {}) {
    const socket = new Socket();
    const req = new IncomingMessage(socket);
    req.url = url;
    req.headers = headers;
    if (!req.headers.host) {
        req.headers.host = "localhost";
    }
    return req;
}
function createMockRes() {
    const req = new IncomingMessage(new Socket());
    const res = new ServerResponse(req);
    let data = "";
    let statusCode = 200;
    res.writeHead = (code, headers) => {
        statusCode = code;
        return res;
    };
    res.end = (chunk) => {
        if (chunk)
            data += chunk;
        res.emit("finish");
    };
    res._getData = () => data;
    res._getStatusCode = () => statusCode;
    return res;
}
async function runTest() {
    console.log("Starting verify-reporting-errors test...");
    // 1. Setup Deps
    const coursesDir = path.join(process.cwd(), "config/courses");
    const registry = loadAllCoursesFromDir({ path: coursesDir });
    const deps = {
        invariantRegistry: registry,
        policy: createTeacherDebugPolicy(),
        log: (msg) => console.log(msg),
    };
    // 2. Register Users
    console.log("\n--- Registering Users ---");
    const suffix = Date.now();
    const teacherReg = await handlePostRegister({ username: `teacher_err_${suffix}`, password: "pwd", role: "teacher" }, deps);
    const studentReg = await handlePostRegister({ username: `student_err_${suffix}`, password: "pwd", role: "student" }, deps);
    if (teacherReg.status === "error")
        throw new Error(`Teacher reg failed: ${teacherReg.error}`);
    if (studentReg.status === "error")
        throw new Error(`Student reg failed: ${studentReg.error}`);
    const teacherToken = teacherReg.token;
    const studentToken = studentReg.token;
    const studentUserId = studentReg.userId;
    // 3. Create Session & Generate Errors
    console.log("\n--- Creating Session & Generating Errors ---");
    const sessionId = `sess_err_${suffix}`;
    // Step 1: Valid Step (1 + 1 -> 2)
    console.log("Step 1: Valid (1 + 1)");
    await HandlerPostEntryStep({
        sessionId,
        courseId: "default",
        expressionLatex: "1 + 1",
        selectionPath: null, // Select the whole expression
        token: studentToken
    }, deps);
    // Step 2: Engine Error (10/0 -> Division by Zero)
    console.log("Step 2: Engine Error (10/0)");
    const res2 = await HandlerPostEntryStep({
        sessionId,
        courseId: "default",
        expressionLatex: "10 / 0",
        selectionPath: null,
        token: teacherToken // Use teacher token to see debug info
    }, deps);
    console.log("Step 2 Result:", res2.status);
    if (res2.debugInfo) {
        console.log("Debug Info Candidates:", JSON.stringify(res2.debugInfo.allCandidates, null, 2));
    }
    assert.strictEqual(res2.status, "engine-error");
    // Step 3: No Candidates (Invalid selection or expression)
    // "1" has no operations
    console.log("Step 3: No Candidates (x)");
    const res3 = await HandlerPostEntryStep({
        sessionId,
        courseId: "default",
        expressionLatex: "x",
        selectionPath: null,
        token: studentToken
    }, deps);
    console.log("Step 3 Result:", res3.status);
    assert.strictEqual(res3.status, "no-candidates");
    // 4. Verify Report
    console.log("\n--- Verifying Report ---");
    const studentId = studentReg.userId;
    if (!studentId)
        throw new Error("Student ID not found in registration response");
    const req = createMockReq(`/api/teacher/student-progress?userId=${studentId}`, {
        authorization: `Bearer ${teacherToken}`
    });
    const res = createMockRes();
    await handleGetStudentProgress(req, res);
    console.log(`Status: ${res._getStatusCode()}`);
    console.log(`Body: ${res._getData()}`);
    assert.strictEqual(res._getStatusCode(), 200);
    const body = JSON.parse(res._getData());
    // We expect 1 session
    assert.strictEqual(body.totalSessions, 1);
    // We expect 2 errors (Step 2 and Step 3)
    // Step 1 was valid.
    // Step 2 was engine-error.
    // Step 3 was no-candidates.
    // Total steps in history: 3.
    // Errors: 2.
    assert.strictEqual(body.totalErrors, 2);
    assert.strictEqual(body.sessions[0].stepCount, 3);
    assert.strictEqual(body.sessions[0].errorCount, 2);
    console.log("PASS: Report correctly counts errors.");
}
runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});

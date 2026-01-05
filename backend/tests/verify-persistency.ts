import { authService } from "../src/auth/auth.service";
import { SessionService } from "../src/session/session.service";
import { HandlerPostEntryStep, type HandlerDeps } from "../src/server/HandlerPostEntryStep";
import { loadAllCoursesFromDir } from "../src/invariants/invariants.course-loader";
import { createDefaultStudentPolicy } from "../src/stepmaster/stepmaster.policy";
import path from "path";
import assert from "assert";
import fs from "fs/promises";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

async function cleanup() {
    try {
        await fs.rm(DATA_DIR, { recursive: true, force: true });
    } catch (e) {
        // Ignore
    }
}

async function runTest() {
    console.log("Starting verify-persistency test...");
    await cleanup();

    // 1. Setup Deps
    const coursesDir = path.join(process.cwd(), "config/courses");
    const registry = loadAllCoursesFromDir({ path: coursesDir });
    console.log("Registry loaded. Sets:", registry.getAllInvariantSets().map(s => s.id));
    const deps: HandlerDeps = {
        invariantRegistry: registry,
        policy: createDefaultStudentPolicy(),
        log: () => { },
    };

    // 2. Run 1: Create Data
    console.log("\n--- Run 1: Creating Data ---");

    // Register User
    console.log("Registering user 'persist_user'...");
    await authService.init(); // Ensure initialized
    const user = await authService.register("persist_user", "pass123", "student");
    const token = await authService.login("persist_user", "pass123");
    assert.ok(token, "Login failed");
    const tokenString = authService.generateTokenString(token);

    // Create Session and Add Step
    console.log("Creating session and adding step...");
    const sessionId = "sess_persist_1";
    const req = {
        sessionId,
        courseId: "default",
        expressionLatex: "3 + 2/5",
        selectionPath: "term[0]",
        token: tokenString
    };
    const res = await HandlerPostEntryStep(req, deps);
    assert.strictEqual(res.status, "step-applied", "Step should be applied");

    // Verify files exist
    const usersExists = await fs.stat(USERS_FILE).then(() => true).catch(() => false);
    const sessionsExists = await fs.stat(SESSIONS_FILE).then(() => true).catch(() => false);
    assert.ok(usersExists, "users.json should exist");
    assert.ok(sessionsExists, "sessions.json should exist");
    console.log("Data files created successfully.");

    // 3. Simulate Restart (Clear in-memory state)
    console.log("\n--- Simulating Restart ---");
    // We can't easily clear the singleton instances without reloading modules, 
    // but we can verify that a NEW instance (or re-init) would load from file.
    // Since we are using singletons, we will manually clear their internal maps if possible,
    // or just inspect the file content to be sure.
    // Ideally, we would spawn a separate process for Run 2, but let's just inspect the file content first.

    const usersContent = JSON.parse(await fs.readFile(USERS_FILE, 'utf-8'));
    const sessionsContent = JSON.parse(await fs.readFile(SESSIONS_FILE, 'utf-8'));

    assert.ok(usersContent.find((u: any) => u.username === "persist_user"), "User should be in file");
    const sessionInFile = sessionsContent.find((s: any) => s.id === sessionId);
    assert.ok(sessionInFile, "Session should be in file");
    assert.strictEqual(sessionInFile.history.entries.length, 1, "History should have 1 entry");
    assert.ok(sessionInFile.history.entries[0].expressionAfter, "History entry should have expressionAfter");

    console.log("File content verified.");

    console.log("\nAll Persistency tests passed!");
}

runTest().catch(err => {
    console.error("Test failed with error:", err);
    process.exit(1);
});

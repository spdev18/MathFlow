import { join } from "node:path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { loadAllCoursesFromDir } from "../src/invariants/invariants.course-loader";
import { runOrchestratorStep } from "../src/orchestrator/step.orchestrator";
import { createDefaultStudentPolicy } from "../src/stepmaster/stepmaster.policy";
const TEMP_DIR = join(process.cwd(), "tests", "temp-courses");
function createCourseFile(filename, setId, ruleTitle) {
    const model = {
        primitives: [
            {
                id: "P.INT_ADD",
                name: "Integer Addition",
                description: "Adds two integers",
                category: "arithmetic",
                tags: ["integer", "add"]
            }
        ],
        invariantSets: [
            {
                id: setId,
                name: `Course ${setId}`,
                description: "Test Course",
                version: "1.0.0",
                rules: [
                    {
                        id: `R.INT_ADD_${setId}`,
                        title: ruleTitle,
                        shortStudentLabel: "Add",
                        description: "Adds two integers",
                        level: "core",
                        tags: ["add"],
                        primitiveIds: ["P.INT_ADD"]
                    }
                ]
            }
        ]
    };
    writeFileSync(join(TEMP_DIR, filename), JSON.stringify(model, null, 2));
}
async function runTest() {
    console.log("--- Starting Multi-Course Loading Verification ---");
    // 1. Setup
    if (existsSync(TEMP_DIR)) {
        rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEMP_DIR, { recursive: true });
    try {
        // 2. Create Course Files
        createCourseFile("course-a.json", "course.a", "Rule from Course A");
        createCourseFile("course-b.json", "course.b", "Rule from Course B");
        console.log("Created temporary course files.");
        // 3. Load Courses
        const registry = loadAllCoursesFromDir({ path: "tests/temp-courses" });
        console.log("Loaded registry from temp directory.");
        const setA = registry.getInvariantSetById("course.a");
        const setB = registry.getInvariantSetById("course.b");
        if (setA && setB) {
            console.log("PASS: Both invariant sets loaded.");
        }
        else {
            console.error("FAIL: Failed to load both sets.");
            process.exit(1);
        }
        // 4. Verify Orchestrator Selection
        const policy = createDefaultStudentPolicy();
        const ctx = { invariantRegistry: registry, policy };
        // Test Course A
        const reqA = {
            sessionId: "session-a",
            courseId: "course.a",
            expressionLatex: "3 + 5",
            selectionPath: null
        };
        const resultA = await runOrchestratorStep(ctx, reqA);
        const lastEntryA = resultA.history.entries[resultA.history.entries.length - 1];
        if (resultA.status === "step-applied" && lastEntryA.invariantRuleId === "R.INT_ADD_course.a") {
            console.log("PASS: Course A selected correct rule (R.INT_ADD_course.a).");
        }
        else {
            console.error("FAIL: Course A selection failed.", resultA, lastEntryA);
            process.exit(1);
        }
        // Test Course B
        const reqB = {
            sessionId: "session-b",
            courseId: "course.b",
            expressionLatex: "3 + 5",
            selectionPath: null
        };
        const resultB = await runOrchestratorStep(ctx, reqB);
        const lastEntryB = resultB.history.entries[resultB.history.entries.length - 1];
        if (resultB.status === "step-applied" && lastEntryB.invariantRuleId === "R.INT_ADD_course.b") {
            console.log("PASS: Course B selected correct rule (R.INT_ADD_course.b).");
        }
        else {
            console.error("FAIL: Course B selection failed.", resultB, lastEntryB);
            process.exit(1);
        }
        // Test Invalid Course
        const reqInvalid = {
            sessionId: "session-invalid",
            courseId: "course.invalid",
            expressionLatex: "3 + 5",
            selectionPath: null
        };
        const resultInvalid = await runOrchestratorStep(ctx, reqInvalid);
        if (resultInvalid.status === "engine-error" && resultInvalid.engineResult?.errorCode?.includes("course-not-found")) {
            console.log("PASS: Invalid course ID handled correctly.");
        }
        else {
            console.error("FAIL: Invalid course ID not handled correctly.", resultInvalid);
            process.exit(1);
        }
    }
    finally {
        // Cleanup
        if (existsSync(TEMP_DIR)) {
            rmSync(TEMP_DIR, { recursive: true, force: true });
        }
        console.log("Cleaned up temp directory.");
    }
    console.log("--- Verification Finished ---");
}
runTest().catch(err => {
    console.error("Test failed with error:", err);
    process.exit(1);
});

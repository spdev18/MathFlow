/**
 * verify-hinting.ts
 *
 * Verify the Hinting Functionality (Phase III).
 */

import {
    loadAllCoursesFromDir,
} from "../src/invariants/index";
import {
    createDefaultStudentPolicy,
} from "../src/stepmaster/index";
import {
    generateHint,
    type OrchestratorContext,
} from "../src/orchestrator/index";
import type { HintRequest } from "../src/protocol/backend-step.types";

async function main() {
    console.log("--- Starting Hinting Verification ---");

    // 1. Load Registry
    const registry = loadAllCoursesFromDir({ path: "config/courses" });
    console.log("Registry loaded.");

    // 2. Create Context
    const ctx: OrchestratorContext = {
        invariantRegistry: registry,
        policy: createDefaultStudentPolicy(),
    };

    // 3. Test Case 1: 3 + 2/5 (Should hint to convert whole to fraction)
    console.log("\n--- Test Case 1: 3 + 2/5 (Select '3') ---");
    const req1: HintRequest = {
        sessionId: "hint-session-1",
        courseId: "default",
        expressionLatex: "3 + 2/5",
        selectionPath: "term[0]", // "3"
    };

    const res1 = await generateHint(ctx, req1);
    console.log("Status:", res1.status);
    if (res1.status === "hint-found") {
        console.log("Hint:", res1.hintText);
        // Expect "Convert whole number to fraction" or similar
        if (res1.hintText && res1.hintText.toLowerCase().includes("fraction")) {
            console.log("PASS: Hint related to fraction conversion found.");
        } else {
            console.log("FAIL: Unexpected hint text.");
        }
    } else {
        console.log("FAIL: No hint found.");
    }

    // 4. Test Case 2: 1/5 + 2/5 (Should hint to add numerators)
    console.log("\n--- Test Case 2: 1/5 + 2/5 (Select 'root') ---");
    const req2: HintRequest = {
        sessionId: "hint-session-1",
        courseId: "default",
        expressionLatex: "1/5 + 2/5",
        selectionPath: "root",
    };

    const res2 = await generateHint(ctx, req2);
    console.log("Status:", res2.status);
    if (res2.status === "hint-found") {
        console.log("Hint:", res2.hintText);
        // Expect "Add fractions with same denominator"
        if (res2.hintText && res2.hintText.toLowerCase().includes("add")) {
            console.log("PASS: Hint related to addition found.");
        } else {
            console.log("FAIL: Unexpected hint text.");
        }
    } else {
        console.log("FAIL: No hint found.");
    }

    // 5. Test Case 3: No possible step (e.g. 'x')
    console.log("\n--- Test Case 3: x (No steps) ---");
    const req3: HintRequest = {
        sessionId: "hint-session-1",
        courseId: "default",
        expressionLatex: "x",
        selectionPath: "root",
    };

    const res3 = await generateHint(ctx, req3);
    console.log("Status:", res3.status);
    if (res3.status === "no-hint") {
        console.log("PASS: Correctly returned no-hint.");
    } else {
        console.log("FAIL: Expected no-hint, got", res3.status);
    }

    console.log("\n--- Verification Finished ---");
}

main().catch(console.error);

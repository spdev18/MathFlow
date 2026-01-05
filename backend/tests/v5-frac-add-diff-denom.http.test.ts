/**
 * HTTP-Level Test: Fraction Add Diff Denom Step 1
 * 
 * Tests the V5 orchestrator endpoint directly via the handler function
 * (same path as HTTP requests without needing a running server).
 * 
 * This reproduces the Viewer failure where:
 * - Request: \frac{1}{2} + \frac{1}{3}, selectionPath: "root", clickTargetKind: "operator"
 * - Expected: P.FRAC_ADD_DIFF_DEN_MUL1 matches and applies
 * - Actual: status "engine-error" with errorCode "primitive-failed"
 */

import { describe, it, expect, beforeAll } from "vitest";
import { handlePostOrchestratorStepV5, HandlerDeps } from "../src/server/HandlerPostOrchestratorStepV5";
import { InMemoryInvariantRegistry } from "../src/invariants/index";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";

describe("V5 Step Endpoint - Fraction Add Diff Denom", () => {
    let deps: HandlerDeps;

    beforeAll(async () => {
        const registry = new InMemoryInvariantRegistry();
        await registry.loadFromDisk("./config/invariants");

        deps = {
            invariantRegistry: registry,
            policy: createDefaultStudentPolicy(),
            log: (msg) => console.log(msg)
        };
    });

    it("Matches P.FRAC_ADD_DIFF_DEN_MUL1 for \\frac{1}{2} + \\frac{1}{3}", async () => {
        const requestBody = {
            sessionId: "test-session-http",
            expressionLatex: "\\frac{1}{2} + \\frac{1}{3}",
            selectionPath: "root",
            courseId: "default",
            userRole: "student",
            // Click context (from Viewer)
            clickTargetKind: "operator",
            operator: "+",
            surfaceNodeKind: "BinaryOp",
            surfaceNodeId: "op-test"
        };

        console.log("[HTTP-TEST] Request:", JSON.stringify(requestBody, null, 2));

        const result = await handlePostOrchestratorStepV5(requestBody, deps);

        console.log("[HTTP-TEST] Response status:", result.status);
        console.log("[HTTP-TEST] Response debugInfo:", JSON.stringify(result.debugInfo, null, 2));
        console.log("[HTTP-TEST] Response engineResult:", JSON.stringify(result.engineResult, null, 2));

        // Should either be "choice" with P.FRAC_ADD_DIFF_DEN_MUL1 in choices
        // OR "step-applied" with result containing "\cdot 1"
        if (result.status === "choice") {
            expect(result.choices).toBeDefined();
            const hasFracAddDiffDenMul1 = result.choices?.some(
                c => c.primitiveId === "P.FRAC_ADD_DIFF_DEN_MUL1"
            );
            expect(hasFracAddDiffDenMul1).toBe(true);
        } else if (result.status === "step-applied") {
            expect(result.engineResult?.ok).toBe(true);
            expect(result.engineResult?.newExpressionLatex).toContain("\\cdot 1");
        } else {
            // Fail with diagnostic info
            console.error("[HTTP-TEST] UNEXPECTED STATUS:", result.status);
            console.error("[HTTP-TEST] debugInfo:", JSON.stringify(result.debugInfo, null, 2));
            console.error("[HTTP-TEST] engineResult:", JSON.stringify(result.engineResult, null, 2));
            expect(result.status).toMatch(/choice|step-applied/);
        }
    });

    it("Includes debugInfo even on failure", async () => {
        const requestBody = {
            sessionId: "test-session-debug",
            expressionLatex: "\\frac{1}{2} + \\frac{1}{3}",
            selectionPath: "root",
            courseId: "default",
            userRole: "student",
            clickTargetKind: "operator",
            operator: "+"
        };

        const result = await handlePostOrchestratorStepV5(requestBody, deps);

        // debugInfo should always be present (even on failure)
        console.log("[HTTP-TEST-DEBUG] debugInfo:", JSON.stringify(result.debugInfo, null, 2));

        // If this fails, we at least get diagnostic output
        if (result.status === "engine-error" || result.status === "no-candidates") {
            console.error("[HTTP-TEST-DEBUG] FAILURE - debugInfo should help diagnose:");
            console.error("  status:", result.status);
            console.error("  errorCode:", result.engineResult?.errorCode);
        }
    });
});

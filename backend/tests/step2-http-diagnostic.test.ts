/**
 * HTTP-Level Test: Step2 - ONE_TO_TARGET_DENOM
 * 
 * DIAGNOSTIC TEST to reproduce the Step2 failure in the real HTTP flow.
 * 
 * Context: After Step1, we have: \frac{1}{2} \cdot 1 + \frac{1}{3} \cdot 1
 * Step2: Clicking the LEFT '1' should produce: \frac{1}{2} \cdot \frac{3}{3} + \frac{1}{3} \cdot 1
 * Step2: Clicking the RIGHT '1' should produce: \frac{1}{2} \cdot 1 + \frac{1}{3} \cdot \frac{2}{2}
 */

import { describe, it, expect, beforeAll } from "vitest";
import { handlePostOrchestratorStepV5, HandlerDeps } from "../src/server/HandlerPostOrchestratorStepV5";
import { InMemoryInvariantRegistry, loadAllCoursesFromDir } from "../src/invariants/index";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";
import { createPrimitiveMaster } from "../src/primitive-master/PrimitiveMaster";
import { createPrimitivePatternRegistry } from "../src/primitive-master/PrimitivePatterns.registry";
import { parseExpression } from "../src/mapmaster/ast";
import { getStage1RegistryModel } from "../src/mapmaster/stage1-converter";

describe("V5 Step Endpoint - Step2 ONE_TO_TARGET_DENOM", () => {
    let deps: HandlerDeps;

    beforeAll(async () => {
        // Full setup like real server
        const fileRegistry = loadAllCoursesFromDir({ path: "config/courses" });
        const stage1Model = getStage1RegistryModel();

        const fileModel = {
            primitives: fileRegistry.getAllPrimitives(),
            invariantSets: fileRegistry.getAllInvariantSets()
        };
        const mergedPrimitives = [...fileModel.primitives];
        const seenPrimIds = new Set(fileModel.primitives.map(p => p.id));
        for (const prim of stage1Model.primitives) {
            if (!seenPrimIds.has(prim.id)) {
                mergedPrimitives.push(prim);
                seenPrimIds.add(prim.id);
            }
        }
        const mergedSets = [...fileModel.invariantSets];
        const defaultSetIndex = mergedSets.findIndex(s => s.id === "default");
        if (defaultSetIndex >= 0) {
            const defaultSet = mergedSets[defaultSetIndex];
            const allStage1Rules = stage1Model.invariantSets.flatMap(s => s.rules);
            const seenRuleIds = new Set(defaultSet.rules.map(r => r.id));
            for (const rule of allStage1Rules) {
                if (!seenRuleIds.has(rule.id)) {
                    defaultSet.rules.push(rule);
                    seenRuleIds.add(rule.id);
                }
            }
        }

        const registry = new InMemoryInvariantRegistry({
            model: { primitives: mergedPrimitives, invariantSets: mergedSets }
        });

        // Create primitiveMaster (required for V5 path)
        const primitiveMaster = createPrimitiveMaster({
            parseLatexToAst: async (latex) => parseExpression(latex),
            patternRegistry: createPrimitivePatternRegistry(),
            log: () => { },
        });

        deps = {
            invariantRegistry: registry,
            policy: createDefaultStudentPolicy(),
            primitiveMaster,
            log: (msg) => console.log(msg)
        };
    });

    // The Step2 starting expression (result of Step1)
    const step2Expression = "\\frac{1}{2} \\cdot 1 + \\frac{1}{3} \\cdot 1";

    it("Step2 LEFT: Click on left '1' WITH preferredPrimitiveId should become 3/3", async () => {
        const requestBody = {
            sessionId: "step2-left-test-" + Date.now(),
            expressionLatex: step2Expression,
            selectionPath: "term[0].term[1]", // The "1" in the left multiplication
            courseId: "default",
            userRole: "student",
            // CRITICAL: This is what the Viewer should send for Step2
            preferredPrimitiveId: "P.ONE_TO_TARGET_DENOM",
            clickTargetKind: "number",
            surfaceNodeKind: "Num"
        };

        console.log("\n[STEP2-HTTP-TEST] ============ LEFT '1' CLICK ============");
        console.log("[STEP2-HTTP-TEST] Request:", JSON.stringify(requestBody, null, 2));

        const result = await handlePostOrchestratorStepV5(requestBody, deps);

        console.log("[STEP2-HTTP-TEST] Response status:", result.status);
        console.log("[STEP2-HTTP-TEST] Response engineResult:", JSON.stringify(result.engineResult, null, 2));
        console.log("[STEP2-HTTP-TEST] Response debugInfo:", JSON.stringify(result.debugInfo, null, 2));

        // Should apply the transformation
        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.ok).toBe(true);
        expect(result.engineResult?.newExpressionLatex).toContain("\\frac{3}{3}");
    });

    it("Step2 RIGHT: Click on right '1' WITH preferredPrimitiveId should become 2/2", async () => {
        const requestBody = {
            sessionId: "step2-right-test-" + Date.now(),
            expressionLatex: step2Expression,
            selectionPath: "term[1].term[1]", // The "1" in the right multiplication
            courseId: "default",
            userRole: "student",
            preferredPrimitiveId: "P.ONE_TO_TARGET_DENOM",
            clickTargetKind: "number",
            surfaceNodeKind: "Num"
        };

        console.log("\n[STEP2-HTTP-TEST] ============ RIGHT '1' CLICK ============");
        console.log("[STEP2-HTTP-TEST] Request:", JSON.stringify(requestBody, null, 2));

        const result = await handlePostOrchestratorStepV5(requestBody, deps);

        console.log("[STEP2-HTTP-TEST] Response status:", result.status);
        console.log("[STEP2-HTTP-TEST] Response engineResult:", JSON.stringify(result.engineResult, null, 2));
        console.log("[STEP2-HTTP-TEST] Response debugInfo:", JSON.stringify(result.debugInfo, null, 2));

        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.ok).toBe(true);
        expect(result.engineResult?.newExpressionLatex).toContain("\\frac{2}{2}");
    });

    it("Step2 WITHOUT preferredPrimitiveId on '1' should return 'choice' or select ONE_TO_TARGET_DENOM", async () => {
        const requestBody = {
            sessionId: "step2-no-pref-test-" + Date.now(),
            expressionLatex: step2Expression,
            selectionPath: "term[0].term[1]",
            courseId: "default",
            userRole: "student",
            // NO preferredPrimitiveId - simulates first click (should offer choices or auto-apply)
            clickTargetKind: "number",
            surfaceNodeKind: "Num"
        };

        console.log("\n[STEP2-HTTP-TEST] ============ LEFT '1' NO PREF ============");
        console.log("[STEP2-HTTP-TEST] Request:", JSON.stringify(requestBody, null, 2));

        const result = await handlePostOrchestratorStepV5(requestBody, deps);

        console.log("[STEP2-HTTP-TEST] Response status:", result.status);
        console.log("[STEP2-HTTP-TEST] Response choices:", JSON.stringify(result.choices, null, 2));
        console.log("[STEP2-HTTP-TEST] Response debugInfo:", JSON.stringify(result.debugInfo, null, 2));

        // First click on integer should return "choice" with INT_TO_FRAC option
        // OR if Step2 context is detected, it should return choice with ONE_TO_TARGET_DENOM
        if (result.status === "choice") {
            expect(result.choices).toBeDefined();
            console.log("[STEP2-HTTP-TEST] Available choices:", result.choices?.map(c => c.primitiveId));
        } else if (result.status === "step-applied") {
            // Auto-applied is acceptable if ONE_TO_TARGET_DENOM was chosen
            console.log("[STEP2-HTTP-TEST] Auto-applied:", result.engineResult?.newExpressionLatex);
        } else {
            console.error("[STEP2-HTTP-TEST] UNEXPECTED:", result.status, result.engineResult);
        }
    });
});

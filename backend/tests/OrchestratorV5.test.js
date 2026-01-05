import { describe, it, expect } from "vitest";
import { runOrchestratorStep } from "../src/orchestrator/index";
import { loadAllCoursesFromDir } from "../src/invariants/index";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";
import { getStage1RegistryModel } from "../src/mapmaster/stage1-converter";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";
describe("Orchestrator V5 Flow", () => {
    // Setup dependencies similarly to cliEngineHttpServer to include Stage 1 rules
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
    const ctx = {
        invariantRegistry: registry,
        policy: createDefaultStudentPolicy(),
    };
    it("should execute P.INT_ADD for '1 + 2' when anchored to operator", async () => {
        const req = {
            sessionId: "v5-test-session",
            courseId: "default",
            expressionLatex: "1 + 2",
            selectionPath: "root",
            userRole: "student",
        };
        const result = await runOrchestratorStep(ctx, req);
        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("3");
    });
    it("should execute P.INT_DIV_TO_INT for '4 : 2' (exact division)", async () => {
        const req = {
            sessionId: "v5-test-session",
            courseId: "default",
            expressionLatex: "4 : 2",
            selectionPath: "root",
            userRole: "student",
        };
        const result = await runOrchestratorStep(ctx, req);
        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("2");
    });
    it("should execute P.FRAC_ADD_SAME_DEN for '1/7 + 3/7'", async () => {
        const uniqueId = "v5-frac-add-" + Date.now();
        const req = {
            sessionId: uniqueId,
            courseId: "default",
            expressionLatex: "1/7 + 3/7",
            selectionPath: "root",
            userRole: "student",
        };
        const result = await runOrchestratorStep(ctx, req);
        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("\\frac{4}{7}");
    });
    it("should execute P.FRAC_SUB_SAME_DEN for '3/7 - 1/7'", async () => {
        const uniqueId = "v5-frac-sub-" + Date.now();
        const req = {
            sessionId: uniqueId,
            courseId: "default",
            expressionLatex: "3/7 - 1/7",
            selectionPath: "root",
            userRole: "student",
        };
        const result = await runOrchestratorStep(ctx, req);
        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("\\frac{2}{7}");
    });
    it("should execute P.INT_TO_FRAC for '3' (normalization)", async () => {
        const uniqueId = "v5-norm-" + Date.now();
        const req = {
            sessionId: uniqueId,
            courseId: "default",
            expressionLatex: "3",
            selectionPath: "root", // P.INT_TO_FRAC applies to integer
            // but selectionPath="root" might target the integer if it's the root node.
            // If parser says "3" is integer type root node.
            userRole: "student",
        };
        const result = await runOrchestratorStep(ctx, req);
        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("\\frac{3}{1}");
    });
    it("should execute P.FRAC_EQUIV for '3/1 + 2/5'", async () => {
        const uniqueId = "v5-equiv-" + Date.now();
        // Target is 3/1. AST structure: binaryOp(+, fraction(3,1), fraction(2,5))
        // Path to 3/1 should be "term[0].left" or similar?
        // Wait, AST paths are "0" or "root" for root?
        // PrimitiveRunner's runLiftFraction uses assumption path ends with .left/.right
        // Our test runner might need explicit path?
        // MapMaster logic will find all candidates. Orchestrator picks one.
        // We hope it picks P.FRAC_EQUIV on 3/1.
        // If we select "root", does it apply?
        // Root is binaryOp. P.FRAC_EQUIV applies to fraction.
        // MapMaster traverses? 
        // V5 Orchestrator currently tries to find *any* candidate if selection mismatch or broad?
        // But let's assume we select the fraction specifically if possible.
        // If we just pass "root", candidates for binaryOp are checked.
        // binaryOp candidates: P.INT_ADD (integers?), P.FRAC_ADD (same den?).
        // '3/1 + 2/5' denominators are 1 and 5. Different. P.FRAC_ADD_SAME_DEN fails.
        // So no candidates on root match.
        // Orchestrator logic in `step.orchestrator.ts`:
        // "Candidates 0... If no candidates and selection is broad, try children?"
        // OR does it auto-suggest?
        // The V5 `searchCandidates` function in mapmaster core might support "bubbling" or "drilling"?
        // Currently StepMaster picks from ALL candidates generated by MapMaster.
        // MapMaster `generateCandidates` takes `selectionPath`.
        // If selection is "root", it generates usage for root node.
        // If we want P.FRAC_EQUIV on 3/1, we need to select 3/1.
        // In our simple AST, 3/1 is `left`.
        // Path strings in our AST implementation...
        // `parseExpression` returns root. `getNodeAt(root, "left")`.
        // So selectionPath shoud be "left".
        const req = {
            sessionId: uniqueId,
            courseId: "default",
            expressionLatex: "3/1 + 2/5",
            selectionPath: "left", // Targeting 3/1
            userRole: "student",
        };
        const result = await runOrchestratorStep(ctx, req);
        // Expect P.FRAC_EQUIV to apply and expand 3/1 to 15/5.
        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("\\frac{15}{5} + \\frac{2}{5}");
    });
    it("should execute P.FRAC_MUL for '1/2 * 3/5'", async () => {
        const uniqueId = "v5-frac-mul-" + Date.now();
        const req = {
            sessionId: uniqueId,
            courseId: "default",
            expressionLatex: "1/2 * 3/5",
            selectionPath: "root", // anchored to *
            userRole: "student",
        };
        const result = await runOrchestratorStep(ctx, req);
        expect(result.status).toBe("step-applied");
        // newFrac = { n: 1*3, d: 2*5 } -> 3/10
        expect(result.engineResult?.newExpressionLatex).toBe("\\frac{3}{10}");
    });
    it("should execute P.FRAC_DIV for '1/2 : 3/5'", async () => {
        const uniqueId = "v5-frac-div-" + Date.now();
        const req = {
            sessionId: uniqueId,
            courseId: "default",
            expressionLatex: "1/2 : 3/5",
            selectionPath: "root", // anchored to :
            userRole: "student",
        };
        const result = await runOrchestratorStep(ctx, req);
        expect(result.status).toBe("step-applied");
        // newFrac = { n: 1*5, d: 2*3 } -> 5/6
        expect(result.engineResult?.newExpressionLatex).toBe("\\frac{5}{6}");
    });
});

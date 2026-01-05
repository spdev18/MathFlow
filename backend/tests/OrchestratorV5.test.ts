import { describe, it, expect } from "vitest";
import { runOrchestratorStep, type OrchestratorContext, type OrchestratorStepRequest } from "../src/orchestrator/index";
import { loadAllCoursesFromDir } from "../src/invariants/index";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";
import { getStage1RegistryModel } from "../src/mapmaster/stage1-converter";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";
import { createPrimitiveMaster } from "../src/primitive-master/PrimitiveMaster";
import { createPrimitivePatternRegistry } from "../src/primitive-master/PrimitivePatterns.registry";
import { parseExpression } from "../src/mapmaster/ast";

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

    // Create primitiveMaster - this is required for the V5 code path
    const primitiveMaster = createPrimitiveMaster({
        parseLatexToAst: async (latex) => parseExpression(latex),
        patternRegistry: createPrimitivePatternRegistry(),
        log: () => { },
    });

    const ctx: OrchestratorContext = {
        invariantRegistry: registry,
        policy: createDefaultStudentPolicy(),
        primitiveMaster,
    };

    // Generate unique session ID for each test to avoid session state collisions
    const genSessionId = () => `v5-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    it("should execute P.INT_ADD for '1 + 2' when anchored to operator", async () => {
        const req: OrchestratorStepRequest = {
            sessionId: genSessionId(), // Unique session to avoid repetitive rejection
            courseId: "default",
            expressionLatex: "1 + 2",
            selectionPath: "root",
            userRole: "student",
        };

        const result = await runOrchestratorStep(ctx, req);

        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("3");
    });

    // Division with V5 path - use preferredPrimitiveId to select exact division
    it("should execute P.INT_DIV_EXACT for '4 \\div 2' with preferredPrimitiveId", async () => {
        const req: OrchestratorStepRequest = {
            sessionId: genSessionId(),
            courseId: "default",
            expressionLatex: "4 \\div 2",
            selectionPath: "root",
            preferredPrimitiveId: "P.INT_DIV_EXACT",
            userRole: "student",
        };

        const result = await runOrchestratorStep(ctx, req);

        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("2");
    });

    it("should execute P.FRAC_ADD_SAME_DEN for '1/7 + 3/7'", async () => {
        const req: OrchestratorStepRequest = {
            sessionId: genSessionId(),
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
        const req: OrchestratorStepRequest = {
            sessionId: genSessionId(),
            courseId: "default",
            expressionLatex: "3/7 - 1/7",
            selectionPath: "root",
            userRole: "student",
        };

        const result = await runOrchestratorStep(ctx, req);

        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("\\frac{2}{7}");
    });

    // P1 Double-click behavior: preferredPrimitiveId is provided to bypass choice
    it("should execute P.INT_TO_FRAC for '3' (normalization) with preferredPrimitiveId", async () => {
        const req: OrchestratorStepRequest = {
            sessionId: genSessionId(),
            courseId: "default",
            expressionLatex: "3",
            selectionPath: "root",
            preferredPrimitiveId: "P.INT_TO_FRAC",
            userRole: "student",
        };

        const result = await runOrchestratorStep(ctx, req);

        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("\\frac{3}{1}");
    });

    // P1 Single-click behavior: no preferredPrimitiveId, returns choice menu
    it("should return 'choice' for '3' when no preferredPrimitiveId (single-click behavior)", async () => {
        const req: OrchestratorStepRequest = {
            sessionId: genSessionId(),
            courseId: "default",
            expressionLatex: "3",
            selectionPath: "root",
            userRole: "student",
        };

        const result = await runOrchestratorStep(ctx, req);

        expect(result.status).toBe("choice");
        expect(result.choices).toBeDefined();
        const hasIntToFrac = result.choices?.some(c => c.primitiveId === "P.INT_TO_FRAC");
        expect(hasIntToFrac).toBe(true);
    });

    it("should execute P.FRAC_MUL for '1/2 * 3/5'", async () => {
        const req: OrchestratorStepRequest = {
            sessionId: genSessionId(),
            courseId: "default",
            expressionLatex: "1/2 * 3/5",
            selectionPath: "root",
            userRole: "student",
        };

        const result = await runOrchestratorStep(ctx, req);

        expect(result.status).toBe("step-applied");
        expect(result.engineResult?.newExpressionLatex).toBe("\\frac{3}{10}");
    });

    // Fraction division - FRAC_DIV_AS_MUL converts to multiplication
    it("should execute P.FRAC_DIV_AS_MUL for fraction division (convert to multiplication)", async () => {
        const req: OrchestratorStepRequest = {
            sessionId: genSessionId(),
            courseId: "default",
            expressionLatex: "\\frac{1}{2} \\div \\frac{3}{5}",
            selectionPath: "root",
            operatorIndex: 0,
            userRole: "student",
        };

        const result = await runOrchestratorStep(ctx, req);

        expect(result.status).toBe("step-applied");
        // FRAC_DIV_AS_MUL converts division to multiplication: 1/2 ÷ 3/5 → 1/2 × 5/3
        expect(result.engineResult?.newExpressionLatex).toBe("\\frac{1}{2} \\cdot \\frac{5}{3}");
    });
});

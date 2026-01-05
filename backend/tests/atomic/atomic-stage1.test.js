import { describe, it, test, expect, beforeAll } from "vitest";
import { loadInvariantRegistryFromFile } from "../../src/invariants/index";
import { createDefaultStudentPolicy } from "../../src/stepmaster/index";
import { runOrchestratorStep } from "../../src/orchestrator/index";
import { SessionService } from "../../src/session/session.service";
describe("Stage-1 Atomic Behavior", () => {
    let ctx;
    beforeAll(() => {
        const registry = loadInvariantRegistryFromFile({
            path: "config/courses/default.course.invariants.json",
        });
        ctx = {
            invariantRegistry: registry,
            policy: createDefaultStudentPolicy(),
        };
    });
    it("FRAC_ADD_SAME: 1/7 + 3/7 -> 4/7", async () => {
        console.log("--- TEST START: FRAC_ADD_SAME 1/7 + 3/7 ---");
        await SessionService.createSession("test-session-1", "user1", "student");
        const res = await runOrchestratorStep(ctx, {
            sessionId: "test-session-1",
            courseId: "default",
            expressionLatex: "\\frac{1}{7} + \\frac{3}{7}",
            selectionPath: "root", // Click on '+' (root)
            userRole: "student",
        });
        expect(res.status).toBe("step-applied");
        // Expect exact fraction, no decimals
        expect(res.engineResult?.newExpressionLatex).toBe("\\frac{4}{7}");
    });
    it("FRAC_ADD_SAME: 5/7 + 2/7 -> 7/7", async () => {
        console.log("--- TEST START: FRAC_ADD_SAME 5/7 + 2/7 ---");
        await SessionService.createSession("test-session-2", "user1", "student");
        const res = await runOrchestratorStep(ctx, {
            sessionId: "test-session-2",
            courseId: "default",
            expressionLatex: "\\frac{5}{7} + \\frac{2}{7}",
            selectionPath: "root",
            userRole: "student",
        });
        expect(res.status).toBe("step-applied");
        expect(res.engineResult?.newExpressionLatex).toBe("\\frac{7}{7}");
    });
    it("FRAC_SUB_SAME: 5/7 - 2/7 -> 3/7", async () => {
        console.log("--- TEST START: FRAC_SUB_SAME 5/7 - 2/7 ---");
        await SessionService.createSession("test-session-2b", "user1", "student");
        const res = await runOrchestratorStep(ctx, {
            sessionId: "test-session-2b",
            courseId: "default",
            expressionLatex: "\\frac{5}{7} - \\frac{2}{7}",
            selectionPath: "root",
            userRole: "student",
        });
        expect(res.status).toBe("step-applied");
        expect(res.engineResult?.newExpressionLatex).toBe("\\frac{3}{7}");
    });
    it("INT_PLUS_FRAC: 3 + 5/7 -> no-candidates (Stage-1 Strict)", async () => {
        const res = await runOrchestratorStep(ctx, {
            sessionId: "test-session-3",
            courseId: "default",
            expressionLatex: "3 + \\frac{5}{7}",
            selectionPath: "root",
            userRole: "student",
        });
        // Stage-1 Strict Mode disables INT_PLUS_FRAC
        expect(res.status).toBe("no-candidates");
    });
    it("INT_PLUS_FRAC: 5/7 + 3 -> no-candidates (Stage-1 Strict)", async () => {
        const res = await runOrchestratorStep(ctx, {
            sessionId: "test-session-4",
            courseId: "default",
            expressionLatex: "\\frac{5}{7} + 3",
            selectionPath: "root",
            userRole: "student",
        });
        expect(res.status).toBe("no-candidates");
    });
    it("INT_DIV_EXACT: Should NOT be chosen on '+' click in (6/2 + 12/2)", async () => {
        // Scenario: 6/2 + 12/2.
        // Click on '+'.
        // INT_DIV_EXACT applies to '/' (division).
        // It should NOT be a candidate for '+'.
        // However, FRAC_ADD_SAME *should* apply if they are fractions with same denominator.
        // We use \frac to ensure they are parsed as fractions.
        console.log("--- TEST START: INT_DIV_EXACT ---");
        await SessionService.createSession("test-session-5", "user1", "student");
        const res = await runOrchestratorStep(ctx, {
            sessionId: "test-session-5",
            courseId: "default",
            expressionLatex: "\\frac{6}{2} + \\frac{12}{2}",
            selectionPath: "root",
            userRole: "student",
        });
        // We expect FRAC_ADD_SAME to apply.
        expect(res.status).toBe("step-applied");
        // 6/2 + 12/2 = 18/2
        expect(res.engineResult?.newExpressionLatex).toBe("\\frac{18}{2}");
    });
    test("Regression: 2 + 3 - 1 flow (INT_ADD then INT_SUB)", async () => {
        const sessionId = `test-session-${Date.now()}-reg1`;
        await SessionService.createSession(sessionId, "user1", "student");
        // Step 1: Click "+"
        let res = await runOrchestratorStep(ctx, {
            sessionId,
            courseId: "default",
            expressionLatex: "2 + 3 - 1",
            selectionPath: "term[0]", // The plus node
            userRole: "student"
        });
        expect(res.status).toBe("step-applied");
        expect(res.engineResult?.newExpressionLatex).toBe("5 - 1");
        // Step 2: Click "-"
        // Now expression is "5 - 1". Root is "-".
        res = await runOrchestratorStep(ctx, {
            sessionId,
            courseId: "default",
            expressionLatex: "5 - 1",
            selectionPath: "root", // The minus node
            userRole: "student"
        });
        expect(res.status).toBe("step-applied");
        expect(res.engineResult?.newExpressionLatex).toBe("4");
    });
    test("Regression: 1/7 + 3/7 anchoring (FRAC_ADD_SAME vs INT_DIV_EXACT)", async () => {
        const sessionId = `test-session-${Date.now()}-reg2`;
        await SessionService.createSession(sessionId, "user1", "student");
        const res = await runOrchestratorStep(ctx, {
            sessionId,
            courseId: "default",
            expressionLatex: "\\frac{1}{7} + \\frac{3}{7}",
            selectionPath: "root",
            userRole: "student"
        });
        expect(res.status).toBe("step-applied");
        expect(res.engineResult?.newExpressionLatex).toBe("\\frac{4}{7}");
    });
    test("Regression: 3 + 6 - (5/7 + 2/7) anchoring", async () => {
        const sessionId = `test-session-${Date.now()}-reg3`;
        await SessionService.createSession(sessionId, "user1", "student");
        const res = await runOrchestratorStep(ctx, {
            sessionId,
            courseId: "default",
            expressionLatex: "3 + 6 - (\\frac{5}{7} + \\frac{2}{7})",
            selectionPath: "term[0]",
            userRole: "student"
        });
        expect(res.status).toBe("step-applied");
        // 9 - (5/7 + 2/7)
        // Printer adds spaces around binary ops
        expect(res.engineResult?.newExpressionLatex).toBe("9 - (\\frac{5}{7} + \\frac{2}{7})");
    });
});

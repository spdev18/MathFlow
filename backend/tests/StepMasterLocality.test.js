import { describe, it, expect } from "vitest";
import { stepMasterDecide } from "../src/stepmaster/stepmaster.core";
import { createDefaultStudentPolicy } from "../src/stepmaster/stepmaster.policy";
describe("StepMaster Locality (Cursor Dictatorship)", () => {
    const mockCandidate1 = {
        id: "cand-1",
        invariantRuleId: "rule-1",
        targetPath: "term[0]",
        description: "Candidate 1",
        primitiveIds: ["prim-1"],
        priority: 1
    };
    const mockCandidate2 = {
        id: "cand-2",
        invariantRuleId: "rule-2",
        targetPath: "term[1]",
        description: "Candidate 2",
        primitiveIds: ["prim-2"],
        priority: 1
    };
    const emptyHistory = {
        lastStep: null,
        recentSteps: []
    };
    const policy = createDefaultStudentPolicy();
    it("selects candidate matching actionTarget", () => {
        const input = {
            candidates: [mockCandidate1, mockCandidate2],
            history: emptyHistory,
            policy: policy,
            actionTarget: "term[0]"
        };
        const result = stepMasterDecide(input);
        expect(result.decision.status).toBe("chosen");
        expect(result.decision.chosenCandidateId).toBe("cand-1");
    });
    it("returns no-candidates if no candidate matches actionTarget", () => {
        const input = {
            candidates: [mockCandidate1, mockCandidate2],
            history: emptyHistory,
            policy: policy,
            actionTarget: "term[2]" // No candidate matches this
        };
        const result = stepMasterDecide(input);
        expect(result.decision.status).toBe("no-candidates");
        expect(result.decision.chosenCandidateId).toBeNull();
    });
    it("ignores actionTarget if not provided (fallback behavior)", () => {
        const input = {
            candidates: [mockCandidate1, mockCandidate2],
            history: emptyHistory,
            policy: policy,
            actionTarget: undefined
        };
        const result = stepMasterDecide(input);
        expect(result.decision.status).toBe("chosen");
        // Should pick first one by default
        expect(result.decision.chosenCandidateId).toBe("cand-1");
    });
});

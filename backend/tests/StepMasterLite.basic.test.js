import { describe, it, expect } from "vitest";
import { choosePrimitiveId } from "../src/stepmaster-legacy/StepMasterLite.js";
const makeContext = (overrides) => ({
    expressionId: "expr-stepmaster-basic",
    latex: "1/3 + 2/5",
    invariantSetId: "fractions-basic.v1",
    mode: "preview",
    ...overrides,
});
const makeCandidate = (primitiveId, scenarioId, teachingTag) => ({
    primitiveId,
    label: primitiveId,
    scenarioId,
    teachingTag,
});
describe("StepMasterLite — scenario-based selection policy", () => {
    it("returns undefined when there are no candidates", () => {
        const context = makeContext();
        const primitiveId = choosePrimitiveId({
            candidates: [],
            context,
        });
        expect(primitiveId).toBeUndefined();
    });
    it("falls back to the first candidate when there is no scenario metadata", () => {
        const context = makeContext();
        const candidates = [
            makeCandidate("P.FIRST"),
            makeCandidate("P.SECOND"),
        ];
        const primitiveId = choosePrimitiveId({
            candidates,
            context,
        });
        expect(primitiveId).toBe("P.FIRST");
    });
    it("prefers SCN.FRAC_ADD_DIFF_DEN over other scenarios when available", () => {
        const context = makeContext();
        const candidates = [
            makeCandidate("P.SIMPLIFY", "SCN.FRAC_SIMPLIFY", "fractions.simplify.step1"),
            makeCandidate("P.ADD_DIFF_DEN", "SCN.FRAC_ADD_DIFF_DEN", "fractions.add.diff-den.step1"),
        ];
        const primitiveId = choosePrimitiveId({
            candidates,
            context,
        });
        expect(primitiveId).toBe("P.ADD_DIFF_DEN");
    });
});

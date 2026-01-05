import { describe, it, expect } from "vitest";
import { getInvariantsBySetId } from "../src/invariants/index.js";
import { FRACTIONS_BASIC_SET_ID } from "../src/invariants/invariant.types.js";
describe("Invariants metadata — fractions-basic.v1", () => {
    it("exposes scenarioId and teachingTag for basic fraction invariants", () => {
        const invariants = getInvariantsBySetId(FRACTIONS_BASIC_SET_ID);
        const sameDen = invariants.find((inv) => inv.id === "I4.FRAC_ADD_SAME_DEN_STEP1");
        const diffDen = invariants.find((inv) => inv.id === "I4.FRAC_ADD_DIFF_DEN_STEP1");
        const simplify = invariants.find((inv) => inv.id === "I0.FRAC_SIMPLIFY");
        expect(sameDen?.scenarioId).toBe("SCN.FRAC_ADD_SAME_DEN");
        expect(sameDen?.teachingTag).toBe("fractions.add.same-den.step1");
        expect(diffDen?.scenarioId).toBe("SCN.FRAC_ADD_DIFF_DEN");
        expect(diffDen?.teachingTag).toBe("fractions.add.diff-den.step1");
        expect(simplify?.scenarioId).toBe("SCN.FRAC_SIMPLIFY");
        expect(simplify?.teachingTag).toBe("fractions.simplify.step1");
    });
});

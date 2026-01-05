import { describe, it, expect } from "vitest";
import { buildMapLite } from "../src/mapmaster/MapMasterLite.js";
const makeRequest = (latex) => ({
    expressionId: "expr-mapmaster-same-den",
    mode: "preview",
    latex,
    invariantSetId: "fractions-basic.v1",
    clientEvent: {
        type: "click",
        surfaceNodeId: "surf-whole-expression",
        selection: [],
    },
});
describe("MapMasterLite — fractions with same denominator", () => {
    it("selects P4.FRAC_ADD_BASIC for 1/3 + 2/3", async () => {
        const request = makeRequest("1/3 + 2/3");
        const result = await buildMapLite(request);
        expect(result.candidates.length).toBeGreaterThan(0);
        expect(result.candidates[0]?.primitiveId).toBe("P4.FRAC_ADD_BASIC");
    });
});

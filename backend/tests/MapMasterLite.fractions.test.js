import { describe, it, expect } from "vitest";
import { buildMapLite } from "../src/mapmaster/MapMasterLite";
/**
 * Contract-level tests for MapMasterLite.
 *
 * The goal is to prove that for very simple fraction sums of the form
 * "a/b + c/d" MapMasterLite produces a single candidate with primitive
 * id "P4.FRAC_ADD_BASIC", and that for other expressions it stays silent.
 */
const makeRequest = (latex) => ({
    expressionId: "expr-mapmaster-lite",
    mode: "preview",
    latex,
    invariantSetId: "fractions-basic.v1",
    clientEvent: {
        type: "click",
        surfaceNodeId: "surf-whole-expression",
        selection: [],
    },
});
describe("MapMasterLite — simple fraction sums", () => {
    it("returns P4.FRAC_ADD_BASIC for a/b + c/d", async () => {
        const request = makeRequest("1/3 + 2/5");
        const result = await buildMapLite(request);
        console.log("Candidates:", JSON.stringify(result.candidates, null, 2));
        expect(result.candidates.length).toBe(1);
        expect(result.candidates[0]?.primitiveId).toBe("P4.FRAC_ADD_BASIC");
    });
    it("returns empty candidates for non-sum expressions", async () => {
        const request = makeRequest("2/3");
        const result = await buildMapLite(request);
        expect(result.candidates.length).toBe(0);
    });
    it("ignores whitespace and rejects zero denominators", async () => {
        const spacedRequest = makeRequest("  1/3   +   2/5  ");
        const spacedResult = await buildMapLite(spacedRequest);
        expect(spacedResult.candidates.length).toBe(1);
        expect(spacedResult.candidates[0]?.primitiveId).toBe("P4.FRAC_ADD_BASIC");
        const badRequest = makeRequest("1/0 + 2/5");
        const badResult = await buildMapLite(badRequest);
        expect(badResult.candidates.length).toBe(0);
    });
});

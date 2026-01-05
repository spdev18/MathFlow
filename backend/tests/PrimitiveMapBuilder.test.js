import { describe, it, expect } from "vitest";
import { parseExpression } from "../src/mapmaster/ast";
import { buildPrimitiveMap } from "../src/engine/primitives/PrimitiveMapBuilder";
function buildMapFromLatex(latex, stage = 1) {
    const trimmed = latex.trim();
    const ast = parseExpression(trimmed);
    if (!ast)
        throw new Error("Failed to parse expression");
    return buildPrimitiveMap(ast, stage, trimmed);
}
describe("PrimitiveMapBuilder", () => {
    it("builds a ready P.FRAC_ADD_SAME_DEN primitive for 1/7 + 3/7", () => {
        const map = buildMapFromLatex("\\frac{1}{7} + \\frac{3}{7}");
        expect(map.operatorCount).toBe(1);
        expect(map.entries.length).toBe(1);
        const entry = map.entries[0];
        expect(entry.primitiveId).toBe("P.FRAC_ADD_SAME_DEN");
        expect(entry.status).toBe("ready");
    });
    it("builds a ready P.FRAC_ADD_SAME_DEN primitive for 4/7 + 5/7", () => {
        const map = buildMapFromLatex("\\frac{4}{7} + \\frac{5}{7}");
        expect(map.operatorCount).toBe(1);
        expect(map.entries.length).toBe(1);
        const entry = map.entries[0];
        expect(entry.primitiveId).toBe("P.FRAC_ADD_SAME_DEN");
        expect(entry.status).toBe("ready");
    });
    it("handles three-term sum 1/7 + 3/7 + 5/7 with one ready primitive and one none", () => {
        const map = buildMapFromLatex("\\frac{1}{7} + \\frac{3}{7} + \\frac{5}{7}");
        expect(map.operatorCount).toBeGreaterThanOrEqual(2);
        const readyFracAdd = map.entries.find(e => e.primitiveId === "P.FRAC_ADD_SAME_DEN" && e.status === "ready");
        expect(readyFracAdd).toBeDefined();
        const noneEntries = map.entries.filter(e => e.status === "none");
        expect(noneEntries.length).toBeGreaterThanOrEqual(1);
    });
    it("builds P.INT_ADD for 2 + 3", () => {
        const map = buildMapFromLatex("2 + 3");
        expect(map.operatorCount).toBe(1);
        const entry = map.entries[0];
        expect(entry.primitiveId).toBe("P.INT_ADD");
        expect(entry.status).toBe("ready");
    });
    it("builds P.INT_SUB for 2 - 3", () => {
        const map = buildMapFromLatex("2 - 3");
        expect(map.operatorCount).toBe(1);
        const entry = map.entries[0];
        expect(entry.primitiveId).toBe("P.INT_SUB");
        expect(entry.status).toBe("ready");
    });
    // Mixed primitives are removed in V5
});

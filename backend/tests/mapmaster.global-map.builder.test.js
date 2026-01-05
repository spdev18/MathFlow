import { describe, it, expect } from "vitest";
import { buildGlobalMap } from "../src/mapmaster/mapmaster.global-map";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";
import { STAGE1_INVARIANT_SETS } from "../src/mapmaster/mapmaster.invariants.registry";
// Helper to create a debug registry (similar to HandlerPostMapMasterGlobalMap)
function createDebugRegistry() {
    const allRules = STAGE1_INVARIANT_SETS.flatMap(s => s.rules);
    const primitives = [];
    for (const rule of allRules) {
        primitives.push({
            id: rule.id,
            name: rule.id,
            description: "Debug Primitive",
            category: "Debug",
            tags: []
        });
    }
    const invariantSets = STAGE1_INVARIANT_SETS.map(s => ({
        id: s.id,
        name: s.id,
        description: "Debug Set",
        version: "1.0",
        rules: s.rules.map(r => ({
            id: r.id,
            title: r.id,
            shortStudentLabel: r.id,
            teacherLabel: r.id,
            description: r.id,
            level: "intro", // Correct level
            tags: [],
            primitiveIds: [r.id],
            scenarioId: "debug-scenario",
            teachingTag: "debug"
        }))
    }));
    const model = {
        primitives,
        invariantSets
    };
    return new InMemoryInvariantRegistry({ model });
}
describe("Global Map Builder", () => {
    const registry = createDebugRegistry();
    const invariantSetIds = STAGE1_INVARIANT_SETS.map(s => s.id);
    it("should build map for simple integer addition '1 + 2'", () => {
        const input = {
            expressionLatex: "1 + 2",
            invariantSetIds,
            registry
        };
        const result = buildGlobalMap(input);
        expect(result.expressionLatex).toBe("1 + 2");
        expect(result.operatorCount).toBe(1);
        expect(result.entries.length).toBe(1);
        const entry = result.entries[0];
        expect(entry.operatorIndex).toBe(0);
        expect(entry.hasCandidates).toBe(true);
        expect(entry.candidateCount).toBeGreaterThan(0);
        expect(entry.debug.pipeline.selection.status).toBe("ok");
    });
    it("should build map for fraction addition '1/7 + 3/7'", () => {
        const input = {
            expressionLatex: "\\frac{1}{7} + \\frac{3}{7}",
            invariantSetIds,
            registry
        };
        const result = buildGlobalMap(input);
        expect(result.operatorCount).toBe(1); // Only the + is a binaryOp in this AST (fractions are nodes)
        expect(result.entries.length).toBe(1);
        expect(result.entries[0].hasCandidates).toBe(true);
    });
    it("should build map for chained addition '1 + 2 + 3'", () => {
        const input = {
            expressionLatex: "1 + 2 + 3",
            invariantSetIds,
            registry
        };
        const result = buildGlobalMap(input);
        // Depending on parser associativity, could be (1+2)+3 or 1+(2+3)
        // Either way, 2 binary operators.
        expect(result.operatorCount).toBe(2);
        expect(result.entries.length).toBe(2);
        // At least one of them should have candidates (likely both)
        expect(result.candidatefulAnchorCount).toBeGreaterThanOrEqual(1);
    });
    it("should handle expressions with no operators '42'", () => {
        const input = {
            expressionLatex: "42",
            invariantSetIds,
            registry
        };
        const result = buildGlobalMap(input);
        expect(result.operatorCount).toBe(0);
        expect(result.entries.length).toBe(0);
    });
});

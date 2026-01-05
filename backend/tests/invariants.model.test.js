import { describe, it, expect } from "vitest";
import { validateInvariantModel, VALID_LEVELS, } from "../src/invariants/invariants.model";
function makeValidPrimitive(id) {
    return {
        id,
        name: `Primitive ${id}`,
        description: `Description for ${id}`,
        category: "fractions",
        tags: ["fractions", "demo"],
    };
}
function makeValidRule(id, primitiveId) {
    return {
        id,
        title: `Rule ${id}`,
        shortStudentLabel: `Rule ${id} label`,
        description: `Rule ${id} description`,
        level: "core",
        tags: ["fractions", "demo"],
        primitiveIds: [primitiveId],
    };
}
function makeValidSet(id, primitiveId) {
    return {
        id,
        name: `Set ${id}`,
        description: `Set ${id} description`,
        version: "1.0.0",
        rules: [makeValidRule("R1", primitiveId)],
    };
}
function makeValidModel() {
    const primitiveId = "P1";
    const setId = "SET1";
    return {
        primitives: [makeValidPrimitive(primitiveId)],
        invariantSets: [makeValidSet(setId, primitiveId)],
    };
}
describe("validateInvariantModel", () => {
    it("accepts a valid model and returns normalized copies", () => {
        const model = makeValidModel();
        const result = validateInvariantModel(model);
        expect(result.ok).toBe(true);
        expect(result.issues).toEqual([]);
        expect(result.model).toBeDefined();
        const normalized = result.model;
        // Root objects must not be the same references.
        expect(normalized).not.toBe(model);
        expect(normalized.primitives).not.toBe(model.primitives);
        expect(normalized.invariantSets).not.toBe(model.invariantSets);
        // Elements must be cloned as well.
        expect(normalized.primitives[0]).not.toBe(model.primitives[0]);
        expect(normalized.invariantSets[0]).not.toBe(model.invariantSets[0]);
        expect(normalized.invariantSets[0].rules[0]).not.toBe(model.invariantSets[0].rules[0]);
        // Changing returned model must not affect a second call.
        normalized.primitives[0].name = "changed";
        const result2 = validateInvariantModel(model);
        expect(result2.ok).toBe(true);
        expect(result2.model.primitives[0].name).toBe(model.primitives[0].name);
    });
    it("rejects non-object input", () => {
        const result = validateInvariantModel(null);
        expect(result.ok).toBe(false);
        expect(result.issues.length).toBeGreaterThan(0);
    });
    it("rejects when primitives / invariantSets are not arrays", () => {
        const badModel = {
            primitives: "not-an-array",
            invariantSets: {},
        };
        const result = validateInvariantModel(badModel);
        expect(result.ok).toBe(false);
        expect(result.issues.some((i) => i.path === "$.primitives")).toBe(true);
        expect(result.issues.some((i) => i.path === "$.invariantSets")).toBe(true);
    });
    it("detects duplicate primitive ids", () => {
        const model = makeValidModel();
        const duplicatePrimitive = {
            ...model.primitives[0],
        };
        model.primitives.push(duplicatePrimitive);
        const result = validateInvariantModel(model);
        expect(result.ok).toBe(false);
        expect(result.issues.some((i) => i.code === "DUPLICATE_PRIMITIVE_ID")).toBe(true);
    });
    it("detects unknown primitive ids in rules", () => {
        const model = makeValidModel();
        // Intentionally reference a primitive that does not exist.
        model.invariantSets[0].rules[0].primitiveIds = ["UNKNOWN"];
        const result = validateInvariantModel(model);
        expect(result.ok).toBe(false);
        expect(result.issues.some((i) => i.code === "UNKNOWN_PRIMITIVE_ID")).toBe(true);
    });
    it("validates rule level against VALID_LEVELS", () => {
        const model = makeValidModel();
        // Force an invalid level.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model.invariantSets[0].rules[0].level = "invalid-level";
        const result = validateInvariantModel(model);
        expect(result.ok).toBe(false);
        expect(result.issues.some((i) => i.code === "INVALID_RULE_LEVEL")).toBe(true);
        // Sanity check: each VALID_LEVELS value is accepted.
        for (const level of VALID_LEVELS) {
            const m = makeValidModel();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            m.invariantSets[0].rules[0].level = level;
            const r = validateInvariantModel(m);
            expect(r.ok).toBe(true);
        }
    });
});

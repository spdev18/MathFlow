/**
 * Test: Support Candidate Emission for Mixed Expressions
 * 
 * Verifies that P.INT_TO_FRAC support candidate is emitted for expressions
 * like 4 + 5/2 where one operand is an integer and the other is a fraction.
 */

import { describe, it, expect } from "vitest";
import { parseExpression } from "../src/mapmaster/ast";
import { mapMasterGenerate, MapMasterInput, MapMasterCandidate } from "../src/mapmaster/mapmaster.core";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";

// Minimal mock registry for testing
function createMinimalRegistry(): InMemoryInvariantRegistry {
    return new InMemoryInvariantRegistry({
        model: {
            primitives: [
                { id: "P.INT_TO_FRAC", name: "Integer to Fraction", description: "n -> n/1", category: "normalization", pattern: "", resultPattern: "" },
                { id: "P.FRAC_ADD_SAME_DEN", name: "Fraction Add Same Den", description: "a/c + b/c", category: "fractions", pattern: "", resultPattern: "" },
            ],
            invariantSets: [
                {
                    id: "test-mixed-set",
                    name: "Test Mixed Set",
                    description: "Test set for mixed expressions",
                    version: "1.0",
                    rules: [
                        {
                            id: "R.INT_TO_FRAC",
                            title: "Integer to Fraction",
                            shortStudentLabel: "Normalize",
                            teacherLabel: "INT_TO_FRAC",
                            description: "Convert integer to fraction",
                            level: 1,
                            tags: ["normalization"],
                            primitiveIds: ["P.INT_TO_FRAC"],
                        },
                        {
                            id: "R.FRAC_ADD_SAME_DEN",
                            title: "Fraction Add Same Denominator",
                            shortStudentLabel: "Add fractions",
                            teacherLabel: "FRAC_ADD_SAME_DEN",
                            description: "Add fractions with same denominator",
                            level: 1,
                            tags: ["fractions"],
                            primitiveIds: ["P.FRAC_ADD_SAME_DEN"],
                        },
                    ],
                },
            ],
        },
    });
}

describe("Support Candidate Emission for Mixed Expressions", () => {
    it("emits P.INT_TO_FRAC support candidate for 4 + \\frac{5}{2}", () => {
        const registry = createMinimalRegistry();

        const input: MapMasterInput = {
            expressionLatex: "4+\\frac{5}{2}",
            selectionPath: "root",
            invariantSetIds: ["test-mixed-set"],
            registry,
        };

        const result = mapMasterGenerate(input);

        // Should have at least one candidate
        expect(result.candidates.length).toBeGreaterThan(0);

        // Find INT_TO_FRAC support candidate
        const supportCandidate = result.candidates.find(c =>
            c.primitiveIds.includes("P.INT_TO_FRAC") &&
            c.category === "support"
        );

        expect(supportCandidate).toBeDefined();
        expect(supportCandidate?.targetPath).toBe("left"); // 4 is on the left
        expect(supportCandidate?.description).toContain("Normalize integer to fraction");
    });

    it("emits P.INT_TO_FRAC support candidate for \\frac{1}{3} - 2", () => {
        const registry = createMinimalRegistry();

        const input: MapMasterInput = {
            expressionLatex: "\\frac{1}{3}-2",
            selectionPath: "root",
            invariantSetIds: ["test-mixed-set"],
            registry,
        };

        const result = mapMasterGenerate(input);

        // Find INT_TO_FRAC support candidate targeting the right operand (2)
        const supportCandidate = result.candidates.find(c =>
            c.primitiveIds.includes("P.INT_TO_FRAC") &&
            c.category === "support"
        );

        expect(supportCandidate).toBeDefined();
        expect(supportCandidate?.targetPath).toBe("right"); // 2 is on the right
    });

    it("does NOT emit support candidate when both operands are fractions", () => {
        const registry = createMinimalRegistry();

        const input: MapMasterInput = {
            expressionLatex: "\\frac{1}{3}+\\frac{2}{3}",
            selectionPath: "root",
            invariantSetIds: ["test-mixed-set"],
            registry,
        };

        const result = mapMasterGenerate(input);

        // Should not have INT_TO_FRAC support candidate
        const supportCandidate = result.candidates.find(c =>
            c.primitiveIds.includes("P.INT_TO_FRAC") &&
            c.category === "support"
        );

        expect(supportCandidate).toBeUndefined();
    });

    it("does NOT emit support candidate when both operands are integers", () => {
        const registry = createMinimalRegistry();

        const input: MapMasterInput = {
            expressionLatex: "4+5",
            selectionPath: "root",
            invariantSetIds: ["test-mixed-set"],
            registry,
        };

        const result = mapMasterGenerate(input);

        // Should not have INT_TO_FRAC support candidate
        const supportCandidate = result.candidates.find(c =>
            c.primitiveIds.includes("P.INT_TO_FRAC") &&
            c.category === "support"
        );

        expect(supportCandidate).toBeUndefined();
    });
});

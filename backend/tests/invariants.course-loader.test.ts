import { describe, it, expect } from "vitest";

import { loadInvariantRegistryFromFile } from "../src/invariants/invariant-course-loader";

describe("Invariant Course Loader — loadInvariantRegistryFromFile", () => {
  it("loads the default course file and exposes primitives and rules", () => {
    const registry = loadInvariantRegistryFromFile({
      path: "config/courses/default.course.invariants.json",
    });

    const primitives = registry.getAllPrimitives();
    const sets = registry.getAllInvariantSets();

    expect(primitives.length).toBeGreaterThan(0);
    expect(sets.length).toBeGreaterThan(0);

    const firstSet = sets[0]!;
    expect(firstSet.rules.length).toBeGreaterThan(0);

    // Sanity check: one of the known rule ids is present.
    const hasAddSameDenRule = firstSet.rules.some(
      (rule) => rule.id === "R.FRAC_ADD_SAME",
    );
    expect(hasAddSameDenRule).toBe(true);
  });

  it("throws a helpful error when the file does not exist", () => {
    expect(() =>
      loadInvariantRegistryFromFile({
        path: "config/courses/__nonexistent__.json",
      }),
    ).toThrow(/Failed to read invariant course file/);
  });
});

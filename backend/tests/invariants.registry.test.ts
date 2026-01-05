import { describe, it, expect } from "vitest";

import {
  type InvariantModelDefinition,
  type PrimitiveDefinition,
  type InvariantSetDefinition,
  type InvariantRuleDefinition,
  type PrimitiveId,
  type InvariantSetId,
  validateInvariantModel,
} from "../src/invariants/invariants.model";

import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";

function makeValidPrimitive(id: PrimitiveId): PrimitiveDefinition {
  return {
    id,
    name: `Primitive ${id}`,
    description: `Description for ${id}`,
    category: "fractions",
    tags: ["fractions", "demo"],
  };
}

function makeValidRule(id: string, primitiveId: PrimitiveId): InvariantRuleDefinition {
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

function makeValidSet(id: InvariantSetId, primitiveId: PrimitiveId): InvariantSetDefinition {
  return {
    id,
    name: `Set ${id}`,
    description: `Set ${id} description`,
    version: "1.0.0",
    rules: [makeValidRule("R1", primitiveId)],
  };
}

function makeValidModel(): InvariantModelDefinition {
  const primitiveId: PrimitiveId = "P1";
  const setId: InvariantSetId = "SET1";

  return {
    primitives: [makeValidPrimitive(primitiveId)],
    invariantSets: [makeValidSet(setId, primitiveId)],
  };
}

describe("InMemoryInvariantRegistry", () => {
  it("builds from a validated model and exposes defensive copies", () => {
    const model = makeValidModel();
    const validation = validateInvariantModel(model);
    expect(validation.ok).toBe(true);

    const registry = new InMemoryInvariantRegistry({
      model: validation.model!,
    });

    const allPrimitives = registry.getAllPrimitives();
    expect(allPrimitives).toHaveLength(1);
    expect(allPrimitives[0].id).toBe("P1");

    // Mutating the returned primitive must not affect subsequent calls.
    allPrimitives[0].name = "mutated";
    const again = registry.getAllPrimitives();
    expect(again[0].name).toBe("Primitive P1");
  });

  it("looks up primitives and sets by id", () => {
    const model = makeValidModel();
    const validation = validateInvariantModel(model);
    expect(validation.ok).toBe(true);

    const registry = new InMemoryInvariantRegistry({
      model: validation.model!,
    });

    const primitive = registry.getPrimitiveById("P1");
    expect(primitive).toBeDefined();
    expect(primitive!.id).toBe("P1");

    const set = registry.getInvariantSetById("SET1");
    expect(set).toBeDefined();
    expect(set!.id).toBe("SET1");

    // Returned objects must be defensive copies.
    primitive!.name = "changed";
    const primitiveAgain = registry.getPrimitiveById("P1");
    expect(primitiveAgain!.name).toBe("Primitive P1");

    set!.name = "changed";
    const setAgain = registry.getInvariantSetById("SET1");
    expect(setAgain!.name).toBe("Set SET1");
  });

  it("finds rules by set and by primitive id", () => {
    const model = makeValidModel();
    const validation = validateInvariantModel(model);
    expect(validation.ok).toBe(true);

    const registry = new InMemoryInvariantRegistry({
      model: validation.model!,
    });

    const rule = registry.findRule("SET1", "R1");
    expect(rule).toBeDefined();
    expect(rule!.id).toBe("R1");

    const rulesByPrimitive = registry.findRulesByPrimitiveId("P1");
    expect(rulesByPrimitive.length).toBe(1);
    expect(rulesByPrimitive[0].id).toBe("R1");

    // Returned rules must be defensive copies.
    rulesByPrimitive[0].title = "changed";
    const again = registry.findRulesByPrimitiveId("P1");
    expect(again[0].title).toBe("Rule R1");
  });

  it("returns empty arrays / undefined when nothing is found", () => {
    const model = makeValidModel();
    const validation = validateInvariantModel(model);
    expect(validation.ok).toBe(true);

    const registry = new InMemoryInvariantRegistry({
      model: validation.model!,
    });

    expect(registry.getPrimitiveById("UNKNOWN")).toBeUndefined();
    expect(registry.getInvariantSetById("UNKNOWN")).toBeUndefined();
    expect(registry.findRule("SET1", "UNKNOWN")).toBeUndefined();
    expect(registry.findRulesByPrimitiveId("UNKNOWN")).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { createMapMasterWithStepMasterLite } from "../src/mapmaster/MapMasterStepMasterAdapter";

describe("EngineStepOrchestrator (Adapter Smoke Test)", () => {
  it("initializes MapMasterStepMasterAdapter without error", () => {
    // Basic verification that the module loads and exports the factory function.
    // This ensures that the inlined StepMasterLite logic in the adapter is syntactically correct
    // and that there are no resolve errors for imports.
    // This replaces the skipped integration test with a valid smoke test.
    const adapter = createMapMasterWithStepMasterLite();
    expect(adapter).toBeDefined();
    expect(typeof adapter.planStep).toBe("function");
  });
});

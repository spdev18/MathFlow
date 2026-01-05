import { describe, it, expect } from "vitest";

import { buildMapLite } from "../src/mapmaster/MapMasterLite";
import { getInvariantsBySetId } from "../src/invariants/index";
import type { EngineStepRequest } from "../src/protocol/backend-step.types";

const makeRequest = (latex: string): EngineStepRequest => ({
  expressionId: "expr-invariants-config",
  mode: "preview",
  latex,
  invariantSetId: "fractions-basic.v1",
  clientEvent: {
    type: "click",
    surfaceNodeId: "surf-whole-expression",
    selection: [],
  },
});

describe("Invariant config loader — fractions-basic.v1", () => {
  it("loads invariants from config and MapMasterLite sees them", async () => {
    const invariants = getInvariantsBySetId("fractions-basic.v1");
    expect(invariants.length).toBeGreaterThan(0);

    const request = makeRequest("1/3 + 2/5");
    const result = await buildMapLite(request);

    expect(result.candidates.length).toBe(1);
    expect(result.candidates[0]?.primitiveId).toBe("P4.FRAC_ADD_BASIC");
  });
});

import { describe, it, expect } from "vitest";

import { buildMapLite } from "../src/mapmaster/MapMasterLite.js";
import type { EngineStepRequest } from "../src/protocol/backend-step.types.js";

const makeRequest = (latex: string): EngineStepRequest => ({
  expressionId: "expr-mapmaster-sub-same-den",
  mode: "preview",
  latex,
  invariantSetId: "fractions-basic.v1",
  clientEvent: {
    type: "click",
    surfaceNodeId: "surf-whole-expression",
    selection: [],
  },
});

describe("MapMasterLite — fractions subtraction with same denominator", () => {
  it("selects P4.FRAC_ADD_BASIC for 5/7 - 2/7", async () => {
    const request = makeRequest("5/7 - 2/7");
    const result = await buildMapLite(request);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0]?.primitiveId).toBe("P4.FRAC_ADD_BASIC");
  });
});

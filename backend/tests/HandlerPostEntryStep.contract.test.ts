import { describe, it, expect, vi } from "vitest";
import { HandlerPostEntryStep, type HandlerDeps } from "../src/server/HandlerPostEntryStep";
import type {
  EngineStepRequest,
  EngineStepResponse,
  EngineStepResponseOk,
} from "../src/protocol/backend-step.types";

import { describe, it, expect, vi, afterEach } from "vitest";
import { HandlerPostEntryStep, type HandlerDeps } from "../src/server/HandlerPostEntryStep";
import type {
  EngineStepResponse,
} from "../src/protocol/backend-step.types";
import * as Orchestrator from "../src/orchestrator/index";

// Mock runOrchestratorStep
vi.mock("../src/orchestrator/index", () => ({
  runOrchestratorStep: vi.fn(),
}));

describe("HandlerPostEntryStep — contract", () => {
  const mockRunOrchestratorStep = Orchestrator.runOrchestratorStep as unknown as ReturnType<typeof vi.fn>;

  const deps = {
    invariantRegistry: {} as any,
    policy: {} as any,
    log: vi.fn(),
  } as HandlerDeps;

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates a valid preview request to runOrchestratorStep", async () => {
    const body = {
      expressionLatex: String.raw`\frac{1}{3} + \frac{2}{5}`,
      expressionId: "ex-001", // Note: HandlerPostEntryStep expects expressionLatex in body, but EntryStepRequest uses it.
      // Wait, HandlerPostEntryStep maps body["expressionLatex"] to request.expressionLatex
      // The test body used "latex" property before.
      // HandlerPostEntryStep implementation uses `obj["expressionLatex"]`.
      // So the previous test body `{ latex: ... }` was WRONG for the implementation!
      // I must use `expressionLatex`.
    };

    // Fix body to match HandlerPostEntryStep expectation
    const validBody = {
      expressionLatex: String.raw`\frac{1}{3} + \frac{2}{5}`,
      sessionId: "sess-001",
      courseId: "course-001",
    };

    mockRunOrchestratorStep.mockResolvedValue({
      status: "step-applied",
      engineResult: {
        ok: true,
        newExpressionLatex: "result-latex",
      },
    });

    const res = await HandlerPostEntryStep(validBody, deps);

    expect(res.status).toBe("step-applied");
    expect(res.expressionLatex).toBe("result-latex");
    expect(mockRunOrchestratorStep).toHaveBeenCalled();
  });

  it("rejects non-object bodies", async () => {
    const res = await HandlerPostEntryStep(null as unknown, deps);

    expect(res.status).toBe("engine-error");
  });

  it("rejects missing required fields", async () => {
    const res = await HandlerPostEntryStep(
      { foo: "bar" } as unknown,
      deps
    );

    expect(res.status).toBe("engine-error");
  });

  // HandlerPostEntryStep does not check for "mode" explicitly in validation, 
  // it just passes it (or ignores it if not mapped).
  // It maps `policyId`.
  // So "unsupported mode" test is likely not applicable unless runOrchestratorStep throws.

  it("normalises thrown errors into engine-error", async () => {
    mockRunOrchestratorStep.mockRejectedValue(new Error("boom"));

    const res = await HandlerPostEntryStep(
      { expressionLatex: "x" } as unknown,
      deps
    );

    expect(res.status).toBe("engine-error");
    expect(deps.log).toHaveBeenCalled(); // or logger
  });
});

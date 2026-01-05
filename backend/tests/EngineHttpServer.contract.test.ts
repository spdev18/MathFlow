/**
 * EngineHttpServer.contract.test.ts
 *
 * Simple contract tests for the HTTP wrapper around HandlerPostEntryStep.
 *
 * These tests do not touch the real engine. Instead, they provide a small
 * in-memory HandlerDeps stub and verify that JSON in/out over HTTP behaves
 * as expected.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { createEngineHttpServer } from "../src/server/engineHttpServer.js";
import type { HandlerDeps } from "../src/server/HandlerPostEntryStep.js";
import type {
  EngineStepRequest,
  EngineStepResponse,
  EngineStepResponseOk,
} from "../src/protocol/backend-step.types.js";

// Mock HandlerPostEntryStep
const mockHandlerPostEntryStep = vi.fn();
vi.mock("../src/server/HandlerPostEntryStep.js", () => ({
  HandlerPostEntryStep: (...args: any[]) => mockHandlerPostEntryStep(...args),
}));

const baseRequest: EngineStepRequest = {
  expressionId: "http-001",
  mode: "preview",
  latex: "\\\\frac{1}{3} + \\\\frac{2}{5}",
  invariantSetId: "fractions-basic.v1",
  clientEvent: {
    type: "click",
    surfaceNodeId: "surf-whole-expression",
    selection: ["surf-frac-1", "surf-plus", "surf-frac-2"],
  },
};

describe("EngineHttpServer — /engine/step", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and a JSON EngineStepResponse from HandlerPostEntryStep", async () => {
    const deps = {} as HandlerDeps; // Deps don't matter as handler is mocked

    const expectedResponse: EngineStepResponseOk = {
      status: "ok",
      expressionId: baseRequest.expressionId,
      fromLatex: baseRequest.latex,
      toLatex: baseRequest.latex,
      step: {
        ruleId: "demo.http.v1",
        descriptionStudent: "HTTP demo step",
      },
    };

    mockHandlerPostEntryStep.mockResolvedValue(expectedResponse);

    const server = createEngineHttpServer({
      port: 0, // let the OS pick a free port
      handlerDeps: deps,
      log: () => { },
    });

    const port = await server.start();
    const url = `http://127.0.0.1:${port}/engine/step`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(baseRequest),
    });

    expect(response.status).toBe(200);

    const json = (await response.json()) as EngineStepResponse;
    expect(json).toEqual(expectedResponse);
    expect(mockHandlerPostEntryStep).toHaveBeenCalledWith(baseRequest, deps);

    await server.stop();
  });

  it("returns 400 on invalid JSON", async () => {
    const deps = {} as HandlerDeps;

    const server = createEngineHttpServer({
      port: 0,
      handlerDeps: deps,
      log: () => { },
    });

    const port = await server.start();
    const url = `http://127.0.0.1:${port}/engine/step`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{ not-a-valid-json }",
    });

    expect(response.status).toBe(400);
    await server.stop();
  });
});
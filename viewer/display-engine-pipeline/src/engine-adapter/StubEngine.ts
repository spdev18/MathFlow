/**
 * StubEngine - trivial embedded engine for demo mode
 * Echoes back the LaTeX with minimal transformation
 */

import type { EngineRequest, EngineResponse } from "../protocol/types.js";

export class StubEngine {
  async process(request: EngineRequest): Promise<EngineResponse> {
    // Simple echo with a marker
    const latex = request.clientEvent.latex;
    const nodeId = request.clientEvent.surfaceNodeId;

    return {
      type: "ok",
      requestType: request.type,
      message: `Stub processed ${request.type}`,
      result: {
        latex: latex,
        highlights: nodeId ? [nodeId] : [],
        meta: {
          stub: true,
          processed: new Date().toISOString(),
        },
      },
    };
  }
}

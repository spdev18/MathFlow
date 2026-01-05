/**
 * ITU / end-to-end demo for Display → TSA / MapMaster → Engine (stub),
 * using EngineExpressionView (variant B).
 *
 * This demo does not talk to a real engine; instead it uses a simple
 * stub that echoes the EngineRequestDraft into a summary string.
 */

import type { ClientEvent } from "../protocol/types.js";
import {
  BasicMapMaster,
  MapMasterEngineOrchestrator,
  type MapMasterRequest,
} from "@motor/mapmaster-bridge";

async function runScenario(): Promise<void> {
  const mapMaster = new BasicMapMaster();

  // Simple stub engine that just reports what it was asked to do.
  const engineClient = {
    async apply(draft: any) {
      const op = draft.operation;
      const ops = Array.isArray(draft.operands)
        ? draft.operands.join(",")
        : String(draft.operands ?? "");
      const preview = draft.preview ? "true" : "false";
      const stage1 = draft.stage1Before ?? "";
      return {
        summary: `ENGINE_OK:${op}:${ops}:preview=${preview}:stage1=${stage1}`,
      };
    },
  };

  const orchestrator = new MapMasterEngineOrchestrator(
    mapMaster,
    engineClient as any
  );

  const clientEvent: ClientEvent = {
    type: "click",
    timestamp: Date.now(),
    latex: String.raw`\frac{1}{3} + \frac{2}{5}`,
    surfaceNodeId: "surf-whole-expression",
    selection: ["surf-frac-1", "surf-plus", "surf-frac-2"],
    click: {
      button: "left",
      clickCount: 1,
      modifiers: {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      },
    },
  };

  // Engine-centric view: 1/3 + 2/5, represented as a binary op with two rationals.
  const engineView = {
    stage1: "1/3 + 2/5",
    root: {
      kind: "binaryOp" as const,
      op: "add" as const,
      indexInStage1: 0,
      left: {
        kind: "rational" as const,
        numerator: "1",
        denominator: "3",
      },
      right: {
        kind: "rational" as const,
        numerator: "2",
        denominator: "5",
      },
    },
  };

  const req: MapMasterRequest = {
    mode: "preview",
    expression: {
      id: "ex-001",
      latex: clientEvent.latex,
      displayVersion: "itu-e2e-mapmaster",
      invariantSetId: "fractions-basic.v1",
    },
    clientEvent,
    tsaSelection: {
      selectionMapVersion: "sm-v1",
      primaryRegionId: "tsa-sum-of-two-fractions",
      allRegionIds: ["tsa-frac-1", "tsa-plus", "tsa-frac-2"],
      flags: {
        isWholeFraction: false,
      },
    },
    policy: {
      stepLevel: "student",
      allowMultipleSteps: false,
      maxCandidates: 3,
    },
    engineView,
  };

  console.log("[ITU-E2E-MAPMASTER] Request:");
  console.log(JSON.stringify(req, null, 2));

  const result = await orchestrator.planAndRun(req);

  console.log("[ITU-E2E-MAPMASTER] Plan:");
  console.log(JSON.stringify(result.plan, null, 2));

  if (result.engineResult) {
    console.log("[ITU-E2E-MAPMASTER] Engine result:");
    console.log(result.engineResult.summary);
  } else {
    console.log("[ITU-E2E-MAPMASTER] No engine result (no candidates chosen).");
  }
}

runScenario().catch((err) => {
  console.error("[ITU-E2E-MAPMASTER] ERROR:", err);
  process.exit(1);
});

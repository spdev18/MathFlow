/**
 * ITU / end-to-end demo for Display → TSA / MapMaster → Engine over HTTP,
 * using EngineExpressionView (variant B).
 *
 * Requires engine-server.mjs to be running, for example:
 *
 *   cd D:\07\viewer\display-engine-pipeline
 *   pnpm engine:server
 *
 * Then run:
 *
 *   pnpm e2e:mapmaster:http
 */

import type { ClientEvent } from "../protocol/types.js";
import {
  BasicMapMaster,
  MapMasterEngineOrchestrator,
  NginHttpEngineClient,
  type MapMasterRequest,
} from "@motor/mapmaster-bridge";

async function runScenario(): Promise<void> {
  const mapMaster = new BasicMapMaster();
  const engineClient = new NginHttpEngineClient();
  const orchestrator = new MapMasterEngineOrchestrator(mapMaster, engineClient);

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
      displayVersion: "itu-e2e-mapmaster-http",
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

  console.log("[ITU-E2E-MAPMASTER-HTTP] Request:");
  console.log(JSON.stringify(req, null, 2));

  const result = await orchestrator.planAndRun(req);

  console.log("[ITU-E2E-MAPMASTER-HTTP] Plan:");
  console.log(JSON.stringify(result.plan, null, 2));

  if (result.engineResult) {
    console.log("[ITU-E2E-MAPMASTER-HTTP] Engine result summary:");
    console.log(result.engineResult.summary);
  } else {
    console.log("[ITU-E2E-MAPMASTER-HTTP] No engine result (no candidates chosen).");
  }
}

runScenario().catch((err) => {
  console.error("[ITU-E2E-MAPMASTER-HTTP] ERROR:", err);
  process.exit(1);
});

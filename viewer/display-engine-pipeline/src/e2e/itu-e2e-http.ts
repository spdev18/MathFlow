/**
 * ITU / end-to-end demo for Display → FileBus → EngineAdapter (HTTP → engine-lite).
 *
 * Run from the display-engine-pipeline package:
 *
 *   # 1) In a separate terminal start the engine HTTP server:
 *   #    pnpm engine:server
 *   #
 *   # 2) In this package, run the HTTP end-to-end scenario:
 *   #    pnpm e2e:http
 *
 * This does not depend on the browser Viewer. It exercises the core
 * Display→Engine pipeline over the FileBus using a synthetic ClientEvent,
 * but the EngineAdapter talks to the real engine-lite HTTP bridge instead of StubEngine.
 */

import { FileBus } from "../filebus/FileBus.js";
import { EngineAdapter } from "../engine-adapter/EngineAdapter.js";
import type { ClientEvent, BusMessage } from "../protocol/types.js";

async function runScenario(): Promise<void> {
  const bus = new FileBus({ name: "itu-e2e-http", maxHistory: 100 });

  // Log EngineResponses to the console so you can see what the engine produced.
  bus.subscribe((msg: BusMessage) => {
    if (msg.messageType === "EngineResponse") {
      const response = msg.payload;
      console.log("\n[ITU-E2E-HTTP] EngineResponse:");
      console.log(JSON.stringify(response, null, 2));
    }
  });

  // Start EngineAdapter in HTTP mode, pointing at engine-server (engine-lite bridge).
  const engineAdapter = new EngineAdapter(bus, {
    mode: "http",
    httpEndpoint: "http://localhost:4201/api/entry-step",
    httpTimeout: 5000,
  });

  engineAdapter.start();

  // Synthetic ClientEvent roughly matching the Viewer protocol.
  const clientEvent: ClientEvent = {
    type: "click",
    timestamp: Date.now(),
    latex: "\\frac{1}{2} + \\frac{1}{3}",
    surfaceNodeId: "n1",
    selection: ["n1"],
    click: {
      button: "left",
      clickCount: 2,
      modifiers: {
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      },
    },
  };

  console.log("[ITU-E2E-HTTP] Sending ClientEvent:");
  console.log(JSON.stringify(clientEvent, null, 2));

  bus.publishClientEvent(clientEvent);

  // Small delay for async processing before we stop the adapter.
  await new Promise((resolve) => setTimeout(resolve, 300));

  engineAdapter.stop();
}

runScenario().catch((err) => {
  console.error("[ITU-E2E-HTTP] Fatal error:", err);
  process.exit(1);
});

/**
 * ITU / end-to-end demo for Display → FileBus → EngineAdapter (StubEngine) → EngineResponse.
 *
 * Run from the display-engine-pipeline package:
 *
 *   pnpm e2e
 *
 * This does not depend on the browser Viewer. It just exercises the core
 * Display→Engine pipeline over the FileBus using a synthetic ClientEvent.
 */

import { FileBus } from "../filebus/FileBus.js";
import { EngineAdapter } from "../engine-adapter/EngineAdapter.js";
import type { ClientEvent, BusMessage } from "../protocol/types.js";

async function runScenario(): Promise<void> {
  const bus = new FileBus({ name: "itu-e2e-demo", maxHistory: 100 });

  // Log EngineResponses to the console so you can see what the StubEngine produced.
  bus.subscribe((msg: BusMessage) => {
    if (msg.messageType === "EngineResponse") {
      const response = msg.payload;
      console.log("\n[ITU-E2E] EngineResponse:");
      console.log(JSON.stringify(response, null, 2));
    }
  });

  // Start EngineAdapter in embedded (StubEngine) mode.
  const engineAdapter = new EngineAdapter(bus, {
    mode: "embedded",
  });

  engineAdapter.start();

  // Simple test expression.
  const latex = "\\frac{1}{2} + \\frac{1}{3}";

  const clientEvent: ClientEvent = {
    type: "click",
    timestamp: Date.now(),
    latex,
    surfaceNodeId: "n1",
    selection: ["n1"],
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

  console.log("[ITU-E2E] Sending ClientEvent:");
  console.log(JSON.stringify(clientEvent, null, 2));

  bus.publishClientEvent(clientEvent);

  // Small delay for async processing before we stop the adapter.
  await new Promise((resolve) => setTimeout(resolve, 100));

  engineAdapter.stop();
}

runScenario().catch((err) => {
  console.error("[ITU-E2E] Fatal error:", err);
  process.exit(1);
});

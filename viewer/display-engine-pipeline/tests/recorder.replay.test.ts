/**
 * Recorder and Player integration tests
 */

import assert from "node:assert";
import { test } from "node:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { FileBus } from "../src/filebus/FileBus.js";
import { Recorder } from "../src/recorder/Recorder.js";
import { Player } from "../src/recorder/Player.js";
import type { ClientEvent } from "../src/protocol/types.js";

test("Recorder writes JSONL correctly", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "recorder-test-"));
  const bus = new FileBus({ name: "test" });
  const recorder = new Recorder(bus, {
    outputDir: tmpDir,
    sessionPrefix: "test",
    autoFlush: false,
  });

  recorder.start();

  // Publish some events
  bus.publishClientEvent({
    type: "click",
    timestamp: Date.now(),
    latex: "x+y",
  });

  bus.publishClientEvent({
    type: "hover",
    timestamp: Date.now(),
    latex: "x+y",
    surfaceNodeId: "num-1",
  });

  await recorder.stop();

  // Verify file exists and contains correct number of lines
  const logPath = recorder.getLogPath();
  assert.strictEqual(fs.existsSync(logPath), true);

  const content = fs.readFileSync(logPath, "utf8");
  const lines = content.trim().split("\n");
  assert.strictEqual(lines.length, 2);

  // Verify each line is valid JSON
  for (const line of lines) {
    const obj = JSON.parse(line);
    assert.strictEqual(typeof obj.timestamp, "number");
    assert.strictEqual(typeof obj.messageType, "string");
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Player replays scenario correctly", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "player-test-"));
  const scenarioPath = path.join(tmpDir, "scenario.jsonl");

  // Create a test scenario file
  const messages = [
    {
      direction: "clientToEngine",
      timestamp: 1000,
      messageType: "ClientEvent",
      payload: {
        type: "click",
        timestamp: 1000,
        latex: "x+y",
      },
    },
    {
      direction: "clientToEngine",
      timestamp: 2000,
      messageType: "ClientEvent",
      payload: {
        type: "hover",
        timestamp: 2000,
        latex: "x+y",
      },
    },
  ];

  fs.writeFileSync(
    scenarioPath,
    messages.map((m) => JSON.stringify(m)).join("\n")
  );

  // Replay through bus
  const bus = new FileBus({ name: "test" });
  const received: any[] = [];

  bus.subscribe((msg) => {
    received.push(msg);
  });

  const player = new Player(bus, {
    scenarioPath,
    realtimeDelay: false,
  });

  const stats = await player.play();

  assert.strictEqual(stats.totalMessages, 2);
  assert.strictEqual(stats.clientEvents, 2);
  assert.strictEqual(stats.errors, 0);
  assert.strictEqual(received.length, 2);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("Player handles invalid lines gracefully", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "player-test-"));
  const scenarioPath = path.join(tmpDir, "bad-scenario.jsonl");

  fs.writeFileSync(
    scenarioPath,
    [
      '{"direction":"clientToEngine","timestamp":1000,"messageType":"ClientEvent","payload":{"type":"click","timestamp":1000,"latex":"x"}}',
      "invalid json line",
      "# comment line",
      '{"direction":"clientToEngine","timestamp":2000,"messageType":"ClientEvent","payload":{"type":"hover","timestamp":2000,"latex":"y"}}',
    ].join("\n")
  );

  const bus = new FileBus({ name: "test" });
  const player = new Player(bus, {
    scenarioPath,
    realtimeDelay: false,
  });

  const stats = await player.play();

  assert.strictEqual(stats.totalMessages, 2); // Only valid messages
  assert.strictEqual(stats.errors, 1); // Invalid JSON line counted as error

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

### File: logs/.gitkeep
```
# This directory stores session logs in dev mode

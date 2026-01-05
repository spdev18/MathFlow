/**
 * FileBus basic functionality tests
 */

import assert from "node:assert";
import { test } from "node:test";
import { FileBus } from "../src/filebus/FileBus.js";
import type { ClientEvent, BusMessage } from "../src/protocol/types.js";

test("FileBus publishes and delivers messages", () => {
  const bus = new FileBus({ name: "test" });
  const received: BusMessage[] = [];

  bus.subscribe((msg) => {
    received.push(msg);
  });

  const event: ClientEvent = {
    type: "click",
    timestamp: Date.now(),
    latex: "x+y",
  };

  bus.publishClientEvent(event);

  assert.strictEqual(received.length, 1);
  assert.strictEqual(received[0].messageType, "ClientEvent");
  assert.strictEqual(received[0].direction, "clientToEngine");
});

test("FileBus maintains history", () => {
  const bus = new FileBus({ name: "test", maxHistory: 10 });

  for (let i = 0; i < 15; i++) {
    bus.publishClientEvent({
      type: "hover",
      timestamp: Date.now(),
      latex: `event-${i}`,
    });
  }

  const history = bus.getHistory();
  assert.strictEqual(history.length, 10); // maxHistory enforced
});

test("FileBus unsubscribe works", () => {
  const bus = new FileBus({ name: "test" });
  const received: BusMessage[] = [];

  const unsubscribe = bus.subscribe((msg) => {
    received.push(msg);
  });

  bus.publishClientEvent({
    type: "click",
    timestamp: Date.now(),
    latex: "first",
  });

  unsubscribe();

  bus.publishClientEvent({
    type: "click",
    timestamp: Date.now(),
    latex: "second",
  });

  assert.strictEqual(received.length, 1); // Only first message received
});

test("FileBus handles async subscribers", async () => {
  const bus = new FileBus({ name: "test" });
  const received: string[] = [];

  bus.subscribe(async (msg) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    received.push(msg.messageType);
  });

  bus.publishClientEvent({
    type: "click",
    timestamp: Date.now(),
    latex: "test",
  });

  // Give async subscriber time to complete
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.strictEqual(received.length, 1);
});

/**
 * Protocol shape validation tests
 */

import assert from "node:assert";
import { test } from "node:test";
import {
  isClientEvent,
  isEngineRequest,
  isEngineResponse,
  isBusMessage,
} from "../src/protocol/guards.js";

test("isClientEvent validates correct shape", () => {
  const valid = {
    type: "click",
    timestamp: Date.now(),
    latex: "x+y",
    surfaceNodeId: "num-1",
  };
  assert.strictEqual(isClientEvent(valid), true);
});

test("isClientEvent rejects invalid shape", () => {
  assert.strictEqual(isClientEvent(null), false);
  assert.strictEqual(isClientEvent({}), false);
  assert.strictEqual(isClientEvent({ type: "invalid" }), false);
  assert.strictEqual(isClientEvent({ type: "click", timestamp: "string" }), false);
});

test("isEngineRequest validates correct shape", () => {
  const valid = {
    type: "parse",
    clientEvent: {
      type: "click",
      timestamp: Date.now(),
      latex: "x+y",
    },
  };
  assert.strictEqual(isEngineRequest(valid), true);
});

test("isEngineResponse validates correct shape", () => {
  const valid = {
    type: "ok",
    requestType: "parse",
    result: {
      latex: "x+y",
    },
  };
  assert.strictEqual(isEngineResponse(valid), true);
});

test("isBusMessage validates correct shape", () => {
  const valid = {
    direction: "clientToEngine",
    timestamp: Date.now(),
    messageType: "ClientEvent",
    payload: {
      type: "click",
      timestamp: Date.now(),
      latex: "x+y",
    },
  };
  assert.strictEqual(isBusMessage(valid), true);
});

test("isBusMessage rejects invalid direction", () => {
  const invalid = {
    direction: "invalid",
    timestamp: Date.now(),
    messageType: "ClientEvent",
    payload: {},
  };
  assert.strictEqual(isBusMessage(invalid), false);
});

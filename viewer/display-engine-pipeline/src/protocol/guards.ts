/**
 * Runtime type guards for protocol validation
 */

import type {
  ClientEvent,
  EngineRequest,
  EngineResponse,
  BusMessage,
} from "./types.js";

export function isClientEvent(obj: unknown): obj is ClientEvent {
  if (!obj || typeof obj !== "object") return false;
  const e = obj as Partial<ClientEvent>;
  return (
    typeof e.type === "string" &&
    ["hover", "click", "dblclick", "context", "selectionChanged", "dragSelect"].includes(e.type) &&
    typeof e.timestamp === "number" &&
    typeof e.latex === "string"
  );
}

export function isEngineRequest(obj: unknown): obj is EngineRequest {
  if (!obj || typeof obj !== "object") return false;
  const r = obj as Partial<EngineRequest>;
  return (
    typeof r.type === "string" &&
    ["parse", "previewStep", "applyStep", "getHints"].includes(r.type) &&
    r.clientEvent !== undefined &&
    isClientEvent(r.clientEvent)
  );
}

export function isEngineResponse(obj: unknown): obj is EngineResponse {
  if (!obj || typeof obj !== "object") return false;
  const r = obj as Partial<EngineResponse>;
  return (
    typeof r.type === "string" &&
    ["ok", "error"].includes(r.type) &&
    typeof r.requestType === "string"
  );
}

export function isBusMessage(obj: unknown): obj is BusMessage {
  if (!obj || typeof obj !== "object") return false;
  const m = obj as Partial<BusMessage>;
  return (
    typeof m.direction === "string" &&
    ["clientToEngine", "engineToClient"].includes(m.direction) &&
    typeof m.timestamp === "number" &&
    typeof m.messageType === "string" &&
    m.payload !== undefined
  );
}

export function assertClientEvent(obj: unknown): asserts obj is ClientEvent {
  if (!isClientEvent(obj)) {
    throw new Error("Invalid ClientEvent shape");
  }
}

export function assertEngineRequest(obj: unknown): asserts obj is EngineRequest {
  if (!isEngineRequest(obj)) {
    throw new Error("Invalid EngineRequest shape");
  }
}

export function assertEngineResponse(obj: unknown): asserts obj is EngineResponse {
  if (!isEngineResponse(obj)) {
    throw new Error("Invalid EngineResponse shape");
  }
}

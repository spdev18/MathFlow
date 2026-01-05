/**
 * FileBus - in-memory pub/sub bus decoupling Display Adapter from Engine Adapter
 * Designed so a file-backed logger can drop in later
 */

import type {
  ClientEvent,
  EngineRequest,
  EngineResponse,
  BusMessage,
  BusSubscriber,
  FileBusConfig,
} from "../protocol/types.js";

export class FileBus {
  private subscribers: Set<BusSubscriber> = new Set();
  private history: BusMessage[] = [];
  private maxHistory: number;

  constructor(config: FileBusConfig = { name: "default", maxHistory: 1000 }) {
    this.maxHistory = config.maxHistory ?? 1000;
  }

  subscribe(subscriber: BusSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  private publish(message: BusMessage): void {
    this.history.push(message);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    for (const subscriber of this.subscribers) {
      try {
        const result = subscriber(message);
        if (result && typeof result.then === "function") {
          result.catch((err: Error) => {
            console.error("[FileBus] Async subscriber error:", err);
          });
        }
      } catch (err) {
        console.error("[FileBus] Subscriber error:", err);
      }
    }
  }

  publishClientEvent(event: ClientEvent): void {
    const message: BusMessage = {
      direction: "clientToEngine",
      timestamp: Date.now(),
      payload: event,
      messageType: "ClientEvent",
    };
    this.publish(message);
  }

  publishEngineRequest(request: EngineRequest): void {
    const message: BusMessage = {
      direction: "clientToEngine",
      timestamp: Date.now(),
      payload: request,
      messageType: "EngineRequest",
    };
    this.publish(message);
  }

  publishEngineResponse(response: EngineResponse): void {
    const message: BusMessage = {
      direction: "engineToClient",
      timestamp: Date.now(),
      payload: response,
      messageType: "EngineResponse",
    };
    this.publish(message);
  }

  getHistory(): ReadonlyArray<BusMessage> {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  clear(): void {
    this.subscribers.clear();
    this.history = [];
  }
}

// filebus.js
// Browser-only FileBus implementation compatible with Claude's BusMessage schema.
// This is a lightweight in-memory pub/sub bus; in Node, a separate TS version
// will provide file-backed Recorder/Player.

/**
 * @typedef {"clientToEngine" | "engineToClient"} BusDirection
 */

/**
 * @typedef {"ClientEvent" | "EngineRequest" | "EngineResponse"} BusMessageType
 */

/**
 * @typedef {Object} BusMessage
 * @property {BusDirection} direction
 * @property {number} timestamp
 * @property {any} payload  // ClientEvent | EngineRequest | EngineResponse
 * @property {BusMessageType} messageType
 */

/**
 * @typedef {(msg: BusMessage) => void | Promise<void>} BusSubscriber
 */

export class FileBus {
  /**
   * @param {{ name?: string; maxHistory?: number }=} config
   */
  constructor(config = {}) {
    this.name = config.name || "browser-bus";
    this.maxHistory = typeof config.maxHistory === "number" ? config.maxHistory : 1000;

    /** @type {BusMessage[]} */
    this.history = [];
    /** @type {Set<BusSubscriber>} */
    this.subscribers = new Set();
  }

  /**
   * Subscribe to bus messages.
   * @param {BusSubscriber} subscriber
   * @returns {() => void} unsubscribe function
   */
  subscribe(subscriber) {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  /**
   * Internal helper to push a message to history and notify subscribers.
   * @param {BusMessage} message
   */
  _publish(message) {
    this.history.push(message);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    for (const subscriber of this.subscribers) {
      try {
        const result = subscriber(message);
        if (result && typeof result.then === "function") {
          result.catch((err) => {
            console.error("[FileBus] Async subscriber error:", err);
          });
        }
      } catch (err) {
        console.error("[FileBus] Subscriber error:", err);
      }
    }
  }

  /**
   * Publish a ClientEvent into the bus.
   * @param {any} event
   */
  publishClientEvent(event) {
    /** @type {BusMessage} */
    const message = {
      direction: "clientToEngine",
      timestamp: Date.now(),
      payload: event,
      messageType: "ClientEvent",
    };
    this._publish(message);
  }

  /**
   * Publish an EngineRequest into the bus.
   * (Not used yet in the browser demo, but kept for future EngineAdapter wiring.)
   * @param {any} request
   */
  publishEngineRequest(request) {
    /** @type {BusMessage} */
    const message = {
      direction: "clientToEngine",
      timestamp: Date.now(),
      payload: request,
      messageType: "EngineRequest",
    };
    this._publish(message);
  }

  /**
   * Publish an EngineResponse into the bus.
   * @param {any} response
   */
  publishEngineResponse(response) {
    /** @type {BusMessage} */
    const message = {
      direction: "engineToClient",
      timestamp: Date.now(),
      payload: response,
      messageType: "EngineResponse",
    };
    this._publish(message);
  }

  /**
   * @returns {BusMessage[]} shallow copy of history
   */
  getHistory() {
    return [...this.history];
  }

  clearHistory() {
    this.history = [];
  }

  clear() {
    this.history = [];
    this.subscribers.clear();
  }
}

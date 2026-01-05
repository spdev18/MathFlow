/**
 * EngineAdapter - subscribes to ClientEvents, produces EngineRequests,
 * calls either embedded stub or HTTP endpoint, publishes EngineResponses
 */

import type {
  ClientEvent,
  EngineRequest,
  EngineResponse,
  BusMessage,
  EngineAdapterConfig,
} from "../protocol/types.js";
import type { FileBus } from "../filebus/FileBus.js";
import { StubEngine } from "./StubEngine.js";

export class EngineAdapter {
  private stubEngine: StubEngine | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private bus: FileBus,
    private config: EngineAdapterConfig
  ) {
    if (config.mode === "embedded") {
      this.stubEngine = new StubEngine();
    }
  }

  start(): void {
    this.unsubscribe = this.bus.subscribe(this.handleBusMessage);
    console.log(`[EngineAdapter] Started in ${this.config.mode} mode`);
  }

  private handleBusMessage = async (message: BusMessage): Promise<void> => {
    // Only process ClientEvents from display
    if (message.messageType !== "ClientEvent") return;

    const clientEvent = message.payload as ClientEvent;
    const engineRequest = this.toEngineRequest(clientEvent);

    // Publish the EngineRequest to the bus (for recording)
    this.bus.publishEngineRequest(engineRequest);

    // Process through engine
    try {
      const response = await this.processRequest(engineRequest);
      this.bus.publishEngineResponse(response);
    } catch (err) {
      const errorResponse: EngineResponse = {
        type: "error",
        requestType: engineRequest.type,
        message: "Engine processing failed",
        error: {
          code: "ENGINE_ERROR",
          details: err instanceof Error ? err.message : String(err),
        },
      };
      this.bus.publishEngineResponse(errorResponse);
    }
  };

  private toEngineRequest(clientEvent: ClientEvent): EngineRequest {
    // Map event types to request types
    let requestType: EngineRequest["type"] = "parse";

    switch (clientEvent.type) {
      case "click":
        requestType = clientEvent.click?.clickCount === 2 ? "applyStep" : "previewStep";
        break;
      case "dblclick":
        requestType = "applyStep";
        break;
      case "hover":
        requestType = "getHints";
        break;
      case "selectionChanged":
      case "dragSelect":
        requestType = "previewStep";
        break;
      default:
        requestType = "parse";
    }

    return {
      type: requestType,
      clientEvent,
    };
  }

  private async processRequest(request: EngineRequest): Promise<EngineResponse> {
    if (this.config.mode === "embedded") {
      return this.stubEngine!.process(request);
    } else {
      return this.processHttp(request);
    }
  }

  private async processHttp(request: EngineRequest): Promise<EngineResponse> {
    const endpoint = this.config.httpEndpoint;
    if (!endpoint) {
      throw new Error("HTTP mode requires httpEndpoint in config");
    }

    // Only handle applyStep for now via the new Engine
    if (request.type !== "applyStep") {
      // Return a dummy OK response for non-apply steps
      return {
        type: "ok",
        requestType: request.type,
        result: {
          latex: (request.clientEvent as any).latex || "",
          meta: { status: "ignored-by-new-engine" }
        }
      };
    }

    const timeout = this.config.httpTimeout || 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Map to EntryStepRequest
      const entryStepRequest = {
        sessionId: "default-session",
        expressionLatex: (request.clientEvent as any).latex,
        selectionPath: null,
        operatorIndex: (request.clientEvent as any).surfaceOperatorIndex,
        policyId: "student.basic"
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(entryStepRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const engineStepResponse = await response.json();

      // Map back to EngineResponse
      return {
        type: "ok",
        requestType: request.type,
        result: {
          latex: engineStepResponse.expressionLatex,
          meta: {
            backendStatus: engineStepResponse.status,
            debugInfo: engineStepResponse.debugInfo
          }
        }
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    console.log(`[EngineAdapter] Stopped`);
  }
}

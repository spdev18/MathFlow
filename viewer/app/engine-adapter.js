// engine-adapter.js
// Browser EngineAdapter + StubEngine wired to FileBus.
// This follows the Claude protocol types but implemented in plain JS.

/**
 * @typedef {import("./filebus.js").FileBus} FileBus
 */
import { runV5Step } from "./client/orchestratorV5Client.js";

/**
 * EngineAdapterConfig
 * @typedef {{ mode: "embedded" | "http"; httpEndpoint?: string; httpTimeout?: number }} EngineAdapterConfig
 */

/**
 * StubEngine - simple embedded engine for demo.
 * It just echoes back the incoming request with a marker and optional highlight.
 */
export class StubEngine {
  /**
   * @param {import("./protocol-types").EngineRequest} request
   * @returns {Promise<import("./protocol-types").EngineResponse>}
   */
  async process(request) {
    const clientEvent = request && request.clientEvent ? request.clientEvent : {};
    const latex = typeof clientEvent.latex === "string" ? clientEvent.latex : "";
    const nodeId = clientEvent.surfaceNodeId;

    return {
      type: "ok",
      requestType: request.type,
      message: `Stub processed ${request.type}`,
      result: {
        latex,
        highlights: nodeId ? [String(nodeId)] : [],
        meta: {
          stub: true,
          processed: new Date().toISOString(),
        },
      },
    };
  }
}

/**
 * EngineAdapter - subscribes to ClientEvents on FileBus, emits EngineRequests
 * and EngineResponses (using embedded StubEngine in this demo).
 */
export class EngineAdapter {
  /**
   * @param {FileBus} bus
   * @param {EngineAdapterConfig} config
   */
  constructor(bus, config) {
    this.bus = bus;
    this.config = config || { mode: "embedded" };
    this.stubEngine = this.config.mode === "embedded" ? new StubEngine() : null;
    this.unsubscribe = null;

    // Bind handler once
    this.handleBusMessage = this.handleBusMessage.bind(this);
  }

  start() {
    if (this.unsubscribe) return;
    this.unsubscribe = this.bus.subscribe(this.handleBusMessage);
    console.log(`[EngineAdapter] Started in ${this.config.mode} mode (Pure V5)`);
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  /**
   * @param {import("./protocol-types").BusMessage} message
   */
  async handleBusMessage(message) {
    // Only process ClientEvents from display
    if (!message || message.messageType !== "ClientEvent") return;

    const clientEvent = message.payload;
    const engineRequest = this.toEngineRequest(clientEvent);

    // Filter: only send operator-like events (and hovers) to the engine.
    if (!this.shouldSendToEngine(clientEvent, engineRequest.type)) {
      return;
    }

    // 1) Publish the EngineRequest to the bus (for recording)
    this.bus.publishEngineRequest(engineRequest);

    // 2) Process via StubEngine / HTTP engine
    try {
      const response = await this.processRequest(engineRequest);
      this.bus.publishEngineResponse(response);
    } catch (err) {
      const errorResponse = {
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
  }


  /**
   * Decide whether a given ClientEvent should be sent to the engine.
   * We keep hover-based getHints, but ignore clicks on non-operator nodes.
   * NEW: Also allow integer (Num) node clicks for context menu.
   * @param {any} clientEvent
   * @param {"parse"|"previewStep"|"applyStep"|"getHints"} requestType
   */
  shouldSendToEngine(clientEvent, requestType) {
    if (!clientEvent) return false;

    const t = clientEvent.type;

    // Always allow hover-based hints.
    if (t === "hover") {
      return true;
    }

    // Do not send pure selection / drag events to the engine for now.
    if (t === "selectionChanged" || t === "dragSelect") {
      return false;
    }

    // For click / dblclick we allow operator-like nodes AND integer (Num) nodes.
    if (t === "click" || t === "dblclick") {
      const role = clientEvent.surfaceNodeRole || "";
      const kind = clientEvent.surfaceNodeKind || "";
      const nodeId = clientEvent.surfaceNodeId;
      const clickCount = clientEvent.click?.clickCount || 1;

      // Binary/relational/fraction operators.
      const isOperatorRole = role === "operator";
      const isOperatorKind =
        kind === "BinaryOp" ||
        kind === "MinusUnary" ||
        kind === "MinusBinary" ||
        kind === "Relation" ||
        kind === "Fraction";

      // NEW: Integer/Number nodes - P1 behavior
      const isIntegerNode = kind === "Num" || kind === "Number" || kind === "Integer";

      // Must be a real surface node inside the formula.
      if (!nodeId) return false;

      // IMPORTANT:
// Integer/Number nodes are handled locally in main.js (mode cycling + the single apply gateway).
// EngineAdapter must NOT send applyStep for numbers, otherwise we get competing apply sources
// and Step2 multiplier "1" (BLUE apply) becomes nondeterministic.
if (isIntegerNode) {
  console.log(`[P1] Integer click ignored by EngineAdapter (handled locally): nodeId=${nodeId}, clickCount=${clickCount}, type=${t}`);
  return false;
}

      return isOperatorRole || isOperatorKind;
    }

    // Everything else (parse, unknown types) we ignore.
    return false;
  }


  /**
     * Map ClientEvent → EngineRequest.type (getHints / previewStep / applyStep / parse).
     * @param {any} clientEvent
     * @returns {{ type: "parse" | "previewStep" | "applyStep" | "getHints"; clientEvent: any }}
     */
  toEngineRequest(clientEvent) {
    let requestType = "parse";

    switch (clientEvent && clientEvent.type) {
      case "click":
        // single click on operator → applyStep
        // single click on integer → applyStep (for choice menu)
        // double-click → applyStep
        // others → previewStep
        {
          const isDouble = clientEvent.click && clientEvent.click.clickCount === 2;
          const role = clientEvent.surfaceNodeRole || "";
          const kind = clientEvent.surfaceNodeKind || "";
          const hasOpIndex = typeof clientEvent.surfaceOperatorIndex === "number";

          const isOperator =
            role === "operator" ||
            kind === "BinaryOp" ||
            kind === "MinusBinary" ||
            kind === "Relation" ||
            kind === "Fraction" ||
            kind === "FracBar" ||
            kind === "Fraction" || // Duplicate but harmless
            hasOpIndex;

          // NEW: Integer clicks also trigger applyStep for choice menu
          const isInteger = kind === "Num" || kind === "Number" || kind === "Integer";

          if (isDouble || isOperator || isInteger) {
            requestType = "applyStep";
          } else {
            requestType = "previewStep";
          }
        }
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
        break;
    }

    return {
      type: requestType,
      clientEvent,
    };
  }

  /**
   * @param {{ type: string; clientEvent: any }} request
   * @returns {Promise<any>}
   */
  async processRequest(request) {
    if (this.config.mode === "embedded") {
      return this.stubEngine.process(request);
    }

    // HTTP mode
    const endpoint = this.config.httpEndpoint;
    if (!endpoint) {
      throw new Error("HTTP mode requires httpEndpoint in config");
    }

    // Only handle applyStep for now via the new V5 Engine
    if (request.type !== "applyStep") {
      return {
        type: "ok",
        requestType: request.type,
        result: {
          latex: request.clientEvent.latex,
          meta: { status: "ignored-by-v5" }
        }
      };
    }

    const timeout = this.config.httpTimeout || 5000;

    // --- V5 PIPELINE ONLY ---
    // Derive V5 endpoint: assume it's on the same host/port, just different path
    // e.g. http://localhost:4201/api/entry-step -> http://localhost:4201/api/orchestrator/v5/step
    const v5Endpoint = endpoint.replace("/api/entry-step", "/api/orchestrator/v5/step");

    const v5Payload = {
      sessionId: `session-${Date.now()}`, // Fresh session per request to prevent history bloat
      expressionLatex: request.clientEvent.latex,
      selectionPath: request.clientEvent.astNodeId || null, // Use AST node ID
      operatorIndex: request.clientEvent.astNodeId ? undefined : request.clientEvent.surfaceOperatorIndex, // FIXED: Only use as fallback
      courseId: "default",
      userRole: "student",
      // NEW: Surface node kind so backend can infer click target type
      surfaceNodeKind: request.clientEvent.surfaceNodeKind || null,
      // NEW: Explicit click context fields for operator matching
      clickTargetKind: request.clientEvent.surfaceNodeRole === "operator" ? "operator" :
        (request.clientEvent.surfaceNodeKind === "Num" || request.clientEvent.surfaceNodeKind === "Number" || request.clientEvent.surfaceNodeKind === "Integer") ? "number" :
          request.clientEvent.surfaceNodeKind === "Fraction" ? "fractionBar" : null,
      operator: request.clientEvent.surfaceNodeText || null, // "+" / "-" / "*" / "/" etc.
      surfaceNodeId: request.clientEvent.surfaceNodeId || null, // For debugging
    };

    // P1: Inject preferredPrimitiveId for integer double-clicks from cycle state
    const isIntegerNode = (request.clientEvent.surfaceNodeKind === "Num" ||
      request.clientEvent.surfaceNodeKind === "Number" ||
      request.clientEvent.surfaceNodeKind === "Integer");
    if (isIntegerNode && typeof window !== "undefined" && window.__p1IntegerCycleState) {
      const p1State = window.__p1IntegerCycleState;
      const clickedSurfaceId = request.clientEvent.surfaceNodeId;

      // Check if this is the same node that was previously selected (single-clicked)
      const isSameNode = p1State.selectedNodeId === clickedSurfaceId;

      // Use P1 state's cycleIndex if same node, otherwise default to mode 0 (GREEN)
      const cycleIndex = isSameNode ? p1State.cycleIndex : 0;
      const primitive = p1State.primitives[cycleIndex];

      if (primitive) {
        v5Payload.preferredPrimitiveId = primitive.id;

        // Determine selectionPath with proper fallback chain:
        // 1) P1 state's astNodeId if same node was selected
        // 2) clientEvent.astNodeId from surface map
        // 3) Keep null and rely on backend's surfaceNodeKind detection
        let targetPath = null;
        if (isSameNode && p1State.astNodeId) {
          targetPath = p1State.astNodeId;
        } else if (request.clientEvent.astNodeId) {
          targetPath = request.clientEvent.astNodeId;
        }

        if (targetPath) {
          v5Payload.selectionPath = targetPath;
        }

        console.log(`[P1] Integer double-click: primitiveId=${primitive.id}, selectionPath=${v5Payload.selectionPath}, mode=${cycleIndex}, isSameNode=${isSameNode}`);
      }
    }

    console.log("[VIEWER-REQUEST] Sending to V5:", {
      endpoint: v5Endpoint,
      payload: v5Payload,
      originalClickContext: {
        surfaceNodeId: request.clientEvent.surfaceNodeId,
        surfaceNodeKind: request.clientEvent.surfaceNodeKind
      }
    });

    const v5Result = await runV5Step(v5Endpoint, v5Payload, timeout);

    // Minimal User-Facing Debug
    console.log(
      "[V5 step]",
      v5Result.status,
      v5Result.primitiveId,
      v5Result.engineResult?.newExpressionLatex || "(no change)",
      v5Result.rawResponse
    );

    // Handle Statuses
    if (v5Result.status === "step-applied") {
      const newLatex = v5Result.engineResult?.newExpressionLatex;
      if (newLatex) {
        return {
          type: "ok",
          requestType: request.type,
          result: {
            latex: newLatex,
            meta: {
              backendStatus: v5Result.status,
              primitiveId: v5Result.primitiveId,
              debugInfo: v5Result.rawResponse.debugInfo
            }
          }
        };
      }
    } else if (v5Result.status === "no-candidates") {
      // No step available
      // Do not update latex, just return meta info
      return {
        type: "ok", // It's not a "client error", just "no step"
        requestType: request.type,
        result: {
          latex: request.clientEvent.latex, // Unchanged
          meta: {
            backendStatus: "no-candidates",
            primitiveId: null
          }
        }
      };
    } else if (v5Result.status === "choice") {
      // NEW: Multiple actions available - return choices to UI for popup display
      console.log("[EngineAdapter] Choice response received:", v5Result.choices);
      return {
        type: "ok",
        requestType: request.type,
        result: {
          latex: request.clientEvent.latex, // Unchanged
          meta: {
            backendStatus: "choice",
            choices: v5Result.choices,
            clickContext: {
              surfaceNodeId: request.clientEvent.surfaceNodeId,
              selectionPath: request.clientEvent.astNodeId || null,
            }
          }
        }
      };
    } else if (v5Result.status === "engine-error") {
      // Show error indication in console (already logged), maybe helpful meta
      return {
        type: "error", // Use error type to potentially show red toast? Or just ok with error meta.
        // Let's use 'ok' type but with error info in meta so Viewer doesn't crash completely
        // or use 'error' if the viewer has good error UI.
        // Existing fallback code used errorResponse for catch.
        // Let's return type: "error" to be safe and visible.
        requestType: request.type,
        message: "V5 Engine Error",
        error: {
          code: "V5_ENGINE_ERROR",
          details: JSON.stringify(v5Result.rawResponse)
        }
      };
    }

    // Fallback for unknown status (should not happen given types)
    return {
      type: "ok",
      requestType: request.type,
      result: {
        latex: request.clientEvent.latex,
        meta: { status: "unknown-v5-status", raw: v5Result }
      }
    };
  }
}

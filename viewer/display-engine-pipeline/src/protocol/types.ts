/**
 * Protocol types for Display ↔ Engine communication
 * These types define the contract between the Display Adapter and Engine Adapter
 */

export interface ClientEvent {
  type: "hover" | "click" | "dblclick" | "context" | "selectionChanged" | "dragSelect";
  timestamp: number;
  latex: string;
  surfaceNodeId?: string;
  surfaceOperatorIndex?: number;
  selection?: string[];
  click?: {
    button: "left" | "right";
    clickCount: 1 | 2;
    modifiers: {
      shift: boolean;
      ctrl: boolean;
      alt: boolean;
    };
  };
  hover?: {
    nodeKind?: string;
    nodeRole?: string;
    latexFragment?: string;
  };
  drag?: {
    selectedNodes: string[];
    selectionMode: "single" | "multi" | "rect";
  };
}

export interface EngineRequest {
  type: "parse" | "previewStep" | "applyStep" | "getHints";
  clientEvent: ClientEvent;
  sessionId?: string;
}

export interface EngineResponse {
  type: "ok" | "error";
  requestType: EngineRequest["type"];
  message?: string;
  result?: {
    latex: string;
    highlights?: string[];
    meta?: Record<string, unknown>;
  };
  error?: {
    code: string;
    details?: string;
  };
}

export interface BusMessage {
  direction: "clientToEngine" | "engineToClient";
  timestamp: number;
  payload: ClientEvent | EngineRequest | EngineResponse;
  messageType: "ClientEvent" | "EngineRequest" | "EngineResponse";
}

export type BusSubscriber = (message: BusMessage) => void | Promise<void>;

export interface FileBusConfig {
  name: string;
  maxHistory?: number;
}

export interface RecorderConfig {
  outputDir: string;
  sessionPrefix?: string;
  autoFlush?: boolean;
}

export interface EngineAdapterConfig {
  mode: "embedded" | "http";
  httpEndpoint?: string;
  httpTimeout?: number;
}

export interface LauncherConfig {
  mode: "demo" | "dev" | "test";
  displayConfig?: {
    containerSelector?: string;
  };
  engineAdapter: EngineAdapterConfig;
  recorder?: RecorderConfig;
  fileBus?: FileBusConfig;
  testScenario?: string;
}

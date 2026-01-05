import type { AstNode } from "./ast";
import type { MapMasterInput, MapMasterCandidate } from "./mapmaster.core";

// --- AST Debug ---

export interface AstDebugRequest {
    latex: string;
}

export interface AstDebugResponse {
    type: "ok" | "error";
    ast?: AstNode;      // full AST snapshot (using AstNode as root)
    message?: string;   // error message or diagnostic commentary
}

// --- MapMaster Debug ---

export interface ViewerSelection {
    // This matches what the frontend sends or what we use internally
    // Typically: selectionPath or operatorIndex
    selectionPath?: string | null;
    operatorIndex?: number;
}

export interface MapMasterDebugRequest {
    latex: string;
    selection: ViewerSelection;
    mode?: "Stage1" | "Advanced" | "Debug"; // optional, default "Stage1"
}

export interface MapMasterDebugPipeline {
    selection: {
        status: "ok" | "no-anchor" | "invalid";
        anchorNodeId?: string; // path
        anchorKind?: string;
        trace?: string;
    };
    window: {
        status: "ok" | "no-window";
        domain?: string;
        operation?: string;
        nodeIds?: string[]; // paths
    };
    invariants: {
        status: "found" | "none";
        ids?: string[];
    };
    rules: {
        status: "candidates-produced" | "no-rules-fired";
        candidateCount: number;
        checkedInvariantIds?: string[];
        reasonIfNone?: string;
    };
}

export interface MapMasterDebugResult {
    input: MapMasterInput;
    astSnapshot: AstNode;
    pipeline: MapMasterDebugPipeline;
    candidates: MapMasterCandidate[];
}

export interface MapMasterDebugResponse {
    type: "ok" | "error";
    message?: string;
    result?: MapMasterDebugResult;
}

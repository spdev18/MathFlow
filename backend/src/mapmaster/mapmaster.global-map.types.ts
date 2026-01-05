import type { AstNode } from "./ast";
import type { MapMasterDebugResult } from "./mapmaster.debug.types";
import type { InvariantSetId } from "../invariants/index";

// --- Global Map Types ---

export interface MapMasterGlobalMapNodeEntry {
    anchorNodeId: string;    // same id as pipeline.selection.anchorNodeId
    anchorKind: string;      // same enum/type as pipeline.selection.anchorKind; keep it as string for stability
    operatorIndex: number;   // 0-based operator index used when invoking MapMaster
    debug: MapMasterDebugResult;  // full debug result for this anchor
    hasCandidates: boolean;  // convenience: debug.candidates.length > 0
    candidateCount: number;  // debug.candidates.length
}

export interface MapMasterGlobalMapResult {
    expressionLatex: string;
    invariantSetIds: InvariantSetId[];
    astSnapshot: AstNode;       // full AST for the expression
    entries: MapMasterGlobalMapNodeEntry[];
    operatorCount: number;      // total number of operators discovered
    candidatefulAnchorCount: number; // number of anchors that produced at least one candidate
}

// --- HTTP Types ---

export interface MapMasterGlobalMapRequest {
    latex: string;
    invariantSetIds?: InvariantSetId[]; // optional; default to Stage1 invariant set if omitted
}

export interface MapMasterGlobalMapResponse {
    type: "ok" | "error";
    message?: string;
    result?: MapMasterGlobalMapResult;
}

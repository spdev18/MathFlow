import type { ViewerSelection } from "../mapmaster/mapmaster.debug.types";
import type { AstNode } from "../mapmaster/ast";
import type { MapMasterResult } from "../mapmaster/mapmaster.core";
import type { StepMasterInput, StepMasterResult } from "./stepmaster.core";
import type { StepHistory } from "./stepmaster.history-service";

export interface StepDebugRequest {
    latex: string;
    selection: ViewerSelection;
    session?: StepHistory; // Optional session state (history)
    mode?: "Stage1" | "Advanced" | "Debug";
}

export interface StepDebugResult {
    astSnapshot: AstNode;
    map: MapMasterResult;
    stepMasterInput: StepMasterInput;
    stepMasterOutput: StepMasterResult;
    updatedSession: StepHistory;
}

export interface StepDebugResponse {
    type: "ok" | "error";
    message?: string;
    result?: StepDebugResult;
}

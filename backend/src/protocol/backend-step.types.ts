/**
 * Backend API v1 — One-Step Math Engine (TzV1.1)
 *
 * Canonical TypeScript contracts for the Engine step endpoint.
 */

export type OrchestratorStepStatus =
  | "step-applied"
  | "no-candidates"
  | "engine-error"
  | "choice"; // NEW: Multiple actions available for this click

export interface EntryStepRequest {
  sessionId: string;
  courseId?: string; // Optional, defaults to "default"
  expressionLatex: string;
  selectionPath: string | null;
  operatorIndex?: number; // Optional, 0-based index of the operator in the expression
  policyId?: string; // Optional, defaults to "student.basic"
  token?: string; // Optional auth token
  preferredPrimitiveId?: string; // NEW: Client's choice from a previous "choice" response
}

export interface PrimitiveDebugInfo {
  primitiveId: string | null;
  status: "ready" | "blocked" | "none" | "error";
  domain?: string | null;
  reason?: string | null;
}

/**
 * StepChoice: One option when status is "choice"
 */
export interface StepChoice {
  id: string;
  label: string;
  primitiveId: string;
  targetNodeId: string;
}

export interface EngineStepResponse {
  expressionLatex: string;
  status: OrchestratorStepStatus;
  debugInfo?: {
    allCandidates: unknown[];
  } | null;
  primitiveDebug?: PrimitiveDebugInfo;
  choices?: StepChoice[]; // NEW: Available when status is "choice"
}

export interface UndoStepRequest {
  sessionId: string;
}

export interface UndoStepResponse {
  status: "ok" | "error";
  previousExpression: string | null; // null if history was empty
  error?: string;
}

export interface HintRequest {
  sessionId: string;
  courseId: string;
  expressionLatex: string;
  selectionPath: string | null;
  operatorIndex?: number;
}

export interface HintResponse {
  status: "hint-found" | "no-hint" | "error";
  hintText?: string;
  error?: string;
}

export type UserRole = "student" | "teacher";

export interface RegisterRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  status: "ok" | "error";
  token?: string;
  userId?: string;
  role?: UserRole;
  error?: string;
}


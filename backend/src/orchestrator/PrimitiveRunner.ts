/**
 * PrimitiveRunner — thin adapter contract between EngineStepOrchestrator
 * and the underlying engine (NGIN Lite or its test doubles).
 *
 * This file defines TypeScript-only types for requests and results.
 * It does not perform any I/O by itself.
 */

/**
 * Request to PrimitiveRunner.
 *
 * At this stage PrimitiveRunner only supports "preview" mode: it reports
 * what would happen if we applied exactly one atomic primitive step.
 */
export interface PrimitiveRunnerRequest {
  /** Mode of operation; at this stage only "preview" is supported. */
  mode: "preview";

  /** Input expression as LaTeX. */
  latex: string;

  /**
   * Identifiers of primitives that should be considered for this step.
   * Exact semantics are defined by the engine and invariant set.
   */
  primitiveIds: string[];

  /**
   * Optional invariant set identifier forwarded to the engine
   * (for example, "fractions-basic.v1").
   */
  invariantSetId?: string;

  /**
   * Optional additional context (selection information, AST paths, etc.)
   * expected by primitives. Kept generic on purpose.
   */
  context?: unknown;
}

/**
 * High-level status of PrimitiveRunner result.
 */
export type PrimitiveRunnerStatus = "ok" | "noStep" | "error";

/**
 * Successful primitive step result.
 */
export interface PrimitiveRunnerResultOk {
  status: "ok";

  /** LaTeX representation of the expression before applying the primitive. */
  latexBefore: string;

  /** LaTeX representation of the expression after applying the primitive. */
  latexAfter: string;

  /** Identifiers of primitives that were actually applied. */
  appliedPrimitiveIds: string[];

  /** Flag for debugging: confirms that AST changed. */
  astChanged: true;

  /** Optional debug payload (can be stripped out in production). */
  debugInfo?: unknown;
}

/**
 * Reason why no step was performed.
 */
export type PrimitiveRunnerNoStepReason =
  | "no-primitive-applicable"
  | "expression-already-simplified";

/**
 * Result indicating that no primitive step was performed.
 */
export interface PrimitiveRunnerResultNoStep {
  status: "noStep";
  reason: PrimitiveRunnerNoStepReason;

  /** Original LaTeX — returned as-is for convenience. */
  latex: string;
}

/**
 * Machine-readable error codes for PrimitiveRunner failures.
 */
export type PrimitiveRunnerErrorCode =
  | "parse-error"
  | "engine-error"
  | "config-error";

/**
 * Result indicating that an error occurred while trying to run a primitive step.
 */
export interface PrimitiveRunnerResultError {
  status: "error";
  errorCode: PrimitiveRunnerErrorCode;

  /**
   * Short technical message; intended for logs and debugging, not for UI.
   */
  message: string;
}

/**
 * Union of all possible PrimitiveRunner results.
 */
export type PrimitiveRunnerResult =
  | PrimitiveRunnerResultOk
  | PrimitiveRunnerResultNoStep
  | PrimitiveRunnerResultError;

/**
 * Main PrimitiveRunner callable interface.
 *
 * The function is intentionally promise-based to align with async engines.
 */
export interface PrimitiveRunner {
  (request: PrimitiveRunnerRequest): Promise<PrimitiveRunnerResult>;
}

export interface PrimitiveRunnerDeps<TContext = unknown> {
  runner: PrimitiveRunner;
}

export async function runPrimitiveStep(
  request: PrimitiveRunnerRequest,
  deps: PrimitiveRunnerDeps<unknown>
): Promise<PrimitiveRunnerResult> {
  return deps.runner(request);
}

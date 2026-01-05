/**
 * Display ⇄ StepMaster Action Layer bridge types (B10).
 *
 * Purpose:
 * --------
 *  - Define the *shape* of data that flows between:
 *      - the Display / KaTeX window (DisplayPublicApi events),
 *      - the StepMaster Action Layer (StepActionQuery / StepActionCandidate).
 *  - This file does NOT implement any UI. It only specifies types that
 *    future UI code will use when wiring real click-handlers and
 *    context menus.
 */

import type { DisplayEvent } from "../display-adapter/DisplayPublicApi";
import type {
  StepActionQuery,
  StepActionCandidate,
} from "../../../../mapmaster-bridge/src/stepmaster/stepmaster.actions.types";

/**
 * Minimal information the Display passes into the StepMaster Action Layer
 * when the student clicks or opens a context menu.
 *
 * This is intentionally close to StepActionQuery, but we keep it separate
 * to allow Display-specific fields (e.g. raw surfaceNodeId).
 */
export interface DisplayStepActionContext {
  /**
   * Last Display event that triggered this query (click / context / etc).
   */
  event: DisplayEvent;

  /**
   * Expression identity and metadata the Display knows about.
   * In many cases this will be obtained from the current "expression slot"
   * in the Viewer (e.g. exercise id, invariant set id, etc.).
   */
  expression: {
    id: string;
    latex: string;
    invariantSetId: string;
    displayVersion?: string;
  };

  /**
   * Optional constraint from the Viewer about which invariant should be
   * used. For basic training flows this can be fixed per exercise.
   */
  invariantId?: string | null;
}

/**
 * Result of asking "what are the allowed one-step actions right now?"
 * for the given Display context.
 */
export interface DisplayStepActionResult {
  /**
   * The normalized StepActionQuery we actually sent to the Action Layer.
   * This is useful for debugging and DevTools views.
   */
  query: StepActionQuery;

  /**
   * Candidate actions that StepMaster considers valid, in the order
   * determined by the policy (student/teacher/etc).
   */
  actions: StepActionCandidate[];
}

/**
 * A small interface the Viewer-side logic can implement to talk to the
 * StepMaster Action Layer. In the browser this can be:
 *
 *  - a direct in-process call to the Action Layer (for offline demos);
 *  - or a tiny HTTP client that calls a backend endpoint.
 */
export interface DisplayStepActionProvider {
  getActions(
    ctx: DisplayStepActionContext,
  ): Promise<DisplayStepActionResult>;
}

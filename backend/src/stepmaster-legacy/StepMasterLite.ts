// LEGACY: StepMasterLite (do not use in new code).
// Kept only for historical reference and experiments.
/**
 * StepMasterLite — Stage 5.x
 *
 * A thin policy layer that decides which primitive should be applied
 * when MapMaster proposes multiple candidates.
 *
 * Current policy:
 *   1. If any candidate belongs to a known scenario (by scenarioId),
 *      choose according to a priority list.
 *   2. Otherwise, fall back to the first candidate.
 */

import type { MapMasterCandidateLite } from "../mapmaster/MapMasterLite.js";

export interface StepMasterPolicyContext {
  expressionId: string;
  latex: string;
  invariantSetId: string | undefined;
  mode: "preview" | "commit";
}

export interface StepMasterLiteDeps {
  /**
   * Optional override for scenario priorities. The first matching scenario
   * wins when several candidates are available.
   */
  scenarioPriority?: string[];
  // Reserved for future logging / metrics / user model.
}

export interface StepMasterInput {
  candidates: MapMasterCandidateLite[];
  context: StepMasterPolicyContext;
}

const DEFAULT_SCENARIO_PRIORITY = [
  "SCN.FRAC_ADD_DIFF_DEN",
  "SCN.FRAC_ADD_SAME_DEN",
  "SCN.FRAC_SIMPLIFY",
];

/**
 * Choose a single primitive id from the list of MapMaster candidates.
 *
 * Policy:
 *   - derive a scenario priority list (deps.scenarioPriority or default);
 *   - if any candidate's scenarioId matches the list, return that
 *     candidate's primitiveId;
 *   - otherwise, return the first candidate's primitiveId;
 *   - if there are no candidates at all, return undefined.
 */
export function choosePrimitiveId(
  input: StepMasterInput,
  deps?: StepMasterLiteDeps,
): string | undefined {
  const { candidates } = input;

  if (candidates.length === 0) {
    return undefined;
  }

  const priority = deps?.scenarioPriority ?? DEFAULT_SCENARIO_PRIORITY;

  for (const scenarioId of priority) {
    const match = candidates.find(
      (candidate) => candidate.scenarioId === scenarioId,
    );
    if (match) {
      return match.primitiveId;
    }
  }

  // Fallback: keep the old behaviour — choose the first candidate.
  const [first] = candidates;
  return first?.primitiveId;
}

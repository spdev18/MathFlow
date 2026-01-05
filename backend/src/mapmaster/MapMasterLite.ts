/**
 * MapMasterLite — Stage 5.3.a
 *
 * Invariants-driven MapMaster implementation for simple fraction expressions.
 * Instead of hard-coding particular LaTeX patterns directly in MapMasterLite,
 * we delegate the decision to the invariant registry loaded from config files.
 */

import type { EngineStepRequest } from "../protocol/backend-step.types.js";
import {
  getInvariantsBySetId,
  FRACTIONS_BASIC_SET_ID,
  type ExpressionAstLite,
  type SurfaceSelectionLite,
  type InvariantRecord,
} from "../invariants/index.js";

/**
 * One candidate step that MapMasterLite can propose.
 */
export interface MapMasterCandidateLite {
  /**
   * Identifier of the primitive that should be applied.
   * Example: "P4.FRAC_ADD_BASIC".
   */
  primitiveId: string;

  /**
   * Optional human-readable label for debugging / UI.
   */
  label?: string;
}

/**
 * Result of building a map for a single EngineStepRequest.
 */
export interface MapMasterResultLite {
  candidates: MapMasterCandidateLite[];
}

/**
 * Optional dependency bag for future extensions (logging, metrics, etc.).
 * Stage 5.3 does not need any external services yet.
 */
export interface MapMasterLiteDeps {
  // Intentionally empty for now.
}

function buildSurfaceSelection(
  request: EngineStepRequest,
): SurfaceSelectionLite | undefined {
  const event = request.clientEvent;

  if (!event || event.type !== "click") {
    return undefined;
  }

  return {
    surfaceNodeId: event.surfaceNodeId,
    selection: event.selection ?? [],
  };
}

/**
 * Very small parser that recognises only the shapes we care about:
 *
 *   - a/b + c/d
 *   - a/b
 *
 * Everything else is left undefined and treated as "no invariants apply".
 */
function parseExpressionAstLite(latex: string): ExpressionAstLite | undefined {
  const compact = latex.replace(/\s+/g, "");

  // a/b (+|-) c/d  — both addition and subtraction are treated as "sum"
  const sumMatch = compact.match(/^(-?\d+)\/(\d+)([+-])(-?\d+)\/(\d+)$/);
  if (sumMatch) {
    const [, leftNum, leftDen, op, rightNumRaw, rightDen] = sumMatch;

    if (leftDen === "0" || rightDen === "0") {
      return undefined;
    }

    const left: ExpressionAstLite = {
      type: "fraction",
      numerator: leftNum,
      denominator: leftDen,
    };

    const right: ExpressionAstLite = {
      type: "fraction",
      numerator: op === "-" ? `-${rightNumRaw}` : rightNumRaw,
      denominator: rightDen,
    };

    return {
      type: "sum",
      left,
      right,
    };
  }

  // a/b or -a/b
  const fracMatch = compact.match(/^(-?\d+)\/(\d+)$/);
  if (fracMatch) {
    const [, num, den] = fracMatch;

    if (den === "0") {
      return undefined;
    }

    return {
      type: "fraction",
      numerator: num,
      denominator: den,
    };
  }

  return undefined;
}

function getInvariantRecords(
  invariantSetId: string | undefined,
): InvariantRecord[] {
  const setId = (invariantSetId ?? FRACTIONS_BASIC_SET_ID) as typeof FRACTIONS_BASIC_SET_ID;
  return getInvariantsBySetId(setId);
}

/**
 * Main entry point for MapMasterLite.
 *
 * Given an EngineStepRequest, it:
 *   1. Builds a tiny AST and surface-selection view.
 *   2. Looks up the invariant set by invariantSetId.
 *   3. Filters invariants by their `when(...)` predicate.
 *   4. Returns candidates ordered by priority.
 */
export async function buildMapLite(
  request: EngineStepRequest,
  _deps?: MapMasterLiteDeps,
): Promise<MapMasterResultLite> {
  const surface = buildSurfaceSelection(request);
  if (!surface) {
    // For now MapMasterLite only reacts to click events.
    return { candidates: [] };
  }

  const ast = parseExpressionAstLite(request.latex);
  if (!ast) {
    return { candidates: [] };
  }

  const invariants = getInvariantRecords(request.invariantSetId);
  if (invariants.length === 0) {
    return { candidates: [] };
  }

  const applicable: InvariantRecord[] = [];

  for (const record of invariants) {
    try {
      if (
        record.when({
          ast,
          surface,
        })
      ) {
        applicable.push(record);
      }
    } catch {
      // Defensive: a single invariant must not break the whole plan.
      // We simply skip invariants that throw.
    }
  }

  if (applicable.length === 0) {
    return { candidates: [] };
  }

  // Order by priority (ascending).
  applicable.sort((a, b) => a.priority - b.priority);

  const candidates: MapMasterCandidateLite[] = applicable.map((record) => {
    const primitiveId = record.primitiveIds[0];

    return {
      primitiveId,
      label: record.description,
    };
  });

  return { candidates };
}

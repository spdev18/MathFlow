/**
 * Core types for invariant-driven MapMaster.
 *
 * Stage 5.3.a — invariants loaded from config files.
 */

export type InvariantSetId = string;

export type InvariantId = string;

/**
 * Minimal AST representation used by invariants in this package.
 *
 * The goal is not to build a full CAS, but to express the shapes
 * that our invariants care about (fractions and simple sums).
 */
export interface FractionNode {
  type: "fraction";
  numerator: string;
  denominator: string;
}

export interface SumNode {
  type: "sum";
  left: ExpressionAstLite;
  right: ExpressionAstLite;
}

export interface DiffNode {
  type: "diff";
  left: ExpressionAstLite;
  right: ExpressionAstLite;
}

export type ExpressionAstLite = FractionNode | SumNode | DiffNode;

/**
 * Description of the surface selection in the display layer.
 *
 * For Stage 5.3 we only distinguish between "whole expression"
 * and "something else", but the structure is kept generic.
 */
export interface SurfaceSelectionLite {
  surfaceNodeId: string;
  selection: string[];
}

/**
 * Single invariant record.
 *
 * Invariants are data — MapMasterLite will consult this table
 * instead of hard-coding knowledge about particular formulas.
 */
export interface InvariantRecord {
  id: InvariantId;
  invariantSetId: InvariantSetId;
  description: string;
  priority: number;
  primitiveIds: string[];
  scenarioId?: string;
  teachingTag?: string;
  when(input: {
    ast: ExpressionAstLite;
    surface: SurfaceSelectionLite;
  }): boolean;
}

export const FRACTIONS_BASIC_SET_ID = "fractions-basic.v1" as const;

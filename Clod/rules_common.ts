/**
 * Common types and utilities for MapMaster rule modules.
 */

import type { MapMasterRequest } from './mapmaster.core';
import type { AstPath, ExpressionAstNode, AstHelpers } from './mapmaster.ast-helpers';

/**
 * Context passed to rule modules for building step candidates.
 * 
 * This contains all the information needed to:
 * - Inspect the semantic window (AST node + path)
 * - Access the original request
 * - Query applicable invariant rules
 * - Navigate the AST structure
 */
export interface RuleContext {
  /**
   * The original MapMaster request.
   */
  request: MapMasterRequest;

  /**
   * Path to the root of the semantic window in the AST.
   */
  windowRootPath: AstPath;

  /**
   * The AST node at the window root.
   */
  windowRootNode: ExpressionAstNode;

  /**
   * Invariant rules applicable to this window.
   * Pre-filtered by the invariant registry based on the window's characteristics.
   */
  invariantRules: InvariantRule[];

  /**
   * AST navigation and inspection utilities.
   * Used to examine the structure of the window and its children.
   */
  astHelpers: AstHelpers;
}

/**
 * Minimal representation of an invariant rule from the registry.
 * 
 * The actual InvariantRule type is defined in mapmaster.invariants.registry-adapter.ts,
 * but we redefine the essential fields here for convenience.
 */
export interface InvariantRule {
  /**
   * Unique identifier for this invariant rule.
   */
  id: string;

  /**
   * Domain this rule belongs to (e.g., "FractionsSameDen", "Integers", "Mixed").
   */
  domain: string;

  /**
   * Stage of the rule (e.g., "Stage1", "Stage2").
   */
  stage: string;

  /**
   * Primitive IDs that this rule uses from the Engine.
   */
  primitiveIds: string[];

  /**
   * Optional operation type (e.g., "Add", "Sub", "Mul", "Div").
   */
  operation?: string;

  /**
   * Human-readable description of the rule.
   */
  description?: string;

  /**
   * Additional metadata about the rule.
   */
  metadata?: Record<string, any>;
}

/**
 * Logger interface for rule modules.
 * Allows rule modules to emit debug/warning messages without depending on a specific logger.
 */
export interface MapMasterLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Helper to create a stable candidate ID from a rule and path.
 */
export function createCandidateId(ruleId: string, windowPath: AstPath): string {
  return `${ruleId}#${windowPath.join('.')}`;
}

/**
 * Helper to check if a node represents an integer literal.
 */
export function isIntegerLiteral(node: ExpressionAstNode): boolean {
  return node.kind === 'Integer' || node.kind === 'IntegerLiteral';
}

/**
 * Helper to extract the value from an integer literal node.
 */
export function getIntegerValue(node: ExpressionAstNode): number | null {
  if (!isIntegerLiteral(node)) {
    return null;
  }

  const value = (node as any).value || (node as any).val;
  return typeof value === 'number' ? value : null;
}
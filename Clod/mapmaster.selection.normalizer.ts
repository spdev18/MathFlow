// backend-api-b1.http-server/src/mapmaster/mapmaster.selection.normalizer.ts

import type { MapMasterRequest } from './mapmaster.core';
import type {
  AstHelpers,
  AstPath,
  ExpressionAstNode,
} from './mapmaster.ast-helpers';

/**
 * Kind of the anchor that selection normalization produced.
 * - "Operator"  → anchor points to a binary operator node
 * - "Operand"   → anchor points to a value (fraction, integer, etc.)
 */
export type AnchorKind = 'Operator' | 'Operand';

/**
 * Normalized selection that MapMaster rule provider will use as an anchor.
 */
export interface NormalizedSelection {
  /** Path to the anchor node in the expression AST */
  anchorPath: AstPath;
  /** Whether the anchor is an operator or an operand */
  anchorKind: AnchorKind;
  /**
   * Human-readable trace of where the selection came from,
   * e.g. "clientEvent.astPath", "clientEvent.operatorIndex:0th operator",
   * "tsaSelection.astPath"
   */
  trace: string;
}

/**
 * Interface for selection normalizers.
 */
export interface SelectionNormalizer {
  normalizeSelection(request: MapMasterRequest): NormalizedSelection | null;
}

/**
 * Default implementation of MapMaster selection normalization.
 *
 * Priority of selection sources:
 *  1) clientEvent.astPath
 *  2) clientEvent.operatorIndex
 *  3) tsaSelection.astPath
 *
 * If none of these yield a valid AST location, returns null.
 */
export class MapMasterSelectionNormalizer implements SelectionNormalizer {
  constructor(private readonly astHelpers: AstHelpers) {}

  normalizeSelection(request: MapMasterRequest): NormalizedSelection | null {
    const engineView: any = (request as any).engineView;
    if (!engineView) {
      // No engine view → cannot map selection
      return null;
    }

    // EngineExpressionView may either be the AST itself or { ast, ... }
    const rootAst: ExpressionAstNode | undefined =
      (engineView as any).ast ?? (engineView as any);

    if (!rootAst) {
      // Missing AST inside engine view
      return null;
    }

    const clientEvent: any = (request as any).clientEvent ?? null;
    const tsaSelection: any = (request as any).tsaSelection ?? null;

    // 1) clientEvent.astPath (highest priority)
    const fromClientAstPath = this.tryFromClientAstPath(rootAst, clientEvent);
    if (fromClientAstPath) {
      return fromClientAstPath;
    }

    // 2) clientEvent.operatorIndex
    const fromOperatorIndex = this.tryFromOperatorIndex(rootAst, clientEvent);
    if (fromOperatorIndex) {
      return fromOperatorIndex;
    }

    // 3) tsaSelection.astPath
    const fromTsa = this.tryFromTsaSelection(rootAst, tsaSelection);
    if (fromTsa) {
      return fromTsa;
    }

    // No usable selection
    return null;
  }

  /**
   * Try to normalize from clientEvent.astPath.
   * Returns null if the path is absent or invalid.
   */
  private tryFromClientAstPath(
    rootAst: ExpressionAstNode,
    clientEvent: any,
  ): NormalizedSelection | null {
    if (!clientEvent || !Array.isArray(clientEvent.astPath)) {
      return null;
    }

    const anchorPath = clientEvent.astPath as AstPath;
    const node = this.astHelpers.getNodeByPath(rootAst, anchorPath);

    if (!node) {
      // Invalid path; caller may still fall back to operatorIndex or TSA
      return null;
    }

    const anchorKind = this.classifyAnchorKind(rootAst, anchorPath);

    return {
      anchorPath,
      anchorKind,
      trace: 'clientEvent.astPath',
    };
  }

  /**
   * Try to normalize from clientEvent.operatorIndex.
   * Returns null if the index is absent, negative, or out of bounds.
   */
  private tryFromOperatorIndex(
    rootAst: ExpressionAstNode,
    clientEvent: any,
  ): NormalizedSelection | null {
    if (!clientEvent || typeof clientEvent.operatorIndex !== 'number') {
      return null;
    }

    const index = clientEvent.operatorIndex as number;

    // Negative index is always invalid
    if (index < 0) {
      return null;
    }

    const operatorPath = this.astHelpers.findNthOperator(rootAst, index);
    if (!operatorPath) {
      // Out-of-bounds index
      return null;
    }

    return {
      anchorPath: operatorPath,
      anchorKind: 'Operator',
      trace: `clientEvent.operatorIndex:${index}th operator`,
    };
  }

  /**
   * Try to normalize from TSA selection (tsaSelection.astPath).
   * Returns null if TSA is absent, has no path, or the path is invalid.
   */
  private tryFromTsaSelection(
    rootAst: ExpressionAstNode,
    tsaSelection: any,
  ): NormalizedSelection | null {
    if (!tsaSelection || !Array.isArray(tsaSelection.astPath)) {
      return null;
    }

    const anchorPath = tsaSelection.astPath as AstPath;
    const node = this.astHelpers.getNodeByPath(rootAst, anchorPath);

    if (!node) {
      return null;
    }

    const anchorKind = this.classifyAnchorKind(rootAst, anchorPath);

    return {
      anchorPath,
      anchorKind,
      trace: 'tsaSelection.astPath',
    };
  }

  /**
   * Classify the anchor node as Operator or Operand.
   * Uses AstHelpers to detect binary operator nodes.
   */
  private classifyAnchorKind(
    rootAst: ExpressionAstNode,
    anchorPath: AstPath,
  ): AnchorKind {
    const node =
      this.astHelpers.getNodeByPath(rootAst, anchorPath) ?? rootAst;

    // Binary operator node → Operator
    if (
      this.astHelpers.isBinaryOperator(node, '+') ||
      this.astHelpers.isBinaryOperator(node, '-') ||
      this.astHelpers.isBinaryOperator(node, '*') ||
      this.astHelpers.isBinaryOperator(node, '/')
    ) {
      return 'Operator';
    }

    // Everything else (fractions, integers, etc.) → Operand
    return 'Operand';
  }
}

/**
 * Simple no-op implementation for cases where selection normalization
 * is not yet wired but the interface is required.
 */
export class DummySelectionNormalizer implements SelectionNormalizer {
  normalizeSelection(_request: MapMasterRequest): NormalizedSelection | null {
    return null;
  }
}

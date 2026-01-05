/**
 * TSA Selection ↔ Viewer integration smoke test.
 *
 * Goal:
 * - Ensure that the `tsa-selection-viewer-bridge` package located at
 *   `D:/06/tsa-selection-viewer-bridge` can be imported from inside
 *   the display-engine-pipeline tests, and that a simple DisplayAst
 *   selection produces at least one TSA SelectionRegion hit.
 *
 * This is a repo-level wiring test: it does NOT touch the real browser
 * Viewer yet, it simply confirms that the shared TSA selection layer
 * is reachable from the C2–C6 pipeline.
 */

import assert from "node:assert";
import { test } from "node:test";

import type { SelectionMap } from "../../../tsa-selection-viewer-bridge/src/types.js";
import {
  buildSelectionMapFromDisplayAstRoot,
  createViewerSelectionContext,
  findRegionsForSelection,
} from "../../../tsa-selection-viewer-bridge/src/index.js";

type AnyDisplayAstNode = {
  id: string;
  kind: string;
  text?: string;
  children: AnyDisplayAstNode[];
};

/**
 * Minimal synthetic DisplayAst tree.
 *
 * IMPORTANT:
 * - `id` values are TSA DisplayAst node IDs.
 * - We will select node "n1" and expect TSA to find at least
 *   one region that touches this display node.
 */
function makeSimpleDisplayAst(): AnyDisplayAstNode {
  const root: AnyDisplayAstNode = {
    id: "root",
    kind: "group",
    children: [
      {
        id: "n1",
        kind: "symbol",
        text: "1",
        children: [],
      },
      {
        id: "plus",
        kind: "symbol",
        text: "+",
        children: [],
      },
      {
        id: "n2",
        kind: "symbol",
        text: "2",
        children: [],
      },
    ],
  };

  return root;
}

test("tsa-selection-viewer-bridge is reachable from display-engine-pipeline", () => {
  const expressionId = "expr-1";
  const displayAst = makeSimpleDisplayAst();

  const selectionMap = buildSelectionMapFromDisplayAstRoot(
    displayAst,
    expressionId,
  ) as SelectionMap;

  // Basic sanity: TSA produced at least one region for this expression.
  assert.ok(
    selectionMap.regions.length > 0,
    "SelectionMap should contain at least one region",
  );

  // Viewer selects the display node with id "n1".
  const selection = {
    mode: "single" as const,
    primaryId: "n1",
    selectedIds: ["n1"],
  };

  const ctx = createViewerSelectionContext(
    expressionId,
    selectionMap,
    selection,
  );

  const hits = findRegionsForSelection(ctx);

  assert.ok(hits.length > 0, "Expected at least one SelectionRegionHit");
  const first = hits[0];

  assert.strictEqual(
    first.region.expressionId,
    expressionId,
    "Hit region should belong to the same expressionId",
  );
});

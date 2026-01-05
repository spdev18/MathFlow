import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ExpressionAstLite,
  FractionNode,
  SumNode,
  DiffNode,
  SurfaceSelectionLite,
  InvariantRecord,
  InvariantSetId,
} from "./invariant.types.js";

interface InvariantFileShapeFracSum {
  kind: "frac-sum";
  denominators?: "different" | "equal" | "any";
}

interface InvariantFileShapeSingleFrac {
  kind: "single-frac";
  gcdGreaterThan?: number;
}

interface InvariantFileShapeFracSub {
  kind: "frac-sub";
  denominators?: "different" | "equal" | "any";
}

type InvariantFileShape = InvariantFileShapeFracSum | InvariantFileShapeSingleFrac | InvariantFileShapeFracSub;

interface InvariantFileSurface {
  mode: "whole-expression";
}

interface InvariantFileEntry {
  id: string;
  description: string;
  priority: number;
  primitiveIds: string[];
  shape: InvariantFileShape;
  surface: InvariantFileSurface;
  scenarioId?: string;
  teachingTag?: string;
}

interface InvariantFileSchema {
  invariantSetId: string;
  invariants: InvariantFileEntry[];
}

const CONFIG_DIR_RELATIVE = ["..", "..", "config", "invariants"];

function isWholeExpression(surface: SurfaceSelectionLite): boolean {
  return (
    surface.surfaceNodeId === "surf-whole-expression" &&
    (surface.selection.length === 0 ||
      surface.selection.includes("surf-whole-expression"))
  );
}

function isFraction(node: ExpressionAstLite): node is FractionNode {
  return node.type === "fraction";
}

function isSimpleFractionSum(
  ast: ExpressionAstLite,
): ast is SumNode & { left: FractionNode; right: FractionNode } {
  return (
    ast.type === "sum" &&
    isFraction(ast.left as ExpressionAstLite) &&
    isFraction(ast.right as ExpressionAstLite)
  );
}

function gcdFromStrings(aStr: string, bStr: string): number | undefined {
  const a = Number.parseInt(aStr, 10);
  const b = Number.parseInt(bStr, 10);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return undefined;
  }

  let x = Math.abs(a);
  let y = Math.abs(b);

  if (x === 0 && y === 0) {
    return undefined;
  }

  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }

  return x;
}

function buildWhenPredicate(
  entry: InvariantFileEntry,
): (input: { ast: ExpressionAstLite; surface: SurfaceSelectionLite }) => boolean {
  const { shape, surface: surfacePattern } = entry;

  return ({ ast, surface }) => {
    if (surfacePattern.mode === "whole-expression" && !isWholeExpression(surface)) {
      return false;
    }

    if (shape.kind === "frac-sum") {
      if (!isSimpleFractionSum(ast)) {
        return false;
      }

      const left = ast.left;
      const right = ast.right;

      const mode = shape.denominators ?? "any";

      if (mode === "different" && left.denominator === right.denominator) {
        return false;
      }

      if (mode === "equal" && left.denominator !== right.denominator) {
        return false;
      }

      return true;
    }

    if (shape.kind === "single-frac") {
      if (!isFraction(ast)) {
        return false;
      }

      const gcdLimit = shape.gcdGreaterThan ?? 1;
      const g = gcdFromStrings(ast.numerator, ast.denominator);

      if (g === undefined) {
        return false;
      }

      return g > gcdLimit;
    }

    if (shape.kind === "frac-sub") {
      if (ast.type !== "diff" || !isFraction(ast.left as ExpressionAstLite) || !isFraction(ast.right as ExpressionAstLite)) {
        return false;
      }

      const left = ast.left as FractionNode;
      const right = ast.right as FractionNode;

      const mode = shape.denominators ?? "any";

      if (mode === "different" && left.denominator === right.denominator) {
        return false;
      }

      if (mode === "equal" && left.denominator !== right.denominator) {
        return false;
      }

      return true;
    }

    return false;
  };
}

let REGISTRY_CACHE: Record<InvariantSetId, InvariantRecord[]> | undefined;

function loadAllInvariantSetsFromConfig(): Record<InvariantSetId, InvariantRecord[]> {
  if (REGISTRY_CACHE) {
    return REGISTRY_CACHE;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const configDir = resolve(moduleDir, ...CONFIG_DIR_RELATIVE);

  let files: string[] = [];
  try {
    files = readdirSync(configDir).filter((name) => name.endsWith(".json"));
  } catch {
    // If the config directory is missing we treat it as "no invariants".
    REGISTRY_CACHE = {};
    return REGISTRY_CACHE;
  }

  const registry: Record<InvariantSetId, InvariantRecord[]> = {};

  for (const fileName of files) {
    const fullPath = resolve(configDir, fileName);
    let raw: string;

    try {
      raw = readFileSync(fullPath, "utf8");
    } catch {
      // Skip unreadable file.
      continue;
    }

    let parsed: InvariantFileSchema;
    try {
      parsed = JSON.parse(raw) as InvariantFileSchema;
    } catch {
      // Skip invalid JSON.
      continue;
    }

    const setId = parsed.invariantSetId as InvariantSetId;
    const entries = parsed.invariants ?? [];

    const records: InvariantRecord[] = entries.map((entry) => ({
      id: entry.id,
      invariantSetId: setId,
      description: entry.description,
      priority: entry.priority,
      primitiveIds: entry.primitiveIds,
      scenarioId: entry.scenarioId,
      teachingTag: entry.teachingTag,
      when: buildWhenPredicate(entry),
    }));

    if (!registry[setId]) {
      registry[setId] = [];
    }

    registry[setId] = registry[setId].concat(records);
  }

  REGISTRY_CACHE = registry;
  return REGISTRY_CACHE;
}

export function getInvariantsBySetId(id: InvariantSetId): InvariantRecord[] {
  const registry = loadAllInvariantSetsFromConfig();
  return registry[id] ?? [];
}

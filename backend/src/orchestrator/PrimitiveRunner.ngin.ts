/**
 * PrimitiveRunner.ngin.ts
 *
 * NGIN-specific implementation of PrimitiveRunner with a small abstraction
 * layer for the underlying engine. The actual NGIN Lite wiring can be
 * provided via the dependency object; tests can plug in their own stubs.
 */

import type {
  PrimitiveRunner,
  PrimitiveRunnerRequest,
  PrimitiveRunnerResult,
  PrimitiveRunnerResultError,
  PrimitiveRunnerResultNoStep,
  PrimitiveRunnerResultOk,
  PrimitiveRunnerErrorCode,
} from "./PrimitiveRunner";

/**
 * Low-level abstraction over the NGIN Lite engine used by PrimitiveRunner.
 *
 * In production this should be backed by real NGIN Lite / TSA functions.
 * In tests we provide lightweight stubs to simulate different scenarios.
 */
export interface NginPrimitiveRunnerDeps {
  /**
   * Optional logger; defaults to a no-op.
   */
  log?: (message: string) => void;

  /**
   * Parse LaTeX into an engine-specific AST.
   */
  parseLatexToAst: (latex: string, invariantSetId?: string) => Promise<unknown>;

  /**
   * Apply a list of primitive identifiers to the AST.
   *
   * Implementations are expected to return:
   * - a new AST (which may or may not differ from the input);
   * - the list of actually applied primitive ids;
   * - an optional flag that the expression is already simplified.
   */
  applyPrimitives: (
    ast: unknown,
    primitiveIds: string[],
    context: unknown
  ) => Promise<{
    ast: unknown;
    appliedPrimitiveIds: string[];
    alreadySimplified?: boolean;
  }>;

  /**
   * Convert AST back to LaTeX.
   */
  printAstToLatex: (ast: unknown) => Promise<string>;

  /**
   * Optional structural equality check for ASTs.
   * By default, a strict `===` comparison is used.
   */
  isAstEqual?: (a: unknown, b: unknown) => boolean;
}

/**
 * Pure implementation of PrimitiveRunner given a concrete engine facade.
 *
 * This is the main unit that tests exercise. The exported factory
 * createNginPrimitiveRunner() simply wires it to a default set of deps.
 */
export const createPrimitiveRunnerWithDeps = (
  deps: NginPrimitiveRunnerDeps
): PrimitiveRunner => {
  const {
    log = () => undefined,
    parseLatexToAst,
    applyPrimitives,
    printAstToLatex,
    isAstEqual = (a, b) => a === b,
  } = deps;

  const toConfigError = (message: string): PrimitiveRunnerResultError => ({
    status: "error",
    errorCode: "config-error",
    message,
  });

  const toError = (
    error: unknown,
    defaultCode: PrimitiveRunnerErrorCode
  ): PrimitiveRunnerResultError => {
    const message =
      error instanceof Error ? error.message : "Unknown error in PrimitiveRunner.";

    // A dedicated "ParseError" name is treated specially.
    const errorCode: PrimitiveRunnerErrorCode =
      error instanceof Error && (error as Error).name === "ParseError"
        ? "parse-error"
        : defaultCode;

    log(`[PrimitiveRunner.ngin] ${message}`);

    return {
      status: "error",
      errorCode,
      message,
    };
  };

  return async (request: PrimitiveRunnerRequest): Promise<PrimitiveRunnerResult> => {
    if (request.mode !== "preview") {
      return toConfigError('Only "preview" mode is supported by PrimitiveRunner.');
    }

    const { latex, primitiveIds, invariantSetId, context } = request;

    if (!latex || latex.trim() === "") {
      return toConfigError("latex must be a non-empty string.");
    }

    if (!Array.isArray(primitiveIds) || primitiveIds.length === 0) {
      return toConfigError("primitiveIds must contain at least one identifier.");
    }

    try {
      const astBefore = await parseLatexToAst(latex, invariantSetId);

      const { ast: astAfter, appliedPrimitiveIds, alreadySimplified } =
        await applyPrimitives(astBefore, primitiveIds, context ?? undefined);

      const noPrimitivesApplied =
        !appliedPrimitiveIds || appliedPrimitiveIds.length === 0;

      const astUnchanged = isAstEqual(astBefore, astAfter);

      if (alreadySimplified || (noPrimitivesApplied && astUnchanged)) {
        const reason: "no-primitive-applicable" | "expression-already-simplified" =
          alreadySimplified ? "expression-already-simplified" : "no-primitive-applicable";

        const noStep: PrimitiveRunnerResultNoStep = {
          status: "noStep",
          reason,
          latex,
        };

        return noStep;
      }

      const latexAfter = await printAstToLatex(astAfter);

      if (latexAfter === latex) {
        const noStep: PrimitiveRunnerResultNoStep = {
          status: "noStep",
          reason: "no-primitive-applicable",
          latex,
        };

        return noStep;
      }

      const ok: PrimitiveRunnerResultOk = {
        status: "ok",
        latexBefore: latex,
        latexAfter,
        appliedPrimitiveIds,
        astChanged: true,
        debugInfo: {
          invariantSetId,
          context,
        },
      };

      return ok;
    } catch (error) {
      // By default, treat failures as "engine-error". Parsers may still
      // signal parse errors via error.name === "ParseError".
      return toError(error, "engine-error");
    }
  };
};

/**
 * Default wiring for production: currently a very small placeholder engine
 * that operates directly on LaTeX strings. It is intentionally simple and
 * can be replaced later with real NGIN Lite bindings.
 *
 * Stage 4.1: the wiring is expressed via a dedicated factory
 * `createNginPrimitiveRunnerDeps()`. This makes it easy to swap the
 * implementation for real NGIN Lite bindings in later stages while keeping
 * the PrimitiveRunner contract stable.
 */
export const createNginPrimitiveRunnerDeps = (): NginPrimitiveRunnerDeps => ({
  async parseLatexToAst(latex: string, _invariantSetId?: string): Promise<unknown> {
    // In this placeholder implementation we treat the AST as just the LaTeX string.
    return latex;
  },

  async applyPrimitives(
    ast: unknown,
    primitiveIds: string[],
    _context: unknown
  ): Promise<{
    ast: unknown;
    appliedPrimitiveIds: string[];
    alreadySimplified?: boolean;
  }> {
    const latex = String(ast);

    if (!primitiveIds.length) {
      return { ast, appliedPrimitiveIds: [] };
    }

    const primaryPrimitiveId = primitiveIds[0];

    // Stage 4.2+ — minimal fraction primitives for very simple cases.
    const FRACTION_SIMPLIFY_PRIMITIVE_ID = "P0.FRAC_SIMPLIFY";
    const FRACTION_ADD_PRIMITIVE_ID = "P4.FRAC_ADD_BASIC";

    const gcd = (a: number, b: number): number => {
      let x = Math.abs(a);
      let y = Math.abs(b);
      while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
      }
      return x || 1;
    };

    const trySimplifyFraction = (
      inputLatex: string,
    ): { changed: boolean; outputLatex: string; applicable: boolean } => {
      const match = inputLatex.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
      if (!match) {
        return { changed: false, outputLatex: inputLatex, applicable: false };
      }

      const num = parseInt(match[1], 10);
      const den = parseInt(match[2], 10);
      if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
        return { changed: false, outputLatex: inputLatex, applicable: false };
      }

      const d = gcd(num, den);
      if (d <= 1) {
        // nothing to simplify
        return { changed: false, outputLatex: inputLatex, applicable: true };
      }

      const newNum = num / d;
      const newDen = den / d;

      return {
        changed: true,
        outputLatex: `${newNum}/${newDen}`,
        applicable: true,
      };
    };

    const tryAddFractions = (
      inputLatex: string,
    ): { changed: boolean; outputLatex: string; applicable: boolean } => {
      // a/b (+|-) c/d
      const match = inputLatex.match(
        /^\s*(\d+)\s*\/\s*(\d+)\s*([+-])\s*(\d+)\s*\/\s*(\d+)\s*$/,
      );
      if (!match) {
        return { changed: false, outputLatex: inputLatex, applicable: false };
      }

      const a = Number.parseInt(match[1], 10);
      const b = Number.parseInt(match[2], 10);
      const op = match[3];
      const cRaw = Number.parseInt(match[4], 10);
      const d = Number.parseInt(match[5], 10);

      const sign = op === "-" ? -1 : 1;
      const c = cRaw * sign;

      if (
        !Number.isFinite(a) ||
        !Number.isFinite(b) ||
        !Number.isFinite(c) ||
        !Number.isFinite(d) ||
        b === 0 ||
        d === 0
      ) {
        return { changed: false, outputLatex: inputLatex, applicable: false };
      }

      const num = a * d + c * b;
      const den = b * d;
      const g = gcd(num, den);
      const newNum = num / g;
      const newDen = den / g;

      return {
        changed: true,
        outputLatex: `${newNum}/${newDen}`,
        applicable: true,
      };
    };

if (primaryPrimitiveId === FRACTION_SIMPLIFY_PRIMITIVE_ID) {
      const result = trySimplifyFraction(latex);
      if (result.applicable) {
        if (result.changed) {
          return {
            ast: result.outputLatex,
            appliedPrimitiveIds: [primaryPrimitiveId],
            alreadySimplified: false,
          };
        }

        return {
          ast,
          appliedPrimitiveIds: [],
          alreadySimplified: true,
        };
      }
      // If not applicable, fall through to the generic behaviour below.
    }

    if (primaryPrimitiveId === FRACTION_ADD_PRIMITIVE_ID) {
      const result = tryAddFractions(latex);
      if (result.applicable) {
        if (result.changed) {
          return {
            ast: result.outputLatex,
            appliedPrimitiveIds: [primaryPrimitiveId],
            alreadySimplified: false,
          };
        }

        return {
          ast,
          appliedPrimitiveIds: [],
          alreadySimplified: true,
        };
      }
      // If not applicable, fall through to the generic behaviour below.
    }

    // Generic placeholder behaviour (kept from Stage 4.1):
    // if we see a "+" we pretend that a primitive changed the expression,
    // otherwise we report "already simplified".
    if (latex.includes("+")) {
      const applied = [primitiveIds[0]];
      const nextLatex = `${latex} /* primitive:${applied[0]} */`;
      return {
        ast: nextLatex,
        appliedPrimitiveIds: applied,
        alreadySimplified: false,
      };
    }

    return { ast, appliedPrimitiveIds: [], alreadySimplified: true };
  },

  async printAstToLatex(ast: unknown): Promise<string> {
    return String(ast);
  },
});
export const createNginPrimitiveRunner = (): PrimitiveRunner => {
  const deps = createNginPrimitiveRunnerDeps();
  return createPrimitiveRunnerWithDeps(deps);
};


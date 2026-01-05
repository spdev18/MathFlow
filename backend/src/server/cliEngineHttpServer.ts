/**
 * cliEngineHttpServer.ts
 *
 * CLI entry point for the Backend API v1 HTTP server.
 */

import { createEngineHttpServer } from "./engineHttpServer.js";
import type { HandlerDeps } from "./HandlerPostEntryStep.js";

import { loadAllCoursesFromDir } from "../invariants/index.js";
import { createDefaultStudentPolicy } from "../stepmaster/index.js";
import { createPrimitiveMaster } from "../primitive-master/PrimitiveMaster.js";
import { createPrimitivePatternRegistry } from "../primitive-master/PrimitivePatterns.registry.js";
import { parseExpression } from "../mapmaster/ast.js";

function getPortFromEnv(): number {
  const raw =
    process.env.ENGINE_HTTP_PORT ?? process.env.PORT ?? "4201";

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 4201;
  }

  return parsed;
}

function makeHandlerDeps(): HandlerDeps {
  const log = (message: string): void => {
    // eslint-disable-next-line no-console
    console.log(message);
  };

  // 1. Load Invariants
  // We scan the config/courses directory for all JSON files.
  const fileRegistry = loadAllCoursesFromDir({
    path: "config/courses",
  });

  // 1b. Merge Stage 1 Invariants (Code-based)
  // This ensures that the orchestrator has access to Stage 1 rules (with correct IDs)
  // even if they are not fully defined in the JSON files yet.
  const stage1Model = getStage1RegistryModel();
  const fileModel = {
    primitives: fileRegistry.getAllPrimitives(),
    invariantSets: fileRegistry.getAllInvariantSets()
  };

  // Merge primitives (deduplicate by ID)
  const mergedPrimitives = [...fileModel.primitives];
  const seenPrimIds = new Set(fileModel.primitives.map(p => p.id));
  for (const prim of stage1Model.primitives) {
    if (!seenPrimIds.has(prim.id)) {
      mergedPrimitives.push(prim);
      seenPrimIds.add(prim.id);
    }
  }

  // Merge sets
  const mergedSets = [...fileModel.invariantSets];

  // Find "default" set and append Stage 1 rules to it
  const defaultSetIndex = mergedSets.findIndex(s => s.id === "default");
  if (defaultSetIndex >= 0) {
    const defaultSet = mergedSets[defaultSetIndex];
    // We need to add Stage 1 rules to the default set so they are active by default
    // (since frontend sends courseId: "default")

    // Get all Stage 1 rules from all Stage 1 sets
    const allStage1Rules = stage1Model.invariantSets.flatMap(s => s.rules);

    // Append unique rules to default set
    const seenRuleIds = new Set(defaultSet.rules.map(r => r.id));
    for (const rule of allStage1Rules) {
      if (!seenRuleIds.has(rule.id)) {
        defaultSet.rules.push(rule);
        seenRuleIds.add(rule.id);
      }
    }
  }

  // Also add the standalone Stage 1 sets (optional, but good for debugging)
  for (const set of stage1Model.invariantSets) {
    if (!mergedSets.find(s => s.id === set.id)) {
      mergedSets.push(set);
    }
  }

  const finalRegistry = new InMemoryInvariantRegistry({
    model: {
      primitives: mergedPrimitives,
      invariantSets: mergedSets
    }
  });

  // 2. Create Policy
  const policy = createDefaultStudentPolicy();

  // 3. Create PrimitiveMaster
  const patternRegistry = createPrimitivePatternRegistry();
  const primitiveMaster = createPrimitiveMaster({
    parseLatexToAst: async (latex) => parseExpression(latex),
    patternRegistry,
    log: (msg) => log(`[PrimitiveMaster] ${msg}`),
  });

  const deps: HandlerDeps = {
    invariantRegistry: finalRegistry,
    policy,
    log,
    logger,
    primitiveMaster,
  };

  return deps;
}

import { getStage1RegistryModel } from "../mapmaster/stage1-converter.js";
import { InMemoryInvariantRegistry } from "../invariants/invariants.registry.js";

import { logger } from "../logger.js";
import { authService } from "../auth/auth.service.js";
import { SessionService } from "../session/session.service.js";

export async function main(): Promise<void> {
  const port = getPortFromEnv();

  try {
    // Initialize Persistency Services
    await authService.init();
    await SessionService.init();

    const handlerDeps = makeHandlerDeps();

    const server = createEngineHttpServer({
      port,
      handlerDeps,
      logger,
    });

    await server.start();
  } catch (error) {
    logger.error({ err: error }, "Failed to start server");
    process.exit(1);
  }
}

// Execute immediately when run via `node --import tsx` or `pnpm tsx`.
// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
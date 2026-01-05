import { readFileSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

import { validateInvariantModel } from "./invariants.model";
import { InMemoryInvariantRegistry } from "./invariants.registry";

export interface CourseLoaderConfig {
  /**
   * Path to the course file with invariants and primitives.
   *
   * May be:
   *  - an absolute filesystem path; or
   *  - a path relative to the backend project root (the folder that contains `config/`).
   */
  path: string;
}

/**
 * Load an invariant model from JSON file and construct an in‑memory registry.
 *
 * This function is intentionally synchronous and fail‑fast:
 *  - it throws if the file cannot be read;
 *  - it throws if JSON cannot be parsed;
 *  - it throws if the model is invalid according to validateInvariantModel(...).
 */
export function loadInvariantRegistryFromFile(
  config: CourseLoaderConfig,
): InMemoryInvariantRegistry {
  const requestedPath = config.path;

  // Compute project root from the location of this module.
  // The compiled file lives in `dist/invariants`, the source in `src/invariants`,
  // so two `..` segments bring us to the project root in both cases.
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(moduleDir, "..", "..");

  const absolutePath = requestedPath.startsWith("file:")
    ? fileURLToPath(new URL(requestedPath))
    : isAbsolute(requestedPath)
      ? requestedPath
      : resolve(projectRoot, requestedPath);

  let raw: string;
  try {
    raw = readFileSync(absolutePath, "utf8");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to read invariant course file at "${absolutePath}": ${message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to parse invariant course file at "${absolutePath}" as JSON: ${message}`,
    );
  }

  const validation = validateInvariantModel(parsed);
  if (!validation.ok || !validation.model) {
    const details =
      validation.issues.length === 0
        ? "unknown validation error"
        : validation.issues
            .map(
              (issue) =>
                `${issue.code} at ${issue.path}: ${issue.message}`,
            )
            .join("; ");

    throw new Error(
      `Invariant course model in "${absolutePath}" is invalid: ${details}`,
    );
  }

  return new InMemoryInvariantRegistry({ model: validation.model });
}

/**
 * Invariants model — course primitives and invariant rules.
 *
 * This module is intentionally self‑contained for Stage 1:
 * it does not depend on MapMaster / StepMaster runtime,
 * only on simple string identifiers.
 */

import type { PrimitiveId } from "../engine/primitives.registry";
export type { PrimitiveId };

/** Identifier of an invariant rule. */
export type InvariantRuleId = string;

/** Identifier of an invariant set (course pack). */
export type InvariantSetId = string;

/**
 * Difficulty / progression level of an invariant rule.
 *
 * The concrete strings are part of the public contract so that
 * teacher tools and analytics can rely on them.
 */
export type InvariantRuleLevel = 'intro' | 'core' | 'advanced' | 'challenge';

/** Definition of a primitive operation used by the course. */
export interface PrimitiveDefinition {
  /** Stable identifier, referenced from invariant rules. */
  id: PrimitiveId;

  /** Short human‑readable name, e.g. "Multiply by 1 in disguise". */
  name: string;

  /** One‑sentence description for teacher tools / debugging. */
  description: string;

  /** Logical category, e.g. "fractions", "integers", "arithmetics". */
  category?: string;

  /** Free‑form tag list for filtering / search in tools. */
  tags?: string[];

  /** Algebraic pattern, e.g. "a + b" or "a/c + b/c". */
  pattern?: string;

  /** Result pattern, e.g. "calc(a+b)" or "(a+b)/c". */
  resultPattern?: string;
}

/**
 * Definition of a single invariant rule.
 *
 * Rules are the primary teaching unit: each rule describes when
 * a primitive is applicable and how we interpret that step.
 */
export interface InvariantRuleDefinition {
  /** Stable identifier, referenced from MapMaster and analytics. */
  id: InvariantRuleId;

  /** Short human‑readable title, e.g. "Common denominator by multiplying by 1". */
  title: string;

  /** Student‑facing one‑line label. */
  shortStudentLabel: string;

  /** Optional teacher‑facing label or note. */
  teacherLabel?: string;

  /** Longer description for documentation / teacher UI. */
  description: string;

  /** Coarse difficulty / progression level. */
  level: InvariantRuleLevel;

  /** Free‑form tag list, e.g. ["fractions", "add", "common‑denominator"]. */
  tags: string[];

  /**
   * IDs of primitives that this rule may trigger.
   *
   * This is a soft link used by analytics and tooling;
   * the math engine stays separate.
   */
  primitiveIds: PrimitiveId[];

  /**
   * Optional scenario identifier tying this rule to a teaching scenario.
   *
   * Used only by higher‑level orchestration and analytics.
   */
  scenarioId?: string;

  /**
   * Optional teaching tag (taxonomy / curriculum label), e.g.
   * "fractions.simplify.step1".
   */
  teachingTag?: string;
}

/**
 * A set groups rules into a course pack — the unit we swap in/out
 * for different curricula. Each set represents a cohesive collection
 * of teaching rules.
 */
export interface InvariantSetDefinition {
  /** Stable identifier used by requests (e.g. MapMasterRequest.expression.invariantSetId). */
  id: InvariantSetId;

  /** Human‑readable name, e.g. "Fractions – beginner". */
  name: string;

  /** Short description for teacher tools. */
  description: string;

  /** Semantic version string, e.g. "1.0.0" or "2025.03". */
  version: string;

  /** Ordered list of rules included in this set. */
  rules: InvariantRuleDefinition[];
}

/**
 * Complete model definition containing all primitives and invariant sets.
 * This is the root structure that defines a curriculum.
 */
export interface InvariantModelDefinition {
  /** All known primitives. */
  primitives: PrimitiveDefinition[];

  /** All available invariant sets. */
  invariantSets: InvariantSetDefinition[];
}

/**
 * A single validation issue found in the model.
 */
export interface InvariantModelIssue {
  /** Machine‑readable code, e.g. "DUPLICATE_PRIMITIVE_ID". */
  code: string;

  /** JSON‑pointer‑like or dot path to the offending field, e.g. "$.primitives[0].id". */
  path: string;

  /** Human‑readable message for logs / teacher tools. */
  message: string;
}

/**
 * Result of validating an invariant model.
 * Contains validation status, issues found, and normalized model if valid.
 */
export interface InvariantModelValidationResult {
  /** True when the model is structurally valid (no issues). */
  ok: boolean;

  /**
   * List of issues. Empty when ok === true.
   * If ok === true, issues MUST be [] (not null / undefined).
   */
  issues: InvariantModelIssue[];

  /**
   * Normalized copy of the model.
   * Present only when ok === true.
   * Arrays and objects are shallow‑copied to prevent mutation.
   */
  model?: InvariantModelDefinition;
}

/** Valid invariant rule levels, exposed for utilities and tests. */
export const VALID_LEVELS: readonly InvariantRuleLevel[] = [
  'intro',
  'core',
  'advanced',
  'challenge',
] as const;

/**
 * Validate the complete invariant model for structural integrity.
 *
 * Performs:
 *  - Shape validation (correct object structure)
 *  - Field validation (non‑empty strings, correct types)
 *  - Duplicate detection (IDs must be unique)
 *  - Referential integrity (primitive IDs must exist)
 *
 * If validation passes, returns a normalized copy of the model with
 * all arrays and objects shallow‑copied to prevent mutation.
 */
export function validateInvariantModel(input: unknown): InvariantModelValidationResult {
  const issues: InvariantModelIssue[] = [];

  // 1. Shape validation
  if (!input || typeof input !== 'object') {
    issues.push({
      code: 'INVALID_SHAPE',
      path: '$',
      message: 'Model must be an object',
    });
    return { ok: false, issues };
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray((obj as any).primitives)) {
    issues.push({
      code: 'INVALID_SHAPE',
      path: '$.primitives',
      message: 'Model.primitives must be an array',
    });
  }

  if (!Array.isArray((obj as any).invariantSets)) {
    issues.push({
      code: 'INVALID_SHAPE',
      path: '$.invariantSets',
      message: 'Model.invariantSets must be an array',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const primitivesRaw = (obj as any).primitives as unknown[];
  const invariantSetsRaw = (obj as any).invariantSets as unknown[];

  // 2. Validate primitives
  const primitiveIds = new Set<PrimitiveId>();

  for (let i = 0; i < primitivesRaw.length; i++) {
    const prim = primitivesRaw[i];
    const path = `$.primitives[${i}]`;

    if (!prim || typeof prim !== 'object') {
      issues.push({
        code: 'INVALID_PRIMITIVE',
        path,
        message: 'Primitive must be an object',
      });
      continue;
    }

    const p = prim as Record<string, unknown>;

    // Required string fields
    if (typeof p.id !== 'string' || p.id === '') {
      issues.push({
        code: 'INVALID_PRIMITIVE_FIELD',
        path: `${path}.id`,
        message: 'Primitive id must be a non‑empty string',
      });
    }

    if (typeof p.name !== 'string' || p.name === '') {
      issues.push({
        code: 'INVALID_PRIMITIVE_FIELD',
        path: `${path}.name`,
        message: 'Primitive name must be a non‑empty string',
      });
    }

    if (typeof p.description !== 'string' || p.description === '') {
      issues.push({
        code: 'INVALID_PRIMITIVE_FIELD',
        path: `${path}.description`,
        message: 'Primitive description must be a non‑empty string',
      });
    }

    if (p.category !== undefined && (typeof p.category !== 'string' || p.category === '')) {
      issues.push({
        code: 'INVALID_PRIMITIVE_FIELD',
        path: `${path}.category`,
        message: 'Primitive category must be a non‑empty string if present',
      });
    }

    if (p.tags !== undefined) {
      if (!Array.isArray(p.tags)) {
        issues.push({
          code: 'INVALID_PRIMITIVE_FIELD',
          path: `${path}.tags`,
          message: 'Primitive tags must be an array',
        });
      } else if (!p.tags.every((t) => typeof t === 'string')) {
        issues.push({
          code: 'INVALID_PRIMITIVE_FIELD',
          path: `${path}.tags`,
          message: 'Primitive tags must be an array of strings',
        });
      }
    }

    if (p.pattern !== undefined && (typeof p.pattern !== 'string' || p.pattern === '')) {
      issues.push({
        code: 'INVALID_PRIMITIVE_FIELD',
        path: `${path}.pattern`,
        message: 'Primitive pattern must be a non‑empty string if present',
      });
    }

    if (p.resultPattern !== undefined && (typeof p.resultPattern !== 'string' || p.resultPattern === '')) {
      issues.push({
        code: 'INVALID_PRIMITIVE_FIELD',
        path: `${path}.resultPattern`,
        message: 'Primitive resultPattern must be a non‑empty string if present',
      });
    }

    // Duplicate IDs
    if (typeof p.id === 'string' && p.id !== '') {
      const id = p.id as PrimitiveId;
      if (primitiveIds.has(id)) {
        issues.push({
          code: 'DUPLICATE_PRIMITIVE_ID',
          path: `${path}.id`,
          message: `Duplicate primitive ID: ${id}`,
        });
      } else {
        primitiveIds.add(id);
      }
    }
  }

  // 3. Validate invariant sets and rules
  const setIds = new Set<InvariantSetId>();

  for (let i = 0; i < invariantSetsRaw.length; i++) {
    const set = invariantSetsRaw[i];
    const path = `$.invariantSets[${i}]`;

    if (!set || typeof set !== 'object') {
      issues.push({
        code: 'INVALID_SET',
        path,
        message: 'Set must be an object',
      });
      continue;
    }

    const s = set as Record<string, unknown>;

    if (typeof s.id !== 'string' || s.id === '') {
      issues.push({
        code: 'INVALID_SET_FIELD',
        path: `${path}.id`,
        message: 'Set id must be a non‑empty string',
      });
    }

    if (typeof s.name !== 'string' || s.name === '') {
      issues.push({
        code: 'INVALID_SET_FIELD',
        path: `${path}.name`,
        message: 'Set name must be a non‑empty string',
      });
    }

    if (typeof s.description !== 'string' || s.description === '') {
      issues.push({
        code: 'INVALID_SET_FIELD',
        path: `${path}.description`,
        message: 'Set description must be a non‑empty string',
      });
    }

    if (typeof s.version !== 'string' || s.version === '') {
      issues.push({
        code: 'INVALID_SET_FIELD',
        path: `${path}.version`,
        message: 'Set version must be a non‑empty string',
      });
    }

    if (!Array.isArray(s.rules)) {
      issues.push({
        code: 'INVALID_SET_FIELD',
        path: `${path}.rules`,
        message: 'Set rules must be an array',
      });
      continue;
    }

    // Duplicate set IDs
    if (typeof s.id === 'string' && s.id !== '') {
      const id = s.id as InvariantSetId;
      if (setIds.has(id)) {
        issues.push({
          code: 'DUPLICATE_SET_ID',
          path: `${path}.id`,
          message: `Duplicate set ID: ${id}`,
        });
      } else {
        setIds.add(id);
      }
    }

    const rules = s.rules as unknown[];
    const ruleIds = new Set<InvariantRuleId>();

    for (let j = 0; j < rules.length; j++) {
      const rule = rules[j];
      const rulePath = `${path}.rules[${j}]`;

      if (!rule || typeof rule !== 'object') {
        issues.push({
          code: 'INVALID_RULE',
          path: rulePath,
          message: 'Rule must be an object',
        });
        continue;
      }

      const r = rule as Record<string, unknown>;

      // Required rule fields
      if (typeof r.id !== 'string' || r.id === '') {
        issues.push({
          code: 'INVALID_RULE_FIELD',
          path: `${rulePath}.id`,
          message: 'Rule id must be a non‑empty string',
        });
      }

      if (typeof r.title !== 'string' || r.title === '') {
        issues.push({
          code: 'INVALID_RULE_FIELD',
          path: `${rulePath}.title`,
          message: 'Rule title must be a non‑empty string',
        });
      }

      if (typeof r.shortStudentLabel !== 'string' || r.shortStudentLabel === '') {
        issues.push({
          code: 'INVALID_RULE_FIELD',
          path: `${rulePath}.shortStudentLabel`,
          message: 'Rule shortStudentLabel must be a non‑empty string',
        });
      }

      if (typeof r.description !== 'string' || r.description === '') {
        issues.push({
          code: 'INVALID_RULE_FIELD',
          path: `${rulePath}.description`,
          message: 'Rule description must be a non‑empty string',
        });
      }

      if (typeof r.level !== 'string' || !VALID_LEVELS.includes(r.level as InvariantRuleLevel)) {
        issues.push({
          code: 'INVALID_RULE_LEVEL',
          path: `${rulePath}.level`,
          message: `Rule level must be one of: ${VALID_LEVELS.join(', ')}`,
        });
      }

      if (r.teacherLabel != null && typeof r.teacherLabel !== 'string') {
        issues.push({
          code: 'INVALID_RULE_FIELD',
          path: `${rulePath}.teacherLabel`,
          message: 'Rule teacherLabel must be a string when present',
        });
      }

      if (!Array.isArray(r.tags)) {
        issues.push({
          code: 'INVALID_RULE_FIELD',
          path: `${rulePath}.tags`,
          message: 'Rule tags must be an array',
        });
      } else if (!r.tags.every((t) => typeof t === 'string')) {
        issues.push({
          code: 'INVALID_RULE_FIELD',
          path: `${rulePath}.tags`,
          message: 'Rule tags must be an array of strings',
        });
      }

      if (!Array.isArray(r.primitiveIds)) {
        issues.push({
          code: 'INVALID_RULE_FIELD',
          path: `${rulePath}.primitiveIds`,
          message: 'Rule primitiveIds must be an array',
        });
      }

      if (r.scenarioId != null && typeof r.scenarioId !== 'string') {
        issues.push({
          code: 'INVALID_RULE_FIELD',
          path: `${rulePath}.scenarioId`,
          message: 'Rule scenarioId must be a string when present',
        });
      }

      if (r.teachingTag != null && typeof r.teachingTag !== 'string') {
        issues.push({
          code: 'INVALID_RULE_FIELD',
          path: `${rulePath}.teachingTag`,
          message: 'Rule teachingTag must be a string when present',
        });
      }

      // 4. Referential integrity: primitiveIds must exist
      if (Array.isArray(r.primitiveIds)) {
        for (let k = 0; k < r.primitiveIds.length; k++) {
          const primId = r.primitiveIds[k];
          if (typeof primId === 'string' && !primitiveIds.has(primId as PrimitiveId)) {
            issues.push({
              code: 'UNKNOWN_PRIMITIVE_ID',
              path: `${rulePath}.primitiveIds[${k}]`,
              message: `Unknown primitive ID: ${primId}`,
            });
          }
        }
      }

      // Duplicate rule IDs within set
      if (typeof r.id === 'string' && r.id !== '') {
        const id = r.id as InvariantRuleId;
        if (ruleIds.has(id)) {
          issues.push({
            code: 'DUPLICATE_RULE_ID_IN_SET',
            path: `${rulePath}.id`,
            message: `Duplicate rule ID in set: ${id}`,
          });
        } else {
          ruleIds.add(id);
        }
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  // 4. Normalized copy.
  // At this point we trust shapes and types, so we can safely cast.
  const normalizedPrimitives: PrimitiveDefinition[] = primitivesRaw.map((prim) => {
    const p = prim as any;
    return {
      id: p.id as PrimitiveId,
      name: p.name as string,
      description: p.description as string,
      category: p.category as string,
      tags: (p.tags as string[]).slice(),
      pattern: typeof p.pattern === 'string' ? p.pattern : undefined,
      resultPattern: typeof p.resultPattern === 'string' ? p.resultPattern : undefined,
    };
  });

  const normalizedSets: InvariantSetDefinition[] = invariantSetsRaw.map((set) => {
    const s = set as any;
    const rules: InvariantRuleDefinition[] = (s.rules as any[]).map((rule) => {
      const r = rule as any;
      return {
        id: r.id as InvariantRuleId,
        title: r.title as string,
        shortStudentLabel: r.shortStudentLabel as string,
        teacherLabel: typeof r.teacherLabel === 'string' ? (r.teacherLabel as string) : undefined,
        description: r.description as string,
        level: r.level as InvariantRuleLevel,
        tags: (r.tags as string[]).slice(),
        primitiveIds: (r.primitiveIds as string[]).slice() as PrimitiveId[],
        scenarioId: typeof r.scenarioId === 'string' ? (r.scenarioId as string) : undefined,
        teachingTag: typeof r.teachingTag === 'string' ? (r.teachingTag as string) : undefined,
      };
    });

    return {
      id: s.id as InvariantSetId,
      name: s.name as string,
      description: s.description as string,
      version: s.version as string,
      rules,
    };
  });

  return {
    ok: true,
    issues: [],
    model: {
      primitives: normalizedPrimitives,
      invariantSets: normalizedSets,
    },
  };
}

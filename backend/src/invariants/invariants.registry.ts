import type {
  PrimitiveId,
  PrimitiveDefinition,
  InvariantRuleId,
  InvariantRuleDefinition,
  InvariantSetId,
  InvariantSetDefinition,
  InvariantModelDefinition,
} from "./invariants.model";

/**
 * Configuration object for constructing the in‑memory invariant registry.
 *
 * The registry assumes that the provided model has already been validated
 * with validateInvariantModel(...).
 */
export interface InvariantRegistryConfig {
  model: InvariantModelDefinition;
}

/**
 * In‑memory registry for primitives and invariant rules.
 *
 * Responsibilities:
 *  - store a canonical copy of the validated model;
 *  - provide fast lookups by primitive id, rule id, and set id;
 *  - expose defensive copies so callers cannot mutate internal state.
 */
export class InMemoryInvariantRegistry {
  /** Canonical primitives array (never exposed directly). */
  private readonly primitives: PrimitiveDefinition[];

  /** Canonical invariant sets array (never exposed directly). */
  private readonly invariantSets: InvariantSetDefinition[];

  /** Map from primitive id to primitive definition. */
  private readonly primitiveMap: Map<PrimitiveId, PrimitiveDefinition>;

  /** Map from set id to invariant set definition. */
  private readonly setMap: Map<InvariantSetId, InvariantSetDefinition>;

  /**
   * Map from composite key `${setId}::${ruleId}` to rule definition.
   * Only used internally for fast findRule lookups.
   */
  private readonly ruleMap: Map<string, InvariantRuleDefinition>;

  /**
   * Reverse index: for each primitive id, list of rules that reference it.
   * Used by MapMaster / analytics to quickly fetch candidate rules.
   */
  private readonly primitiveToRulesMap: Map<PrimitiveId, InvariantRuleDefinition[]>;

  constructor(config: InvariantRegistryConfig) {
    const { model } = config;

    // Store canonical copies of primitives and sets.
    this.primitives = model.primitives.map(clonePrimitiveShallow);
    this.invariantSets = model.invariantSets.map(cloneSetDeep);

    // Build lookup maps.
    this.primitiveMap = new Map();
    for (const prim of this.primitives) {
      this.primitiveMap.set(prim.id, prim);
    }

    this.setMap = new Map();
    this.ruleMap = new Map();
    this.primitiveToRulesMap = new Map();

    for (const set of this.invariantSets) {
      this.setMap.set(set.id, set);

      for (const rule of set.rules) {
        const compositeKey = makeRuleKey(set.id, rule.id);
        this.ruleMap.set(compositeKey, rule);

        for (const primitiveId of rule.primitiveIds) {
          let bucket = this.primitiveToRulesMap.get(primitiveId);
          if (!bucket) {
            bucket = [];
            this.primitiveToRulesMap.set(primitiveId, bucket);
          }
          bucket.push(rule);
        }
      }
    }
  }

  /**
   * Return all primitives as defensive copies.
   */
  getAllPrimitives(): PrimitiveDefinition[] {
    return this.primitives.map(clonePrimitiveShallow);
  }

  /**
   * Lookup primitive by id.
   * Returns a defensive copy or undefined if not found.
   */
  getPrimitiveById(id: PrimitiveId): PrimitiveDefinition | undefined {
    const found = this.primitiveMap.get(id);
    return found ? clonePrimitiveShallow(found) : undefined;
  }

  /**
   * Return all invariant sets as defensive copies.
   */
  getAllInvariantSets(): InvariantSetDefinition[] {
    return this.invariantSets.map(cloneSetDeep);
  }

  /**
   * Lookup invariant set by id.
   * Returns a defensive copy or undefined if not found.
   */
  getInvariantSetById(id: InvariantSetId): InvariantSetDefinition | undefined {
    const found = this.setMap.get(id);
    return found ? cloneSetDeep(found) : undefined;
  }

  /**
   * Find a single rule by set id and rule id.
   * Returns a defensive copy or undefined if not found.
   */
  findRule(setId: InvariantSetId, ruleId: InvariantRuleId): InvariantRuleDefinition | undefined {
    const key = makeRuleKey(setId, ruleId);
    const found = this.ruleMap.get(key);
    return found ? cloneRuleShallow(found) : undefined;
  }

  /**
   * Find all rules that reference the given primitive id.
   * Returns an empty array when no rules are found.
   */
  findRulesByPrimitiveId(primitiveId: PrimitiveId): InvariantRuleDefinition[] {
    const rules = this.primitiveToRulesMap.get(primitiveId);
    if (!rules || rules.length === 0) {
      return [];
    }
    return rules.map(cloneRuleShallow);
  }
}

/**
 * Internal helper: build composite rule key.
 */
function makeRuleKey(setId: InvariantSetId, ruleId: InvariantRuleId): string {
  return `${setId}::${ruleId}`;
}

/**
 * Shallow clone helpers.
 * We intentionally copy arrays / objects that may be mutated by callers.
 */

function clonePrimitiveShallow(source: PrimitiveDefinition): PrimitiveDefinition {
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    category: source.category,
    tags: source.tags ? source.tags.slice() : [],
    pattern: source.pattern,
    resultPattern: source.resultPattern,
  };
}

function cloneRuleShallow(source: InvariantRuleDefinition): InvariantRuleDefinition {
  return {
    id: source.id,
    title: source.title,
    shortStudentLabel: source.shortStudentLabel,
    teacherLabel: source.teacherLabel,
    description: source.description,
    level: source.level,
    tags: source.tags.slice(),
    primitiveIds: source.primitiveIds.slice(),
    scenarioId: source.scenarioId,
    teachingTag: source.teachingTag,
  };
}

function cloneSetDeep(source: InvariantSetDefinition): InvariantSetDefinition {
  return {
    id: source.id,
    name: source.name,
    description: source.description,
    version: source.version,
    rules: source.rules.map(cloneRuleShallow),
  };
}

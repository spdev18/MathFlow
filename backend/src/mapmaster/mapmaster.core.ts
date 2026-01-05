/**
 * MapMaster Core (TzV1.1)
 *
 * Responsibilities:
 *  - For a given current state (expression + selection + active invariant sets) and registry:
 *    - determine which invariant rules are applicable;
 *    - generate a list of step candidates.
 */

import type {
    InMemoryInvariantRegistry,
    InvariantRuleId,
    InvariantSetId,
} from "../invariants/index";
import type { PrimitiveId } from "../engine/primitives.registry";
import { parseExpression } from "./ast";
import { MapMasterAstHelpers } from "./mapmaster.ast-helpers";
import { MapMasterSelectionNormalizer } from "./mapmaster.selection.normalizer";
import { DefaultInvariantRegistryAdapter } from "./mapmaster.invariants.registry-adapter";
import { DefaultMapMasterRuleProvider } from "./mapmaster.rule-provider";
import { STAGE1_INVARIANT_SETS } from "./mapmaster.invariants.registry";

export interface MapMasterInput {
    expressionLatex: string;
    selectionPath: string | null;      // path to selected node in Surface/AST
    operatorIndex?: number;            // optional: linear index of operator
    invariantSetIds: InvariantSetId[]; // active invariant sets (for v1.1: one default set)
    registry: InMemoryInvariantRegistry;
}

export type MapMasterCandidateId = string & { __brand: "MapMasterCandidateId" };

export interface MapMasterCandidate {
    id: MapMasterCandidateId;
    invariantRuleId: InvariantRuleId;
    primitiveIds: PrimitiveId[];
    targetPath: string;                // where to apply the step
    description: string;               // debug/teacher description
    bindings?: Record<string, any>;    // Variable bindings from pattern match
    resultPattern?: string;            // Result pattern for generic execution
    category?: 'direct' | 'support';   // Candidate type: direct rule or support step
}

export interface MapMasterResult {
    candidates: MapMasterCandidate[];
    resolvedSelectionPath?: string;
}

/**
 * Generate step candidates based on the input.
 *
 * Uses the modular MapMaster pipeline:
 * 1. Parse AST
 * 2. Normalize Selection
 * 3. Resolve Semantic Window
 * 4. Query Invariants
 * 5. Generate Candidates via Rules
 */
export function mapMasterGenerate(input: MapMasterInput): MapMasterResult {
    const { expressionLatex, registry } = input;

    // 1. Parse expression using robust AST parser
    const ast = parseExpression(expressionLatex);
    if (!ast) {
        return { candidates: [] };
    }

    // 2. Setup Pipeline Components
    const astHelpers = new MapMasterAstHelpers();
    const selectionNormalizer = new MapMasterSelectionNormalizer(astHelpers);

    // Adapter needs the registry from input
    const invariantRegistryAdapter = new DefaultInvariantRegistryAdapter(registry, astHelpers);

    // Rule Provider orchestrates the flow
    const ruleProvider = new DefaultMapMasterRuleProvider(
        selectionNormalizer,
        astHelpers,
        invariantRegistryAdapter,
        {
            debug: (msg) => console.log(`[MapMaster] ${msg}`),
            warn: (msg) => console.warn(`[MapMaster] ${msg}`)
        }
    );

    // 3. Execute Pipeline
    // We explicitly normalize here to get the resolved path for the result.
    const normalized = selectionNormalizer.normalizeSelection(input, ast);
    const resolvedSelectionPath = normalized ? normalized.anchorPath.join('.') : undefined;

    const candidates = ruleProvider.buildCandidates(input, ast);

    // 4. Return Result
    return { candidates, resolvedSelectionPath };
}

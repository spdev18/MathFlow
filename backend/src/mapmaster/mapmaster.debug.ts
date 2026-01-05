import { parseExpression } from "./ast";
import { MapMasterAstHelpers } from "./mapmaster.ast-helpers";
import { MapMasterSelectionNormalizer } from "./mapmaster.selection.normalizer";
import { DefaultInvariantRegistryAdapter } from "./mapmaster.invariants.registry-adapter";
import { DefaultMapMasterRuleProvider } from "./mapmaster.rule-provider";
import type { MapMasterInput } from "./mapmaster.core";
import type { MapMasterDebugResult, MapMasterDebugPipeline } from "./mapmaster.debug.types";

/**
 * Run MapMaster in debug mode to capture the full pipeline state.
 */
export function mapMasterDebug(input: MapMasterInput): MapMasterDebugResult {
    const { expressionLatex, registry } = input;

    // 1. Parse AST
    const ast = parseExpression(expressionLatex);
    if (!ast) {
        throw new Error("Failed to parse LaTeX");
    }

    // 2. Setup Pipeline Components
    const astHelpers = new MapMasterAstHelpers();
    const selectionNormalizer = new MapMasterSelectionNormalizer(astHelpers);
    const invariantRegistryAdapter = new DefaultInvariantRegistryAdapter(registry, astHelpers);
    const ruleProvider = new DefaultMapMasterRuleProvider(
        selectionNormalizer,
        astHelpers,
        invariantRegistryAdapter,
        {
            debug: (msg) => console.log(`[MapMasterDebug] ${msg}`),
            warn: (msg) => console.warn(`[MapMasterDebug] ${msg}`)
        }
    );

    // Initialize Pipeline Trace
    const pipeline: MapMasterDebugPipeline = {
        selection: { status: "invalid" },
        window: { status: "no-window" },
        invariants: { status: "none" },
        rules: { status: "no-rules-fired", candidateCount: 0 }
    };

    // Step 1: Normalize Selection
    const normalized = selectionNormalizer.normalizeSelection(input, ast);
    if (normalized) {
        pipeline.selection = {
            status: "ok",
            anchorNodeId: normalized.anchorPath.join('.'),
            anchorKind: normalized.anchorKind,
            trace: normalized.trace
        };

        // Step 2: Resolve Semantic Window (Manual simulation to capture state)
        // Note: RuleProvider does this internally, but doesn't expose it.
        // To get the window info, we need to peek or duplicate logic.
        // Since this is a debug tool, duplicating the window resolution logic (or extracting it) is acceptable.
        // Ideally, we'd refactor RuleProvider to expose this, but for now let's use the public `buildCandidates`
        // and infer some things, OR duplicate the logic here for full transparency.
        // Let's duplicate the logic from DefaultMapMasterRuleProvider.resolveSemanticWindow for accuracy.

        // ... Logic duplicated from RuleProvider ...
        let windowRootPath = normalized.anchorPath;
        let windowRootNode = astHelpers.getNodeByPath(ast, normalized.anchorPath);

        if (windowRootNode) {
            if (normalized.anchorKind !== 'Operator') {
                const parentPath = astHelpers.getParentPath(normalized.anchorPath);
                if (parentPath && parentPath.length > 0) {
                    const parentNode = astHelpers.getNodeByPath(ast, parentPath);
                    if (parentNode && parentNode.type === 'binaryOp') {
                        windowRootPath = parentPath;
                        windowRootNode = parentNode;
                    }
                }
            }

            pipeline.window = {
                status: "ok",
                domain: "Unknown", // We'll find this from invariants
                operation: windowRootNode.type === 'binaryOp' ? (windowRootNode as any).op : undefined,
                nodeIds: [windowRootPath.join('.')]
            };

            // Step 3: Query Invariants
            const invariantRules = invariantRegistryAdapter.getInvariantRulesForRequest(
                input,
                windowRootPath,
                windowRootNode
            );

            if (invariantRules.length > 0) {
                pipeline.invariants = {
                    status: "found",
                    ids: invariantRules.map(r => r.id)
                };

                // Infer domain from the first rule (heuristic)
                if (invariantRules[0].domain) {
                    pipeline.window.domain = invariantRules[0].domain;
                }
            }
        }
    } else {
        pipeline.selection.status = "no-anchor";
    }

    // Step 4: Generate Candidates (using the real provider)
    const candidates = ruleProvider.buildCandidates(input, ast);

    pipeline.rules = {
        status: candidates.length > 0 ? "candidates-produced" : "no-rules-fired",
        candidateCount: candidates.length,
        checkedInvariantIds: pipeline.invariants.ids, // We checked these
        reasonIfNone: candidates.length === 0 ? "No rules matched or produced candidates" : undefined
    };

    return {
        input,
        astSnapshot: ast,
        pipeline,
        candidates
    };
}

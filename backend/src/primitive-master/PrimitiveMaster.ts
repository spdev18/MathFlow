/**
 * PrimitiveMaster (V5)
 *
 * Coordinator for the V5 Decision Layer.
 *
 * Responsibilities:
 *  - Receive click/context from Orchestrator.
 *  - Delegate to NodeContextBuilder -> PrimitiveMatcher -> PrimitiveSelector.
 *  - Return a deterministic SelectedOutcome.
 *
 * Legacy Compatibility:
 *  - Implements `match()` to support existing Orchestrator calls, adapting the V5 outcome
 *    to the legacy PrimitiveMasterResult format.
 */

import { PRIMITIVES_V5_TABLE, NodeContext } from "../engine/primitives.registry.v5";
import { NodeContextBuilder } from "../engine/v5/NodeContextBuilder";
import { PrimitiveMatcher } from "../engine/v5/PrimitiveMatcher";
import { PrimitiveSelector, SelectedOutcome } from "../engine/v5/PrimitiveSelector";
import type { AstNode } from "../mapmaster/ast";
import { toLatex, getNodeAt, getNodeByOperatorIndex } from "../mapmaster/ast";
import type { PrimitiveId } from "../engine/primitives.registry.v5";

// --- Legacy Types Re-export (for compatibility) ---
export type PrimitiveMasterStatus = "match-found" | "no-match" | "error";

export interface PrimitiveMasterRequest {
    expressionLatex: string;
    selectionPath: string | null;
    operatorIndex?: number;
    invariantSetId?: string; // Ignored in V5
    expressionId?: string;
    context?: { userRole?: string };
}

export interface PrimitiveMasterWindow {
    centerPath: string;
    latexFragment: string;
    leftContextPaths?: string[];
    rightContextPaths?: string[];
}

export interface PrimitiveMasterDebugCandidate {
    primitiveId: PrimitiveId;
    verdict: "applicable" | "not-applicable";
    reason?: string;
}

export interface PrimitiveMasterDebug {
    candidates: PrimitiveMasterDebugCandidate[];
}

export interface PrimitiveMasterResultMatch {
    status: "match-found";
    primitiveId: PrimitiveId;
    window: PrimitiveMasterWindow;
    debug?: PrimitiveMasterDebug;
}

export interface PrimitiveMasterResultNoMatch {
    status: "no-match";
    reason: "selection-out-of-domain" | "no-primitive-for-selection";
    debug?: PrimitiveMasterDebug;
}

export interface PrimitiveMasterResultError {
    status: "error";
    errorCode: "parse-error" | "internal-error";
    message: string;
}

export type PrimitiveMasterResult =
    | PrimitiveMasterResultMatch
    | PrimitiveMasterResultNoMatch
    | PrimitiveMasterResultError;

export interface PrimitiveMasterDeps {
    parseLatexToAst: (latex: string, invariantSetId?: string) => Promise<AstNode | undefined>;
    // patternRegistry is no longer needed for V5 logic, but kept signature if needed
    log?: (message: string) => void;
}

// --- V5 PrimitiveMaster Class ---

export class PrimitiveMaster {
    private contextBuilder: NodeContextBuilder;
    private matcher: PrimitiveMatcher;
    private selector: PrimitiveSelector;
    private deps: PrimitiveMasterDeps;

    constructor(deps: PrimitiveMasterDeps) {
        this.deps = deps;
        this.contextBuilder = new NodeContextBuilder();
        this.matcher = new PrimitiveMatcher();
        this.selector = new PrimitiveSelector();
    }

    /**
     * Primary V5 API: Resolves the best primitive outcome for a given click.
     */
    public async resolvePrimitive(params: {
        expressionId: string;
        expressionLatex: string;
        click: {
            nodeId: string;
            kind: "operator" | "number" | "fractionBar" | "bracket" | "other";
            operatorIndex?: number;
        };
        ast?: AstNode; // Optional: Pass pre-parsed/mapped AST
        preferredPrimitiveId?: string; // Optional: force primitive (e.g. Hint Apply)
    }): Promise<SelectedOutcome> {
        // 1. Parse AST (if needed)
        // In a real optimized system we might pass AST. For now, we parse.
        const ast = params.ast || await this.deps.parseLatexToAst(params.expressionLatex);
        if (!ast) {
            return { kind: "no-candidates", matches: [] };
        }

        // 2. Normalize Target (Binary Op Normalization)
        // If the user clicked a number inside a binary operation, we often treat the operator as the target.
        // HOWEVER: when the caller forces a specific primitive (Hint Apply / Double-Click Apply),
        // we must keep the raw click target so that number-target primitives (e.g. P.INT_TO_FRAC) can apply.
        // 2. Normalize Target (Binary Op Normalization)
// IMPORTANT: For our UX, clicking a number should target that number, not the parent operator.
// The user can click the operator explicitly (or provide operatorIndex) when they want operator actions.
// Therefore we DO NOT normalize number-clicks to operators.
//
// We still keep the method `normalizeClick` for possible future experiments,
// but it is disabled by default here.
const normalizedClick =
    (params.click.kind === "number" || params.click.kind === "integer" || params.preferredPrimitiveId)
        ? { nodeId: params.click.nodeId, kind: params.click.kind, operatorIndex: params.click.operatorIndex }
        : this.normalizeClick(ast, {
            nodeId: params.click.nodeId,
            kind: params.click.kind,
            operatorIndex: params.click.operatorIndex
        });

// 3. Build Context
        const ctx: NodeContext = this.contextBuilder.buildContext({
            expressionId: params.expressionId,
            ast,
            click: normalizedClick
        });

        // 3. Match
        const matches = this.matcher.match({
            table: PRIMITIVES_V5_TABLE,
            ctx
        });

        // 4. Select
        const outcome = this.selector.select(matches);
        console.log(`[V5-STEPMASTER] chosenPrimitiveId=${outcome.primitive?.id ?? "none"} operator=${ctx.operatorLatex ?? "?"} kind=${outcome.kind} score=${outcome.matches[0]?.score ?? 0}`);
        return outcome;
    }

    /**
     * Legacy Adapter: Implements the old `match` interface used by Orchestrator.
     */
    public async match(request: PrimitiveMasterRequest): Promise<PrimitiveMasterResult> {
        try {
            // Map legacy request to V5 resolvePrimitive params

            // 1. Parse
            const ast = await this.deps.parseLatexToAst(request.expressionLatex);
            if (!ast) {
                return { status: "error", errorCode: "parse-error", message: "Parse failed" };
            }

            // 2. Resolve Anchor (borrowing logic from old master)
            // We need to determine ClickTarget
            const clickTarget = this.resolveClickTarget(ast, request.selectionPath || "", request.operatorIndex);
            if (!clickTarget) {
                return { status: "no-match", reason: "selection-out-of-domain" };
            }

            // 3. V5 Pipeline
            const ctx = this.contextBuilder.buildContext({
                expressionId: request.expressionId || "unknown",
                ast,
                click: clickTarget
            });

            const matches = this.matcher.match({
                table: PRIMITIVES_V5_TABLE,
                ctx
            });

            const outcome = this.selector.select(matches);

            // 4. Map to Legacy Result
            if (outcome.kind === "no-candidates" || !outcome.primitive) {
                return {
                    status: "no-match",
                    reason: "no-primitive-for-selection",
                    debug: {
                        candidates: outcome.matches.map(m => ({
                            primitiveId: m.row.id,
                            verdict: "not-applicable"
                        }))
                    }
                };
            }

            // Note: Legacy `window` logic was simple.
            const centerPath = ctx.nodeId;
            const window: PrimitiveMasterWindow = {
                centerPath,
                latexFragment: toLatex(ast) // Approximate
            };

            const debugCandidates: PrimitiveMasterDebugCandidate[] = outcome.matches.map(m => ({
                primitiveId: m.row.id,
                verdict: "applicable",
                reason: `Score: ${m.score}`
            }));

            // For now, return "match-found" with the chosen primitive ID.

            return {
                status: "match-found",
                primitiveId: outcome.primitive.id,
                window,
                debug: { candidates: debugCandidates }
            };

        } catch (e: any) {
            return { status: "error", errorCode: "internal-error", message: e.message };
        }
    }

    public resolveClickTarget(ast: AstNode, selectionPath: string, operatorIndex?: number): { nodeId: string; kind: any; operatorIndex?: number } | undefined {
        // 1. Try Operator Index
        if (typeof operatorIndex === "number") {
            const found = getNodeByOperatorIndex(ast, operatorIndex);
            if (found) {
                return {
                    nodeId: found.path,
                    kind: this.classifyNode(found.node),
                    operatorIndex
                };
            }
        }

        // 2. Try Path
        if (selectionPath) {
            const cleanPath = selectionPath.replace(/\.op$/, "");
            const node = getNodeAt(ast, cleanPath);
            if (node) {
                return {
                    nodeId: cleanPath,
                    kind: this.classifyNode(node)
                };
            }
        }
        return undefined;
    }

    private classifyNode(node: AstNode): "operator" | "number" | "fractionBar" | "bracket" | "other" {
        if (node.type === "binaryOp") return "operator";
        // Most V5 primitives classify fraction bar related ops as operators for now, 
        // OR as "fractionBar" if specific. Let's map to "operator" for compatibility with existing patterns
        // unless table specifically distinguishes.
        // But wait, the V5 spec says `kind: ClickTargetKind`.
        // Primitives table rows have `clickTargetKind`.
        // If I map fraction to "operator", then `P.FRAC_SIMPLIFY` (if it targets fraction) must expect "operator".
        // Let's assume standard "operator" for now.
        if (node.type === "fraction") return "operator";
        if (node.type === "integer") return "number";
        if (node.type === "mixed") return "number";
        return "other";
    }

    private normalizeClick(ast: AstNode, click: { nodeId: string; kind: string; operatorIndex?: number }): { nodeId: string; kind: any; operatorIndex?: number } {
        // Only normalize numbers/integers
        if (click.kind !== "number" && click.kind !== "integer") return click;

        // Determine parent path
        let parentPath = "";
        if (click.nodeId === "root") return click; // Root cannot have parent

        const lastDotIndex = click.nodeId.lastIndexOf('.');
        if (lastDotIndex === -1) {
            // e.g. "term[0]" -> parent is "root" (which is mapped to "" by some, or "root" by getNodeAt if passed as path?)
            // getNodeAt expects "root" or nested path.
            // If click.nodeId is "term[0]", parent is root.
            parentPath = "root";
        } else {
            parentPath = click.nodeId.substring(0, lastDotIndex);
        }

        const parentNode = getNodeAt(ast, parentPath);
        if (parentNode && parentNode.type === "binaryOp") {
            // Normalization Rule: If parent is binaryOp (+, -, *, /, etc), target the operator.
            // We verify the op is a standard binary op just in case.
            if (["+", "-", "*", "/", "\\times", "\\div"].includes(parentNode.op)) {

                const normalized = {
                    nodeId: parentPath,
                    kind: "operator" as const,
                    operatorIndex: click.operatorIndex
                };

                console.log(`[V5-TARGET] rawKind=${click.kind}, parentKind=${parentNode.type}, normalizedKind=operator, normalizedNodeId=${normalized.nodeId}`);
                return normalized;
            }
        }
        return click;
    }
}

// Factory for backward compatibility
export function createPrimitiveMaster(deps: PrimitiveMasterDeps): PrimitiveMaster {
    return new PrimitiveMaster(deps);
}
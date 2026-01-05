/**
 * Step Orchestrator (TzV1.1)
 *
 * Responsibilities:
 *  - Act as the central coordinator for a single step.
 *  - Talk to Invariants Registry, MapMaster, StepMaster, History, Engine Bridge.
 *  - Maintain per-request step history and policy.
 */

import {
    type InMemoryInvariantRegistry,
} from "../invariants/index";
import {
    mapMasterGenerate,
    type MapMasterInput,
} from "../mapmaster/index";
import {
    stepMasterDecide,
    createDefaultStudentPolicy,
    type StepPolicyConfig,
    type StepMasterInput,
} from "../stepmaster/index";
import {
    createEmptyHistory,
    appendStepFromResult,
    getSnapshot,
    type StepHistory,
    removeLastStep,
    updateLastStep,
} from "../stepmaster/index";
import {
    executeStepViaEngine,
    type EngineStepExecutionResult,
} from "../engine/index";
import { SessionService } from "../session/session.service";
import type { UserRole, HintRequest, HintResponse } from "../protocol/backend-step.types";
import { isLocalToSelection } from "./locality";
import { StepSnapshotStore } from "../debug/StepSnapshotStore.js";
import { computePrimitiveDebug } from "../engine/primitives/PrimitiveDebug";
import type { PrimitiveDebugInfo } from "../protocol/backend-step.types";
import type { PrimitiveMaster } from "../primitive-master/PrimitiveMaster";
import { PRIMITIVE_DEFINITIONS, PrimitiveId } from "../engine/primitives.registry";
import { TraceHub, shortLatex, generateTraceId } from "../debug/TraceHub.js";
import { validateOperatorContext, type ValidationResult, type ValidationType } from "../mapmaster/validation.utils";

export interface OrchestratorContext {
    invariantRegistry: InMemoryInvariantRegistry;
    policy: StepPolicyConfig;
    primitiveMaster?: PrimitiveMaster;
}

export interface OrchestratorStepRequest {
    sessionId: string;
    courseId: string;
    expressionLatex: string;
    selectionPath: string | null;
    operatorIndex?: number;
    userRole: UserRole;
    userId?: string;
    preferredPrimitiveId?: string; // NEW: Client's choice from a previous "choice" response
    surfaceNodeKind?: string; // NEW: Surface node kind from viewer (e.g., "Num", "BinaryOp")
    traceId?: string; // NEW: TraceHub correlation ID from viewer
    // NEW: Click context fields for operator matching
    clickTargetKind?: string; // "operator" | "number" | "fractionBar" | etc.
    operator?: string; // "+" | "-" | "*" | "/" etc.
    surfaceNodeId?: string; // For debugging
}

export type OrchestratorStepStatus =
    | "step-applied"
    | "no-candidates"
    | "engine-error"
    | "choice"; // NEW: Multiple actions available for this click

import type { StepChoice } from "../protocol/backend-step.types";

export interface OrchestratorStepResult {
    history: StepHistory;
    engineResult: EngineStepExecutionResult | null;
    status: OrchestratorStepStatus;
    debugInfo?: {
        allCandidates?: unknown[];
        [key: string]: unknown;
    } | null;
    primitiveDebug?: PrimitiveDebugInfo;
    choices?: StepChoice[]; // NEW: Available when status is "choice"
    // Smart Operator Selection: validation result for operator clicks
    validationType?: ValidationType; // "direct" (GREEN) | "requires-prep" (YELLOW)
    validationDetail?: ValidationResult;
}

/**
 * Run a single step orchestration.
 */
export async function runOrchestratorStep(
    ctx: OrchestratorContext,
    req: OrchestratorStepRequest
): Promise<OrchestratorStepResult> {
    // TraceHub: Setup context and emit ORCHESTRATOR_ENTER
    const traceId = req.traceId || generateTraceId();
    const stepId = `step-${Date.now()}`;
    TraceHub.setContext(traceId, stepId);

    TraceHub.emit({
        module: "backend.orchestrator",
        event: "ORCHESTRATOR_ENTER",
        data: {
            expressionLatex: shortLatex(req.expressionLatex),
            selectionPath: req.selectionPath,
            preferredPrimitiveId: req.preferredPrimitiveId,
            surfaceNodeKind: req.surfaceNodeKind,
            courseId: req.courseId,
            // NEW: Click context fields for debugging
            clickTargetKind: req.clickTargetKind,
            operator: req.operator,
            surfaceNodeId: req.surfaceNodeId,
        }
    });

    // 1. Load history from Session Service
    let history = await SessionService.getHistory(req.sessionId, req.userId, req.userRole);

    // 2. Build MapMasterInput
    // TzV2.1: Use courseId to select the specific invariant set.
    const targetSet = ctx.invariantRegistry.getInvariantSetById(req.courseId);

    if (!targetSet) {
        return {
            status: "engine-error",
            engineResult: { ok: false, errorCode: `course-not-found: ${req.courseId}` },
            history,
        };
    }

    const invariantSetIds = [targetSet.id];

    const mapInput: MapMasterInput = {
        expressionLatex: req.expressionLatex,
        selectionPath: req.selectionPath,
        operatorIndex: req.operatorIndex,
        invariantSetIds,
        registry: ctx.invariantRegistry,
    };

    // 3. V5 Decision Core Integration
    // If PrimitiveMaster is available, we delegate the entire "match & select" process to it.
    let mapResult: { candidates: any[], resolvedSelectionPath?: string } | undefined;
    let isPrimitiveMasterPath = false;
    let pmPrimitiveId: string | null = null;
    let v5Outcome: any = null;
    let operatorAnchorPath: string | null = null;

    // We need AST for V5 logic (and legacy anchoring)
    // We need AST for V5 logic (and legacy anchoring)
    const { parseExpression, getNodeAt, replaceNodeAt, toLatex } = await import("../mapmaster/ast");
    const ast = parseExpression(req.expressionLatex);

    // [New] Surface AST Logic for V5
    // Helper to augment AST with IDs if they are missing (since parser returns raw AST)
    function augmentAstWithIds(root: any) {
        if (!root) return;

        const traverse = (node: any, path: string) => {
            if (!node || typeof node !== 'object') return;

            // Assign ID to this node
            node.id = path;

            // Handle different node types
            switch (node.type) {
                case "binaryOp":
                    // For binary operations, traverse left and right children
                    if (node.left) {
                        traverse(node.left, path === "root" ? "term[0]" : `${path}.term[0]`);
                    }
                    if (node.right) {
                        traverse(node.right, path === "root" ? "term[1]" : `${path}.term[1]`);
                    }
                    break;

                case "fraction":
                    // Fractions have numerator/denominator as strings in current AST,
                    // so no child traversal needed
                    break;

                case "mixed":
                    // Mixed numbers have whole, numerator, denominator as strings
                    break;

                case "integer":
                case "variable":
                    // Leaf nodes, no children to traverse
                    break;

                default:
                    // For any other node types, try to traverse common child properties
                    if (node.left) traverse(node.left, `${path}.left`);
                    if (node.right) traverse(node.right, `${path}.right`);
                    if (node.children && Array.isArray(node.children)) {
                        node.children.forEach((child: any, i: number) => {
                            traverse(child, `${path}.child[${i}]`);
                        });
                    }
                    break;
            }
        };

        traverse(root, "root");
        return root;
    }

    // Helper to find the first integer node path in the AST
    function findFirstIntegerPath(ast: any): string | null {
        if (!ast) return null;

        // DFS to find first integer (left-to-right order)
        // Use term[0]/term[1] path format compatible with getNodeAt
        const stack: Array<{ node: any; path: string }> = [{ node: ast, path: "root" }];

        while (stack.length > 0) {
            const { node, path } = stack.pop()!;
            if (!node) continue;

            if (node.type === "integer") {
                return path;
            }

            // For binaryOp, add children using term[0]/term[1] format
            // Push right first so left is processed first (left-to-right traversal)
            if (node.type === "binaryOp") {
                if (node.right) {
                    const rightPath = path === "root" ? "term[1]" : `${path}.term[1]`;
                    stack.push({ node: node.right, path: rightPath });
                }
                if (node.left) {
                    const leftPath = path === "root" ? "term[0]" : `${path}.term[0]`;
                    stack.push({ node: node.left, path: leftPath });
                }
            }
        }

        return null;
    }

    // NEW: Direct P.INT_TO_FRAC Application (when preferredPrimitiveId is provided)
    // This handles the "Hint Apply" case where user already selected INT_TO_FRAC from choice menu
    // CRITICAL: This path BYPASSES StepMaster entirely to ensure the primitive is always applied
    if (ast && req.preferredPrimitiveId === "P.INT_TO_FRAC") {
        // Augment AST with IDs
        augmentAstWithIds(ast);

        // Resolve the target integer path
        let targetPath = req.selectionPath || "root";
        let targetNode = getNodeAt(ast, targetPath);

        // If selectionPath doesn't resolve to an integer, check special cases
        if (!targetNode || targetNode.type !== "integer") {
            // Check if the root is an integer (simple case like "6")
            if (ast.type === "integer" && (targetPath === "root" || !targetPath)) {
                targetPath = "root";
                targetNode = ast;
            }
            // Don't auto-fallback to first integer - require explicit path for expressions
        }

        // Validate target is integer
        if (!targetNode || targetNode.type !== "integer") {
            const gotKind = targetNode ? targetNode.type : "null";
            console.log(`[Orchestrator] INT_TO_FRAC target validation failed: selectionPath="${req.selectionPath}", resolved="${targetPath}", nodeType="${gotKind}"`);

            TraceHub.emit({
                module: "backend.orchestrator",
                event: "DECISION",
                data: {
                    preferredPrimitiveId: "P.INT_TO_FRAC",
                    selectionPath: req.selectionPath,
                    resolvedPath: targetPath,
                    resolvedKind: gotKind,
                    decision: "reject",
                    reason: `Target is not integer, got ${gotKind}`
                }
            });

            return {
                status: "engine-error",
                engineResult: { ok: false, errorCode: `INT_TO_FRAC target must be integer, got ${gotKind}` },
                history,
                debugInfo: {
                    preferredPrimitiveId: req.preferredPrimitiveId,
                    selectionPath: req.selectionPath,
                    resolvedTargetPath: targetPath,
                    targetNodeType: gotKind
                }
            };
        }

        const intValue = (targetNode as any).value;
        console.log(`[Orchestrator] P.INT_TO_FRAC DIRECT EXECUTION: targetPath="${targetPath}", intValue="${intValue}"`);

        // Log DECISION (accept)
        TraceHub.emit({
            module: "backend.orchestrator",
            event: "DECISION",
            data: {
                preferredPrimitiveId: "P.INT_TO_FRAC",
                selectionPath: req.selectionPath,
                resolvedPath: targetPath,
                resolvedKind: "integer",
                intValue,
                decision: "apply",
                reason: "preferredPrimitiveId-direct-execution"
            }
        });

        // DIRECT EXECUTION: Apply INT_TO_FRAC transformation
        // Replace the integer node with a fraction node {numerator: value, denominator: "1"}
        const fractionNode = {
            type: "fraction",
            numerator: intValue,
            denominator: "1"
        };

        let newAst;
        try {
            newAst = replaceNodeAt(ast, targetPath, fractionNode as any);
        } catch (replaceError) {
            console.error(`[Orchestrator] replaceNodeAt failed:`, replaceError);

            TraceHub.emit({
                module: "backend.orchestrator",
                event: "RUN_END",
                data: {
                    primitiveId: "P.INT_TO_FRAC",
                    ok: false,
                    errorMessage: `replaceNodeAt failed: ${replaceError instanceof Error ? replaceError.message : String(replaceError)}`
                }
            });

            return {
                status: "engine-error",
                engineResult: { ok: false, errorCode: `Replace failed: ${replaceError instanceof Error ? replaceError.message : String(replaceError)}` },
                history,
                debugInfo: {
                    preferredPrimitiveId: req.preferredPrimitiveId,
                    targetPath,
                    error: String(replaceError)
                }
            };
        }

        // Convert new AST back to LaTeX
        const newLatex = toLatex(newAst);
        console.log(`[Orchestrator] P.INT_TO_FRAC result: "${req.expressionLatex}" => "${newLatex}"`);

        // Update history
        history = updateLastStep(history, { expressionAfter: newLatex });
        await SessionService.updateHistory(req.sessionId, history);

        // Log RUN_END (success)
        TraceHub.emit({
            module: "backend.orchestrator",
            event: "RUN_END",
            data: {
                primitiveId: "P.INT_TO_FRAC",
                ok: true,
                resultLatexShort: shortLatex(newLatex),
                targetPath,
                intValue
            }
        });

        // Return step-applied (BYPASS StepMaster)
        return {
            status: "step-applied",
            engineResult: {
                ok: true,
                newExpressionLatex: newLatex
            },
            history,
            debugInfo: {
                preferredPrimitiveId: "P.INT_TO_FRAC",
                chosenPrimitiveId: "P.INT_TO_FRAC",
                targetPath,
                intValue,
                bypassedStepMaster: true
            },
            primitiveDebug: {
                primitiveId: "P.INT_TO_FRAC",
                status: "ready",
                domain: "direct-execution",
                reason: "preferredPrimitiveId-bypass"
            }
        };
    }
    // NEW: Direct P.ONE_TO_TARGET_DENOM Application (Step2 of frac-add-diff-denom)
    // This handles converting "1" to "d/d" where d is the opposite fraction's denominator
    else if (ast && req.preferredPrimitiveId === "P.ONE_TO_TARGET_DENOM") {
        augmentAstWithIds(ast);

        let targetPath = req.selectionPath || "root";
        let targetNode = getNodeAt(ast, targetPath);

        // Validate target is integer "1"
        if (!targetNode || targetNode.type !== "integer" || (targetNode as any).value !== "1") {
            const gotKind = targetNode ? targetNode.type : "null";
            const gotValue = targetNode?.type === "integer" ? (targetNode as any).value : "N/A";
            console.log(`[Orchestrator] ONE_TO_TARGET_DENOM validation failed: path="${targetPath}", type="${gotKind}", value="${gotValue}"`);

            return {
                status: "engine-error",
                engineResult: { ok: false, errorCode: `ONE_TO_TARGET_DENOM target must be integer "1", got ${gotKind}:${gotValue}` },
                history,
                debugInfo: {
                    preferredPrimitiveId: req.preferredPrimitiveId,
                    selectionPath: req.selectionPath,
                    targetPath,
                    targetNodeType: gotKind,
                    targetNodeValue: gotValue
                }
            };
        }

        // Find parent (should be multiplication: frac * 1)
        const pathParts = targetPath.split(".");
        if (pathParts.length < 2) {
            return {
                status: "engine-error",
                engineResult: { ok: false, errorCode: "ONE_TO_TARGET_DENOM: path too short to find parent" },
                history,
                debugInfo: { targetPath, pathParts }
            };
        }

        pathParts.pop();
        const parentPath = pathParts.join(".") || "root";
        const parent = getNodeAt(ast, parentPath);

        if (!parent || parent.type !== "binaryOp" || parent.op !== "*") {
            console.log(`[Orchestrator] ONE_TO_TARGET_DENOM: parent is not *, got ${parent?.type}:${(parent as any)?.op}`);
            return {
                status: "engine-error",
                engineResult: { ok: false, errorCode: `ONE_TO_TARGET_DENOM: parent must be *, got ${parent?.type}:${(parent as any)?.op}` },
                history,
                debugInfo: { targetPath, parentPath, parentType: parent?.type, parentOp: (parent as any)?.op }
            };
        }

        // Find grandparent (should be + or -)
        pathParts.pop();
        const grandParentPath = pathParts.length > 0 ? pathParts.join(".") : "root";
        const grandParent = grandParentPath === "root" ? ast : getNodeAt(ast, grandParentPath);

        if (!grandParent || grandParent.type !== "binaryOp" || (grandParent.op !== "+" && grandParent.op !== "-")) {
            console.log(`[Orchestrator] ONE_TO_TARGET_DENOM: grandparent is not +/-, got ${grandParent?.type}:${(grandParent as any)?.op}`);
            return {
                status: "engine-error",
                engineResult: { ok: false, errorCode: `ONE_TO_TARGET_DENOM: grandparent must be +/-, got ${grandParent?.type}:${(grandParent as any)?.op}` },
                history,
                debugInfo: { targetPath, grandParentPath, grandParentType: grandParent?.type, grandParentOp: (grandParent as any)?.op }
            };
        }

        // Determine which side we're on and find opposite branch
        const parentIsLeft = parent === grandParent.left;
        const otherBranch = parentIsLeft ? grandParent.right : grandParent.left;

        // Extract denominator from other branch
        const extractDenom = (node: any): string | undefined => {
            if (node.type === "binaryOp" && node.op === "*") {
                if (node.left.type === "fraction") return node.left.denominator;
                if (node.right.type === "fraction") return node.right.denominator;
            }
            if (node.type === "fraction") return node.denominator;
            return undefined;
        };

        const oppositeD = extractDenom(otherBranch);
        if (!oppositeD) {
            console.log(`[Orchestrator] ONE_TO_TARGET_DENOM: could not extract opposite denominator from ${otherBranch?.type}`);
            return {
                status: "engine-error",
                engineResult: { ok: false, errorCode: "ONE_TO_TARGET_DENOM: could not find opposite denominator" },
                history,
                debugInfo: { targetPath, otherBranchType: otherBranch?.type }
            };
        }

        console.log(`[Orchestrator] P.ONE_TO_TARGET_DENOM DIRECT EXECUTION: path="${targetPath}" -> \\frac{${oppositeD}}{${oppositeD}}`);

        // Replace "1" with fraction d/d
        const newFraction = {
            type: "fraction",
            numerator: oppositeD,
            denominator: oppositeD
        };

        let newAst;
        try {
            newAst = replaceNodeAt(ast, targetPath, newFraction as any);
        } catch (replaceError) {
            console.error(`[Orchestrator] ONE_TO_TARGET_DENOM replaceNodeAt failed:`, replaceError);
            return {
                status: "engine-error",
                engineResult: { ok: false, errorCode: `Replace failed: ${replaceError}` },
                history,
                debugInfo: { targetPath, replaceError: String(replaceError) }
            };
        }

        const newLatex = toLatex(newAst);
        console.log(`[Orchestrator] P.ONE_TO_TARGET_DENOM result: "${req.expressionLatex}" => "${newLatex}"`);

        history = updateLastStep(history, { expressionAfter: newLatex });
        await SessionService.updateHistory(req.sessionId, history);

        TraceHub.emit({
            module: "backend.orchestrator",
            event: "RUN_END",
            data: {
                primitiveId: "P.ONE_TO_TARGET_DENOM",
                ok: true,
                resultLatexShort: shortLatex(newLatex),
                targetPath,
                oppositeDenominator: oppositeD
            }
        });

        return {
            status: "step-applied",
            engineResult: {
                ok: true,
                newExpressionLatex: newLatex
            },
            history,
            debugInfo: {
                preferredPrimitiveId: "P.ONE_TO_TARGET_DENOM",
                chosenPrimitiveId: "P.ONE_TO_TARGET_DENOM",
                targetPath,
                oppositeDenominator: oppositeD,
                bypassedStepMaster: true
            },
            primitiveDebug: {
                primitiveId: "P.ONE_TO_TARGET_DENOM",
                status: "ready",
                domain: "direct-execution",
                reason: "preferredPrimitiveId-bypass"
            }
        };
    }
    // Integer Click Detection - return choice response for integers (unless preferredPrimitiveId is provided)
    else if (ast && !req.preferredPrimitiveId) {
        // Augment AST with IDs first
        augmentAstWithIds(ast);

        // Check if the clicked node is an integer
        const clickedNodePath = req.selectionPath || "root";
        const clickedNode = getNodeAt(ast, clickedNodePath);

        // Detect integer click either by AST node type OR by surfaceNodeKind
        const isIntegerByAst = clickedNode && clickedNode.type === "integer";
        const isIntegerBySurface = req.surfaceNodeKind === "Num" || req.surfaceNodeKind === "Number" || req.surfaceNodeKind === "Integer";

        if (isIntegerByAst || isIntegerBySurface) {
            console.log(`[Orchestrator] Integer click detected: byAst=${isIntegerByAst}, bySurface=${isIntegerBySurface}, path=${clickedNodePath}, surfaceKind=${req.surfaceNodeKind}`);

            // Determine the target node ID for the choice
            // If we found an integer in AST, use its path; otherwise we need to find one
            let targetPath = clickedNodePath;
            let intValue: any = null;

            if (isIntegerByAst && clickedNode) {
                intValue = (clickedNode as any).value;
            } else if (isIntegerBySurface && ast) {
                // Surface says it's a number but AST path doesn't resolve to integer
                // This happens when selectionPath is null/root - try to find first integer in AST
                const firstIntPath = findFirstIntegerPath(ast);
                if (firstIntPath) {
                    targetPath = firstIntPath;
                    const intNode = getNodeAt(ast, firstIntPath);
                    intValue = intNode ? (intNode as any).value : null;
                }
            }

            // Return choice response with available integer actions
            return {
                status: "choice",
                engineResult: null,
                history,
                choices: [
                    {
                        id: "int-to-frac",
                        label: "Convert to fraction",
                        primitiveId: "P.INT_TO_FRAC",
                        targetNodeId: targetPath,
                    }
                ],
                debugInfo: {
                    clickedNodeType: "integer",
                    clickedNodePath,
                    targetNodeId: targetPath,
                    integerValue: intValue,
                    detectedByAst: isIntegerByAst,
                    detectedBySurface: isIntegerBySurface,
                }
            };
        }
    }

    // Only use PrimitiveMaster if we haven't already set mapResult (e.g. via P.INT_TO_FRAC direct path)
    if (ctx.primitiveMaster && ast && !mapResult) {
        console.log("[Orchestrator] Using V5 PrimitiveMaster Path");

        // 1. Augment AST with IDs (Surface Map)
        augmentAstWithIds(ast);
        console.log(`[V5-ORCH] rootAst.id=${(ast as any).id}, kind=${ast.type}`);

        // Resolve Click Target
        const clickTarget = await ctx.primitiveMaster.resolveClickTarget(ast, req.selectionPath || "", req.operatorIndex);

        if (clickTarget) {
            // Resolve Primitive (Match -> Select)
            v5Outcome = await ctx.primitiveMaster.resolvePrimitive({
                expressionId: "expr-temp",
                expressionLatex: req.expressionLatex,
                click: clickTarget,
                preferredPrimitiveId: req.preferredPrimitiveId,
                ast: ast // Pass the augmented AST
            });

            // Handle V5 Outcome
            if (v5Outcome.kind === "green-primitive" || v5Outcome.kind === "yellow-scenario") {
                // GREEN / YELLOW -> Execute immediately (Auto-Apply)
                // We treat "yellow-scenario" as auto-apply for now until Scenario Manager is fully active.
                if (v5Outcome.primitive) {
                    isPrimitiveMasterPath = true;
                    pmPrimitiveId = v5Outcome.primitive.enginePrimitiveId; // Use the ENGINE ID

                    // Create a synthetic candidate for the legacy runner
                    // The runner still expects a "candidate" object for now.
                    const candidate = {
                        id: "v5-match",
                        invariantRuleId: "v5-rule",
                        primitiveIds: [pmPrimitiveId],
                        targetPath: v5Outcome.matches[0]?.ctx?.actionNodeId ?? v5Outcome.matches[0]?.ctx?.clickTarget?.nodeId ?? clickTarget.nodeId,
                        description: v5Outcome.primitive.label,
                    };

                    mapResult = {
                        candidates: [candidate],
                        resolvedSelectionPath: candidate.targetPath
                    };
                } else {
                    mapResult = { candidates: [] };
                }
            } else if (v5Outcome.kind === "blue-choice") {
                // BLUE -> Ask User (Context Menu)
                // HOWEVER, if preferredPrimitiveId is provided, we should honor it and apply that primitive
                console.log(`[Orchestrator] V5 Blue Choice entry - preferredPrimitiveId="${req.preferredPrimitiveId || "NONE"}", matchCount=${v5Outcome.matches?.length || 0}`);
                if (req.preferredPrimitiveId && v5Outcome.matches && v5Outcome.matches.length > 0) {
                    // Find the match that corresponds to the preferred primitive
                    const preferredMatch = v5Outcome.matches.find(
                        (m: any) => m.row.id === req.preferredPrimitiveId || m.row.enginePrimitiveId === req.preferredPrimitiveId
                    );

                    if (preferredMatch) {
                        console.log(`[Orchestrator] V5 Blue Choice with preferredPrimitiveId="${req.preferredPrimitiveId}" - applying directly`);
                        isPrimitiveMasterPath = true;
                        pmPrimitiveId = preferredMatch.row.enginePrimitiveId || preferredMatch.row.id;

                        // Create candidate for the runner
                        const candidate = {
                            id: "v5-preferred-match",
                            invariantRuleId: "v5-rule",
                            primitiveIds: [pmPrimitiveId],
                            targetPath: preferredMatch.ctx?.actionNodeId ?? preferredMatch.ctx?.clickTarget?.nodeId ?? clickTarget.nodeId,
                            description: preferredMatch.row.label || "Apply primitive",
                        };

                        mapResult = {
                            candidates: [candidate],
                            resolvedSelectionPath: candidate.targetPath
                        };
                    } else {
                        // Preferred primitive not found in matches - return no-candidates
                        console.log(`[Orchestrator] V5 Blue Choice: preferredPrimitiveId="${req.preferredPrimitiveId}" not found in matches`);
                        return {
                            status: "no-candidates",
                            engineResult: { ok: false, errorCode: "preferred-primitive-not-in-candidates" },
                            history,
                            debugInfo: {
                                v5Status: "preferred-not-found",
                                preferredPrimitiveId: req.preferredPrimitiveId,
                                availableMatches: v5Outcome.matches.map((m: any) => m.row.id)
                            }
                        };
                    }
                } else {
                    // No preferredPrimitiveId - return choice to user
                    console.log("[Orchestrator] V5 Blue Choice Detected - asking user");
                    return {
                        status: "choice",
                        engineResult: null,
                        history,
                        choices: v5Outcome.matches.map((m: any) => ({
                            id: m.row.id,
                            label: m.row.label || m.row.id,
                            primitiveId: m.row.enginePrimitiveId || m.row.id,
                            targetNodeId: m.ctx?.clickTarget?.nodeId
                        })),
                        debugInfo: {
                            v5Status: "ask-user",
                            options: v5Outcome.matches
                        }
                    };
                }
            } else if (v5Outcome.kind === "red-diagnostic") {
                // RED -> Diagnostic Message
                console.log("[Orchestrator] V5 Red Diagnostic Detected");
                return {
                    status: "no-candidates",
                    engineResult: null,
                    history,
                    debugInfo: {
                        v5Status: "diagnostic",
                        message: v5Outcome.primitive?.label
                    }
                };
            } else {
                mapResult = { candidates: [] };
            }
        } else {
            console.log("[Orchestrator] Click target could not be resolved in V5.");
            mapResult = { candidates: [] };
        }
    }

    // FALLBACK to Legacy if V5 produced no candidates (or if PM not present)
    if ((!mapResult || mapResult.candidates.length === 0) && !v5Outcome) {
        if (!ctx.primitiveMaster) {
            // Legacy/Default MapMaster Path
            mapResult = mapMasterGenerate(mapInput);
            console.log(`[Orchestrator] MapMaster returned ${mapResult.candidates.length} candidates for expression "${req.expressionLatex}" using set "${targetSet.id}"`);

            // 3b. Enforce Locality (Stage-1)
            mapResult.candidates = mapResult.candidates.filter(c => {
                const isLocal = isLocalToSelection(req.selectionPath, mapResult.resolvedSelectionPath, c);
                // if (!isLocal) console.log(`[Orchestrator] Filtered by locality: ${c.id}`);
                return isLocal;
            });

            // 3c. Operator Anchoring (Stage-1 Fix)
            const { getOperatorAnchorPath } = await import("./locality");
            // ast is already parsed above
            if (ast) {
                operatorAnchorPath = getOperatorAnchorPath(
                    ast,
                    mapResult.resolvedSelectionPath,
                    req.selectionPath,
                    req.operatorIndex,
                    getNodeAt
                );

                if (operatorAnchorPath) {
                    const anchoredCandidates = mapResult.candidates.filter(c => c.targetPath === operatorAnchorPath);
                    if (anchoredCandidates.length > 0) {
                        mapResult.candidates = anchoredCandidates;
                    } else {
                        mapResult.candidates = [];
                    }
                }
            }
        } else {
            // V5 was arguably authoritative if it ran.
            if (!mapResult) mapResult = { candidates: [] };
        }
    }

    // Safety check
    if (!mapResult) mapResult = { candidates: [] };



    // NEW: If the caller provided a preferredPrimitiveId (e.g. Hint Apply),
    // we MUST only consider candidates whose PRIMARY primitive matches it.
    // Otherwise, the orchestrator may apply a different "best" step (e.g. evaluate 2+3 -> 5),
    // which breaks the intended explicit action.
    if (req.preferredPrimitiveId && mapResult && Array.isArray(mapResult.candidates)) {
        const pref = req.preferredPrimitiveId;
        const before = mapResult.candidates.length;
        mapResult.candidates = mapResult.candidates.filter(c => {
            const prims = (c as any).primitiveIds;
            return Array.isArray(prims) && prims.length > 0 && prims[0] === pref;
        });
        const after = mapResult.candidates.length;
        console.log(`[Orchestrator] preferredPrimitiveId="${pref}" filtered candidates: ${before} -> ${after}`);
    }

    // 4. Build StepMasterInput
    let policy = ctx.policy;

    // RBAC Check: Only teachers can use teacher.debug
    if (policy.id === "teacher.debug" && req.userRole !== "teacher") {
        // Fallback to student policy
        policy = createDefaultStudentPolicy();
    }

    const stepInput: StepMasterInput = {
        candidates: mapResult.candidates,
        history: getSnapshot(history),
        policy: policy,
        // Pass the strict action target (operator anchor if available, else selection path)
        actionTarget: operatorAnchorPath || mapResult.resolvedSelectionPath
    };

    // 5. Call StepMaster
    const stepResult = stepMasterDecide(stepInput);

    // 6. Update History
    history = appendStepFromResult(history, stepResult, req.expressionLatex);

    // 7. Save History to Session Service
    await SessionService.updateHistory(req.sessionId, history);

    // 8. Handle Decision
    if (stepResult.decision.status === "no-candidates") {
        captureSnapshot(req, mapResult, "no-candidates");
        return {
            status: "no-candidates",
            engineResult: null,
            history,
            debugInfo: buildDebugInfo(policy, mapResult),
        };
    }

    if (stepResult.decision.status === "chosen") {
        const chosenId = stepResult.decision.chosenCandidateId;
        const chosenCandidate = mapResult.candidates.find(c => c.id === chosenId);

        if (!chosenCandidate) {
            return {
                status: "engine-error",
                engineResult: { ok: false, errorCode: "chosen-candidate-not-found" },
                history,
                debugInfo: buildDebugInfo(policy, mapResult),
            };
        }

        // STAGE 1 ENFORCEMENT
        const primitivesToApply = stepResult.primitivesToApply?.map(p => p.id) || chosenCandidate.primitiveIds;
        const primaryPrimitiveId = primitivesToApply[0] as PrimitiveId;
        const primitiveDef = PRIMITIVE_DEFINITIONS[primaryPrimitiveId];

        if (!primaryPrimitiveId || !primitiveDef) {
            return {
                status: "no-candidates",
                engineResult: null,
                history,
                debugInfo: {
                    ...buildDebugInfo(policy, mapResult),
                    reason: "invalid-primitive-id",
                    invalidId: primaryPrimitiveId
                }
            };
        }

        // 8. Execute via Engine
        // === V5 LOGGING START ===
        if (pmPrimitiveId) {
            console.log(`[Orchestrator] [V5-RUNNER-START] Executing Primitive: ${pmPrimitiveId}`);
        }
        // === V5 LOGGING END ===

        const engineResult = await executeStepViaEngine(chosenCandidate, mapInput);

        if (engineResult.ok) {
            if (engineResult.newExpressionLatex) {
                history = updateLastStep(history, { expressionAfter: engineResult.newExpressionLatex });
                await SessionService.updateHistory(req.sessionId, history);
            }

            // TraceHub: RUN_END success
            TraceHub.emit({
                module: "backend.orchestrator",
                event: "RUN_END",
                data: {
                    primitiveId: pmPrimitiveId || chosenCandidate.primitiveIds?.[0],
                    ok: true,
                    errorCode: null,
                    resultLatex: shortLatex(engineResult.newExpressionLatex || "")
                }
            });

            captureSnapshot(req, mapResult, "step-applied", chosenCandidate, engineResult);

            // Primitive Debug
            let primitiveDebug: PrimitiveDebugInfo | undefined;
            if (isPrimitiveMasterPath && pmPrimitiveId) {
                primitiveDebug = {
                    primitiveId: pmPrimitiveId,
                    status: "ready",
                    domain: "primitive-master",
                    reason: "matched-by-selection"
                };
            } else if (req.operatorIndex != null && ast) {
                primitiveDebug = computePrimitiveDebug({
                    expressionLatex: req.expressionLatex,
                    stage: 1, // Default to Stage 1 for now
                    astRoot: ast,
                    operatorIndex: req.operatorIndex
                });
            }

            // Smart Operator Selection: Compute validation for operator clicks
            const validationResult = req.selectionPath
                ? validateOperatorContext(req.expressionLatex, req.selectionPath)
                : validateOperatorContext(req.expressionLatex, 'root');

            return {
                status: "step-applied",
                engineResult,
                history,
                debugInfo: buildDebugInfo(policy, mapResult),
                primitiveDebug,
                validationType: validationResult?.validationType,
                validationDetail: validationResult ?? undefined,
            };
        } else {
            // === V5 LOGGING START ===
            console.error("[Orchestrator] [V5-RUNNER-FAIL] Error details:", JSON.stringify(engineResult, null, 2));
            // === V5 LOGGING END ===

            // TraceHub: RUN_END error
            TraceHub.emit({
                module: "backend.orchestrator",
                event: "RUN_END",
                data: {
                    primitiveId: pmPrimitiveId || chosenCandidate.primitiveIds?.[0],
                    ok: false,
                    errorCode: engineResult.errorCode,
                    resultLatex: null,
                    errorMessage: engineResult.errorCode
                }
            });

            history = updateLastStep(history, { errorCode: engineResult.errorCode });
            await SessionService.updateHistory(req.sessionId, history);

            captureSnapshot(req, mapResult, "engine-error", chosenCandidate, engineResult);
            return {
                status: "engine-error",
                engineResult,
                history,
                debugInfo: buildDebugInfo(policy, mapResult),
            };
        }
    }

    captureSnapshot(req, mapResult, "no-candidates");
    return {
        status: "no-candidates",
        engineResult: null,
        history,
    };
}

function buildDebugInfo(policy: StepPolicyConfig, mapResult: { candidates: unknown[] }) {
    if (policy.id === "teacher.debug") {
        return {
            allCandidates: mapResult.candidates
        };
    }
    return null;
}

export async function undoLastStep(
    ctx: OrchestratorContext,
    sessionId: string
): Promise<string | null> {
    const history = await SessionService.getHistory(sessionId);

    if (history.entries.length === 0) {
        return null;
    }

    const lastEntry = history.entries[history.entries.length - 1];
    const previousExpression = lastEntry.expressionBefore;

    const newHistory = removeLastStep(history);
    await SessionService.updateHistory(sessionId, newHistory);

    return previousExpression;
}

export async function generateHint(
    ctx: OrchestratorContext,
    req: HintRequest
): Promise<HintResponse> {
    const history = await SessionService.getHistory(req.sessionId);
    const targetSet = ctx.invariantRegistry.getInvariantSetById(req.courseId);
    if (!targetSet) {
        return { status: "error", error: `course-not-found: ${req.courseId}` };
    }

    const mapInput: MapMasterInput = {
        expressionLatex: req.expressionLatex,
        selectionPath: req.selectionPath,
        operatorIndex: req.operatorIndex,
        invariantSetIds: [targetSet.id],
        registry: ctx.invariantRegistry,
    };

    const mapResult = mapMasterGenerate(mapInput);

    const stepInput: StepMasterInput = {
        candidates: mapResult.candidates,
        history: getSnapshot(history),
        policy: ctx.policy,
    };

    const stepResult = stepMasterDecide(stepInput);

    if (stepResult.decision.status === "chosen") {
        const chosenId = stepResult.decision.chosenCandidateId;
        const chosenCandidate = mapResult.candidates.find(c => c.id === chosenId);
        if (chosenCandidate) {
            return {
                status: "hint-found",
                hintText: chosenCandidate.description,
            };
        }
    }

    return { status: "no-hint" };
}

function captureSnapshot(
    req: OrchestratorStepRequest,
    mapResult: { candidates: any[], resolvedSelectionPath?: string },
    status: string,
    chosenCandidate?: any,
    engineResult?: any,
    error?: string
) {
    StepSnapshotStore.setLatest({
        id: `step-${Date.now()}`,
        timestamp: new Date().toISOString(),
        inputLatex: req.expressionLatex,
        outputLatex: engineResult?.newExpressionLatex,
        selectionPath: req.selectionPath,
        selectionAstPath: mapResult.resolvedSelectionPath,
        engineRequest: {
            selectionPath: req.selectionPath,
            preferredPrimitiveId: req.preferredPrimitiveId,
            operatorIndex: req.operatorIndex,
            surfaceNodeKind: (req as any).surfaceNodeKind,
            expressionLatex: req.expressionLatex,
        },
        engineResponseStatus: status,
        chosenCandidate,
        allCandidates: mapResult.candidates,
        error: error || (engineResult?.ok === false ? engineResult.errorCode : undefined)
    });
    StepSnapshotStore.appendSnapshot(StepSnapshotStore.getLatest()!);
}

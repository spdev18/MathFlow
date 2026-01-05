/**
 * StepMaster Core (TzV1.1)
 *
 * Responsibilities:
 *  - Given a list of candidates, history, and policy, decide which step to take.
 */

import type { MapMasterCandidate, MapMasterCandidateId } from "../mapmaster/index";
import type { StepHistorySnapshot } from "./stepmaster.history-service";
import type { StepPolicyConfig } from "./stepmaster.policy";

export type StepMasterDecisionStatus = "chosen" | "no-candidates";

export interface StepMasterInput {
    candidates: MapMasterCandidate[];
    history: StepHistorySnapshot;
    policy: StepPolicyConfig;
    actionTarget?: string | null;
}

export interface StepMasterDecision {
    status: StepMasterDecisionStatus;
    chosenCandidateId: MapMasterCandidateId | null;
}

export interface StepMasterResult {
    input: StepMasterInput;
    decision: StepMasterDecision;
    primitivesToApply: { id: string }[];
}

/**
 * Decide which step to take.
 *
 * TzV1.1 strategy:
 *  - Filter out candidates that are "repetitive" or "looping" based on history.
 *  - Filter out candidates that do not match the actionTarget (Locality).
 *  - If no candidates remain -> "no-candidates"
 *  - Else -> pick the first one (simple student policy)
 */
export function stepMasterDecide(input: StepMasterInput): StepMasterResult {
    const { candidates, history, policy, actionTarget } = input;
    console.log(`[StepMaster] Deciding among ${candidates.length} candidates. Last step exists: ${!!history.lastStep}`);

    let validCandidates = candidates;

    // 1. Locality Filter (Cursor Dictatorship)
    if (actionTarget) {
        console.log(`[StepMaster] Enforcing locality for target: ${actionTarget}`);
        validCandidates = validCandidates.filter(c => {
            // Strict equality: candidate target must match action target.
            // We might want to allow "direct parent" if the click is on a child but the op is on parent?
            // But for now, strict equality is safest for "Dictatorship".
            const match = c.targetPath === actionTarget;
            if (!match) {
                console.log(`[StepMaster] Candidate ${c.id} rejected: target ${c.targetPath} != ${actionTarget}`);
            }
            return match;
        });
    }

    // 2. Filter out repetitive/looping steps
    validCandidates = validCandidates.filter(c => {
        if (isCandidateRepetitive(c, history)) {
            console.log(`[StepMaster] Candidate ${c.id} rejected: repetitive`);
            return false;
        }
        return true;
    });
    console.log(`[StepMaster] Valid candidates: ${validCandidates.length}`);

    if (validCandidates.length === 0) {
        return {
            input,
            decision: {
                status: "no-candidates",
                chosenCandidateId: null,
            },
            primitivesToApply: []
        };
    }

    // 3. Prioritize (simple strategy: pick first)
    const best = validCandidates[0];
    console.log(`[StepMaster] Chosen: ${best.id}`);

    // Map primitive IDs to objects
    const primitivesToApply = best.primitiveIds.map(id => ({ id }));

    return {
        input,
        decision: {
            status: "chosen",
            chosenCandidateId: best.id
        },
        primitivesToApply
    };
}

/**
 * Check if a candidate repeats the last step.
 * 
 * Heuristic:
 * - If the last step applied the same rule to the same target path, it's a loop.
 * - Ideally, we should check if the *result* of the step leads to a previous state, 
 *   but we don't know the result yet.
 * - So we rely on "don't do the exact same thing twice in a row".
 * - Actually, "same rule at same path" might be valid if the state changed (e.g. simplify again).
 * - But for V1.1, let's prevent "A -> B -> A" loops if possible.
 * - Since we only have history of *steps*, not states (in the snapshot passed here, though snapshot has steps),
 *   we can check if the last step was the "inverse" or if we are just repeating.
 * 
 * For now, a very simple check:
 * - If the last step used rule X on path Y, don't use rule X on path Y again immediately?
 *   No, that prevents valid repeated applications (e.g. simplify 2/4 then 3/6 if they were at same path? No, path would change or content change).
 * 
 * Let's implement a specific check for the "3/1 * 1" loop.
 * If we just did "3 -> 3/1", we don't want to do "3/1 -> 3" (if we had such a rule).
 * 
 * But the user requirement says: "Filter out candidates that repeat the last step".
 * This usually means "don't apply the same rule to the same location if it didn't change anything".
 * But MapMaster only proposes applicable rules.
 * 
 * Let's assume "repetitive" means "we just did this exact step".
 * But we can't do the exact same step because the state changed (unless the step was a no-op).
 * 
 * Maybe "looping" means "we are undoing the last step"?
 * e.g. "3/1 -> 3" after "3 -> 3/1".
 * 
 * For this task, let's implement a placeholder `isCandidateRepetitive` that returns false,
 * unless we identify a specific loop pattern we want to block.
 * 
 * Wait, the prompt says: "ensure that StepMaster accepts StepHistorySnapshot to avoid repeating just executed steps".
 * 
 * Let's check if the candidate is identical to the last step's intent.
 * If `lastStep.ruleId === candidate.ruleId` and `lastStep.path === candidate.path`, 
 * it might be a loop if the rule is idempotent or if the previous application failed to change state enough to disable the rule.
 * 
 * Let's block it if it matches the last step exactly.
 */
function isCandidateRepetitive(candidate: MapMasterCandidate, history: StepHistorySnapshot): boolean {
    if (!history.lastStep) return false;

    const lastStep = history.lastStep;

    // Check if we are trying to apply the same rule to the same path immediately again.
    // This catches "idempotent loop" where a rule applies but doesn't change the state (or MapMaster thinks it still applies).
    if (lastStep.invariantRuleId === candidate.invariantRuleId &&
        lastStep.targetPath === candidate.targetPath) {
        return true;
    }

    return false;
}

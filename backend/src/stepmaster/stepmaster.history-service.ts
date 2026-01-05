/**
 * Step History Service (TzV1.1)
 *
 * Responsibilities:
 *  - Maintain an immutable history of executed steps.
 *  - Provide easy access to a simple history snapshot.
 */

import type { MapMasterCandidateId } from "../mapmaster/index";
import type { StepMasterDecisionStatus, StepMasterResult } from "./stepmaster.core";

export type StepId = string;

export interface StepHistoryEntry {
    stepId: StepId;
    candidateId: MapMasterCandidateId | null;
    decisionStatus: StepMasterDecisionStatus;
    timestampIso: string;
    invariantRuleId?: string;
    targetPath?: string;
    expressionBefore: string;
    expressionAfter?: string;
    errorCode?: string;
}

export interface StepHistory {
    entries: StepHistoryEntry[];
}

export interface StepHistorySnapshot {
    lastStep: StepHistoryEntry | null;
}

/**
 * Create an empty history.
 */
export function createEmptyHistory(): StepHistory {
    return { entries: [] };
}

/**
 * Append a step result to the history.
 * Returns a new history object (immutable).
 */
export function appendStepFromResult(
    history: StepHistory,
    result: StepMasterResult,
    expressionBefore: string
): StepHistory {
    const { decision, input } = result;

    let invariantRuleId: string | undefined;
    let targetPath: string | undefined;

    if (decision.status === "chosen" && decision.chosenCandidateId) {
        const candidate = input.candidates.find(c => c.id === decision.chosenCandidateId);
        if (candidate) {
            invariantRuleId = candidate.invariantRuleId;
            targetPath = candidate.targetPath;
        }
    }

    const newEntry: StepHistoryEntry = {
        stepId: generateStepId(),
        candidateId: decision.status === "chosen" ? decision.chosenCandidateId : null,
        decisionStatus: decision.status,
        timestampIso: new Date().toISOString(),
        invariantRuleId,
        targetPath,
        expressionBefore,
        errorCode: decision.status === "no-candidates" ? "no-candidates" : undefined,
    };

    return {
        entries: [...history.entries, newEntry],
    };
}

/**
 * Get a snapshot of the history (last step).
 */
export function getSnapshot(history: StepHistory): StepHistorySnapshot {
    const lastStep = history.entries.length > 0 ? history.entries[history.entries.length - 1] : null;
    // Return a defensive copy if needed, but StepHistoryEntry is simple data.
    // We treat it as read-only.
    return { lastStep };
}

function generateStepId(): StepId {
    return `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Remove the last step from history.
 * Returns a new history object (immutable).
 */
export function removeLastStep(history: StepHistory): StepHistory {
    if (history.entries.length === 0) {
        return history;
    }
    return {
        entries: history.entries.slice(0, -1)
    };
}

/**
 * Update the last step in history with partial data.
 * Returns a new history object (immutable).
 */
export function updateLastStep(history: StepHistory, updates: Partial<StepHistoryEntry>): StepHistory {
    if (history.entries.length === 0) {
        return history;
    }
    const lastEntry = history.entries[history.entries.length - 1];
    const updatedEntry = { ...lastEntry, ...updates };
    return {
        entries: [...history.entries.slice(0, -1), updatedEntry]
    };
}

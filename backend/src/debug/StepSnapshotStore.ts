/**
 * StepSnapshotStore.ts
 *
 * In-memory store for the latest step snapshot.
 * Used for debugging to inspect the details of the last executed step.
 */

export interface StepSnapshot {
    id: string;
    timestamp: string;
    inputLatex: string;
    outputLatex?: string;
    selectionPath?: string | null;
    selectionAstPath?: string | null;
    engineRequest?: any;
    engineResponseStatus: string;
    chosenCandidate?: any;
    allCandidates?: any[];
    error?: any;
}

export interface SessionStepSnapshot extends StepSnapshot {
    stepIndex: number;
}

let latestSnapshot: StepSnapshot | null = null;
let sessionSnapshots: SessionStepSnapshot[] = [];
let currentStepIndex = 0;

export const StepSnapshotStore = {
    setLatest(snapshot: StepSnapshot) {
        latestSnapshot = snapshot;
        console.log(`[STEP SNAPSHOT] id=${snapshot.id} status=${snapshot.engineResponseStatus}`);
    },

    getLatest(): StepSnapshot | null {
        return latestSnapshot;
    },

    appendSnapshot(snapshot: StepSnapshot): SessionStepSnapshot {
        const sessionSnapshot: SessionStepSnapshot = {
            ...snapshot,
            stepIndex: currentStepIndex++
        };
        sessionSnapshots.push(sessionSnapshot);
        return sessionSnapshot;
    },

    getSessionSnapshots(): SessionStepSnapshot[] {
        return [...sessionSnapshots];
    },

    resetSession() {
        sessionSnapshots = [];
        currentStepIndex = 0;
        console.log("[STEP SNAPSHOT] Session reset");
    }
};

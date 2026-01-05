import { describe, it, expect, vi, beforeEach } from "vitest";
import { StepSnapshotStore } from "../src/debug/StepSnapshotStore.js";

describe("Step Snapshot Session Store", () => {
    beforeEach(() => {
        StepSnapshotStore.resetSession();
    });

    it("accumulates snapshots in session history", () => {
        // Step 1
        StepSnapshotStore.appendSnapshot({
            id: "step-1",
            timestamp: new Date().toISOString(),
            inputLatex: "2+3",
            outputLatex: "5",
            engineResponseStatus: "step-applied",
            selectionPath: "op-1",
            selectionAstPath: "root"
        });

        // Step 2
        StepSnapshotStore.appendSnapshot({
            id: "step-2",
            timestamp: new Date().toISOString(),
            inputLatex: "5",
            outputLatex: "5",
            engineResponseStatus: "no-candidates",
            selectionPath: "root",
            selectionAstPath: "root"
        });

        const history = StepSnapshotStore.getSessionSnapshots();
        expect(history.length).toBe(2);
        expect(history[0].id).toBe("step-1");
        expect(history[0].stepIndex).toBe(0);
        expect(history[1].id).toBe("step-2");
        expect(history[1].stepIndex).toBe(1);
    });

    it("resets session history", () => {
        StepSnapshotStore.appendSnapshot({
            id: "step-1",
            timestamp: new Date().toISOString(),
            inputLatex: "2+3",
            engineResponseStatus: "step-applied"
        });

        StepSnapshotStore.resetSession();
        const history = StepSnapshotStore.getSessionSnapshots();
        expect(history.length).toBe(0);
    });
});

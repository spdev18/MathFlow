/**
 * TraceHub Backend Endpoint Tests
 * 
 * Tests for /debug/trace/latest, /debug/trace/download, /debug/trace/reset
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TraceHub } from "../src/debug/TraceHub.js";

describe("TraceHub Endpoints", () => {
    beforeEach(() => {
        TraceHub.reset();
    });

    describe("TraceHub Module", () => {
        it("starts with count 0 after reset", () => {
            expect(TraceHub.count()).toBe(0);
        });

        it("emits events and increments count", () => {
            TraceHub.emit({
                module: "test.module",
                event: "TEST_EVENT",
                data: { foo: "bar" }
            });
            expect(TraceHub.count()).toBe(1);
        });

        it("returns null for lastTraceId when empty", () => {
            expect(TraceHub.getLastTraceId()).toBeNull();
        });

        it("returns correct lastTraceId after emit", () => {
            TraceHub.setContext("test-trace-123", "step-1");
            TraceHub.emit({
                module: "test.module",
                event: "TEST_EVENT"
            });
            expect(TraceHub.getLastTraceId()).toBe("test-trace-123");
        });

        it("toJsonl returns proper JSONL format", () => {
            TraceHub.setContext("tr-001", null);
            TraceHub.emit({ module: "a", event: "E1" });
            TraceHub.emit({ module: "b", event: "E2" });

            const jsonl = TraceHub.toJsonl();
            const lines = jsonl.split("\n").filter(Boolean);

            expect(lines.length).toBe(2);
            const parsed0 = JSON.parse(lines[0]);
            expect(parsed0.module).toBe("a");
            expect(parsed0.event).toBe("E1");
            expect(parsed0.traceId).toBe("tr-001");
        });

        it("getLastN returns last N events", () => {
            TraceHub.emit({ module: "a", event: "E1" });
            TraceHub.emit({ module: "b", event: "E2" });
            TraceHub.emit({ module: "c", event: "E3" });

            const last2 = TraceHub.getLastN(2);
            expect(last2.length).toBe(2);
            expect(last2[0].module).toBe("b");
            expect(last2[1].module).toBe("c");
        });

        it("reset clears all events", () => {
            TraceHub.emit({ module: "a", event: "E1" });
            TraceHub.emit({ module: "b", event: "E2" });
            expect(TraceHub.count()).toBe(2);

            TraceHub.reset();
            expect(TraceHub.count()).toBe(0);
            expect(TraceHub.getLastTraceId()).toBeNull();
        });
    });
});

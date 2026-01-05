/**
 * TraceHub - Viewer-side tracing infrastructure
 * 
 * In-memory ring buffer for end-to-end debugging.
 * Correlated with backend via traceId.
 */

// ============================================================
// TRACE EVENT SCHEMA (matches backend)
// ============================================================

class ViewerTraceHub {
    constructor() {
        this.events = [];
        this.maxSize = 50000;
        this.currentTraceId = null;
    }

    /**
     * Generate a new trace ID for an apply attempt
     */
    generateTraceId() {
        this.currentTraceId = `tr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
        return this.currentTraceId;
    }

    /**
     * Get current trace ID
     */
    getTraceId() {
        return this.currentTraceId;
    }

    /**
     * Emit a trace event
     */
    emit(params) {
        const event = {
            ts: new Date().toISOString(),
            traceId: params.traceId || this.currentTraceId || "unknown",
            stepId: params.stepId || null,
            module: params.module || "viewer",
            level: params.level || "INFO",
            event: params.event,
            data: params.data || {},
        };

        // Ring buffer: remove oldest if at capacity
        if (this.events.length >= this.maxSize) {
            this.events.shift();
        }

        this.events.push(event);

        // Console log for development
        if (event.level === "INFO" || event.level === "DEBUG") {
            console.log(`[TraceHub] ${event.module}:${event.event} traceId=${event.traceId.substring(0, 8)}`);
        }
    }

    /**
     * Get the last N events
     */
    getLastN(n) {
        return this.events.slice(-n);
    }

    /**
     * Get all events for the current/last traceId
     */
    getByCurrentTrace() {
        if (!this.currentTraceId) return [];
        return this.events.filter(e => e.traceId === this.currentTraceId);
    }

    /**
     * Get all events
     */
    dump() {
        return [...this.events];
    }

    /**
     * Get event count
     */
    count() {
        return this.events.length;
    }

    /**
     * Clear all events
     */
    clear() {
        this.events = [];
        this.currentTraceId = null;
        console.log("[TraceHub] Buffer cleared");
    }

    /**
     * Export as JSONL string
     */
    toJsonl() {
        return this.events.map(e => JSON.stringify(e)).join("\n");
    }

    /**
     * Download trace as JSONL file
     */
    downloadJsonl() {
        const jsonl = this.toJsonl();
        const blob = new Blob([jsonl], { type: "application/x-ndjson" });
        const url = URL.createObjectURL(blob);
        const filename = `viewer-trace-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`[TraceHub] Downloaded ${this.events.length} events to ${filename}`);
    }

    /**
     * Get last trace summary for UI overlay
     */
    getLastTraceSummary() {
        const events = this.getByCurrentTrace();
        if (events.length === 0) return null;

        const summary = {
            traceId: this.currentTraceId,
            eventCount: events.length,
            events: events.slice(-10), // Last 10 events
            timing: {
                start: events[0]?.ts,
                end: events[events.length - 1]?.ts,
            },
        };

        // Extract key info from events
        for (const ev of events) {
            if (ev.event === "STEP_REQUEST") {
                summary.lastRequest = ev.data;
            }
            if (ev.event === "STEP_RESPONSE") {
                summary.lastResponse = ev.data;
            }
            if (ev.data?.chosenPrimitiveId) {
                summary.chosenPrimitiveId = ev.data.chosenPrimitiveId;
            }
            if (ev.data?.outputLatex) {
                summary.outputLatex = ev.data.outputLatex;
            }
        }

        return summary;
    }
}

// ============================================================
// SINGLETON & GLOBAL EXPOSURE
// ============================================================

const traceHub = new ViewerTraceHub();

// Expose globally for debugging
if (typeof window !== "undefined") {
    window.__traceHub = {
        emit: (params) => traceHub.emit(params),
        dump: () => traceHub.dump(),
        clear: () => traceHub.clear(),
        downloadJsonl: () => traceHub.downloadJsonl(),
        getLastN: (n) => traceHub.getLastN(n),
        getLastTraceSummary: () => traceHub.getLastTraceSummary(),
        count: () => traceHub.count(),
    };
}

export { traceHub, ViewerTraceHub };

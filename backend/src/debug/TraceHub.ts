/**
 * TraceHub.ts
 * 
 * Universal event tracing infrastructure for end-to-end debugging.
 * Ring buffer implementation to keep memory bounded.
 */

// ============================================================
// TRACE EVENT SCHEMA
// ============================================================

export type TraceLevel = "INFO" | "DEBUG" | "TRACE";

export type TraceEventType =
    | "CLICK"
    | "HINT_APPLY"
    | "RESOLVE_TARGET"
    | "STEP_REQUEST"
    | "CANDIDATES"
    | "DECISION"
    | "RUN_START"
    | "RUN_END"
    | "UI_RENDER"
    | "FILTER"
    | "ORCHESTRATOR_ENTER"
    | "ORCHESTRATOR_EXIT"
    | "PRIMITIVE_RESOLVE"
    | "STEPMASTER_DECIDE"
    | "LOCALITY_FILTER"
    | "ERROR";

export interface TraceEvent {
    ts: string;          // ISO timestamp
    traceId: string;     // Correlation ID per apply attempt
    stepId: string | null; // Backend step ID if available
    module: string;      // e.g., "backend.orchestrator"
    level: TraceLevel;
    event: TraceEventType | string;
    data: Record<string, unknown>;
}

// ============================================================
// RING BUFFER IMPLEMENTATION
// ============================================================

const MAX_EVENTS = 200_000;

class TraceHubStore {
    private events: TraceEvent[] = [];
    private maxSize: number = MAX_EVENTS;
    private currentTraceId: string | null = null;
    private currentStepId: string | null = null;

    /**
     * Set the current trace context (from incoming request)
     */
    setContext(traceId: string, stepId?: string | null) {
        this.currentTraceId = traceId;
        this.currentStepId = stepId ?? null;
    }

    /**
     * Clear the current trace context
     */
    clearContext() {
        this.currentTraceId = null;
        this.currentStepId = null;
    }

    /**
     * Emit a trace event
     */
    emit(params: {
        module: string;
        event: TraceEventType | string;
        level?: TraceLevel;
        data?: Record<string, unknown>;
        traceId?: string;
        stepId?: string | null;
    }) {
        const traceEvent: TraceEvent = {
            ts: new Date().toISOString(),
            traceId: params.traceId ?? this.currentTraceId ?? "unknown",
            stepId: params.stepId ?? this.currentStepId,
            module: params.module,
            level: params.level ?? "INFO",
            event: params.event,
            data: params.data ?? {},
        };

        // Ring buffer: remove oldest if at capacity
        if (this.events.length >= this.maxSize) {
            this.events.shift();
        }

        this.events.push(traceEvent);

        // Also log to console for development visibility
        if (traceEvent.level === "INFO" || traceEvent.level === "DEBUG") {
            console.log(`[TraceHub] ${traceEvent.module}:${traceEvent.event} traceId=${traceEvent.traceId.substring(0, 8)}`);
        }
    }

    /**
     * Get the last N events
     */
    getLastN(n: number): TraceEvent[] {
        return this.events.slice(-n);
    }

    /**
     * Get all events for a specific traceId
     */
    getByTraceId(traceId: string): TraceEvent[] {
        return this.events.filter(e => e.traceId === traceId);
    }

    /**
     * Get the last traceId used
     */
    getLastTraceId(): string | null {
        if (this.events.length === 0) return null;
        return this.events[this.events.length - 1].traceId;
    }

    /**
     * Get the last stepId used
     */
    getLastStepId(): string | null {
        for (let i = this.events.length - 1; i >= 0; i--) {
            if (this.events[i].stepId) {
                return this.events[i].stepId;
            }
        }
        return null;
    }

    /**
     * Get all events
     */
    dump(): TraceEvent[] {
        return [...this.events];
    }

    /**
     * Get event count
     */
    count(): number {
        return this.events.length;
    }

    /**
     * Clear all events
     */
    reset() {
        this.events = [];
        this.currentTraceId = null;
        this.currentStepId = null;
        console.log("[TraceHub] Buffer reset");
    }

    /**
     * Export as JSONL string
     */
    toJsonl(): string {
        return this.events.map(e => JSON.stringify(e)).join("\n");
    }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const TraceHub = new TraceHubStore();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Shortens a LaTeX string for logging (avoid huge outputs)
 */
export function shortLatex(latex: string, maxLen: number = 50): string {
    if (!latex) return "";
    if (latex.length <= maxLen) return latex;
    return latex.substring(0, maxLen) + "...";
}

/**
 * Generate a simple unique ID for tracing
 */
export function generateTraceId(): string {
    return `tr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

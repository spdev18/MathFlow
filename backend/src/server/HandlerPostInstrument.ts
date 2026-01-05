/**
 * Instrumentation endpoint for Stable-ID.
 *
 * Accepts LaTeX and returns instrumented LaTeX with \htmlData wrappers
 * for data-ast-id attributes.
 * 
 * This endpoint is the AUTHORITATIVE source of truth for AST node IDs.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { parseExpression, toInstrumentedLatex } from "../mapmaster/ast";

export interface InstrumentRequest {
    latex: string;
}

export interface InstrumentResponse {
    success: boolean;
    instrumentedLatex?: string;
    reason?: string;
    tokenCount?: number;
}

export async function handlePostInstrument(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown
): Promise<void> {
    const request = body as InstrumentRequest;

    if (!request || typeof request.latex !== "string") {
        sendJson(res, 400, {
            success: false,
            reason: "Invalid request: 'latex' string is required."
        } as InstrumentResponse);
        return;
    }

    try {
        // Parse LaTeX to AST using backend's authoritative parser
        const ast = parseExpression(request.latex);

        if (!ast) {
            console.log(`[INSTRUMENT] Parse failed for: "${request.latex}"`);
            sendJson(res, 200, {
                success: false,
                reason: "Failed to parse LaTeX expression"
            } as InstrumentResponse);
            return;
        }

        // Generate instrumented LaTeX with data-ast-id wrappers
        const instrumented = toInstrumentedLatex(ast, "root");

        if (!instrumented || instrumented.trim() === "") {
            sendJson(res, 200, {
                success: false,
                reason: "toInstrumentedLatex returned empty result"
            } as InstrumentResponse);
            return;
        }

        // Count tokens (htmlData occurrences)
        const tokenCount = (instrumented.match(/\\htmlData/g) || []).length;

        console.log(`[INSTRUMENT] Success: ${tokenCount} tokens instrumented`);
        console.log(`[INSTRUMENT] Input:  "${request.latex}"`);
        console.log(`[INSTRUMENT] Output: "${instrumented}"`);

        sendJson(res, 200, {
            success: true,
            instrumentedLatex: instrumented,
            tokenCount
        } as InstrumentResponse);

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[INSTRUMENT] Error: ${msg}`);
        sendJson(res, 500, {
            success: false,
            reason: `Internal error: ${msg}`
        } as InstrumentResponse);
    }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify(payload));
}

/**
 * Handler for Primitive Map Debug endpoint.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { parseExpression } from "../mapmaster/ast";
import { buildPrimitiveMap, PrimitiveMap } from "../engine/primitives/PrimitiveMapBuilder";

interface PrimitiveMapDebugRequest {
    expressionLatex: string;
    stage?: number; // optional, default 1
}

interface PrimitiveMapDebugResponse {
    status: "ok" | "error";
    errorMessage?: string;
    map?: PrimitiveMap;
}

export async function handlePostPrimitiveMapDebug(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown
): Promise<void> {
    try {
        const request = body as PrimitiveMapDebugRequest;

        const expressionLatex = request.expressionLatex;
        const stage = request.stage ?? 1;

        if (!expressionLatex || typeof expressionLatex !== "string") {
            sendJson(res, 400, {
                status: "error",
                errorMessage: "expressionLatex is required",
            });
            return;
        }

        // Reuse existing parsing pipeline:
        const ast = parseExpression(expressionLatex);

        if (!ast) {
            sendJson(res, 400, {
                status: "error",
                errorMessage: "Failed to parse expression",
            });
            return;
        }

        const primitiveMap = buildPrimitiveMap(ast, stage, expressionLatex);

        sendJson(res, 200, {
            status: "ok",
            map: primitiveMap,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sendJson(res, 500, {
            status: "error",
            errorMessage: `Failed to build primitive map: ${msg}`,
        });
    }
}

function sendJson(res: ServerResponse, statusCode: number, payload: PrimitiveMapDebugResponse) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
}

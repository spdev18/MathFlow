/**
 * AST Debug endpoint.
 *
 * This is a DEBUG/TOOLS ONLY endpoint used by viewer/debug-tool.html.
 * It exposes the internal AST structure and MUST NOT be used from the student-facing UI.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { parseExpression } from "../mapmaster/ast";
import type { AstDebugRequest, AstDebugResponse } from "../mapmaster/mapmaster.debug.types";

export async function handlePostAstDebug(
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown
): Promise<void> {
    const request = body as AstDebugRequest;

    if (!request || typeof request.latex !== "string") {
        sendJson(res, 400, {
            type: "error",
            message: "Invalid request: 'latex' string is required."
        } as AstDebugResponse);
        return;
    }

    try {
        const ast = parseExpression(request.latex);

        if (ast) {
            sendJson(res, 200, {
                type: "ok",
                ast: ast,
                message: "Parsed successfully"
            } as AstDebugResponse);
        } else {
            sendJson(res, 200, { // 200 OK but with error type, or 422? Spec says type="error"
                type: "error",
                message: "Parser returned null (parsing failed)"
            } as AstDebugResponse);
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        sendJson(res, 500, {
            type: "error",
            message: `Internal parser error: ${msg}`
        } as AstDebugResponse);
    }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload));
}

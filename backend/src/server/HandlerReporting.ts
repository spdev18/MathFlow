/**
 * HandlerReporting.ts
 *
 * Handles reporting and analytics endpoints.
 */

import { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { authService } from "../auth/auth.service";
import { SessionService } from "../session/session.service";

export async function handleGetStudentProgress(req: IncomingMessage, res: ServerResponse) {
    // 1. Parse URL and Query Params
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const studentId = url.searchParams.get("userId");

    if (!studentId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing userId query parameter" }));
        return;
    }

    // 2. Check Authorization Header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized: Missing or invalid token" }));
        return;
    }

    const tokenString = authHeader.split(" ")[1];
    const token = authService.validateToken(tokenString);

    // 3. Validate Token and Role
    if (!token) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Unauthorized: Invalid token" }));
        return;
    }

    if (token.role !== "teacher") {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden: Only teachers can view student progress" }));
        return;
    }

    // 4. Fetch Data from Session Service
    const sessions = await SessionService.findAllSessionsByUserId(studentId);

    // 5. Build Report
    let totalErrors = 0;
    const report = sessions.map(session => {
        const errorCount = session.history.entries.filter(e => !!e.errorCode).length;
        totalErrors += errorCount;

        return {
            sessionId: session.id,
            createdAt: session.createdAt,
            stepCount: session.history.entries.length,
            errorCount,
            lastExpression: session.history.entries.length > 0
                ? session.history.entries[session.history.entries.length - 1].expressionAfter
                : null
        };
    });

    // 6. Return Response
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
        studentId,
        totalSessions: sessions.length,
        totalErrors,
        sessions: report
    }));
}

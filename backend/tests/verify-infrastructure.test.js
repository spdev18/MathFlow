import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createEngineHttpServer } from "../src/server/engineHttpServer";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";
import { loadAllCoursesFromDir } from "../src/invariants/index";
import { logger } from "../src/logger";
const PORT = 4203; // Use a different port for testing
describe("Infrastructure Verification", () => {
    let server;
    let actualPort;
    beforeAll(async () => {
        const registry = loadAllCoursesFromDir({ path: "config/courses" });
        const policy = createDefaultStudentPolicy();
        const deps = {
            invariantRegistry: registry,
            policy,
            logger,
        };
        server = createEngineHttpServer({
            port: PORT,
            handlerDeps: deps,
            logger,
        });
        actualPort = await server.start();
    });
    afterAll(async () => {
        await server.stop();
    });
    it("GET /health returns 200 OK", async () => {
        const res = await fetch(`http://localhost:${actualPort}/health`);
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toBe("ok");
    });
    it("POST /api/entry-step with invalid JSON returns 400", async () => {
        const res = await fetch(`http://localhost:${actualPort}/api/entry-step`, {
            method: "POST",
            body: "invalid-json",
            headers: { "Content-Type": "application/json" },
        });
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.status).toBe("engine-error");
    });
    it("POST /api/entry-step with valid JSON returns 200", async () => {
        const res = await fetch(`http://localhost:${actualPort}/api/entry-step`, {
            method: "POST",
            body: JSON.stringify({
                expressionLatex: "1/2+1/2",
                sessionId: `infra-test-${Date.now()}`,
            }),
            headers: { "Content-Type": "application/json" },
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.status).toBe("step-applied"); // or whatever default status
    });
});

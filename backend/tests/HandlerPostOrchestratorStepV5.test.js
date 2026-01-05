import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { createEngineHttpServer } from "../src/server/engineHttpServer";
import { loadAllCoursesFromDir } from "../src/invariants/index";
import { createDefaultStudentPolicy } from "../src/stepmaster/index";
import { createPrimitiveMaster } from "../src/primitive-master/PrimitiveMaster";
import { createPrimitivePatternRegistry } from "../src/primitive-master/PrimitivePatterns.registry";
import { parseExpression } from "../src/mapmaster/ast";
import { InMemoryInvariantRegistry } from "../src/invariants/invariants.registry";
import { getStage1RegistryModel } from "../src/mapmaster/stage1-converter";
// Helper to make requests to our test server
async function postJson(port, path, body) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    // Try to parse error if json
                    try {
                        const err = JSON.parse(data);
                        reject(new Error(`Server returned ${res.statusCode}: ${JSON.stringify(err)}`));
                    }
                    catch {
                        reject(new Error(`Server returned ${res.statusCode}: ${data}`));
                    }
                    return;
                }
                resolve(JSON.parse(data));
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
    });
}
describe("HandlerPostOrchestratorStepV5", () => {
    let server;
    let port;
    let sessionId;
    beforeAll(async () => {
        // Unique session ID to ensure clean state
        sessionId = `test-http-session-${Date.now()}-${Math.random()}`;
        // Setup dependencies similarly to cliEngineHttpServer
        const fileRegistry = loadAllCoursesFromDir({ path: "config/courses" });
        const stage1Model = getStage1RegistryModel();
        const fileModel = {
            primitives: fileRegistry.getAllPrimitives(),
            invariantSets: fileRegistry.getAllInvariantSets()
        };
        const mergedPrimitives = [...fileModel.primitives];
        const seenPrimIds = new Set(fileModel.primitives.map(p => p.id));
        for (const prim of stage1Model.primitives) {
            if (!seenPrimIds.has(prim.id)) {
                mergedPrimitives.push(prim);
                seenPrimIds.add(prim.id);
            }
        }
        const mergedSets = [...fileModel.invariantSets];
        const defaultSetIndex = mergedSets.findIndex(s => s.id === "default");
        if (defaultSetIndex >= 0) {
            const defaultSet = mergedSets[defaultSetIndex];
            const allStage1Rules = stage1Model.invariantSets.flatMap(s => s.rules);
            const seenRuleIds = new Set(defaultSet.rules.map(r => r.id));
            for (const rule of allStage1Rules) {
                if (!seenRuleIds.has(rule.id)) {
                    defaultSet.rules.push(rule);
                    seenRuleIds.add(rule.id);
                }
            }
        }
        const registry = new InMemoryInvariantRegistry({
            model: { primitives: mergedPrimitives, invariantSets: mergedSets }
        });
        const primitiveMaster = createPrimitiveMaster({
            parseLatexToAst: async (latex) => parseExpression(latex),
            patternRegistry: createPrimitivePatternRegistry(),
            log: () => { },
        });
        server = createEngineHttpServer({
            port: 0, // Random port
            handlerDeps: {
                invariantRegistry: registry,
                policy: createDefaultStudentPolicy(),
                primitiveMaster,
                log: () => { }, // Quiet logs
            }
        });
        port = await server.start();
    });
    afterAll(async () => {
        await server.stop();
    });
    it("should handle P.INT_ADD (1 + 2) via HTTP", async () => {
        // Use unique session
        const localSessionId = sessionId + "-add";
        const body = {
            sessionId: localSessionId,
            courseId: "default",
            expressionLatex: "1 + 2",
            selectionPath: "root"
        };
        const result = await postJson(port, "/api/orchestrator/v5/step", body);
        expect(result.status).toBe("step-applied");
        expect(result.engineResult).toBeDefined();
        expect(result.engineResult.ok).toBe(true);
        expect(result.engineResult.newExpressionLatex).toBe("3");
    });
    it("should handle P.INT_DIV_TO_INT (4 : 2) via HTTP", async () => {
        // Use unique session
        const localSessionId = sessionId + "-div";
        const body = {
            sessionId: localSessionId,
            courseId: "default",
            expressionLatex: "4 : 2",
            selectionPath: "root"
        };
        const result = await postJson(port, "/api/orchestrator/v5/step", body);
        expect(result.status).toBe("step-applied");
        expect(result.engineResult.newExpressionLatex).toBe("2");
    });
    it("should handle P.INT_DIV_ZERO (5 : 0) gracefully via HTTP", async () => {
        // Use unique session
        const localSessionId = sessionId + "-error";
        const body = {
            sessionId: localSessionId,
            courseId: "default",
            expressionLatex: "5 : 0",
            selectionPath: "root"
        };
        const result = await postJson(port, "/api/orchestrator/v5/step", body);
        expect(["no-candidates", "engine-error"]).toContain(result.status);
    });
    it("should return 404 for unknown route", async () => {
        await expect(postJson(port, "/api/unknown/xyz", {})).rejects.toThrow();
    });
});

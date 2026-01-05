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
// Reuse helper (could be extracted but okay for now)
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
describe("HandlerPostPrimitiveMapDebug", () => {
    let server;
    let port;
    beforeAll(async () => {
        // Setup dependencies - same as other tests to ensure consistent environment
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
            port: 0,
            handlerDeps: {
                invariantRegistry: registry,
                policy: createDefaultStudentPolicy(),
                primitiveMaster,
                log: () => { },
            }
        });
        port = await server.start();
    });
    afterAll(async () => {
        await server.stop();
    });
    it("returns a Primitive Map for 1/7 + 3/7", async () => {
        const body = {
            expressionLatex: "1/7 + 3/7",
            stage: 1
        };
        const result = await postJson(port, "/api/primitive-map-debug", body);
        expect(result.status).toBe("ok");
        expect(result.map).toBeDefined();
        // Check that we found P.FRAC_ADD_SAME_DEN
        // The map entries correspond to operators.
        // 1/7 + 3/7 has one operator: +
        // We expect it to be ready.
        const entries = result.map.entries;
        const addEntry = entries.find((e) => e.primitiveId === "P.FRAC_ADD_SAME_DEN");
        expect(addEntry).toBeDefined();
        expect(addEntry.status).toBe("ready");
    });
});

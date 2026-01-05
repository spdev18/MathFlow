import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createEngineHttpServer } from '../src/server/engineHttpServer';
import { loadAllCoursesFromDir } from '../src/invariants/index';
import { createDefaultStudentPolicy } from '../src/stepmaster/index';
import { getStage1RegistryModel } from '../src/mapmaster/stage1-converter';
import { InMemoryInvariantRegistry } from '../src/invariants/invariants.registry';
import type { HandlerDeps } from '../src/server/HandlerPostEntryStep';
import http from 'http';

// Helper to make requests
function post(port: number, path: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: 'localhost',
            port,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
    });
}

describe('E2E: /api/entry-step Stage 1 Alignment', () => {
    let server: any;
    let port: number;

    beforeAll(async () => {
        // Setup registry exactly as in cliEngineHttpServer.ts
        const fileRegistry = loadAllCoursesFromDir({ path: 'config/courses' });
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
        const defaultSetIndex = mergedSets.findIndex(s => s.id === 'default');
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
            console.log('Merged Default Set Rules:', defaultSet.rules.map(r => r.id));
        }

        const finalRegistry = new InMemoryInvariantRegistry({
            model: {
                primitives: mergedPrimitives,
                invariantSets: mergedSets
            }
        });

        const deps: HandlerDeps = {
            invariantRegistry: finalRegistry,
            policy: createDefaultStudentPolicy(),
            log: (msg) => console.error('[TEST LOG]', msg),
        };

        server = createEngineHttpServer({ port: 0, handlerDeps: deps }); // Port 0 = random free port
        port = await server.start();
    });

    afterAll(async () => {
        await server.stop();
    });

    it('should return candidates for Stage 1 integer addition (2 + 3)', async () => {
        const sessionId = `test-session-${Date.now()}`;
        const response = await post(port, '/api/entry-step', {
            sessionId: sessionId,
            expressionLatex: '2 + 3',
            selectionPath: null // Global selection
        });

        expect(response.status).toBe('step-applied');
        expect(response.expressionLatex).toBe('5');
    });

    it.only('should return candidates for Stage 1 fraction addition (1/7 + 3/7)', async () => {
        const sessionId = `test-session-frac-${Date.now()}`;
        const response = await post(port, '/api/entry-step', {
            sessionId: sessionId,
            expressionLatex: '\\frac{1}{7} + \\frac{3}{7}',
            selectionPath: null
        });

        if (response.status === 'engine-error') {
            console.error('Engine Error Message:', response.message);
        }
        expect(response.status).toBe('step-applied');
        expect(response.expressionLatex).toBe('\\frac{4}{7}');
    });
});

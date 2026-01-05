import { describe, it, expect } from 'vitest';
import { createEngineHttpServer } from '../src/server/engineHttpServer';
const mockDeps = {
    stepMaster: {},
    mapMaster: {},
    sessionService: {},
    analytics: {}
};
describe('Step Debug Endpoint', () => {
    it('POST /api/step-debug returns step decision for valid input', async () => {
        const server = createEngineHttpServer({ port: 0, handlerDeps: mockDeps });
        const port = await server.start();
        const url = `http://localhost:${port}/api/step-debug`;
        const reqBody = {
            latex: '\\frac{1}{7} + \\frac{3}{7}',
            selection: { operatorIndex: 0 }
        };
        const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(reqBody)
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.type).toBe('ok');
        expect(body.result).toBeDefined();
        const result = body.result;
        expect(result.astSnapshot).toBeDefined();
        expect(result.map.candidates.length).toBeGreaterThan(0);
        // Verify StepMaster output
        expect(result.stepMasterOutput).toBeDefined();
        expect(result.stepMasterOutput.decision.status).toBe('chosen');
        expect(result.stepMasterOutput.decision.chosenCandidateId).toBeDefined();
        // Verify Session Update
        expect(result.updatedSession).toBeDefined();
        expect(result.updatedSession.entries.length).toBe(1);
        expect(result.updatedSession.entries[0].decisionStatus).toBe('chosen');
        await server.stop();
    });
    it('POST /api/step-debug handles no candidates gracefully', async () => {
        const server = createEngineHttpServer({ port: 0, handlerDeps: mockDeps });
        const port = await server.start();
        const url = `http://localhost:${port}/api/step-debug`;
        // Expression where no rule applies (e.g. single integer with no op selected, or just "1")
        // "1" has no binary op, so operatorIndex 0 might fail or return no candidates.
        // Let's use "1" and operatorIndex 0 (which won't exist).
        // Or "1 + 2" but select something invalid?
        // Actually, "1" with operatorIndex 0 will result in "no-anchor" or "invalid" selection.
        // MapMaster returns 0 candidates.
        const reqBody = {
            latex: '1',
            selection: { operatorIndex: 0 }
        };
        const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(reqBody)
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.type).toBe('ok');
        const result = body.result;
        // MapMaster should have 0 candidates
        expect(result.map.candidates.length).toBe(0);
        // StepMaster should return no-candidates
        expect(result.stepMasterOutput.decision.status).toBe('no-candidates');
        expect(result.stepMasterOutput.decision.chosenCandidateId).toBeNull();
        await server.stop();
    });
});

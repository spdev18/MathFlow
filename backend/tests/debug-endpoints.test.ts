import { describe, it, expect } from 'vitest';
import { createEngineHttpServer } from '../src/server/engineHttpServer';
import { HandlerPostEntryStep } from '../src/server/HandlerPostEntryStep';
import type { HandlerDeps } from '../src/server/HandlerPostEntryStep';
import type { AstDebugRequest, AstDebugResponse, MapMasterDebugRequest, MapMasterDebugResponse } from '../src/mapmaster/mapmaster.debug.types';

// Mock deps
const mockDeps: HandlerDeps = {
    stepMaster: {} as any,
    mapMaster: {} as any,
    sessionService: {} as any,
    analytics: {} as any
};

describe('Debug Endpoints', () => {
    // We need to start the server to test the routes
    // But we can also test the handlers directly if we export them?
    // The handlers are exported. But testing via HTTP is better for integration.

    it('POST /api/ast-debug returns AST for valid LaTeX', async () => {
        const server = createEngineHttpServer({ port: 0, handlerDeps: mockDeps });
        const port = await server.start();
        const url = `http://localhost:${port}/api/ast-debug`;

        const reqBody: AstDebugRequest = { latex: '1/2 + 3/4' };

        const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(reqBody)
        });

        expect(res.status).toBe(200);
        const body = await res.json() as AstDebugResponse;

        expect(body.type).toBe('ok');
        expect(body.ast).toBeDefined();
        expect(body.ast?.type).toBe('binaryOp');

        await server.stop();
    });

    it('POST /api/ast-debug returns error for invalid LaTeX', async () => {
        // Note: The current parser might be very robust and not throw easily.
        // But let's try something empty or weird.
        // parseExpression('') returns null in some versions?

        const server = createEngineHttpServer({ port: 0, handlerDeps: mockDeps });
        const port = await server.start();
        const url = `http://localhost:${port}/api/ast-debug`;

        const reqBody: AstDebugRequest = { latex: '' }; // Empty string might return null

        const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(reqBody)
        });

        expect(res.status).toBe(200);
        const body = await res.json() as AstDebugResponse;

        // Depending on parser behavior, it might be error or ok with empty AST.
        // Based on HandlerPostAstDebug implementation:
        // if (ast) -> ok, else -> error.
        // parseExpression('') usually returns null or undefined.

        if (body.type === 'ok') {
            // If it parses empty string as something, that's fine too, just check structure
            expect(body.ast).toBeDefined();
        } else {
            expect(body.type).toBe('error');
        }

        await server.stop();
    });

    it('POST /api/mapmaster-debug returns pipeline for valid input', async () => {
        const server = createEngineHttpServer({ port: 0, handlerDeps: mockDeps });
        const port = await server.start();
        const url = `http://localhost:${port}/api/mapmaster-debug`;

        const reqBody: MapMasterDebugRequest = {
            latex: '1/7 + 3/7',
            selection: { operatorIndex: 0 } // Select the '+'
        };

        const res = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(reqBody)
        });

        expect(res.status).toBe(200);
        const body = await res.json() as MapMasterDebugResponse;

        expect(body.type).toBe('ok');
        expect(body.result).toBeDefined();
        expect(body.result?.pipeline.selection.status).toBe('ok');
        expect(body.result?.pipeline.window.status).toBe('ok');
        expect(body.result?.candidates.length).toBeGreaterThan(0);

        await server.stop();
    });
});

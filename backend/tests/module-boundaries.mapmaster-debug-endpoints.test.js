import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
describe('MapMaster Module Boundaries', () => {
    const viewerAppDir = path.resolve(__dirname, '../../viewer/app');
    const debugToolPath = path.join(viewerAppDir, 'debug-tool.js');
    const mainViewerPath = path.join(viewerAppDir, 'main.js'); // Assuming main.js is the student viewer entry
    it('Dev Tool (debug-tool.js) uses debug endpoints and does NOT call /api/entry-step', () => {
        expect(fs.existsSync(debugToolPath)).toBe(true);
        const content = fs.readFileSync(debugToolPath, 'utf-8');
        // Allowed: Debug endpoints
        expect(content).toContain('/api/ast-debug');
        expect(content).toContain('/api/mapmaster-debug');
        expect(content).toContain('/api/step-debug');
        expect(content).toContain('/api/mapmaster-global-map');
        // Forbidden: Student endpoint (Dev Tool should not be playing steps)
        expect(content).not.toContain('/api/entry-step');
    });
    it('Student Viewer (main.js) does NOT call debug endpoints', () => {
        if (!fs.existsSync(mainViewerPath)) {
            console.warn(`Student viewer entry not found at ${mainViewerPath}. Skipping test.`);
            return;
        }
        const content = fs.readFileSync(mainViewerPath, 'utf-8');
        // Forbidden: Debug endpoints
        expect(content).not.toContain('/api/ast-debug');
        expect(content).not.toContain('/api/mapmaster-debug');
        expect(content).not.toContain('/api/step-debug');
        expect(content).not.toContain('/api/mapmaster-global-map');
    });
    it('Engine Adapter (engine-adapter.js) does NOT call debug endpoints', () => {
        const adapterPath = path.join(viewerAppDir, 'engine-adapter.js');
        if (!fs.existsSync(adapterPath)) {
            console.warn(`Engine adapter not found at ${adapterPath}. Skipping test.`);
            return;
        }
        const content = fs.readFileSync(adapterPath, 'utf-8');
        // Forbidden: Debug endpoints
        expect(content).not.toContain('/api/ast-debug');
        expect(content).not.toContain('/api/mapmaster-debug');
        expect(content).not.toContain('/api/step-debug');
        expect(content).not.toContain('/api/mapmaster-global-map');
    });
});

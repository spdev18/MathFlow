import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Frontend Debug Tool', () => {
    const viewerDir = path.resolve(__dirname, '../../viewer');
    const htmlPath = path.join(viewerDir, 'debug-tool.html');
    const jsPath = path.join(viewerDir, 'app/debug-tool.js');

    it('debug-tool.html exists and contains key elements', () => {
        expect(fs.existsSync(htmlPath)).toBe(true);
        const content = fs.readFileSync(htmlPath, 'utf-8');

        // Check for key UI elements
        expect(content).toContain('id="latex-input"');
        expect(content).toContain('id="selection-type"');
        expect(content).toContain('id="btn-ast-debug"');
        expect(content).toContain('id="btn-map-debug"');
        expect(content).toContain('id="btn-step-debug"');
        expect(content).toContain('id="btn-global-map"');
        expect(content).toContain('src="app/debug-tool.js"');
    });

    it('debug-tool.js exists and exports functions', () => {
        expect(fs.existsSync(jsPath)).toBe(true);
        const content = fs.readFileSync(jsPath, 'utf-8');

        // Check for exports
        expect(content).toContain('export function init()');
        expect(content).toContain('export async function callAstDebug');
        expect(content).toContain('export async function callMapMasterDebug');
        expect(content).toContain('export async function callStepDebug');
        expect(content).toContain('export async function callGlobalMapDebug');

        // Check for logic
        expect(content).toContain('fetch(`${DEBUG_API_BASE}/api/ast-debug`');
        expect(content).toContain('fetch(`${DEBUG_API_BASE}/api/mapmaster-debug`');
        expect(content).toContain('fetch(`${DEBUG_API_BASE}/api/step-debug`');
        expect(content).toContain('fetch(`${DEBUG_API_BASE}/api/mapmaster-global-map`');
    });
});

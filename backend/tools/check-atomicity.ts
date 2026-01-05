
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadAllCoursesFromDir } from '../src/invariants/invariants.course-loader';
import { createDefaultStudentPolicy } from '../src/stepmaster/index';
import { runOrchestratorStep, OrchestratorContext } from '../src/orchestrator/step.orchestrator';
import { SessionService } from '../src/session/session.service';
import { parseExpression } from '../src/mapmaster/ast';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestScenario {
    id: string;
    expression: string;
    selectionPath: string;
    expectedPrimitive?: string;
}

async function main() {
    console.log("Starting Atomicity Checker...");

    // 1. Load Matrix
    const matrixPath = resolve(__dirname, '../test_matrix.json');
    const matrix: TestScenario[] = JSON.parse(readFileSync(matrixPath, 'utf-8'));
    console.log(`Loaded ${matrix.length} scenarios from ${matrixPath}`);

    // 2. Init Registry & Context
    const coursesPath = resolve(__dirname, '../config/courses');
    const registry = loadAllCoursesFromDir({ path: coursesPath });
    const policy = createDefaultStudentPolicy();
    const ctx: OrchestratorContext = { invariantRegistry: registry, policy };

    // Mock SessionService
    SessionService.getHistory = async () => ({ entries: [] });
    SessionService.updateHistory = async () => { };

    console.log("--------------------------------------------------------------------------------");
    console.log("| ID                 | Primitive           | Atomicity | Status |");
    console.log("--------------------------------------------------------------------------------");

    let failed = false;

    for (const scenario of matrix) {
        // Parse operator index from selectionPath if it matches op-N
        let operatorIndex: number | undefined;
        if (scenario.selectionPath && scenario.selectionPath.startsWith('op-')) {
            const parts = scenario.selectionPath.split('-');
            if (parts.length === 2 && !isNaN(parseInt(parts[1]))) {
                operatorIndex = parseInt(parts[1]);
            }
        }

        // Run Step
        const req = {
            sessionId: 'atomicity-check',
            courseId: 'default',
            expressionLatex: scenario.expression,
            selectionPath: scenario.selectionPath,
            operatorIndex: operatorIndex,
            userRole: 'student' as const,
        };

        // Calculate AST size before
        const astBefore = parseExpression(scenario.expression);
        const sizeBefore = countNodes(astBefore);

        const result = await runOrchestratorStep(ctx, req);

        let primitiveId = "N/A";
        let status = "FAIL";
        let atomicity = "OK";

        if (result.status === 'step-applied' && result.engineResult?.ok) {
            // Check Primitive
            const trace = result.debugInfo?.trace;
            if (trace && trace.stepMaster.decision) {
                const chosenId = trace.stepMaster.decision;
                const candidate = trace.mapMaster.allCandidates.find((c: any) => c.id === chosenId) as any;
                if (candidate) {
                    // MapMasterCandidate has primitiveIds array
                    primitiveId = (candidate.primitiveIds && candidate.primitiveIds.length > 0)
                        ? candidate.primitiveIds[0]
                        : "unknown";
                }
            }

            // Check Expected Primitive
            if (scenario.expectedPrimitive && primitiveId !== scenario.expectedPrimitive) {
                status = `FAIL (Exp: ${scenario.expectedPrimitive})`;
                failed = true;
            } else {
                status = "PASS";
            }

            // Check AST Stability
            const astAfter = parseExpression(result.engineResult.newExpressionLatex!);
            const sizeAfter = countNodes(astAfter);
            const diff = Math.abs(sizeAfter - sizeBefore);

            if (diff > 5) {
                atomicity = "WARN: Jump";
            }

        } else {
            status = `ERR: ${result.status}`;
            failed = true;
        }

        console.log(`| ${scenario.id.padEnd(18)} | ${primitiveId.padEnd(19)} | ${atomicity.padEnd(9)} | ${status} |`);
    }

    console.log("--------------------------------------------------------------------------------");

    if (failed) {
        console.error("Atomicity Check FAILED.");
        process.exit(1);
    } else {
        console.log("Atomicity Check PASSED.");
        process.exit(0);
    }
}

function countNodes(ast: any): number {
    if (!ast) return 0;
    let count = 1;
    if (ast.args) {
        for (const arg of ast.args) count += countNodes(arg);
    }
    return count;
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});


/**
 * V5 Decision Core Smoke Test
 * 
 * Verifies that PrimitiveMaster + NodeContextBuilder + Matcher + Selector
 * correctly identify atomic steps, scenarios, and diagnostics.
 * 
 * Run with: npx ts-node scripts/v5-smoke-test.ts
 */

import { createPrimitiveMaster } from "../src/primitive-master/PrimitiveMaster";
import { parseExpression } from "../src/mapmaster/ast";

async function main() {
    console.log("=== V5 Decision Core Smoke Test ===\n");
    console.log("[INFO] Initializing PrimitiveMaster...");

    try {
        // Instantiate Master
        const master = createPrimitiveMaster({
            parseLatexToAst: async (latex) => parseExpression(latex),
            log: (msg) => console.log(`[MASTER LOG] ${msg}`)
        });

        let passed = 0;
        let failed = 0;
        let testCount = 0;

        // Helper function
        async function runTestCase(label: string, latex: string, opIndex: number, expectedId: string | null, expectedKind?: string) {
            testCount++;
            console.log(`\nTest #${testCount}: ${label}`);
            console.log(`  LaTeX: "${latex}", OpIndex: ${opIndex}`);

            try {
                const outcome = await master.resolvePrimitive({
                    expressionId: `test-${testCount}`,
                    expressionLatex: latex,
                    click: {
                        nodeId: "resolved-by-index",
                        kind: "operator", // Default assumption
                        operatorIndex: opIndex
                    }
                });

                const actualId = outcome.primitive?.id || null;
                const actualKind = outcome.kind;

                let success = true;

                // Check Primitive ID
                if (expectedId !== null) {
                    if (actualId !== expectedId) {
                        console.error(`  FAIL: Expected ID '${expectedId}', got '${actualId}'`);
                        success = false;
                    }
                } else {
                    if (actualId !== null) {
                        console.error(`  FAIL: Expected NO ID, got '${actualId}'`);
                        success = false;
                    }
                }

                // Check Kind (if specified)
                if (expectedKind && actualKind !== expectedKind) {
                    console.error(`  FAIL: Expected Kind '${expectedKind}', got '${actualKind}'`);
                    success = false;
                }

                if (success) {
                    console.log(`  PASS: Got '${actualId}' (${actualKind})`);
                    passed++;
                } else {
                    failed++;
                }

            } catch (e: any) {
                console.error(`  ERROR Executing Resolve: ${e.message}`);
                console.error(e);
                failed++;
            }
        }

        // --- Execute Tests ---

        console.log("[INFO] Starting Test Cases...");

        // 1. Integer Addition -> P.INT_ADD (Green)
        await runTestCase("Integer Addition", "1 + 2", 0, "P.INT_ADD", "green-primitive");
        console.log("[INFO] Finished Test 1");

        // 2. Fraction Same Denom -> P.FRAC_ADD_SAME_DEN (Green)
        // Note: 1/7 (idx0), + (idx1), 2/7 (idx2)
        await runTestCase("Fraction Same Denom", "1/7 + 2/7", 1, "P.FRAC_ADD_SAME_DEN", "green-primitive");
        console.log("[INFO] Finished Test 2");

        // 3. Fraction Diff Denom -> P.FRAC_ADD_COMMON_DEN (Scenario)
        // Matches "P.FRAC_ADD_COMMON_DEN" logic which is "Fractions" domain usually?
        // Let's assume the ID "P.FRAC_ADD_COMMON_DEN" exists or "P.FRAC_ADD_DIFF_PREP".
        // Based on previous conversations, it might be "P.FRAC_ADD_COMMON_DEN".
        // We will accept failure on ID if name matches, but important is "yellow-scenario".
        await runTestCase("Fraction Diff Denom", "1/2 + 1/3", 1, "P.FRAC_ADD_COMMON_DEN", "yellow-scenario");
        console.log("[INFO] Finished Test 3");

        // 4. Division by Zero -> P.DIV_BY_ZERO (Red)
        await runTestCase("Division by Zero", "5 / 0", 1, "P.DIV_BY_ZERO", "red-diagnostic");
        console.log("[INFO] Finished Test 4");

        // 5. No Candidate -> "no-candidates"
        // Try invalid op or unsupported context
        await runTestCase("Unsupported Op", "1 ^ 2", 1, null, "no-candidates");
        console.log("[INFO] Finished Test 5");

        // Report
        console.log(`\n=== SUMMARY: ${passed} Passed, ${failed} Failed ===`);

        if (failed > 0) {
            console.log("[EXIT] Exiting with code 1 due to failures.");
            process.exit(1);
        } else {
            console.log("[EXIT] Exiting with code 0 (Success).");
            process.exit(0);
        }

    } catch (err: any) {
        console.error("\n[FATAL ERROR]", err);
        process.exit(1);
    }
}

// Start
main();

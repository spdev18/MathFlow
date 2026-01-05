#!/usr/bin/env node
/**
 * P1 INT_TO_FRAC Smoke Test
 * 
 * Tests the backend /api/orchestrator/v5/step endpoint directly
 * to verify P.INT_TO_FRAC works for:
 * - Single integer "6" -> "\frac{6}{1}"
 * - Compound expression "2+3" -> "\frac{2}{1}+3" (convert left integer only)
 */

const BASE_URL = "http://localhost:4201";

async function testIntToFrac(description, payload) {
    console.log("\n" + "=".repeat(60));
    console.log(`TEST: ${description}`);
    console.log("=".repeat(60));

    console.log("\n📤 REQUEST PAYLOAD:");
    console.log(JSON.stringify(payload, null, 2));

    try {
        const res = await fetch(`${BASE_URL}/api/orchestrator/v5/step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const json = await res.json();

        console.log("\n📥 RESPONSE:");
        console.log(`  HTTP Status: ${res.status}`);
        console.log(`  Response Status: ${json.status}`);
        console.log(`  Chosen Primitive: ${json.debugInfo?.chosenPrimitiveId || json.chosenPrimitiveId || "N/A"}`);
        console.log(`  Output LaTeX: ${json.output?.expressionLatex || json.newExpressionLatex || "N/A"}`);

        if (json.error || json.message) {
            console.log(`  ⚠️ Error/Message: ${json.error || json.message}`);
        }

        if (json.debugInfo) {
            console.log("\n  Debug Info:");
            console.log(`    - targetNodeId: ${json.debugInfo.targetNodeId || "N/A"}`);
            console.log(`    - candidateCount: ${json.debugInfo.candidateCount ?? "N/A"}`);
        }

        // Full response for debugging
        console.log("\n📄 FULL RESPONSE JSON:");
        console.log(JSON.stringify(json, null, 2));

        return json;
    } catch (err) {
        console.error("\n❌ FETCH ERROR:", err.message);
        return null;
    }
}

async function discoverChoicesForInteger(expressionLatex, selectionPath) {
    console.log("\n" + "-".repeat(60));
    console.log(`DISCOVERY: Getting choices for "${expressionLatex}" at "${selectionPath}"`);
    console.log("-".repeat(60));

    const payload = {
        sessionId: "smoke-test",
        expressionLatex: expressionLatex,
        selectionPath: selectionPath,
        surfaceNodeKind: "Num",
        userRole: "student",
        courseId: "default"
        // Note: NO preferredPrimitiveId to get choice list
    };

    try {
        const res = await fetch(`${BASE_URL}/api/orchestrator/v5/step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const json = await res.json();

        console.log(`  Status: ${json.status}`);
        if (json.choices && json.choices.length > 0) {
            console.log(`  Choices (${json.choices.length}):`);
            json.choices.forEach((c, i) => {
                console.log(`    [${i}] ${c.primitiveId} - ${c.label} (target: ${c.targetNodeId || "N/A"})`);
            });
            return json.choices;
        } else {
            console.log("  No choices returned");
            return [];
        }
    } catch (err) {
        console.error("  Fetch error:", err.message);
        return [];
    }
}

async function main() {
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║         P.INT_TO_FRAC BACKEND SMOKE TEST                 ║");
    console.log("╚══════════════════════════════════════════════════════════╝");
    console.log(`\nBackend URL: ${BASE_URL}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);

    // Test 1: Single integer "6"
    console.log("\n\n▶ TEST CASE 1: Single integer '6'");

    // First discover what choices are available
    await discoverChoicesForInteger("6", "root");

    // Then try applying INT_TO_FRAC
    const result1 = await testIntToFrac(
        "Single integer '6' -> should become \\frac{6}{1}",
        {
            sessionId: "smoke-test-1",
            expressionLatex: "6",
            selectionPath: "root",
            surfaceNodeKind: "Num",
            preferredPrimitiveId: "P.INT_TO_FRAC",
            userRole: "student",
            courseId: "default"
        }
    );

    // Check result
    const expectedLatex1 = "\\frac{6}{1}";
    if (result1 && result1.status === "step-applied") {
        const outputLatex = result1.output?.expressionLatex || result1.newExpressionLatex;
        if (outputLatex === expectedLatex1) {
            console.log("\n✅ TEST 1 PASSED: Output matches expected");
        } else {
            console.log(`\n⚠️ TEST 1 PARTIAL: Got "${outputLatex}", expected "${expectedLatex1}"`);
        }
    } else {
        console.log("\n❌ TEST 1 FAILED: Did not get step-applied status");
    }

    // Test 2: Compound expression "2+3"
    console.log("\n\n▶ TEST CASE 2: Compound expression '2+3' - convert left integer");

    // First discover what choices are available for term[0]
    await discoverChoicesForInteger("2+3", "term[0]");

    // Then try applying INT_TO_FRAC
    const result2 = await testIntToFrac(
        "Compound '2+3' with term[0] -> should become \\frac{2}{1}+3",
        {
            sessionId: "smoke-test-2",
            expressionLatex: "2+3",
            selectionPath: "term[0]",
            surfaceNodeKind: "Num",
            preferredPrimitiveId: "P.INT_TO_FRAC",
            userRole: "student",
            courseId: "default"
        }
    );

    // Check result
    const expectedLatex2 = "\\frac{2}{1}+3";
    if (result2 && result2.status === "step-applied") {
        const outputLatex = result2.output?.expressionLatex || result2.newExpressionLatex;
        if (outputLatex === expectedLatex2) {
            console.log("\n✅ TEST 2 PASSED: Output matches expected");
        } else {
            console.log(`\n⚠️ TEST 2 PARTIAL: Got "${outputLatex}", expected "${expectedLatex2}"`);
        }
    } else {
        console.log("\n❌ TEST 2 FAILED: Did not get step-applied status");
    }

    console.log("\n\n" + "═".repeat(60));
    console.log("SMOKE TEST COMPLETE");
    console.log("═".repeat(60));
}

main().catch(console.error);

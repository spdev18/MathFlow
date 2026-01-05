// main.js
// Demo: canonical KaTeX formula + SurfaceNodeMap + interactive hover/click.

import { buildSurfaceNodeMap, surfaceMapToSerializable, enhanceSurfaceMap, correlateOperatorsWithAST, hitTestPoint, getOperandNodes } from "./surface-map.js";
import { instrumentLatex } from "./ast-parser.js";
import { HintCycle } from "./hint-cycle.js";
import { createOperatorContext, isCompleteContext, getContextBoundingBoxes } from "./operator-selection-context.js";

// Expose hitTestPoint globally for coordinate-based hit-testing
if (typeof window !== "undefined") {
  window.__surfaceMapUtils = { hitTestPoint };
}
import { DisplayAdapter, ClientEventRecorder } from "./display-adapter.js";
import { FileBus } from "./filebus.js";
import { EngineAdapter } from "./engine-adapter.js";
import { runV5Step } from "./client/orchestratorV5Client.js";

// ============================================================
// UNIFIED ENGINE BASE URL UTILITY
// ============================================================
// Single source of truth for backend base URL
function getEngineBaseUrl() {
  if (typeof window !== "undefined" && window.__v5EndpointUrl) {
    // Extract base from full URL like "http://localhost:4201/api/orchestrator/v5/step"
    const url = window.__v5EndpointUrl;
    const match = url.match(/^(https?:\/\/[^/]+)/);
    return match ? match[1] : "http://localhost:4201";
  }
  return "http://localhost:4201";
}

// Expose globally for debug tools
if (typeof window !== "undefined") {
  window.getEngineBaseUrl = getEngineBaseUrl;
}


// Test suite (6 distinct LaTeX expressions)
const TESTS = [
  // T14: fraction addition same denominator
  String.raw`\frac{1}{7} + \frac{3}{7}`,
  // T15: fraction subtraction same denominator
  String.raw`\frac{5}{9} - \frac{2}{9}`,
  // T0: simple integers
  String.raw`2+3`,
  // T1: simple fractions
  String.raw`\frac{1}{3}+\frac{2}{5}`,
  // T2: nested fraction
  String.raw`\frac{1}{1+\frac{1}{2}}`,
  // T3: unary minus + brackets
  String.raw`-\left(\frac{3}{4}-\frac{1}{8}\right)`,
  // T4: decimals
  String.raw`12.5 + 0.75 - 3.125`,
  // T5: mixed numbers
  String.raw`1\frac{2}{3} + 2\frac{1}{5}`,
  // T6: two integer operations
  String.raw`2 + 3 - 1`,
  // T7: three fractions
  String.raw`\frac{1}{2} + \frac{1}{3} + \frac{1}{6}`,
  // T8: brackets + multiply
  String.raw`\left(1-\frac{1}{3}\right)\cdot\frac{3}{4}`,
  // T9: subtraction with inner sum
  String.raw`\frac{2}{5} - \left(\frac{1}{10}+\frac{3}{20}\right)`,
  // T10: two bracketed groups
  String.raw`\left(\frac{1}{2}+\frac{2}{3}\right)-\left(\frac{3}{4}-\frac{1}{5}\right)`,
  // T11: mixed decimals & fractions
  String.raw`1.2 + \frac{3}{5} - 0.4`,
  // T12: stress nested
  String.raw`\frac{1}{2} + \left(\frac{3}{4} - \frac{1}{1+\frac{1}{2}}\right)`,
  // T13: extra mix
  String.raw`\left(\frac{5}{6} - \frac{1}{3}\right) + \frac{7}{8}`,
];

let currentLatex = TESTS[0];

let current = null;
let lastHoverNode = null;

// Selection engine state
const selectionState = {
  mode: "none",           // "none" | "single" | "multi" | "rect"
  primaryId: null,
  selectedIds: new Set(),
};

// SMART OPERATOR SELECTION: State for operator + operands highlighting
const operatorSelectionState = {
  active: false,                    // Whether operator selection is currently active
  validationType: null,             // "direct" (GREEN) | "requires-prep" (YELLOW)
  context: null,                    // OperatorSelectionContext from operator-selection-context.js
  boxes: [],                        // Array of bounding boxes to highlight
};

// P1: 3-MODE HINT CYCLE STATE MACHINE
// Mode 0 = GREEN (selection only, no apply)
// Mode 1 = ORANGE (P.INT_TO_FRAC)
// Mode 2 = BLUE (P.ONE_TO_TARGET_DENOM for Step2)
const MODE_GREEN = 0;
const MODE_ORANGE = 1;
const MODE_BLUE = 2;

// Mode configurations (independent of primitives array)
const MODE_CONFIG = [
  { mode: MODE_GREEN, color: "#4CAF50", label: "Selected", primitiveId: null },
  { mode: MODE_ORANGE, color: "#FF9800", label: "Convert to fraction", primitiveId: "P.INT_TO_FRAC" },
  { mode: MODE_BLUE, color: "#2196F3", label: "Convert 1 → target denom", primitiveId: "P.ONE_TO_TARGET_DENOM" }
];

const integerCycleState = {
  selectedNodeId: null,      // surfaceNodeId of currently selected integer
  astNodeId: null,           // AST path of selected integer
  stableKey: null,           // StableTokenKey for deduplication (astId|role|operator)
  mode: MODE_GREEN,          // Current mode: 0=GREEN, 1=ORANGE, 2=BLUE
  isStep2Context: false,     // True if this integer is a Step2 multiplier-1
  step2Info: null,           // { side, oppositeDenom } for Step2
  // Legacy primitives array for ensureP1IntegerContext compatibility
  primitives: [
    { id: "P.INT_TO_FRAC", label: "Convert to fraction", color: "#4CAF50" },
    { id: "P.INT_FACTOR_PRIMES", label: "Factor to primes", color: "#FF9800" },
  ],
  cycleIndex: 0,             // Keep for compatibility, will be derived from mode
  // Double-click detection state
  pendingClickTimeout: null,
  lastClickTime: 0,
  lastClickNodeId: null,
  dblclickLockUntil: 0,      // Timestamp: suppress cycling until this time (for dblclick)
};

// P1: Prevent re-entry while hint apply is in progress
const hintApplyState = { applying: false };

// FIX: Per-token mode storage to prevent left/right "1" sharing state
// Key: stableKey (e.g., "term[0].term[1]|number|"), Value: { mode, isStep2Context, step2Info }
const perTokenModeMap = new Map();

/**
 * Save current token's mode state to perTokenModeMap
 */
function saveTokenModeState() {
  const key = integerCycleState.stableKey;
  if (!key) return;
  perTokenModeMap.set(key, {
    mode: integerCycleState.mode,
    isStep2Context: integerCycleState.isStep2Context,
    step2Info: integerCycleState.step2Info ? { ...integerCycleState.step2Info } : null
  });
  console.log(`[STEP2-BLUE-TRACE] Saved mode=${integerCycleState.mode} for stableKey="${key}"`);
}

/**
 * Restore token's mode state from perTokenModeMap, or default to GREEN
 * @param {string} stableKey
 * @returns {{ mode: number, isStep2Context: boolean, step2Info: object|null }}
 */
function restoreTokenModeState(stableKey) {
  if (!stableKey || !perTokenModeMap.has(stableKey)) {
    return { mode: MODE_GREEN, isStep2Context: false, step2Info: null };
  }
  const saved = perTokenModeMap.get(stableKey);
  console.log(`[STEP2-BLUE-TRACE] Restored mode=${saved.mode} for stableKey="${stableKey}"`);
  return saved;
}

/**
 * Clear all per-token mode state (on expression change)
 */
function clearAllTokenModeState() {
  perTokenModeMap.clear();
  console.log(`[STEP2-BLUE-TRACE] Cleared perTokenModeMap (expression changed)`);
}

/**
 * SINGLE GATEWAY for all apply actions (hint click, double-click)
 * Reads mode from state at call time - no captured parameters.
 * @param {string} logPrefix - "[HINT-APPLY]" or "[DOUBLE-CLICK APPLY]"
 */
async function applyCurrentHintForStableKey(logPrefix = "[HINT-APPLY]") {
  // Read state at call time
  const currentMode = integerCycleState.mode;
  const currentStableKey = integerCycleState.stableKey;
  const currentAstId = integerCycleState.astNodeId;
  const currentSurfaceId = integerCycleState.selectedNodeId;
  // MODE 0 (GREEN) normally = selection only, no apply.
  // BUT: user expectation for P1 integers is that DOUBLE-CLICK in GREEN applies INT_TO_FRAC
  // (unless this is a protected Step2 multiplier-1 token).
  if (currentMode === MODE_GREEN) {
    const isStep2 = !!integerCycleState.isStep2Context;
    const isDoubleClickApply = (typeof logPrefix === "string") && logPrefix.indexOf("DOUBLE-CLICK") >= 0;

    if (isDoubleClickApply && !isStep2) {
      console.log(`[GREEN-DBLCLICK] Treat GREEN as ORANGE for P1: stableKey=${currentStableKey} -> primitive=P.INT_TO_FRAC`);
      // Override primitive for this apply
      // (keeps UI in GREEN, but performs the expected conversion)
      // NOTE: primitiveId is defined below from MODE_CONFIG; we override later too.
    } else {
      console.log(`[APPLY BLOCKED] stableKey=${currentStableKey} mode=0 (GREEN) - selection only`);
      return { applied: false, reason: "mode-0" };
    }
  }

  // Prevent re-entry
  if (hintApplyState.applying) {
    console.log(`${logPrefix} Ignored: already applying`);
    return { applied: false, reason: "re-entry" };
  }

  // Get primitiveId from MODE_CONFIG
  const modeConfig = MODE_CONFIG[currentMode];
  let primitiveId = modeConfig?.primitiveId;


  // If GREEN + DOUBLE-CLICK and not Step2: allow P1 INT_TO_FRAC apply.
  if (currentMode === MODE_GREEN) {
    const isStep2 = !!integerCycleState.isStep2Context;
    const isDoubleClickApply = (typeof logPrefix === "string") && logPrefix.indexOf("DOUBLE-CLICK") >= 0;
    if (isDoubleClickApply && !isStep2) {
      primitiveId = "P.INT_TO_FRAC";
    }
  }

  // Part C: Block ORANGE mode for multiplier-1 tokens (prevents killing Step2)
  if (currentMode === MODE_ORANGE && integerCycleState.isStep2Context) {
    console.log(`[APPLY BLOCKED] stableKey=${currentStableKey} mode=1 (ORANGE) - multiplier-1 cannot use INT_TO_FRAC (would kill Step2)`);
    return { applied: false, reason: "multiplier-1-protected" };
  }

  // For BLUE mode with Step2 info, ensure correct primitive
  if (currentMode === MODE_BLUE && integerCycleState.step2Info) {
    primitiveId = "P.ONE_TO_TARGET_DENOM";
  }

  if (!primitiveId) {
    console.warn(`${logPrefix} BLOCKED: No primitiveId for mode=${currentMode}`);
    return { applied: false, reason: "no-primitive" };
  }

  // Log target denom for BLUE mode
  const targetDenom = (currentMode === MODE_BLUE && integerCycleState.step2Info)
    ? integerCycleState.step2Info.oppositeDenom : null;
  console.log(`${logPrefix} stableKey=${currentStableKey} astId=${currentAstId} mode=${currentMode} primitive=${primitiveId}${targetDenom ? ` targetDenom=${targetDenom}` : ''}`);

  hintApplyState.applying = true;

  try {
    // Get endpoint
    const endpointUrl = (typeof window !== "undefined" && window.__v5EndpointUrl)
      ? window.__v5EndpointUrl
      : "/api/orchestrator/v5/step";

    const v5Payload = {
      sessionId: "default-session",
      expressionLatex: typeof currentLatex === "string" ? currentLatex : "",
      selectionPath: currentAstId || "root",
      preferredPrimitiveId: primitiveId,
      courseId: "default",
      userRole: "student",
      surfaceNodeKind: "Num",
    };

    console.log(`[VIEWER-REQUEST] preferredPrimitiveId=${primitiveId} selectionPath=${currentAstId || "root"}`);

    const result = await runV5Step(endpointUrl, v5Payload, 8000);

    console.log(`[APPLY RESULT] status=${result.status}`);

    if (result.status === "step-applied" && result.engineResult?.newExpressionLatex) {
      const newLatex = result.engineResult.newExpressionLatex;
      console.log(`[APPLY RESULT] SUCCESS! newLatex=${newLatex}`);
      currentLatex = newLatex;
      renderFormula();
      buildAndShowMap();
      clearSelection("latex-changed");
      return { applied: true, newLatex };
    } else {
      console.warn(`[APPLY RESULT] FAILED status=${result.status}`);
      return { applied: false, reason: result.status };
    }
  } catch (err) {
    console.error(`${logPrefix} Exception:`, err);
    return { applied: false, reason: "exception", error: err };
  } finally {
    hintApplyState.applying = false;
  }
}

// STABLE-ID: Track whether instrumentation succeeded for current formula
// When disabled, precise click actions (numbers/operators) are blocked
const stableIdState = {
  enabled: false,        // Whether Stable-ID is active for current expression
  reason: null,          // Reason for failure if disabled
  lastExpression: null   // Track which expression this state applies to
};

// P1 double-click threshold in milliseconds
const P1_DOUBLE_CLICK_THRESHOLD = 350;

// P1: Diagnostics panel state
const p1DiagnosticsState = {
  currentLatex: "",
  selectedSurfaceNodeId: "N/A",
  resolvedAstNodeId: "N/A",
  primitiveId: "N/A",
  hintClickBlocked: "N/A",
  lastTestResult: "N/A",

  // Choice fetch (integer click) diagnostics
  lastChoiceStatus: "N/A",
  lastChoiceTargetPath: "N/A",
  lastChoiceCount: "0",

  // Hint-apply diagnostics (green hint click / double-click)
  lastHintApplyStatus: "N/A",
  lastHintApplySelectionPath: "N/A",
  lastHintApplyPreferredPrimitiveId: "N/A",
  lastHintApplyEndpoint: "N/A",
  lastHintApplyNewLatex: "N/A",
  lastHintApplyError: "N/A"
};

// P1: Create and update diagnostics panel (bottom-left)
function createP1DiagnosticsPanel() {
  let panel = document.getElementById("p1-diagnostics-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "p1-diagnostics-panel";
    panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.85);
      color: #0f0;
      font-family: monospace;
      font-size: 11px;
      border-radius: 4px;
      z-index: 10000;
      max-width: 400px;
      white-space: pre-wrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(panel);
  }
  return panel;
}

function updateP1Diagnostics(updates = {}) {
  Object.assign(p1DiagnosticsState, updates);
  if (typeof currentLatex !== "undefined") {
    p1DiagnosticsState.currentLatex = currentLatex;
  }

  const panel = createP1DiagnosticsPanel();
  const astColorClass = p1DiagnosticsState.resolvedAstNodeId === "MISSING" ? "color: red;" : "color: lime;";

  panel.innerHTML = `
<b>P1 HINT DIAGNOSTICS</b>
─────────────────────
currentLatex: <span style="color: cyan;">${escapeHtml(p1DiagnosticsState.currentLatex || "N/A")}</span>
surfaceNodeId: <span style="color: yellow;">${p1DiagnosticsState.selectedSurfaceNodeId}</span>
astNodeId: <span style="${astColorClass}">${p1DiagnosticsState.resolvedAstNodeId}</span>
primitiveId: <span style="color: orange;">${p1DiagnosticsState.primitiveId}</span>
hintClickBlocked: <span style="color: magenta;">${p1DiagnosticsState.hintClickBlocked}</span>
lastTestResult: <span style="color: ${p1DiagnosticsState.lastTestResult === "PASS" ? "lime" : (p1DiagnosticsState.lastTestResult === "N/A" ? "white" : "red")};">${p1DiagnosticsState.lastTestResult}</span>

<b>CHOICE FETCH</b>
choiceStatus: <span style="color: ${p1DiagnosticsState.lastChoiceStatus === "choice" ? "lime" : "white"};">${p1DiagnosticsState.lastChoiceStatus}</span>
choiceTargetPath: <span style="color: cyan;">${p1DiagnosticsState.lastChoiceTargetPath}</span>
choiceCount: <span style="color: cyan;">${p1DiagnosticsState.lastChoiceCount}</span>

<b>HINT APPLY</b>
applyStatus: <span style="color: ${p1DiagnosticsState.lastHintApplyStatus === "step-applied" ? "lime" : (p1DiagnosticsState.lastHintApplyStatus === "RUNNING" ? "yellow" : (p1DiagnosticsState.lastHintApplyStatus === "N/A" ? "white" : "red"))};">${p1DiagnosticsState.lastHintApplyStatus}</span>
applySelectionPath: <span style="color: cyan;">${p1DiagnosticsState.lastHintApplySelectionPath}</span>
applyPreferredPrimitiveId: <span style="color: cyan;">${p1DiagnosticsState.lastHintApplyPreferredPrimitiveId}</span>
applyEndpoint: <span style="color: cyan;">${escapeHtml(p1DiagnosticsState.lastHintApplyEndpoint || "N/A")}</span>
applyNewLatex: <span style="color: cyan;">${escapeHtml(p1DiagnosticsState.lastHintApplyNewLatex || "N/A")}</span>
applyError: <span style="color: red;">${escapeHtml(p1DiagnosticsState.lastHintApplyError || "N/A")}</span>
`.trim();
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// P1: Self-test function (can be triggered from console: window.runP1SelfTest())
async function runP1SelfTest() {
  console.log("[P1-SELF-TEST] Starting self-test...");
  updateP1Diagnostics({ lastTestResult: "RUNNING..." });

  // Save current state
  const originalLatex = currentLatex;

  // Set test expression
  currentLatex = "2+3";
  renderFormula();
  buildAndShowMap();
  await new Promise(r => setTimeout(r, 300));

  // Simulate clicking "2" (first integer)
  const map = window.__currentSurfaceMap;
  if (!map || !map.atoms) {
    console.error("[P1-SELF-TEST] FAIL: No surface map available");
    updateP1Diagnostics({ lastTestResult: "FAIL: No surface map" });
    return;
  }

  const firstNum = map.atoms.find(n => n.kind === "Num");
  if (!firstNum) {
    console.error("[P1-SELF-TEST] FAIL: No Num node found");
    updateP1Diagnostics({ lastTestResult: "FAIL: No Num node" });
    return;
  }

  // Select the integer
  integerCycleState.selectedNodeId = firstNum.id;
  integerCycleState.astNodeId = firstNum.astNodeId;
  integerCycleState.cycleIndex = 0; // GREEN mode
  applyIntegerHighlight(firstNum.id, 0);
  await new Promise(r => setTimeout(r, 300));

  // Apply P1 action (simulating hint click)
  await applyP1Action(firstNum.id, firstNum.astNodeId, 0);
  await new Promise(r => setTimeout(r, 500));

  // Check result
  const expected = "\\frac{2}{1}+3";
  const passed = currentLatex === expected;

  if (passed) {
    console.log("[P1-SELF-TEST] PASS: Expression correctly converted to", currentLatex);
    updateP1Diagnostics({ lastTestResult: "PASS" });
  } else {
    console.error("[P1-SELF-TEST] FAIL: Expected", expected, "but got", currentLatex);
    updateP1Diagnostics({ lastTestResult: `FAIL: got "${currentLatex}"` });
  }

  // Restore original
  currentLatex = originalLatex;
  renderFormula();
  buildAndShowMap();
  resetIntegerCycleState();

  return passed;
}

// Expose self-test globally
if (typeof window !== "undefined") {
  window.runP1SelfTest = runP1SelfTest;
}

/**
 * P1 Order-Independence Test
 * Tests that INT_TO_FRAC applies correctly to each integer regardless of click order.
 * Usage: window.runP1OrderTest() or window.runP1OrderTest("right-to-left")
 */
async function runP1OrderTest(order = "left-to-right") {
  console.log(`[P1-ORDER-TEST] Starting order-independence test (${order})...`);

  const originalLatex = currentLatex;
  const results = [];

  // Set test expression
  currentLatex = "2+3-1-1";
  renderFormula();
  buildAndShowMap();
  await new Promise(r => setTimeout(r, 300));

  const map = window.__currentSurfaceMap;
  if (!map || !map.atoms) {
    console.error("[P1-ORDER-TEST] FAIL: No surface map available");
    return { passed: false, error: "No surface map" };
  }

  // Get all Num nodes sorted by position
  let nums = map.atoms.filter(n => n.kind === "Num" && n.astNodeId);
  nums.sort((a, b) => (a.bbox.left - b.bbox.left));

  if (order === "right-to-left") {
    nums = nums.reverse();
  }

  console.log(`[P1-ORDER-TEST] Found ${nums.length} integers in ${order} order:`);
  nums.forEach((n, i) => {
    console.log(`  [${i}] surfaceId=${n.id}, astNodeId=${n.astNodeId}, value=${n.latexFragment || n.text}`);
  });

  // Apply INT_TO_FRAC to each integer in order
  for (let i = 0; i < nums.length; i++) {
    const num = nums[i];
    const beforeLatex = currentLatex;

    console.log(`[P1-ORDER-TEST] Step ${i + 1}: Applying to ${num.latexFragment || num.text} (astNodeId=${num.astNodeId})`);

    // Select and apply
    integerCycleState.selectedNodeId = num.id;
    integerCycleState.astNodeId = num.astNodeId;
    integerCycleState.cycleIndex = 0;

    await applyP1Action(num.id, num.astNodeId, 0);
    await new Promise(r => setTimeout(r, 400));

    // Record result
    results.push({
      step: i + 1,
      targetValue: num.latexFragment || num.text,
      targetPath: num.astNodeId,
      beforeLatex,
      afterLatex: currentLatex,
      changed: beforeLatex !== currentLatex
    });

    console.log(`[P1-ORDER-TEST] Result: "${beforeLatex}" -> "${currentLatex}"`);

    // Rebuild map for next iteration
    buildAndShowMap();
    await new Promise(r => setTimeout(r, 200));
  }

  // Summary
  const allChanged = results.every(r => r.changed);
  console.log(`[P1-ORDER-TEST] === SUMMARY ===`);
  console.log(`[P1-ORDER-TEST] Order: ${order}`);
  console.log(`[P1-ORDER-TEST] All steps applied: ${allChanged ? "YES" : "NO"}`);
  console.log(`[P1-ORDER-TEST] Final expression: ${currentLatex}`);
  results.forEach(r => {
    console.log(`  Step ${r.step}: ${r.targetValue} (${r.targetPath}) -> ${r.changed ? "OK" : "FAILED"}`);
  });

  // Restore
  currentLatex = originalLatex;
  renderFormula();
  buildAndShowMap();
  resetIntegerCycleState();

  return { passed: allChanged, order, results, finalLatex: currentLatex };
}

// Expose order test globally
if (typeof window !== "undefined") {
  window.runP1OrderTest = runP1OrderTest;
}


// P1: Clear integer selection on expression change
function resetIntegerCycleState() {
  // Clear any pending click timeout
  if (integerCycleState.pendingClickTimeout) {
    clearTimeout(integerCycleState.pendingClickTimeout);
    integerCycleState.pendingClickTimeout = null;
  }
  integerCycleState.selectedNodeId = null;
  integerCycleState.astNodeId = null;
  integerCycleState.stableKey = null;
  integerCycleState.mode = MODE_GREEN;
  integerCycleState.isStep2Context = false;
  integerCycleState.step2Info = null;
  integerCycleState.cycleIndex = 0;
  integerCycleState.lastClickTime = 0;
  integerCycleState.lastClickNodeId = null;
  // FIX: Do NOT clear perTokenModeMap on expression change!
  // Tokens that still exist after Step2 apply should retain their saved mode.
  // The mode will be validated when the token is clicked (if Step2 context is gone, mode will be adjusted).
  // clearAllTokenModeState(); // REMOVED - was wiping valid mode for remaining Step2 tokens
  clearIntegerHighlight();
  if (window.__debugStep2Cycle) {
    console.log("[STEP2-CYCLE] resetIntegerCycleState: Cleared current selection but preserved perTokenModeMap");
  }
  console.log("[P1] Reset integer cycle state");
}

// P1: Apply visual highlight to selected integer
function applyIntegerHighlight(surfaceNodeId, mode) {
  clearIntegerHighlight();
  const modeConfig = MODE_CONFIG[mode] || MODE_CONFIG[MODE_GREEN];
  const el = document.querySelector(`[data-surface-id="${surfaceNodeId}"]`);
  if (el) {
    el.classList.add("p1-integer-selected");
    el.style.setProperty("--p1-highlight-color", modeConfig.color);
    console.log(`[P1] Applied highlight to ${surfaceNodeId} with color ${modeConfig.color} (mode=${mode})`);
  }
  // Also show mode indicator (now clickable)
  showModeIndicator(modeConfig, surfaceNodeId, mode);
}

function clearIntegerHighlight() {
  document.querySelectorAll(".p1-integer-selected").forEach(el => {
    el.classList.remove("p1-integer-selected");
    el.style.removeProperty("--p1-highlight-color");
  });
  hideModeIndicator();
}

// P1: Show clickable mode indicator with CAPTURE-PHASE BLOCKING
function showModeIndicator(primitive, surfaceNodeId, cycleIndex) {
  let indicator = document.getElementById("p1-hint-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "p1-hint-indicator";
    indicator.className = "p1-hint-container"; // For guard checks
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      color: white;
      z-index: 9999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      cursor: pointer;
      user-select: none;
      transition: transform 0.1s, box-shadow 0.1s;
    `;

    // CAPTURE-PHASE BLOCKING: Prevent ALL events from reaching global handlers
    const captureBlocker = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.log(`[P1-HINT][BLOCK] Blocked ${e.type} in capture phase`);
      updateP1Diagnostics({ hintClickBlocked: "YES" });
    };

    // Add capture-phase blockers
    indicator.addEventListener("pointerdown", captureBlocker, { capture: true });
    indicator.addEventListener("mousedown", captureBlocker, { capture: true });

    // Add hover effect
    indicator.addEventListener("mouseenter", () => {
      indicator.style.transform = "scale(1.02)";
      indicator.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
    });
    indicator.addEventListener("mouseleave", () => {
      indicator.style.transform = "scale(1)";
      indicator.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
    });

    document.body.appendChild(indicator);
  }

  // Build label - for BLUE mode, show actual target denom from step2Info
  let label = primitive.label;
  if (integerCycleState.mode === MODE_BLUE && integerCycleState.step2Info) {
    const targetDenom = integerCycleState.step2Info.oppositeDenom;
    label = `Convert 1 → ${targetDenom}/${targetDenom}`;
    // Log BLUE display with all Step2 info
    console.log(`[BLUE-SHOW] stableKey=${integerCycleState.stableKey} astId=${integerCycleState.astNodeId} side=${integerCycleState.step2Info.side} oppositeDenom=${targetDenom} primitiveId=P.ONE_TO_TARGET_DENOM`);
  } else if (integerCycleState.mode === MODE_GREEN) {
    label = "Selected (click to cycle)";
  }

  indicator.textContent = `${label} (click to apply)`;
  indicator.style.backgroundColor = primitive.color;
  indicator.style.display = "block";

  // Update diagnostics
  updateP1Diagnostics({
    selectedSurfaceNodeId: surfaceNodeId,
    resolvedAstNodeId: integerCycleState.astNodeId || "MISSING",
    primitiveId: primitive.id,
    hintClickBlocked: "N/A"
  });

  // Make indicator clickable - applies the current mode's action
  // CRITICAL: Use single gateway function, no captured params
  indicator.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Call single gateway - reads mode from state at call time
    await applyCurrentHintForStableKey("[HINT-APPLY]");
  };
}

function hideModeIndicator() {
  const indicator = document.getElementById("p1-hint-indicator");
  if (indicator) {
    indicator.style.display = "none";
    indicator.onclick = null; // Clear click handler
  }
}

/**
 * STABLE-ID: Get astId from DOM element's data-ast-id attribute.
 * This is the authoritative source for click/hover targeting.
 * 
 * @param {Element|null} domElement - The DOM element to get astId from
 * @returns {string|null} The data-ast-id value or null if not set
 */
function getAstIdFromDOM(domElement) {
  if (!domElement) return null;

  // Try the element itself first
  if (domElement.hasAttribute && domElement.hasAttribute('data-ast-id')) {
    return domElement.getAttribute('data-ast-id');
  }

  // Use closest to find parent with data-ast-id
  const withAstId = domElement.closest ? domElement.closest('[data-ast-id]') : null;
  if (withAstId) {
    return withAstId.getAttribute('data-ast-id');
  }

  return null;
}

/**
 * STABLE-ID: Get role and operator info from DOM element.
 * @param {Element|null} domElement - The DOM element
 * @returns {{role: string|null, operator: string|null}}
 */
function getRoleFromDOM(domElement) {
  if (!domElement) return { role: null, operator: null };

  const withRole = domElement.closest ? domElement.closest('[data-role]') : null;
  if (withRole) {
    return {
      role: withRole.getAttribute('data-role'),
      operator: withRole.getAttribute('data-operator') || null
    };
  }

  return { role: null, operator: null };
}

/**
 * STEP 2: Detect if clicked integer is a multiplier "1" that participates in diff-denom flow.
 * Uses data-ast-id attributes (Stable-ID) for precise targeting.
 * 
 * For Step2 to apply:
 * - Expression must be: frac * 1 +/- frac * 1 with different denominators
 * - OR partial: frac * 1 +/- frac * frac (one side already converted)
 * - Clicked "1" must have astId matching term[X].term[1] pattern
 * 
 * @param {string} surfaceNodeId - The surface node ID clicked
 * @param {string|null} astNodeId - The astId from DOM (Stable-ID)
 * @param {object} surfaceMap - The surface map
 * @returns {{ isStep2Context: boolean, side?: string, path?: string, oppositeDenom?: string }}
 */
function detectStep2MultiplierContext(surfaceNodeId, astNodeId, surfaceMap) {
  // Must have a valid astNodeId from Stable-ID
  if (!astNodeId) {
    return { isStep2Context: false };
  }

  // Check if astNodeId matches the multiplier-1 pattern
  const leftPattern = /^term\[0\]\.term\[1\]$/;
  const rightPattern = /^term\[1\]\.term\[1\]$/;

  let side = null;
  if (leftPattern.test(astNodeId)) {
    side = "left";
  } else if (rightPattern.test(astNodeId)) {
    side = "right";
  } else {
    return { isStep2Context: false };
  }

  const latex = typeof currentLatex === "string" ? currentLatex : "";

  // FIX: Support partial Step2 expressions (one side already converted)
  // Pattern 1: Both sides have ·1 (original Step2 pattern)
  const fullPattern = /\\frac\{([^}]+)\}\{(\d+)\}\s*\\cdot\s*1\s*([+\-])\s*\\frac\{([^}]+)\}\{(\d+)\}\s*\\cdot\s*1/;
  // Pattern 2: Left side has ·frac, right side has ·1 (left already applied)
  const leftAppliedPattern = /\\frac\{([^}]+)\}\{(\d+)\}\s*\\cdot\s*\\frac\{[^}]+\}\{[^}]+\}\s*([+\-])\s*\\frac\{([^}]+)\}\{(\d+)\}\s*\\cdot\s*1/;
  // Pattern 3: Left side has ·1, right side has ·frac (right already applied)
  const rightAppliedPattern = /\\frac\{([^}]+)\}\{(\d+)\}\s*\\cdot\s*1\s*([+\-])\s*\\frac\{([^}]+)\}\{(\d+)\}\s*\\cdot\s*\\frac\{[^}]+\}\{[^}]+\}/;

  let leftDenom = null;
  let rightDenom = null;
  let matchType = null;

  const fullMatch = latex.match(fullPattern);
  if (fullMatch) {
    leftDenom = fullMatch[2];
    rightDenom = fullMatch[5];
    matchType = "full";
  } else {
    const leftAppliedMatch = latex.match(leftAppliedPattern);
    if (leftAppliedMatch && side === "right") {
      // Left already applied, right still has ·1
      leftDenom = leftAppliedMatch[2];
      rightDenom = leftAppliedMatch[5];
      matchType = "leftApplied";
    } else {
      const rightAppliedMatch = latex.match(rightAppliedPattern);
      if (rightAppliedMatch && side === "left") {
        // Right already applied, left still has ·1
        leftDenom = rightAppliedMatch[2];
        rightDenom = rightAppliedMatch[5];
        matchType = "rightApplied";
      }
    }
  }

  if (!leftDenom || !rightDenom) {
    if (window.__debugStep2Cycle) {
      console.log(`[STEP2-CYCLE] detectStep2MultiplierContext: No pattern matched for side=${side} latex="${latex.substring(0, 80)}..."`);
    }
    return { isStep2Context: false };
  }

  if (leftDenom === rightDenom) {
    return { isStep2Context: false };
  }

  const oppositeDenom = side === "left" ? rightDenom : leftDenom;

  if (window.__debugStep2Cycle) {
    console.log(`[STEP2-CYCLE] detectStep2MultiplierContext: astNodeId=${astNodeId}, side=${side}, oppositeDenom=${oppositeDenom}, matchType=${matchType}`);
  }

  console.log(`[STEP2-DETECT] Found Step 2 context via Stable-ID: astNodeId=${astNodeId}, side=${side}, oppositeDenom=${oppositeDenom}`);

  return {
    isStep2Context: true,
    side,
    path: astNodeId,
    oppositeDenom
  };
}

/**
 * STABLE-ID: Scan DOM for elements with data-ast-id and populate surface map atoms.
 * 
 * IMPORTANT: Scans only .katex-html (not .katex-mathml) to avoid duplicates.
 * Deduplicates by StableTokenKey = `${astId}|${role}|${operator}`.
 * 
 * @param {object} map - Surface map
 * @param {HTMLElement} container - Formula container
 */
function scanDOMForStableIds(map, container) {
  if (!map || !Array.isArray(map.atoms) || !container) return;

  // CRITICAL: Only scan .katex-html, exclude .katex-mathml (screen reader copy causes duplicates)
  const katexHtml = container.querySelector('.katex-html');
  if (!katexHtml) {
    console.warn("[STABLE-ID] No .katex-html found in container");
    return;
  }

  // Find all elements with data-ast-id within .katex-html only
  const stableElements = katexHtml.querySelectorAll('[data-ast-id]');
  console.log(`[STABLE-ID] Found ${stableElements.length} DOM elements with data-ast-id in .katex-html`);

  // Build StableTokenKey -> info map, dedupe by key (keep first occurrence)
  const stableTokenMap = new Map(); // StableTokenKey -> { astId, role, operator, dom }

  for (const el of stableElements) {
    const astId = el.getAttribute('data-ast-id') || "";
    const role = el.getAttribute('data-role') || "";
    const operator = el.getAttribute('data-operator') || "";
    const stableKey = `${astId}|${role}|${operator}`;

    if (!stableTokenMap.has(stableKey)) {
      stableTokenMap.set(stableKey, { astId, role, operator, dom: el, stableKey });
    }
    // else: skip duplicate (same stableKey already registered)
  }

  console.log(`[STABLE-ID] Deduplicated to ${stableTokenMap.size} unique StableTokenKeys`);

  // Create DOM element -> stable info map for fast lookup
  const astIdByDom = new Map();
  for (const [key, info] of stableTokenMap) {
    astIdByDom.set(info.dom, info);
  }

  // Update surface atoms with ast info from DOM
  for (const atom of map.atoms) {
    if (!atom.dom) continue;

    // Check if atom's DOM is within .katex-html (exclude mathml copies)
    if (!katexHtml.contains(atom.dom)) continue;

    // Check if this atom's DOM element or any ancestor has data-ast-id
    let current = atom.dom;
    while (current && current !== container) {
      if (astIdByDom.has(current)) {
        const info = astIdByDom.get(current);
        atom.astNodeId = info.astId;
        atom.dataRole = info.role;
        atom.dataOperator = info.operator;
        atom.stableKey = info.stableKey; // Store StableTokenKey for hint-cycle
        console.log(`[STABLE-ID] Atom ${atom.id} (${atom.kind}) -> stableKey="${info.stableKey}"`);
        break;
      }
      current = current.parentElement;
    }
  }

  // Store stableTokenMap on window for click/hover handlers
  window.__stableTokenMap = stableTokenMap;
}

/**
 * STABLE-ID: Dev assertion - verify DOM contains expected data-ast-id elements.
 * @param {HTMLElement} container - Formula container  
 */
function assertDOMStableIds(container) {
  if (!container) return;

  const stableElements = container.querySelectorAll('[data-ast-id]');
  const count = stableElements.length;

  if (count > 0) {
    console.log(`[STABLE-ID ASSERTION] DOM scan found ${count} tokens with data-ast-id; none missing for interactive roles.`);
  } else {
    console.warn(`[STABLE-ID ASSERTION] No data-ast-id elements found in DOM! Instrumentation may have failed.`);
  }
}


// P1: Ensure we have a valid AST nodeId + up-to-date choice list for the currently selected integer.
// This makes hint-apply robust even when surface map correlation fails (astNodeId missing).
async function ensureP1IntegerContext(surfaceNodeId, fallbackAstNodeId = null) {
  // 1) Prefer explicit astNodeId from event/state
  let astNodeId = fallbackAstNodeId || integerCycleState.astNodeId || null;

  // 2) Try to find it on the current surface map (if available)
  if (!astNodeId && typeof window !== "undefined" && window.__currentSurfaceMap && Array.isArray(window.__currentSurfaceMap.atoms)) {
    const node = window.__currentSurfaceMap.atoms.find(a => a && a.id === surfaceNodeId);
    if (node && node.astNodeId) astNodeId = node.astNodeId;
  }

  // 3) If we still don't have it OR we want authoritative choices, ask backend for a "choice" response.
  // The orchestrator can resolve the correct integer target even when selectionPath is null/root.
  const endpointUrl = (typeof window !== "undefined" && window.__v5EndpointUrl) ? window.__v5EndpointUrl : V5_ENDPOINT_URL;

  const choicePayload = {
    sessionId: "default-session",
    expressionLatex: currentLatex,
    selectionPath: astNodeId, // may be null
    userRole: "student",
    userId: "student",
    courseId: "default",
    surfaceNodeKind: "Num"
    // IMPORTANT: no preferredPrimitiveId here; we want status="choice"
  };

  updateP1Diagnostics({
    selectedSurfaceNodeId: surfaceNodeId || "N/A",
    resolvedAstNodeId: astNodeId || "MISSING",
    lastChoiceStatus: "RUNNING",
    lastChoiceTargetPath: astNodeId || "N/A",
    lastChoiceCount: String(integerCycleState.primitives?.length || 0)
  });

  const result = await runV5Step(endpointUrl, choicePayload, 8000);

  // Backend standardized response: { status, choices, rawResponse.json.debugInfo ... }
  if (result && (String(result.status || "") === "choice" || String(result.status || "").includes("choice")) && Array.isArray(result.choices) && result.choices.length > 0) {
    const choices = result.choices;

    // If backend provides a targetNodeId, use it as authoritative astNodeId
    const targetNodeId = choices[0].targetNodeId || astNodeId || null;
    astNodeId = targetNodeId;

    // Rebuild primitives list from backend choices (stable + future-proof)
    integerCycleState.primitives = choices.map((c, idx) => ({
      id: c.primitiveId,
      label: c.label,
      // Color convention: first choice = green; others = orange (until we add richer palette)
      color: idx === 0 ? "#4CAF50" : "#FF9800",
      targetNodeId: c.targetNodeId || targetNodeId
    }));

    // STEP 2: Add third hint for "1" multiplier in diff denom flow
    const step2Context = detectStep2MultiplierContext(surfaceNodeId, astNodeId, window.__currentSurfaceMap);
    if (step2Context.isStep2Context) {
      // Add the P.ONE_TO_TARGET_DENOM hint as third option (blue color)
      integerCycleState.primitives.push({
        id: "P.ONE_TO_TARGET_DENOM",
        label: `Convert 1 → ${step2Context.oppositeDenom}/${step2Context.oppositeDenom}`,
        color: "#2196F3", // Blue for Step 2
        targetNodeId: step2Context.path,
        isStep2: true,
        oppositeDenom: step2Context.oppositeDenom,
        side: step2Context.side
      });

      // INT-CYCLE logging
      const hints = integerCycleState.primitives.map(p => p.id);
      console.log(`[INT-CYCLE] surfaceId=${surfaceNodeId} isMultiplier1=true selectionPath=${step2Context.path} side=${step2Context.side} cycleIndex(before)=${integerCycleState.cycleIndex} cycleIndex(after)=${integerCycleState.cycleIndex} hints=[${hints.join(",")}]`);
    }

    updateP1Diagnostics({
      resolvedAstNodeId: astNodeId || "MISSING",
      primitiveId: integerCycleState.primitives[integerCycleState.cycleIndex]?.id || "N/A",
      lastChoiceStatus: "choice",
      lastChoiceTargetPath: astNodeId || "N/A",
      lastChoiceCount: String(integerCycleState.primitives.length),
      lastHintApplyError: "N/A"
    });

    // Keep integerCycleState.astNodeId in sync
    integerCycleState.astNodeId = astNodeId;
    return { astNodeId, primitives: integerCycleState.primitives };
  }

  // Not a choice response or error
  const errMsg = (result && result.rawResponse && result.rawResponse.error) ? String(result.rawResponse.error) : "No choice response";
  updateP1Diagnostics({
    resolvedAstNodeId: astNodeId || "MISSING",
    lastChoiceStatus: result ? result.status : "engine-error",
    lastChoiceTargetPath: astNodeId || "N/A",
    lastChoiceCount: String(integerCycleState.primitives?.length || 0),
    lastHintApplyError: errMsg
  });

  // Still return what we have (may be null)
  integerCycleState.astNodeId = astNodeId;
  return { astNodeId, primitives: integerCycleState.primitives };
}


// P1: Apply action for the current mode (GREEN or ORANGE)
// This sends an applyStep request to the backend
async function applyP1Action(surfaceNodeId, astNodeId, cycleIndex) {
  // Ensure we have an AST selectionPath. If missing, try to resolve via backend choice response.
  if (!astNodeId) {
    try {
      const ctx = await ensureP1IntegerContext(surfaceNodeId, null);
      astNodeId = ctx.astNodeId;
    } catch (err) {
      console.warn("[P1-HINT-APPLY] Failed to resolve astNodeId via ensureP1IntegerContext:", err);
    }
  }

  const primitive = integerCycleState.primitives[cycleIndex];
  if (!primitive) {
    console.warn("[P1-APPLY] No primitive for cycleIndex", cycleIndex);
    return;
  }

  console.log(`[P1-APPLY] === Hint/DblClick Apply Action ===`);
  console.log(`[P1-APPLY] surfaceNodeId: ${surfaceNodeId}`);
  console.log(`[P1-APPLY] astNodeId (param): ${astNodeId}`);
  console.log(`[P1-APPLY] integerCycleState.astNodeId: ${integerCycleState.astNodeId}`);
  console.log(`[P1-APPLY] primitive: ${primitive.id}`);
  console.log(`[P1-APPLY] currentLatex: "${currentLatex}"`);

  // ROBUST FALLBACK CHAIN for selectionPath:
  // 1. Provided astNodeId (from P1 state or event)
  // 2. integerCycleState.astNodeId (stored during single-click)
  // 3. Look up from current surface map using surfaceNodeId
  // 4. "root" ONLY if the expression is a single isolated integer
  let targetPath = astNodeId || integerCycleState.astNodeId;

  // If still no targetPath, try to look it up from the current surface map
  if (!targetPath && surfaceNodeId && typeof window !== "undefined" && window.__currentSurfaceMap) {
    const map = window.__currentSurfaceMap;
    const surfaceNode = map.atoms?.find(n => n.id === surfaceNodeId);
    if (surfaceNode && surfaceNode.astNodeId) {
      targetPath = surfaceNode.astNodeId;
      console.log(`[P1-APPLY] Found astNodeId from surface map: "${targetPath}"`);
    }
  }

  // Check if we need "root" fallback - ONLY for isolated integers
  if (!targetPath) {
    const latex = typeof currentLatex === "string" ? currentLatex.trim() : "";
    // Check if expression is just a single integer (e.g., "3", "12", "456")
    const isIsolatedInteger = /^-?\d+$/.test(latex);

    if (isIsolatedInteger) {
      targetPath = "root";
      console.log(`[P1-APPLY] Using "root" - expression "${latex}" is an isolated integer`);
    } else {
      console.error(`[P1-APPLY] ERROR: No valid astNodeId for non-isolated integer expression!`);
      console.error(`[P1-APPLY] This likely means correlateIntegersWithAST did not assign an astNodeId to the clicked integer.`);
      console.error(`[P1-APPLY] Expression: "${latex}", surfaceNodeId: ${surfaceNodeId}`);
      console.error(`[P1-APPLY] ABORTING - would incorrectly target root node.`);
      return;
    }
  }

  console.log(`[P1-APPLY] targetPath (resolved): ${targetPath}`);

  // Define payload and endpoint FIRST, then use them in diagnostics
  const v5Payload = {
    sessionId: "default-session",
    expressionLatex: typeof currentLatex === "string" ? currentLatex : "",
    selectionPath: targetPath,
    preferredPrimitiveId: primitive.id,
    courseId: "default",
    userRole: "student",
    surfaceNodeKind: "Num",
  };

  // Get endpoint from global config (exposed by EngineAdapter init)
  const endpointUrl = (typeof window !== "undefined" && window.__v5EndpointUrl)
    ? window.__v5EndpointUrl
    : "/api/orchestrator/v5/step"; // Fallback to relative URL for dev proxy

  // Update diagnostics before calling backend
  updateP1Diagnostics({
    selectedSurfaceNodeId: surfaceNodeId || "N/A",
    resolvedAstNodeId: astNodeId || "MISSING",
    primitiveId: primitive.id,
    lastHintApplyStatus: "RUNNING",
    lastHintApplySelectionPath: targetPath || "MISSING",
    lastHintApplyPreferredPrimitiveId: primitive.id,
    lastHintApplyEndpoint: endpointUrl || "N/A",
    lastHintApplyNewLatex: "N/A",
    lastHintApplyError: "N/A"
  });

  console.log(`[P1-HINT-APPLY] primitiveId: ${primitive.id}`);
  console.log(`[P1-HINT-APPLY] selectionPath: ${targetPath}`);

  // STEP2: Special debug log for one-multiplier clicks
  if (primitive.id === "P.ONE_TO_TARGET_DENOM") {
    const side = primitive.side || "unknown";
    const oppositeDenom = primitive.oppositeDenom || "?";
    console.log(`[STEP2-APPLY] selectionPath=${targetPath} preferredPrimitiveId=P.ONE_TO_TARGET_DENOM side=${side} oppositeDenom=${oppositeDenom}`);
  }
  console.log(`[P1-HINT-APPLY] request URL: ${endpointUrl}`);
  console.log(`[P1-HINT-APPLY] payload:`, JSON.stringify(v5Payload));

  // TraceHub: Emit VIEWER_HINT_APPLY_REQUEST
  if (typeof window !== "undefined" && window.__traceHub) {
    window.__traceHub.emit({
      module: "viewer.main",
      event: "VIEWER_HINT_APPLY_REQUEST",
      data: {
        latex: v5Payload.expressionLatex,
        selectionPath: targetPath,
        preferredPrimitiveId: primitive.id,
        surfaceNodeId
      }
    });
  }

  try {
    // Use the shared V5 client for proper request handling
    const result = await runV5Step(endpointUrl, v5Payload, 8000);
    // Record backend result to diagnostics
    const _newLatex = (result && result.engineResult && typeof result.engineResult.latex === "string") ? result.engineResult.latex : "N/A";
    updateP1Diagnostics({
      lastHintApplyStatus: result ? result.status : "engine-error",
      lastHintApplyNewLatex: _newLatex,
      lastHintApplyError: (result && result.status === "engine-error" && result.rawResponse && result.rawResponse.error) ? String(result.rawResponse.error) : "N/A"
    });

    // TraceHub: Emit VIEWER_HINT_APPLY_RESPONSE
    if (typeof window !== "undefined" && window.__traceHub) {
      window.__traceHub.emit({
        module: "viewer.main",
        event: "VIEWER_HINT_APPLY_RESPONSE",
        data: {
          status: result ? result.status : "engine-error",
          newLatex: result?.engineResult?.newExpressionLatex || null,
          error: (result && result.status === "engine-error") ? (result.rawResponse?.error || "unknown") : null
        }
      });
    }

    console.log(`[P1-HINT-APPLY] response status: ${result.status}`);
    console.log(`[P1-HINT-APPLY] newExpressionLatex: ${result.engineResult?.newExpressionLatex || "N/A"}`);

    if (result.status === "step-applied" && result.engineResult?.newExpressionLatex) {
      const newLatex = result.engineResult.newExpressionLatex;
      console.log(`[P1-HINT-APPLY] SUCCESS! Updating expression to: ${newLatex}`);

      // Update the expression in the viewer
      currentLatex = newLatex;
      renderFormula();
      buildAndShowMap();

      // Clear selection comprehensively
      clearSelection("latex-changed");
    } else if (result.status === "no-candidates") {
      console.warn(`[P1-HINT-APPLY] No candidates found for primitive ${primitive.id}. Backend may not support this primitive.`);
    } else if (result.status === "choice") {
      console.warn(`[P1-HINT-APPLY] Got 'choice' response but expected 'step-applied'. preferredPrimitiveId may not have been honored by backend.`);
    } else if (result.status === "engine-error") {
      console.error(`[P1-HINT-APPLY][ERROR] Engine error:`, result.rawResponse);
    } else {
      console.warn(`[P1-HINT-APPLY] Unexpected response status: ${result.status}`);
    }
  } catch (err) {
    console.error(`[P1-HINT-APPLY][ERROR] Exception calling backend:`, err);
    // TraceHub: Emit VIEWER_HINT_APPLY_RESPONSE with error
    if (typeof window !== "undefined" && window.__traceHub) {
      window.__traceHub.emit({
        module: "viewer.main",
        event: "VIEWER_HINT_APPLY_RESPONSE",
        data: {
          status: "exception",
          error: err instanceof Error ? err.message : String(err)
        }
      });
    }
  }
}

/**
 * P1: Apply action with explicit primitiveId (mode-based, not array-based)
 * @param {string} surfaceNodeId
 * @param {string|null} astNodeId
 * @param {string} primitiveId - e.g. "P.INT_TO_FRAC" or "P.ONE_TO_TARGET_DENOM"
 */
async function applyP1ActionWithPrimitive(surfaceNodeId, astNodeId, primitiveId) {
  if (!primitiveId) {
    console.warn("[P1-HINT-APPLY] No primitiveId provided");
    return;
  }

  // Get endpoint from global config
  const endpointUrl = (typeof window !== "undefined" && window.__v5EndpointUrl)
    ? window.__v5EndpointUrl
    : "/api/orchestrator/v5/step";

  const v5Payload = {
    sessionId: "default-session",
    expressionLatex: typeof currentLatex === "string" ? currentLatex : "",
    selectionPath: astNodeId || "root",
    preferredPrimitiveId: primitiveId,
    courseId: "default",
    userRole: "student",
    surfaceNodeKind: "Num",
  };

  console.log(`[P1-HINT-APPLY] primitiveId: ${primitiveId}`);
  console.log(`[P1-HINT-APPLY] selectionPath: ${astNodeId || "root"}`);
  console.log(`[P1-HINT-APPLY] request URL: ${endpointUrl}`);

  try {
    const result = await runV5Step(endpointUrl, v5Payload, 8000);

    console.log(`[P1-HINT-APPLY] response status: ${result.status}`);

    if (result.status === "step-applied" && result.engineResult?.newExpressionLatex) {
      const newLatex = result.engineResult.newExpressionLatex;
      console.log(`[P1-HINT-APPLY] SUCCESS! Updating expression to: ${newLatex}`);
      currentLatex = newLatex;
      renderFormula();
      buildAndShowMap();
      clearSelection("latex-changed");
    } else {
      console.warn(`[P1-HINT-APPLY] Response status: ${result.status}`);
    }

    updateP1Diagnostics({
      lastHintApplyStatus: result.status,
      lastHintApplyNewLatex: result.engineResult?.newExpressionLatex || "N/A"
    });
  } catch (err) {
    console.error(`[P1-HINT-APPLY][ERROR] Exception:`, err);
    updateP1Diagnostics({
      lastHintApplyStatus: "exception",
      lastHintApplyError: err instanceof Error ? err.message : String(err)
    });
  }
}

// P1: Expose integerCycleState globally for engine-adapter access
if (typeof window !== "undefined") {
  window.__p1IntegerCycleState = integerCycleState;
}

// C4: FileBus (in-browser demo)
const fileBus = new FileBus({ name: "browser-demo-bus" });

// C2: DisplayAdapter + in-browser recorder
const eventRecorder = new ClientEventRecorder();
const displayAdapter = new DisplayAdapter(
  () => currentLatex,
  () => selectionState,
  (evt) => {
    // 1) Publish into FileBus (for future EngineAdapter / Recorder)
    fileBus.publishClientEvent(evt);
    // 2) Mirror into local recorder for JSONL export
    eventRecorder.handleEvent(evt);
  }
);

// Optional: expose FileBus for debug
if (typeof window !== "undefined") {
  window.__motorFileBus = fileBus;
}

// C6: EngineAdapter + StubEngine (embedded demo)
const engineAdapter = new EngineAdapter(fileBus, {
  mode: "http",
  httpEndpoint: "http://localhost:4201/api/entry-step",
  httpTimeout: 8000,
});

engineAdapter.start();

// Expose V5 endpoint globally for P1 hint-apply to use
const V5_ENDPOINT_URL = "http://localhost:4201/api/entry-step".replace("/api/entry-step", "/api/orchestrator/v5/step");
if (typeof window !== "undefined") {
  window.__motorEngineAdapter = engineAdapter;
  window.__v5EndpointUrl = V5_ENDPOINT_URL;
}

let isDragging = false;
let dragStart = null;
let dragEnd = null;

/**
 * Canonical function to clear ALL selection states and visuals.
 * @param {string} reason - Debug reason for clearing
 */
function clearSelection(reason) {
  console.info("[SEL] clearSelection", { reason });

  // 1. Clear internal selection states
  selectionState.selectedIds.clear();
  selectionState.mode = "none";
  selectionState.primaryId = null;

  // Clear P1 state
  if (typeof resetIntegerCycleState === "function") {
    resetIntegerCycleState();
  }

  // 2. Remove integer visual classes from DOM
  const selectedInts = document.querySelectorAll(".p1-integer-selected");
  selectedInts.forEach(el => {
    el.classList.remove("p1-integer-selected");
    el.style.removeProperty("--p1-highlight-color");
  });

  // 3. Clear overlay
  const overlay = document.getElementById("selection-overlay");
  if (overlay) overlay.innerHTML = "";

  // Force clear via helper if available (handles ensuring overlay exists)
  if (typeof clearSelectionVisual === "function" && typeof current !== "undefined" && current && current.map) {
    clearSelectionVisual(current.map);
  }

  // 4. Clear hover/focus
  if (typeof clearDomHighlight === "function") {
    clearDomHighlight();
  }

  // 5. Hide indicator
  if (typeof hideModeIndicator === "function") {
    hideModeIndicator();
  }
}

function renderFormula() {
  /** @type {HTMLElement|null} */
  const container = document.getElementById("formula-container");
  if (!container) return null;

  container.innerHTML = "";

  // Remove any existing Stable-ID disabled banner
  const existingBanner = document.getElementById("stable-id-banner");
  if (existingBanner) existingBanner.remove();

  if (!window.katex || !window.katex.render) {
    container.textContent = "KaTeX is not available (window.katex missing).";
    return container;
  }

  // STABLE-ID: Try local instrumentation first
  const localResult = instrumentLatex(currentLatex);

  if (localResult.success) {
    // Local success
    stableIdState.lastExpression = currentLatex;
    stableIdState.enabled = true;
    stableIdState.reason = null;
    console.log("[STABLE-ID] Local instrumentation succeeded");
    doRender(localResult.latex, container);
  } else {
    // Local failed - try backend
    console.log(`[STABLE-ID] Local failed (${localResult.reason}) -> calling backend`);
    tryBackendInstrumentation(currentLatex, localResult.latex, container, localResult.reason);
  }

  return container;
}

/**
 * Call backend /api/instrument endpoint for instrumentation.
 * Falls back to original LaTeX if backend fails.
 */
async function tryBackendInstrumentation(latex, fallbackLatex, container, localReason) {
  const backendUrl = (window.__v5EndpointUrl || "http://localhost:4201/api/orchestrator/v5/step")
    .replace("/api/orchestrator/v5/step", "/api/instrument");

  try {
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latex })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.instrumentedLatex) {
      // Backend success!
      stableIdState.lastExpression = latex;
      stableIdState.enabled = true;
      stableIdState.reason = null;
      console.log(`[STABLE-ID] Backend instrumentation succeeded (${result.tokenCount || "?"} tokens)`);
      doRender(result.instrumentedLatex, container);
      return;
    } else {
      // Backend failed
      const reason = result.reason || "unknown backend error";
      console.log(`[BUG] Backend instrument failed: ${reason}`);
      stableIdState.lastExpression = latex;
      stableIdState.enabled = false;
      stableIdState.reason = reason;
      showStableIdDisabledBanner(reason);
      doRender(fallbackLatex, container);
    }
  } catch (err) {
    // Network or other error
    const reason = `backend unreachable: ${err.message}`;
    console.log(`[BUG] Backend instrument failed: ${reason}`);
    stableIdState.lastExpression = latex;
    stableIdState.enabled = false;
    stableIdState.reason = `local: ${localReason}; ${reason}`;
    showStableIdDisabledBanner(stableIdState.reason);
    doRender(fallbackLatex, container);
  }
}

/**
 * Render LaTeX with KaTeX using trust for \htmlData.
 */
function doRender(latex, container) {
  window.katex.render(latex, container, {
    throwOnError: false,
    displayMode: true,
    output: "html",
    // TRUST: Enable htmlData command for Stable-ID rendering
    trust: (context) => {
      // Only allow our htmlData commands for data-ast-id
      return context.command === "\\htmlData";
    },
    // STRICT: Silence only htmlExtension warnings, keep others
    strict: (errorCode, errorMsg, token) => {
      if (errorCode === "htmlExtension") {
        return "ignore"; // Silence our intended htmlData usage
      }
      return "warn"; // Keep warnings for everything else
    }
  });

  return container;
}

/**
 * Show a banner when Stable-ID is disabled for an expression.
 * @param {string} reason - Reason for failure
 */
function showStableIdDisabledBanner(reason) {
  let banner = document.getElementById("stable-id-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "stable-id-banner";
    banner.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff9800;
      color: #000;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(banner);
  }
  banner.textContent = `⚠️ Stable-ID disabled: ${reason || "unknown"}. Precise clicks disabled.`;
  banner.style.display = "block";
}


// === Choice Popup for Integer Context Menu ===

let currentChoicePopup = null;

/**
 * Show a popup near the clicked element with available choices.
 * @param {Array<{id: string, label: string, primitiveId: string, targetNodeId: string}>} choices
 * @param {{surfaceNodeId?: string, selectionPath?: string}} clickContext
 * @param {string} latex - Current expression latex
 */
function showChoicePopup(choices, clickContext, latex) {
  // Remove any existing popup
  hideChoicePopup();

  if (!choices || choices.length === 0) {
    console.log("[ChoicePopup] No choices to display");
    return;
  }

  // Create popup container
  const popup = document.createElement("div");
  popup.id = "choice-popup";
  popup.style.cssText = `
    position: absolute;
    z-index: 1000;
    background: white;
    border: 1px solid #ccc;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 8px 0;
    min-width: 160px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
  `;

  // Create choice buttons
  choices.forEach((choice, idx) => {
    const btn = document.createElement("button");
    btn.textContent = choice.label;
    btn.dataset.primitiveId = choice.primitiveId;
    btn.dataset.targetNodeId = choice.targetNodeId;
    btn.style.cssText = `
      display: block;
      width: 100%;
      padding: 8px 16px;
      border: none;
      background: transparent;
      text-align: left;
      cursor: pointer;
      color: #333;
    `;
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "#f0f0f0";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "transparent";
    });
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // Prevent close handler from firing
      // CRITICAL FIX: Use choice.targetNodeId (from backend) instead of clickContext.selectionPath
      const targetPath = choice.targetNodeId || clickContext.selectionPath || "root";
      console.log(`[ChoicePopup] Click: primitiveId=${choice.primitiveId}, targetPath=${targetPath}`);
      applyChoice(choice.primitiveId, targetPath, latex);
      hideChoicePopup();
    });
    popup.appendChild(btn);
  });

  // Position popup near formula container center (simple approach)
  const formulaContainer = document.getElementById("formula-container");
  if (formulaContainer) {
    const rect = formulaContainer.getBoundingClientRect();
    popup.style.left = `${rect.left + rect.width / 2 - 80}px`;
    popup.style.top = `${rect.bottom + 10}px`;
  } else {
    popup.style.left = "50%";
    popup.style.top = "100px";
  }

  document.body.appendChild(popup);
  currentChoicePopup = popup;

  // Close popup when clicking outside
  setTimeout(() => {
    document.addEventListener("click", closePopupOnClickOutside, { once: true, capture: true });
  }, 0);
}

function hideChoicePopup() {
  if (currentChoicePopup) {
    currentChoicePopup.remove();
    currentChoicePopup = null;
  }
}

function closePopupOnClickOutside(event) {
  if (currentChoicePopup && !currentChoicePopup.contains(event.target)) {
    hideChoicePopup();
  }
}

/**
 * Apply a chosen action by sending a new request with preferredPrimitiveId
 * @param {string} primitiveId - The primitive to apply
 * @param {string} selectionPath - The node path
 * @param {string} latex - The current expression
 */
async function applyChoice(primitiveId, selectionPath, latex) {
  console.log(`[ApplyChoice] Applying ${primitiveId} to ${selectionPath}`);

  const endpoint = "http://localhost:4201/api/orchestrator/v5/step";
  const payload = {
    sessionId: "default-session",
    expressionLatex: latex,
    selectionPath: selectionPath,
    courseId: "default",
    userRole: "student",
    preferredPrimitiveId: primitiveId,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    console.log("[ApplyChoice] Response:", json);

    if (json.status === "step-applied" && json.expressionLatex) {
      currentLatex = json.expressionLatex;
      clearSelection("latex-changed");
      renderFormula();
      buildAndShowMap();
    } else {
      console.warn("[ApplyChoice] Step not applied:", json.status);
    }
  } catch (err) {
    console.error("[ApplyChoice] Error:", err);
  }
}

function updateHoverPanel(kind, node) {
  const hoverSpan = document.getElementById("hover-info");
  const clickSpan = document.getElementById("click-info");

  if (kind === "hover") {
    if (!hoverSpan) return;
    if (!node) {
      hoverSpan.textContent = "—";
      return;
    }
    const text = node.latexFragment ? ` "${node.latexFragment}"` : "";
    hoverSpan.textContent = `${node.id} · ${node.kind}${text}`;
  } else if (kind === "click") {
    if (!clickSpan) return;
    if (!node) {
      clickSpan.textContent = "—";
      return;
    }
    const text = node.latexFragment ? ` "${node.latexFragment}"` : "";
    clickSpan.textContent = `${node.id} · ${node.kind}${text}`;
  }
}

function clearDomHighlight() {
  if (lastHoverNode && lastHoverNode.dom) {
    lastHoverNode.dom.style.outline = "";
    lastHoverNode.dom.style.backgroundColor = "";
  }
  lastHoverNode = null;
}

function highlightNode(node) {
  clearDomHighlight();
  if (!node || !node.dom) return;
  // Hover highlight (blue outline)
  node.dom.style.outline = "2px solid rgba(37,99,235,0.8)";
  node.dom.style.backgroundColor = "rgba(191,219,254,0.45)";
  lastHoverNode = node;
}

// --- Selection helpers ---

let selectionOverlayEl = null;

function ensureSelectionOverlay() {
  const shell = document.querySelector(".formula-shell");
  if (!shell) return null;

  // Create once
  if (!selectionOverlayEl) {
    selectionOverlayEl = document.createElement("div");
    selectionOverlayEl.id = "selection-overlay";
    selectionOverlayEl.style.position = "absolute";
    selectionOverlayEl.style.left = "0px";
    selectionOverlayEl.style.top = "0px";
    selectionOverlayEl.style.right = "0px";
    selectionOverlayEl.style.bottom = "0px";
    selectionOverlayEl.style.pointerEvents = "none";
    selectionOverlayEl.style.zIndex = "2"; // above formula, below drag-rect
    shell.appendChild(selectionOverlayEl);

    // Ensure drag-rect stays above overlays
    const dragRectEl = document.getElementById("drag-rect");
    if (dragRectEl) dragRectEl.style.zIndex = "3";
  }

  return selectionOverlayEl;
}

function clearSelectionVisual(map) {
  // Backward-compat: if older code painted mv-selected on DOM, strip it.
  if (map && map.atoms) {
    for (const node of map.atoms) {
      if (node.dom && node.dom.classList) {
        node.dom.classList.remove("mv-selected");
      }
    }
  }

  const overlay = ensureSelectionOverlay();
  if (!overlay) return;
  overlay.innerHTML = "";
}

function nodeTextForVisual(node) {
  const t = (node && node.latexFragment ? String(node.latexFragment) : "").trim();
  return t;
}

function shouldSkipNodeForVisual(node) {
  if (!node) return true;

  // Never draw selection visuals for FracBar: it has no ink and produces ugly "floating lines"
  if (node.kind === "FracBar") return true;

  // Skip empty-text nodes (wrappers, struts, spacing)
  const t = nodeTextForVisual(node);
  if (!t) return true;

  // Skip pure whitespace
  if (!t.replace(/\s+/g, "")) return true;

  return false;
}

function buildSelectedLeafNodes(map) {
  const selectedSet = selectionState.selectedIds;
  const selectedById = new Map();
  for (const n of (map?.atoms || [])) {
    if (selectedSet.has(n.id)) selectedById.set(n.id, n);
  }

  // Keep only "leaf-most" selected nodes to avoid nested outlines (parent + child).
  // This is VISUAL ONLY; selectionState remains unchanged.
  const memo = new Map();
  function hasSelectedDescendant(node) {
    if (!node || !node.children || node.children.length === 0) return false;
    if (memo.has(node.id)) return memo.get(node.id);

    for (const ch of node.children) {
      if (selectedSet.has(ch.id)) {
        memo.set(node.id, true);
        return true;
      }
      if (hasSelectedDescendant(ch)) {
        memo.set(node.id, true);
        return true;
      }
    }
    memo.set(node.id, false);
    return false;
  }

  const leaf = [];
  for (const node of selectedById.values()) {
    if (!hasSelectedDescendant(node)) leaf.push(node);
  }
  return leaf;
}

function clusterDigitRuns(nodes) {
  // Merge adjacent single-digit Num nodes into one rectangle (visual polish).
  const digits = [];
  const rest = [];

  for (const n of nodes) {
    const t = nodeTextForVisual(n);
    if (n.kind === "Num" && /^[0-9]$/.test(t)) digits.push(n);
    else rest.push(n);
  }

  digits.sort((a, b) => a.bbox.left - b.bbox.left);

  const merged = [];
  let cur = null;

  function midY(n) {
    return (n.bbox.top + n.bbox.bottom) / 2;
  }

  for (const n of digits) {
    if (!cur) {
      cur = {
        kind: "Num",
        text: nodeTextForVisual(n),
        bbox: { ...n.bbox }
      };
      continue;
    }

    const sameLine = Math.abs(midY(n) - ((cur.bbox.top + cur.bbox.bottom) / 2)) <= 3;
    const gap = n.bbox.left - cur.bbox.right;

    if (sameLine && gap <= 2) {
      cur.text += nodeTextForVisual(n);
      cur.bbox.right = Math.max(cur.bbox.right, n.bbox.right);
      cur.bbox.top = Math.min(cur.bbox.top, n.bbox.top);
      cur.bbox.bottom = Math.max(cur.bbox.bottom, n.bbox.bottom);
    } else {
      merged.push(cur);
      cur = {
        kind: "Num",
        text: nodeTextForVisual(n),
        bbox: { ...n.bbox }
      };
    }
  }
  if (cur) merged.push(cur);

  // Return visual items: merged digit-runs + the rest as-is
  const items = [];
  for (const m of merged) items.push({ kind: m.kind, text: m.text, bbox: m.bbox });
  for (const r of rest) items.push({ kind: r.kind, text: nodeTextForVisual(r), bbox: r.bbox });

  // Sort for stable painting left-to-right
  items.sort((a, b) => a.bbox.left - b.bbox.left);

  return items;
}

function paintSelectionRects(items, colorMode = "default") {
  const overlay = ensureSelectionOverlay();
  if (!overlay) return;
  overlay.innerHTML = "";

  // COLOR SCHEMES for different selection modes
  const colorSchemes = {
    default: {
      border: "2px solid rgba(16, 185, 129, 0.95)",     // Teal/Green
      boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.3)",
      background: "rgba(209, 250, 229, 0.4)",
    },
    direct: {
      border: "2px solid rgba(34, 197, 94, 0.95)",       // Bright GREEN
      boxShadow: "0 0 0 3px rgba(34, 197, 94, 0.3)",
      background: "rgba(187, 247, 208, 0.5)",
    },
    "requires-prep": {
      border: "2px solid rgba(234, 179, 8, 0.95)",       // YELLOW/Amber
      boxShadow: "0 0 0 3px rgba(234, 179, 8, 0.3)",
      background: "rgba(254, 243, 199, 0.5)",
    },
  };

  const scheme = colorSchemes[colorMode] || colorSchemes.default;

  for (const it of items) {
    const w = Math.max(0, it.bbox.right - it.bbox.left);
    const h = Math.max(0, it.bbox.bottom - it.bbox.top);
    if (w < 2 || h < 2) continue; // ignore tiny noise

    const r = document.createElement("div");
    r.style.position = "absolute";
    r.style.left = it.bbox.left + "px";
    r.style.top = it.bbox.top + "px";
    r.style.width = w + "px";
    r.style.height = h + "px";

    // Apply color scheme
    r.style.border = scheme.border;
    r.style.boxShadow = scheme.boxShadow;
    r.style.backgroundColor = scheme.background;
    r.style.borderRadius = "2px";

    // Add data attribute for debugging
    if (it.role) {
      r.dataset.role = it.role;
    }

    overlay.appendChild(r);
  }
}

/**
 * SMART OPERATOR SELECTION: Apply visual highlighting to operator and operands
 * Fetches validation type from backend and paints boxes with appropriate color.
 * 
 * @param {Object} context - OperatorSelectionContext
 * @param {Array} boxes - Bounding boxes from getContextBoundingBoxes
 * @param {string} latex - Current expression LaTeX
 * @returns {Promise<string|null>} validationType or null
 */
async function applyOperatorHighlight(context, boxes, latex) {
  if (!context || !boxes || boxes.length === 0) {
    console.log("[applyOperatorHighlight] No context or boxes provided");
    return null;
  }

  // Update state
  operatorSelectionState.active = true;
  operatorSelectionState.context = context;
  operatorSelectionState.boxes = boxes;

  // Try to get validationType from backend via existing engine adapter
  let validationType = "requires-prep"; // Default to yellow if unknown

  try {
    // Use the validation endpoint or the step endpoint
    const apiBase = window.__engineApiBase || "http://localhost:4001";
    const response = await fetch(`${apiBase}/api/v1/validate-operator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        latex: latex,
        operatorPath: context.astPath,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.validationType) {
        validationType = data.validationType;
        console.log("[applyOperatorHighlight] Backend returned validationType:", validationType);
      }
    } else {
      console.log("[applyOperatorHighlight] Backend validation failed, using default");
    }
  } catch (err) {
    // Fallback: Infer validation type from operand types if backend unavailable
    console.log("[applyOperatorHighlight] Backend unavailable, inferring from operands");

    const leftKind = context.leftOperandSurfaceNode?.kind;
    const rightKind = context.rightOperandSurfaceNode?.kind;
    const isSimpleIntegers = leftKind === "Num" && rightKind === "Num";

    if (isSimpleIntegers) {
      validationType = "direct"; // Integer arithmetic is always direct
    }
    // For fractions, we'd need deeper analysis - default to yellow
  }

  // Store in state
  operatorSelectionState.validationType = validationType;

  // Paint the boxes with appropriate color
  const items = boxes.map(b => ({
    bbox: b.bbox,
    role: b.role,
  }));

  paintSelectionRects(items, validationType);

  console.log(`[applyOperatorHighlight] Painted ${boxes.length} boxes with color=${validationType}`);

  return validationType;
}

/**
 * SMART OPERATOR SELECTION: Clear operator highlighting
 */
function clearOperatorHighlight() {
  operatorSelectionState.active = false;
  operatorSelectionState.validationType = null;
  operatorSelectionState.context = null;
  operatorSelectionState.boxes = [];
  window.__currentOperatorContext = null;

  // Clear visual overlay
  const overlay = document.getElementById("selection-overlay");
  if (overlay) {
    overlay.innerHTML = "";
  }

  console.log("[clearOperatorHighlight] Operator highlight cleared");
}

function applySelectionVisual(map) {
  if (!map || !map.atoms) return;

  // Always clear first
  clearSelectionVisual(map);

  // Build visual-only leaf nodes
  const leafSelected = buildSelectedLeafNodes(map);

  // Filter out non-ink / problematic nodes (e.g., FracBar)
  const visible = leafSelected.filter((n) => !shouldSkipNodeForVisual(n));

  // Cluster digits for prettier numbers
  const items = clusterDigitRuns(visible);

  paintSelectionRects(items);
}

// Rectangle hit-test over all map atoms (for drag selection).
function hitTestRect(map, rect) {
  if (!map || !map.atoms) return [];
  const results = [];
  for (const node of map.atoms) {
    const b = node.bbox;
    if (
      !(rect.right < b.left ||
        rect.left > b.right ||
        rect.bottom < b.top ||
        rect.top > b.bottom)
    ) {
      results.push(node);
    }
  }
  return results;
}
function buildAndShowMap() {
  /** @type {HTMLElement|null} */
  const container = document.getElementById("formula-container");
  if (!container) return null;

  let map = buildSurfaceNodeMap(container);
  map = enhanceSurfaceMap(map, container);
  map = correlateOperatorsWithAST(map, currentLatex); // Still needed for operator correlation

  // STABLE-ID: Scan DOM for data-ast-id elements (render-time injection)
  // This replaces position-based correlateIntegersWithAST
  scanDOMForStableIds(map, container);
  assertDOMStableIds(container);
  const serializable = surfaceMapToSerializable(map);

  const pre = document.getElementById("surface-json");
  if (pre) {
    pre.textContent = JSON.stringify(serializable, null, 2);
  }

  current = { map, serializable };
  if (typeof window !== "undefined") {
    window.current = current;
    window.__currentSurfaceMap = map; // P1: Expose surface map for applyP1Action lookup
  }
  clearDomHighlight();
  updateHoverPanel("hover", null);
  updateHoverPanel("click", null);

  // P1: Reset integer cycle state when expression changes
  resetIntegerCycleState();

  return current;
}

document.addEventListener("DOMContentLoaded", () => {
  const btnRebuild = document.getElementById("btn-rebuild");
  const btnDownload = document.getElementById("btn-download");
  const btnDownloadEvents = document.getElementById("btn-download-events");
  const btnDownloadBus = document.getElementById("btn-download-bus");
  const container = renderFormula();
  buildAndShowMap();


  // Manual LaTeX input: load arbitrary expression into the viewer
  const manualInput = document.getElementById("manual-latex-input");
  const btnLoadLatex = document.getElementById("btn-load-latex");
  if (manualInput && btnLoadLatex) {
    btnLoadLatex.addEventListener("click", () => {
      const value = manualInput.value.trim();
      if (!value) return;
      currentLatex = value;
      clearSelection("latex-changed");
      renderFormula();
      buildAndShowMap();
    });
  }

  // Explicit Clear Selection Button
  const btnClearSel = document.getElementById("btn-clear-selection");
  if (btnClearSel) {
    btnClearSel.addEventListener("click", () => {
      console.info("[SEL] clear via button/esc");
      clearSelection("button");
    });
    console.info("[SEL] clear button wired");
  }

  // Esc Key Handler
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      // Ignore if typing in an input
      const tag = e.target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      console.info("[SEL] clear via button/esc");
      clearSelection("esc");
    }
  });


  // Click Outside to Clear Selection
  document.addEventListener("pointerup", (e) => {
    // Only proceed if we have an active selection
    const hasSelection = selectionState.selectedIds.size > 0 || integerCycleState.selectedNodeId;
    if (!hasSelection) return;

    // Don't clear if clicking on the diag panels or context menu
    if (e.target.closest("#p1-diagnostics-panel")) return;
    if (e.target.closest("#choice-popup")) return;

    const container = document.getElementById("formula-container");
    if (!container) return;

    // Check if click is inside the container
    if (container.contains(e.target)) return;

    // Calculate dynamic threshold (approx 1 character width)
    let thresholdPx = 12; // Fallback
    try {
      // Try to measure a "0" digit in the current font
      const testSpan = document.createElement("span");
      testSpan.style.visibility = "hidden";
      testSpan.style.position = "absolute";
      testSpan.style.font = window.getComputedStyle(container).font;
      testSpan.textContent = "0";
      container.appendChild(testSpan);
      const w = testSpan.getBoundingClientRect().width;
      if (w > 0) thresholdPx = w;
      testSpan.remove();
    } catch (err) {
      // Ignore measurement errors
    }

    const box = container.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    // Check if outside the expanded box
    const isOutside =
      x < box.left - thresholdPx ||
      x > box.right + thresholdPx ||
      y < box.top - thresholdPx ||
      y > box.bottom + thresholdPx;

    if (isOutside) {
      console.log(`[Viewer] Click outside detected (threshold=${thresholdPx.toFixed(1)}px) - clearing selection`);

      // Clear Global Selection
      selectionState.selectedIds.clear();
      selectionState.mode = "none";
      selectionState.primaryId = null;

      // Clear P1 Selection
      resetIntegerCycleState();

      // Update Visuals
      if (current && current.map) {
        applySelectionVisual(current.map);
      }
      clearDomHighlight();
    }
  });


  // Engine / FileBus debug panel (last ClientEvent → EngineRequest → EngineResponse)
  const elDbgClient = document.getElementById("engine-debug-client");
  const elDbgReq = document.getElementById("engine-debug-request");
  const elDbgRes = document.getElementById("engine-debug-response");
  const elDbgTsaOp = document.getElementById("tsa-debug-operator");
  const elDbgTsaStrategy = document.getElementById("tsa-debug-strategy");
  const elDbgTsaInvariant = document.getElementById("tsa-debug-invariant");
  const elDbgTsaInvariantText = document.getElementById("tsa-debug-invariant-text");
  const elDbgTsaBefore = document.getElementById("tsa-debug-before");
  const elDbgTsaAfter = document.getElementById("tsa-debug-after");
  const elDbgTsaError = document.getElementById("tsa-debug-error");
  const elDbgTsaAstSize = document.getElementById("tsa-debug-ast-size");
  const elTsaLogOutput = document.getElementById("tsa-log-output");
  const elStudentHint = document.getElementById("tsa-student-hint");

  if (elDbgClient && elDbgReq && elDbgRes) {
    const debugState = {
      lastClientEvent: null,
      lastEngineRequest: null,
      lastEngineResponse: null,
      lastTsa: null,
      tsaLog: [],
    };

    const formatClientEvent = (ev) => {
      if (!ev) return "—";
      const parts = [];
      if (ev.type) parts.push(ev.type);
      if (ev.surfaceNodeKind) parts.push(ev.surfaceNodeKind);
      if (ev.surfaceNodeId) parts.push(ev.surfaceNodeId);
      return parts.join(" · ");
    };

    const formatEngineRequest = (req) => {
      if (!req) return "—";
      const base = req.type || "?";
      const srcType = req.clientEvent && req.clientEvent.type;
      return srcType ? base + " ← " + srcType : base;
    };

    const formatEngineResponse = (res) => {
      if (!res) return "—";
      if (res.type === "error") {
        return "error " + (res.requestType || "") + " · " + (res.message || "");
      }
      const base = (res.type || "ok") + " " + (res.requestType || "");
      const highlights =
        res.result && Array.isArray(res.result.highlights)
          ? res.result.highlights.join(", ")
          : "";
      return highlights ? base + " · highlights: " + highlights : base;
    };

    const truncate = (value, max) => {
      if (value == null) return "";
      const s = String(value);
      if (s.length <= max) return s;
      return s.slice(0, max - 1) + "…";
    };

    const formatTsaOperator = (tsa) => {
      if (!tsa || !tsa.meta) return "—";
      const idx =
        typeof tsa.meta.operatorIndex === "number" && Number.isFinite(tsa.meta.operatorIndex)
          ? tsa.meta.operatorIndex
          : -1;
      const kind =
        typeof tsa.meta.operatorKind === "string" && tsa.meta.operatorKind
          ? tsa.meta.operatorKind
          : "";
      if (idx < 0 && !kind) return "—";
      return kind ? String(idx) + " · " + kind : String(idx);
    };

    const formatTsaWindowBefore = (tsa) => {
      if (!tsa) return "—";
      const win = tsa.localWindowBefore || tsa.latexBefore || "";
      if (!win) return "—";
      return truncate(win, 48);
    };

    const formatTsaWindowAfter = (tsa) => {
      if (!tsa) return "—";
      const win = tsa.localWindowAfter || tsa.latexAfter || "";
      if (!win) return "—";
      return truncate(win, 48);
    };

    const formatTsaError = (tsa) => {
      if (!tsa || !tsa.meta || !tsa.meta.error) return "—";
      const err = tsa.meta.error;
      const kind = err.kind || "Error";
      const msg = err.message || "";
      return truncate(kind + ": " + msg, 60);
    };


    const formatTsaStrategy = (tsa) => {
      if (!tsa || !tsa.meta) return "—";
      const s = typeof tsa.meta.strategy === "string" ? tsa.meta.strategy : "";
      return s || "—";
    };

    const formatTsaInvariant = (tsa) => {
      if (!tsa || !tsa.meta) return "—";
      const id = typeof tsa.meta.invariantId === "string" ? tsa.meta.invariantId : "";
      return id || "—";
    };

    const formatTsaInvariantText = (tsa) => {
      if (!tsa || !tsa.meta) return "—";
      const id = typeof tsa.meta.invariantId === "string" ? tsa.meta.invariantId : "";
      if (!id) return "—";
      switch (id) {
        case "MI1.add-rat-rat":
          return "Adding two rational numbers (Math Invariant #1).";
        case "MI1.sub-rat-rat":
          return "Subtracting two rational numbers (Math Invariant #1).";
        case "MI1.mul-rat-rat":
          return "Multiplying two rational numbers (Math Invariant #1).";
        case "MI1.div-rat-rat":
          return "Dividing two rational numbers (Math Invariant #1).";
        default:
          return id;
      }
    };

    const formatStudentHint = (tsa) => {
      if (!tsa || !tsa.meta) return "—";
      const id = typeof tsa.meta.invariantId === "string" ? tsa.meta.invariantId : "";
      if (!id) return "—";
      switch (id) {
        case "MI1.add-rat-rat":
          return "Next step: add two rational numbers (Math Invariant #1).";
        case "MI1.sub-rat-rat":
          return "Next step: subtract two rational numbers (Math Invariant #1).";
        case "MI1.mul-rat-rat":
          return "Next step: multiply two rational numbers (Math Invariant #1).";
        case "MI1.div-rat-rat":
          return "Next step: divide two rational numbers (Math Invariant #1).";
        default:
          return "Invariant step: " + id;
      }
    };

    const countAstNodesJSON = (node) => {
      if (!node || typeof node !== "object") return 0;
      switch (node.type) {
        case "rat":
          return 1;
        case "add":
        case "mul": {
          const args = Array.isArray(node.args) ? node.args : [];
          return 1 + args.reduce((sum, x) => sum + countAstNodesJSON(x), 0);
        }
        case "sub":
        case "div":
        case "pow": {
          const l = countAstNodesJSON(node.left);
          const r = countAstNodesJSON(node.right);
          return 1 + l + r;
        }
        case "sqrt":
        case "cbrt": {
          return 1 + countAstNodesJSON(node.arg);
        }
        default:
          return 1;
      }
    };

    const formatTsaAstSize = (tsa) => {
      if (!tsa) return "—";
      const before = countAstNodesJSON(tsa.astBeforeJSON);
      const after = countAstNodesJSON(tsa.astAfterJSON);
      if (!before && !after) return "—";
      if (before === after) return String(before);
      return String(before) + " → " + String(after);
    };


    const formatTsaLog = (log) => {
      if (!log || !log.length) return "—";
      const lines = log.map((entry, i) => {
        const n = String(i + 1).padStart(2, " ");
        const ts = entry.ts || "";
        const op = entry.operator || "";
        const strat = entry.strategy || "";
        const inv = entry.invariant || "";
        const win = entry.before || "";
        return n + ". " + ts + " · op=" + op + " · strat=" + strat + " · inv=" + inv + " · " + win;
      });
      return lines.join("\n");
    };

    fileBus.subscribe((msg) => {
      if (!msg) return;

      switch (msg.messageType) {
        case "ClientEvent":
          debugState.lastClientEvent = msg.payload;

          // P1: Handle integer clicks with proper double-click detection
          const ev = msg.payload;
          if (ev && ev.type === "click" && ev.surfaceNodeKind &&
            (ev.surfaceNodeKind === "Num" || ev.surfaceNodeKind === "Number" || ev.surfaceNodeKind === "Integer")) {
            const clickCount = ev.click?.clickCount || 1;
            const surfaceId = ev.surfaceNodeId;
            const astId = ev.astNodeId; // THIS is the authoritative AST path from surface map correlation
            const now = Date.now();
            const clickedValue = ev.latexFragment || ev.surfaceNodeText || "?";

            // Diagnostic: Log the astNodeId from the click event
            console.log(`[P1-CLICK] Integer click event: surfaceId=${surfaceId}, astId=${astId || 'MISSING!'}, value="${clickedValue}", clickCount=${clickCount}`);

            // SAFE INSTRUMENTATION: Block precise clicks when Stable-ID is disabled
            if (!stableIdState.enabled) {
              console.warn(`[P1-CLICK] BLOCKED: Stable-ID disabled (${stableIdState.reason}). No precise clicks allowed.`);
              alert(`Stable-ID is disabled for this expression. Precise clicks are not available.\n\nReason: ${stableIdState.reason}`);
              return;
            }

            // STABLE-ID: If astId is missing from event, try to get it from DOM data-ast-id
            // This is more reliable than surface map correlation for duplicate values
            let effectiveAstId = astId;
            if (!effectiveAstId) {
              const surfaceNode = window.__currentSurfaceMap?.atoms?.find(a => a && a.id === surfaceId);
              if (surfaceNode && surfaceNode.dom) {
                effectiveAstId = getAstIdFromDOM(surfaceNode.dom);
              }
            }

            // BUG LOG: If still no astId, log as bug - surface-map correlation failed
            if (!effectiveAstId) {
              console.log(`[BUG] Missing data-ast-id for clickable element: surfaceId=${surfaceId} value="${clickedValue}" - this should not happen with Stable-ID injection`);
            }

            // STABLE-ID: Get stableKey for this click to handle duplicates correctly
            const surfaceNode = window.__currentSurfaceMap?.atoms?.find(a => a && a.id === surfaceId);
            const clickStableKey = surfaceNode?.stableKey || null;
            console.log(`[P1-CLICK] StableKey: ${clickStableKey || 'MISSING'}`);

            // CRITICAL FIX: Check if this is a non-targetable path (fraction children)
            const isNonTargetable = effectiveAstId && effectiveAstId.startsWith && effectiveAstId.startsWith('NON_TARGETABLE:');
            if (isNonTargetable) {
              console.warn(`[P1-CLICK] Non-targetable integer (fraction child): ${effectiveAstId}`);
              // Show user message
              const msg = "This number is inside a simple fraction and cannot be targeted individually (backend limitation).";
              alert(msg);
              // Update diagnostics
              updateP1Diagnostics({
                selectedSurfaceNodeId: surfaceId,
                resolvedAstNodeId: effectiveAstId,
                lastHintApplyError: "NON_TARGETABLE: fraction child",
                lastHintApplyStatus: "blocked"
              });
              return; // Abort click processing
            }

            // TraceHub: Emit VIEWER_INTEGER_CLICK_TARGETED
            if (typeof window !== "undefined" && window.__traceHub) {
              window.__traceHub.emit({
                module: "viewer.main",
                event: "VIEWER_INTEGER_CLICK_TARGETED",
                data: {
                  latex: currentLatex,
                  surfaceNodeId: surfaceId,
                  value: clickedValue,
                  selectionPath: effectiveAstId || "MISSING",
                  clickCount
                }
              });
            }

            // Part A: detail=2 FAST APPLY for BLUE mode
            // If second click of dblclick AND same token is selected AND mode is BLUE -> apply immediately
            if (clickCount === 2 && integerCycleState.stableKey === clickStableKey && integerCycleState.mode === MODE_BLUE) {
              integerCycleState.dblclickLockUntil = Date.now() + 300;
              const targetDenom = integerCycleState.step2Info?.oppositeDenom || "?";
              console.log(`[DOUBLE-CLICK APPLY via detail=2] stableKey=${clickStableKey} mode=${integerCycleState.mode} primitive=P.ONE_TO_TARGET_DENOM targetDenom=${targetDenom}`);

              // Cancel pending timeout
              if (integerCycleState.pendingClickTimeout) {
                clearTimeout(integerCycleState.pendingClickTimeout);
                integerCycleState.pendingClickTimeout = null;
              }

              // Apply via gateway
              applyCurrentHintForStableKey("[DOUBLE-CLICK APPLY]");
              integerCycleState.lastClickTime = 0;
              integerCycleState.lastClickNodeId = null;
              return;
            }

            // Check if this is a browser-reported double-click (e.detail >= 2)
            if (clickCount === 2) {
              // Double-click detected by browser - set lock to prevent cycling
              integerCycleState.dblclickLockUntil = Date.now() + 300;

              // Cancel any pending single-click timeout
              if (integerCycleState.pendingClickTimeout) {
                clearTimeout(integerCycleState.pendingClickTimeout);
                integerCycleState.pendingClickTimeout = null;
              }

              // Update state to match the clicked node
              integerCycleState.selectedNodeId = surfaceId;
              integerCycleState.astNodeId = effectiveAstId;
              integerCycleState.stableKey = clickStableKey;

              // Check for Step2 context
              const step2Ctx = detectStep2MultiplierContext(surfaceId, effectiveAstId, window.__currentSurfaceMap);
              integerCycleState.isStep2Context = step2Ctx.isStep2Context;
              integerCycleState.step2Info = step2Ctx.isStep2Context ? step2Ctx : null;

              // BLOCK double-click in GREEN mode - user must cycle first
              if (integerCycleState.mode === MODE_GREEN) {
                console.log(`[APPLY BLOCKED] stableKey=${clickStableKey} mode=0 (GREEN) - double-click blocked`);
                // Just show selection, don't apply
                applyIntegerHighlight(surfaceId, MODE_GREEN);
                integerCycleState.lastClickTime = 0;
                integerCycleState.lastClickNodeId = null;
                return;
              }

              // Apply via single gateway (respects current mode)
              applyCurrentHintForStableKey("[DOUBLE-CLICK APPLY]");

              // Reset timing state
              integerCycleState.lastClickTime = 0;
              integerCycleState.lastClickNodeId = null;

            } else if (clickCount === 1) {
              // Single-click: check if this is actually a double-click based on timing
              const timeSinceLastClick = now - integerCycleState.lastClickTime;
              const sameNode = integerCycleState.lastClickNodeId === clickStableKey; // Use stableKey!

              if (sameNode && timeSinceLastClick < P1_DOUBLE_CLICK_THRESHOLD) {
                // This second single-click came too fast - it's a double-click!
                // Cancel any pending timeout
                if (integerCycleState.pendingClickTimeout) {
                  clearTimeout(integerCycleState.pendingClickTimeout);
                  integerCycleState.pendingClickTimeout = null;
                }

                console.log(`[P1] Double-click detected (timing): stableKey=${clickStableKey}, deltaMs=${timeSinceLastClick}`);
                // Set lock to prevent any pending cycling
                integerCycleState.dblclickLockUntil = Date.now() + 300;

                // BLOCK double-click in GREEN mode - user must cycle first
                if (integerCycleState.mode === MODE_GREEN) {
                  console.log(`[APPLY BLOCKED] stableKey=${clickStableKey} mode=0 (GREEN) - timing double-click blocked`);
                  integerCycleState.lastClickTime = 0;
                  integerCycleState.lastClickNodeId = null;
                  return;
                }

                // Apply via single gateway (respects current mode)
                applyCurrentHintForStableKey("[DOUBLE-CLICK APPLY]");

                // Reset timing state
                integerCycleState.lastClickTime = 0;
                integerCycleState.lastClickNodeId = null;

              } else {
                // This is a true single-click, but delay processing in case double-click follows
                // Cancel any previous pending click
                if (integerCycleState.pendingClickTimeout) {
                  clearTimeout(integerCycleState.pendingClickTimeout);
                }

                // CRITICAL FIX: Store astNodeId IMMEDIATELY on this click
                // This ensures if a double-click follows, we have the correct path
                integerCycleState.lastClickTime = now;
                integerCycleState.lastClickNodeId = clickStableKey; // Use stableKey!

                // Delay the cycle/selection logic
                integerCycleState.pendingClickTimeout = setTimeout(() => {
                  integerCycleState.pendingClickTimeout = null;

                  // Check dblclick lock - suppress cycling if within lock period
                  if (Date.now() < integerCycleState.dblclickLockUntil) {
                    console.log(`[CYCLE SUPPRESSED] stableKey=${clickStableKey} reason=dblclick`);
                    return;
                  }

                  // Process as true single-click
                  if (integerCycleState.stableKey === clickStableKey) {
                    // Same stableKey clicked again - check for timing-based double-click BEFORE cycling
                    const dt = Date.now() - integerCycleState.lastClickTime;
                    const isDblClick = dt > 0 && dt <= 350;

                    // For Step2 context in BLUE mode: timing-based dblclick -> APPLY
                    if (isDblClick && integerCycleState.isStep2Context && integerCycleState.mode === MODE_BLUE) {
                      console.log(`[DBL-DET] stableKey=${clickStableKey} dt=${dt} mode=2 isStep2=true action=APPLY`);
                      applyCurrentHintForStableKey("[DOUBLE-CLICK APPLY]");
                      integerCycleState.lastClickTime = 0;
                      return;
                    }

                    // Otherwise cycle mode
                    const oldMode = integerCycleState.mode;
                    let newMode;

                    if (integerCycleState.isStep2Context) {
                      // Step2 tokens: GREEN <-> BLUE (skip ORANGE entirely)
                      newMode = oldMode === MODE_GREEN ? MODE_BLUE : MODE_GREEN;
                    } else {
                      // Normal tokens: GREEN <-> ORANGE
                      newMode = oldMode === MODE_GREEN ? MODE_ORANGE : MODE_GREEN;
                    }

                    integerCycleState.mode = newMode;
                    integerCycleState.cycleIndex = newMode; // Sync for compat
                    saveTokenModeState(); // FIX: Save mode after cycling
                    const modeConfig = MODE_CONFIG[newMode];
                    console.log(`[DBL-DET] stableKey=${clickStableKey} dt=${dt} mode=${oldMode} action=CYCLE`);
                    console.log(`[CYCLE] stableKey=${clickStableKey} mode ${oldMode}->${newMode} (${modeConfig.label}) isStep2=${integerCycleState.isStep2Context}`);
                  } else {
                    // Different token - save current token's state first, then switch
                    saveTokenModeState(); // FIX: Save outgoing token's state

                    // Restore new token's state (or init to GREEN)
                    const restored = restoreTokenModeState(clickStableKey);
                    integerCycleState.selectedNodeId = surfaceId;
                    integerCycleState.astNodeId = effectiveAstId;
                    integerCycleState.stableKey = clickStableKey;

                    // FIX: ALWAYS revalidate Step2 context (expression may have changed after Step2 apply)
                    const step2Ctx = detectStep2MultiplierContext(surfaceId, effectiveAstId, window.__currentSurfaceMap);
                    integerCycleState.isStep2Context = step2Ctx.isStep2Context;
                    integerCycleState.step2Info = step2Ctx.isStep2Context ? step2Ctx : null;

                    // Validate restored mode: if BLUE but Step2 no longer available, fallback to GREEN
                    let validatedMode = restored.mode;
                    if (restored.mode === MODE_BLUE && !step2Ctx.isStep2Context) {
                      if (window.__debugStep2Cycle) {
                        console.log(`[STEP2-CYCLE] Mode validation: BLUE no longer valid (Step2 context gone), falling back to GREEN`);
                      }
                      validatedMode = MODE_GREEN;
                    }
                    // If non-Step2 token had ORANGE saved but now is Step2, keep ORANGE (it's valid)
                    // If Step2 token had ORANGE saved (shouldn't happen), fallback to GREEN
                    if (validatedMode === MODE_ORANGE && step2Ctx.isStep2Context) {
                      if (window.__debugStep2Cycle) {
                        console.log(`[STEP2-CYCLE] Mode validation: ORANGE not valid for Step2 token, falling back to GREEN`);
                      }
                      validatedMode = MODE_GREEN;
                    }

                    integerCycleState.mode = validatedMode;
                    integerCycleState.cycleIndex = validatedMode;

                    // Update saved state with current validated values
                    saveTokenModeState();

                    if (window.__debugStep2Cycle) {
                      console.log(`[STEP2-CYCLE] stableKey=${clickStableKey} hasStep2=${step2Ctx.isStep2Context} allowedModes=[GREEN,${step2Ctx.isStep2Context ? 'BLUE' : 'ORANGE'}] restoredMode=${restored.mode} validatedMode=${validatedMode}`);
                    }
                    console.log(`[CYCLE] stableKey=${clickStableKey} mode=${integerCycleState.mode} isStep2=${integerCycleState.isStep2Context}${integerCycleState.step2Info?.oppositeDenom ? ` oppositeDenom=${integerCycleState.step2Info.oppositeDenom}` : ''}`);
                  }
                  applyIntegerHighlight(surfaceId, integerCycleState.mode);

                  // Update diagnostics
                  updateP1Diagnostics({
                    selectedSurfaceNodeId: surfaceId,
                    resolvedAstNodeId: integerCycleState.astNodeId || "MISSING",
                    primitiveId: integerCycleState.primitives[integerCycleState.cycleIndex]?.id || "N/A"
                  });

                  // P1: Ensure astNodeId + backend choice list (non-blocking)
                  ensureP1IntegerContext(surfaceId, astId || integerCycleState.astNodeId).catch(err => {
                    console.warn("[P1] ensureP1IntegerContext failed (single-click):", err);
                  });
                }, P1_DOUBLE_CLICK_THRESHOLD);
              }
            }
          }
          break;
        case "EngineRequest":
          debugState.lastEngineRequest = msg.payload;
          break;
        case "EngineResponse": {
          const res = msg.payload;
          debugState.lastEngineResponse = res;

          const tsa =
            res &&
              res.result &&
              res.result.meta &&
              res.result.meta.tsa
              ? res.result.meta.tsa
              : null;
          debugState.lastTsa = tsa;

          if (tsa) {
            const entry = {
              ts: new Date().toISOString(),
              operator: formatTsaOperator(tsa),
              strategy: formatTsaStrategy(tsa),
              invariant: formatTsaInvariant(tsa),
              before: tsa.localWindowBefore || tsa.latexBefore || "",
              after: tsa.localWindowAfter || tsa.latexAfter || "",
            };
            debugState.tsaLog.push(entry);
            if (debugState.tsaLog.length > 12) {
              debugState.tsaLog.shift();
            }
          }

          // Apply engine result to the viewer only for preview/apply steps.
          if (
            res &&
            res.type === "ok" &&
            res.requestType &&
            res.result &&
            typeof res.result.latex === "string"
          ) {
            const status = res.result.meta ? res.result.meta.backendStatus : null;
            const shouldApply =
              res.requestType === "applyStep" &&
              status === "step-applied";

            if (shouldApply) {
              const newLatex = res.result.latex;
              if (newLatex && typeof newLatex === "string") {
                const oldLatex = currentLatex;
                currentLatex = newLatex;
                if (oldLatex !== newLatex) {
                  clearSelection("latex-changed");
                }
                renderFormula();
                buildAndShowMap();
              }
            }

            // NEW: Handle choice response - show popup with available actions
            if (status === "choice" && res.result.meta && res.result.meta.choices) {
              const choices = res.result.meta.choices;
              const clickContext = res.result.meta.clickContext || {};
              console.log("[MainJS] Choice response - showing popup", choices, clickContext);
              showChoicePopup(choices, clickContext, res.result.latex);
            }
          }
          break;
        }
        default:
          return;
      }

      elDbgClient.textContent = formatClientEvent(debugState.lastClientEvent);
      elDbgReq.textContent = formatEngineRequest(debugState.lastEngineRequest);
      elDbgRes.textContent = formatEngineResponse(debugState.lastEngineResponse);

      if (elDbgTsaOp && elDbgTsaStrategy && elDbgTsaInvariant && elDbgTsaInvariantText && elDbgTsaBefore && elDbgTsaAfter && elDbgTsaError && elDbgTsaAstSize) {
        elDbgTsaOp.textContent = formatTsaOperator(debugState.lastTsa);
        elDbgTsaStrategy.textContent = formatTsaStrategy(debugState.lastTsa);
        elDbgTsaInvariant.textContent = formatTsaInvariant(debugState.lastTsa);
        elDbgTsaInvariantText.textContent = formatTsaInvariantText(debugState.lastTsa);
        elDbgTsaBefore.textContent = formatTsaWindowBefore(debugState.lastTsa);
        elDbgTsaAfter.textContent = formatTsaWindowAfter(debugState.lastTsa);
        elDbgTsaError.textContent = formatTsaError(debugState.lastTsa);
        elDbgTsaAstSize.textContent = formatTsaAstSize(debugState.lastTsa);
      }
      if (elTsaLogOutput) {
        elTsaLogOutput.textContent = formatTsaLog(debugState.tsaLog);
      }
      if (elStudentHint) {
        elStudentHint.textContent = formatStudentHint(debugState.lastTsa);
      }
    });
  }

  // Init test selector UI
  const select = document.getElementById("test-select");
  if (select) {
    select.addEventListener("change", () => {
      const idx = parseInt(select.value, 10) || 0;
      currentLatex = TESTS[Math.max(0, Math.min(TESTS.length - 1, idx))];
      clearSelection("latex-changed");
      renderFormula();
      buildAndShowMap();
    });
  }

  // Debounced rebuild on window resize (keeps hit-test accurate)
  let __resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(__resizeTimer);
    __resizeTimer = setTimeout(() => {
      renderFormula();
      buildAndShowMap();
    }, 120);
  });

  if (btnRebuild) {
    btnRebuild.addEventListener("click", () => {
      renderFormula();
      buildAndShowMap();

      // Init test selector UI
      const select = document.getElementById("test-select");
      if (select) {
        select.addEventListener("change", () => {
          const idx = parseInt(select.value, 10) || 0;
          currentLatex = TESTS[Math.max(0, Math.min(TESTS.length - 1, idx))];
          clearSelection("latex-changed");
          renderFormula();
          buildAndShowMap();
        });
      }

      // Debounced rebuild on window resize (keeps hit-test accurate)
      let __resizeTimer = null;
      window.addEventListener("resize", () => {
        clearTimeout(__resizeTimer);
        __resizeTimer = setTimeout(() => {
          renderFormula();
          buildAndShowMap();
        }, 120);
      });
    });
  }

  if (btnDownload) {
    btnDownload.addEventListener("click", () => {
      if (!current) return;
      const data = JSON.stringify(current.serializable, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "surface-map-canonical.json";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (btnDownloadEvents) {
    btnDownloadEvents.addEventListener("click", () => {
      eventRecorder.download();
    });
  }

  if (btnDownloadBus) {
    btnDownloadBus.addEventListener("click", () => {
      const history = fileBus.getHistory();
      if (!history || history.length === 0) {
        console.warn("[FileBus] No messages to download");
        return;
      }
      const lines = history.map((msg) => JSON.stringify(msg));
      const blob = new Blob([lines.join("\n") + "\n"], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "filebus-messages.jsonl";
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const btnDownloadSnapshot = document.getElementById("btn-download-snapshot");
  if (btnDownloadSnapshot) {
    btnDownloadSnapshot.addEventListener("click", async () => {
      try {
        const res = await fetch(`${getEngineBaseUrl()}/debug/step-snapshot/latest`);
        if (res.status === 404) {
          alert("No step snapshot available (perform a step first).");
          return;
        }
        if (!res.ok) {
          throw new Error(`Error ${res.status}`);
        }
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `step-snapshot-${json.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error(e);
        alert("Failed to download snapshot: " + e.message);
      }
    });
  }

  const btnDownloadSession = document.getElementById("btn-download-session");
  if (btnDownloadSession) {
    btnDownloadSession.addEventListener("click", async () => {
      try {
        const res = await fetch(`${getEngineBaseUrl()}/debug/step-snapshot/session`);
        if (!res.ok) {
          throw new Error(`Error ${res.status}`);
        }
        const json = await res.json();
        const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        a.download = `session-log-${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error(e);
        alert("Failed to download session log: " + e.message);
      }
    });
  }

  const btnResetSession = document.getElementById("btn-reset-session");
  if (btnResetSession) {
    btnResetSession.addEventListener("click", async () => {
      try {
        const res = await fetch(`${getEngineBaseUrl()}/debug/step-snapshot/reset`, { method: "POST" });
        if (res.ok) {
          alert("Session log reset.");
        } else {
          alert("Failed to reset session log.");
        }
      } catch (e) {
        console.error(e);
        alert("Failed to reset session log: " + e.message);
      }
    });
  }

  if (container) {
    // Helper: find SurfaceNode by coordinates or DOM element
    // CRITICAL FIX: For synthetic nodes (created from segmented mixed content like "2*5"),
    // DOM-based lookup fails because all synthetic nodes share the same parent element.
    // We MUST use coordinate-based hit-testing to correctly identify which segment was clicked.
    function findNodeByElement(target, e) {
      if (!current || !current.map) return null;

      // Primary: Use coordinate-based hit-testing (works for synthetic nodes)
      if (e && typeof e.clientX === 'number' && typeof e.clientY === 'number') {
        const { hitTestPoint } = window.__surfaceMapUtils || {};
        if (hitTestPoint) {
          const node = hitTestPoint(current.map, e.clientX, e.clientY, container);
          if (node) {
            return node;
          }
        }
      }

      // Fallback: DOM-based lookup (for non-synthetic nodes)
      if (!current.map.byElement) return null;
      let el = target;
      while (el && el !== container && !current.map.byElement.has(el)) {
        el = el.parentElement;
      }
      return el ? current.map.byElement.get(el) : null;
    }

    // PointerDown: start drag-selection (rubber band)
    container.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return; // left click only
      if (!current || !current.map) return;
      isDragging = true;
      dragStart = { x: e.clientX, y: e.clientY };
      dragEnd = { x: e.clientX, y: e.clientY };
    });

    // Hover: show the current atomic node and highlight it in KaTeX.
    container.addEventListener("pointermove", (e) => {
      if (!current || !current.map) return;
      const containerBox = container.getBoundingClientRect();

      // Update hover (always, regardless of drag)
      // CRITICAL FIX: Use coordinate-based hit-testing for hover
      const node = findNodeByElement(e.target, e);

      if (!node) {
        clearDomHighlight();
        updateHoverPanel("hover", null);
      } else {
        highlightNode(node);
        updateHoverPanel("hover", node);
      }

      // Proxy hover events into the DisplayAdapter
      displayAdapter.emitHover(node, e);

      // If dragging, update the rubber-band rectangle
      if (isDragging && dragStart) {
        dragEnd = { x: e.clientX, y: e.clientY };
        const dragRectEl = document.getElementById("drag-rect");
        if (dragRectEl) {
          const left = Math.min(dragStart.x, dragEnd.x) - containerBox.left;
          const top = Math.min(dragStart.y, dragEnd.y) - containerBox.top;
          const width = Math.abs(dragEnd.x - dragStart.x);
          const height = Math.abs(dragEnd.y - dragStart.y);
          dragRectEl.style.display = "block";
          dragRectEl.style.left = left + "px";
          dragRectEl.style.top = top + "px";
          dragRectEl.style.width = width + "px";
          dragRectEl.style.height = height + "px";
        }
      }
    });

    // Click: record the "last click" in the panel.
    container.addEventListener("pointerup", (e) => {
      if (!current || !current.map) return;
      const map = current.map;
      const containerBox = container.getBoundingClientRect();
      const dragRectEl = document.getElementById("drag-rect");

      // If there was a drag (meaningful movement), handle rectangle selection
      if (isDragging && dragStart) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const dist2 = dx * dx + dy * dy;
        const threshold2 = 7 * 7; // movement threshold; below this treat as a normal click

        if (dist2 > threshold2) {
          const rect = {
            left: Math.min(dragStart.x, e.clientX) - containerBox.left,
            right: Math.max(dragStart.x, e.clientX) - containerBox.left,
            top: Math.min(dragStart.y, e.clientY) - containerBox.top,
            bottom: Math.max(dragStart.y, e.clientY) - containerBox.top,
          };

          const nodesInRect = hitTestRect(map, rect);

          if (nodesInRect.length > 0) {
            if (e.ctrlKey) {
              // Ctrl + drag: toggle selection for all atoms inside the rectangle
              const newSet = new Set(selectionState.selectedIds);
              for (const n of nodesInRect) {
                if (newSet.has(n.id)) newSet.delete(n.id);
                else newSet.add(n.id);
              }
              selectionState.selectedIds = newSet;
              selectionState.mode = newSet.size <= 1 ? "single" : "multi";
              selectionState.primaryId = nodesInRect[nodesInRect.length - 1].id;
            } else {
              // Regular drag: select only what falls inside
              selectionState.selectedIds = new Set(nodesInRect.map((n) => n.id));
              selectionState.mode = "rect";
              selectionState.primaryId = nodesInRect[nodesInRect.length - 1].id;
            }
            applySelectionVisual(map);
            // Notify adapter about rectangle selection
            displayAdapter.emitSelectionChanged("rect", e);
          }

          // Hide the rectangle and reset drag state
          if (dragRectEl) {
            dragRectEl.style.display = "none";
          }
          isDragging = false;
          dragStart = null;
          dragEnd = null;
          return; // do not treat this as a normal click
        }
      }

      // If we got here, there was no drag (or it was tiny) -> treat as a click
      if (dragRectEl) {
        dragRectEl.style.display = "none";
      }
      isDragging = false;
      dragStart = null;
      dragEnd = null;

      if (e.button !== 0) return; // left click only

      // CRITICAL FIX: Use coordinate-based hit-testing for clicks
      const node = findNodeByElement(e.target, e);

      // DEBUG: Log click attempt
      console.log("[DEBUG] pointerup target:", e.target, "found node:", node);
      const elDbgClient = document.getElementById("engine-debug-client");
      if (elDbgClient) {
        elDbgClient.textContent = `Click attempt: ${node ? node.id : "null"} on ${e.target.tagName}`;
      }

      if (!node) return;

      // Update selection on click
      if (e.ctrlKey) {
        // Ctrl + click: toggle selection of a single node
        const newSet = new Set(selectionState.selectedIds);
        if (newSet.has(node.id)) {
          newSet.delete(node.id);
        } else {
          newSet.add(node.id);
        }
        selectionState.selectedIds = newSet;
        selectionState.mode = newSet.size === 0 ? "none" : (newSet.size === 1 ? "single" : "multi");
        selectionState.primaryId = newSet.size ? node.id : null;
      } else {
        // Regular click: single selection
        selectionState.selectedIds = new Set([node.id]);
        selectionState.mode = "single";
        selectionState.primaryId = node.id;
      }
      applySelectionVisual(map);
      // Notify adapter about updated selection state
      displayAdapter.emitSelectionChanged("click", e);

      // Click-debug panel
      updateHoverPanel("click", node);
      console.log("[click] SurfaceNode:", {
        id: node.id,
        kind: node.kind,
        role: node.role,
        latex: node.latexFragment,
        bbox: node.bbox,
        selectionMode: selectionState.mode,
        selectionCount: selectionState.selectedIds.size,
      });

      // SMART OPERATOR SELECTION: Create context when clicking on operator
      if (node.role === "operator" || node.kind === "BinaryOp" || node.kind === "MinusBinary") {
        console.log("[SmartOperatorSelection] Operator click detected:", node.kind, node.latexFragment);

        const operatorContext = createOperatorContext(node, current.map, getOperandNodes);

        if (operatorContext && isCompleteContext(operatorContext)) {
          const boxes = getContextBoundingBoxes(operatorContext);
          console.log("[SmartOperatorSelection] Context created successfully:", {
            operator: operatorContext.operatorSymbol,
            astPath: operatorContext.astPath,
            leftOperand: operatorContext.leftOperandSurfaceNode?.latexFragment,
            rightOperand: operatorContext.rightOperandSurfaceNode?.latexFragment,
            boundingBoxCount: boxes.length,
          });

          // Store context globally
          window.__currentOperatorContext = operatorContext;

          // PHASE 3: Request validation from backend and apply visual highlighting
          applyOperatorHighlight(operatorContext, boxes, currentLatex).then(validationType => {
            console.log("[SmartOperatorSelection] Applied highlight with validationType:", validationType);
          }).catch(err => {
            console.error("[SmartOperatorSelection] Highlight error:", err);
          });
        } else {
          console.log("[SmartOperatorSelection] Context incomplete - operands not found");
          window.__currentOperatorContext = null;
          clearOperatorHighlight();
        }
      }

      // Normalized click event for the rest of the pipeline
      displayAdapter.emitClick(node, e);
    });

    // Reset drag rectangle on pointer cancel/leave
    container.addEventListener("pointercancel", () => {
      const dragRectEl = document.getElementById("drag-rect");
      if (dragRectEl) dragRectEl.style.display = "none";
      isDragging = false; dragStart = null; dragEnd = null;
    });
    container.addEventListener("pointerleave", () => {
      const dragRectEl = document.getElementById("drag-rect");
      if (dragRectEl) dragRectEl.style.display = "none";
      isDragging = false; dragStart = null; dragEnd = null;
    });
  }

  // Click Outside to Clear Selection (Robust Capture Phase) - Added for V5 Fix
  window.addEventListener("pointerdown", (e) => {
    // Only proceed if we have an active selection
    const p1Active = typeof integerCycleState !== "undefined" && integerCycleState.selectedNodeId !== null;
    const selActive = typeof selectionState !== "undefined" && selectionState.selectedIds.size > 0;
    const overlayHasChildren = !!document.querySelector("#selection-overlay > div");
    const domHasClasses = !!document.querySelector(".p1-integer-selected");

    // Check if anything needs clearing
    if (!p1Active && !selActive && !overlayHasChildren && !domHasClasses) {
      return;
    }

    // Don't clear if clicking on the diag panels or context menu
    if (e.target.closest("#p1-diagnostics-panel")) return;
    if (e.target.closest("#choice-popup")) return;

    const container = document.getElementById("formula-container");
    if (!container) return;

    // Check if click is inside the container
    if (container.contains(e.target)) return;

    // Calculate dynamic threshold (approx 1 character width)
    let thresholdPx = 12; // Fallback
    try {
      // Try to measure a "0" digit in the current font
      const testSpan = document.createElement("span");
      testSpan.style.visibility = "hidden";
      testSpan.style.position = "absolute";
      testSpan.style.font = window.getComputedStyle(container).font;
      testSpan.textContent = "0";
      container.appendChild(testSpan);
      const w = testSpan.getBoundingClientRect().width;
      if (w > 0) thresholdPx = w;
      testSpan.remove();
    } catch (err) {
      // Ignore measurement errors
    }

    const box = container.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    // Check if outside the expanded box
    const isOutside =
      x < box.left - thresholdPx ||
      x > box.right + thresholdPx ||
      y < box.top - thresholdPx ||
      y > box.bottom + thresholdPx;

    if (isOutside) {
      console.info(`[SEL] outside-click`, { cleared: true, threshold: thresholdPx });
      if (typeof clearSelection === "function") clearSelection("outside-click");
    }
  }, { capture: true });

  console.info("[SEL] init", { entry: "app/main.js" });
});

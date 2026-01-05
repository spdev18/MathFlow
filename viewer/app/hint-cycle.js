/**
 * hint-cycle.js - State-driven hint cycle manager
 * 
 * Manages hint cycling state keyed by stableKey to avoid captured-state bugs.
 * Single source of truth for current selection and primitive.
 */

/**
 * @typedef {Object} Primitive
 * @property {string} id - Primitive ID (e.g., "P.INT_TO_FRAC")
 * @property {string} label - Display label
 * @property {string} color - CSS color
 * @property {string} [targetNodeId] - Optional AST path
 * @property {boolean} [isStep2] - True for Step 2 primitives
 * @property {string} [oppositeDenom] - For Step 2
 * @property {string} [side] - "left" or "right" for Step 2
 */

/**
 * @typedef {Object} HintCycleEntry
 * @property {string} stableKey - StableTokenKey
 * @property {string} surfaceNodeId - Surface map ID (for UI)
 * @property {string|null} astNodeId - AST path
 * @property {number} cycleIndex - Current mode index
 * @property {Primitive[]} primitives - Available primitives
 * @property {number} lastClickTime - Timestamp
 */

// Default primitives for integers
const DEFAULT_INTEGER_PRIMITIVES = [
    { id: "P.INT_TO_FRAC", label: "Convert to fraction", color: "#4CAF50" },     // Green
    { id: "P.INT_FACTOR_PRIMES", label: "Factor to primes", color: "#FF9800" },  // Orange
];

// State storage keyed by stableKey
const hintCycleEntries = new Map();

// Currently active entry
let activeStableKey = null;

// Prevent re-entry
let applying = false;

/**
 * Get or create entry for stableKey
 * @param {string} stableKey 
 * @returns {HintCycleEntry|null}
 */
function getEntry(stableKey) {
    if (!stableKey) return null;
    return hintCycleEntries.get(stableKey) || null;
}

/**
 * Get the currently active entry
 * @returns {HintCycleEntry|null}
 */
function getActiveEntry() {
    if (!activeStableKey) return null;
    return getEntry(activeStableKey);
}

/**
 * Select a token for hint cycling
 * @param {string} stableKey 
 * @param {string} surfaceNodeId 
 * @param {string|null} astNodeId 
 * @param {Primitive[]} [primitives] 
 */
function selectToken(stableKey, surfaceNodeId, astNodeId, primitives = null) {
    if (!stableKey) {
        console.warn("[HintCycle] selectToken called with null stableKey");
        return;
    }

    let entry = hintCycleEntries.get(stableKey);

    if (!entry) {
        // New entry
        entry = {
            stableKey,
            surfaceNodeId,
            astNodeId,
            cycleIndex: 0,
            primitives: primitives || [...DEFAULT_INTEGER_PRIMITIVES],
            lastClickTime: Date.now()
        };
        hintCycleEntries.set(stableKey, entry);
        console.log(`[HintCycle] Created entry for stableKey=${stableKey}, mode=0`);
    } else {
        // Update existing
        entry.surfaceNodeId = surfaceNodeId;
        entry.astNodeId = astNodeId || entry.astNodeId;
        if (primitives) {
            entry.primitives = primitives;
        }
        entry.lastClickTime = Date.now();
    }

    activeStableKey = stableKey;
}

/**
 * Cycle to next mode for active token
 * @returns {number} New cycle index
 */
function cycleNext() {
    const entry = getActiveEntry();
    if (!entry) {
        console.warn("[HintCycle] cycleNext: no active entry");
        return 0;
    }

    entry.cycleIndex = (entry.cycleIndex + 1) % entry.primitives.length;
    console.log(`[HintCycle] Cycled to mode=${entry.cycleIndex} (${entry.primitives[entry.cycleIndex]?.id})`);
    return entry.cycleIndex;
}

/**
 * Get current primitive for active entry
 * @returns {Primitive|null}
 */
function getCurrentPrimitive() {
    const entry = getActiveEntry();
    if (!entry) return null;
    return entry.primitives[entry.cycleIndex] || null;
}

/**
 * Get current state for active entry
 * @returns {{stableKey: string|null, astNodeId: string|null, surfaceNodeId: string|null, cycleIndex: number, primitive: Primitive|null}}
 */
function getCurrentState() {
    const entry = getActiveEntry();
    if (!entry) {
        return { stableKey: null, astNodeId: null, surfaceNodeId: null, cycleIndex: 0, primitive: null };
    }
    return {
        stableKey: entry.stableKey,
        astNodeId: entry.astNodeId,
        surfaceNodeId: entry.surfaceNodeId,
        cycleIndex: entry.cycleIndex,
        primitive: entry.primitives[entry.cycleIndex] || null
    };
}

/**
 * Update primitives for active entry (backend choices)
 * @param {Primitive[]} primitives 
 */
function setPrimitives(primitives) {
    const entry = getActiveEntry();
    if (!entry) return;
    entry.primitives = primitives;
    // Clamp cycleIndex
    if (entry.cycleIndex >= primitives.length) {
        entry.cycleIndex = 0;
    }
}

/**
 * Update astNodeId for active entry
 * @param {string} astNodeId 
 */
function setAstNodeId(astNodeId) {
    const entry = getActiveEntry();
    if (!entry) return;
    entry.astNodeId = astNodeId;
}

/**
 * Check if same token was recently clicked (for double-click detection)
 * @param {string} stableKey 
 * @param {number} thresholdMs 
 * @returns {boolean}
 */
function wasRecentlyClicked(stableKey, thresholdMs) {
    if (activeStableKey !== stableKey) return false;
    const entry = getEntry(stableKey);
    if (!entry) return false;
    return (Date.now() - entry.lastClickTime) < thresholdMs;
}

/**
 * Reset state (on expression change)
 */
function reset() {
    hintCycleEntries.clear();
    activeStableKey = null;
    applying = false;
    console.log("[HintCycle] Reset");
}

/**
 * Check/set applying lock
 */
function isApplying() { return applying; }
function setApplying(val) { applying = val; }

// Export module
export const HintCycle = {
    getEntry,
    getActiveEntry,
    selectToken,
    cycleNext,
    getCurrentPrimitive,
    getCurrentState,
    setPrimitives,
    setAstNodeId,
    wasRecentlyClicked,
    reset,
    isApplying,
    setApplying,
    DEFAULT_PRIMITIVES: DEFAULT_INTEGER_PRIMITIVES
};

// Also expose globally for inline scripts
if (typeof window !== "undefined") {
    window.HintCycle = HintCycle;
}

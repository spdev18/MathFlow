/**
 * primitives.registry.v5.ts
 *
 * Motor V5 Primitives Registry (Pure)
 * Source of Truth: `primitives_v5_improved_v3.html` & `motor_v5_primitive_layer_tech_spec.md`
 * 
 * This file MUST NOT import from any legacy system components to ensure isolation.
 */

// --- 1. Domain & Enums (Spec Section 2) ---

export type Domain =
    | "integers"
    | "fractions"
    | "decimals"
    | "mixed"
    | "signs"
    | "brackets"
    | "algebra"
    | "trig";

export type OperandType =
    | "int"
    | "nonzero-int"
    | "fraction"
    | "nonzero-fraction"
    | "decimal"
    | "mixed-number"
    | "any";

export type PrimitiveColor =
    | "green"
    | "yellow"
    | "red"
    | "blue";

export type UiMode =
    | "auto-apply"
    | "requires-confirmation"
    | "context-menu"
    | "diagnostic-only";

export type ActionClass =
    | "normal"
    | "diagnostic";

export type ClickTargetKind =
    | "operator"
    | "number"
    | "fractionBar"
    | "bracket"
    | "other";

// --- 2. Guards & Scenarios (Spec Section 3) ---

export type GuardId =
    | "divisor-nonzero"
    | "result-is-integer"
    | "numerators-coprime"
    | "denominators-equal"
    | "denominators-different"
    | "operands-free"
    | "inside-brackets"
    | "left-negative"
    | "right-negative"
    | "divisor-zero"
    | "remainder-zero"
    | "remainder-nonzero"
    | "is-decimal";

export type ScenarioId =
    | "SC.FRACTIONS_COMMON_DEN"
    | "SC.DISTRIBUTIVE_EXPAND"
    | "SC.COLLECT_LIKE_TERMS"
    | "SC.NORMALIZE_MIXED";

export interface ScenarioMeta {
    scenarioId: ScenarioId;
    stepIndex: number;
    stepCount: number;
    isTerminalStep: boolean;
}

// --- 2.5 Node Context (Spec Section 5) ---
export type ExpressionId = string;
export type NodeId = string;

export interface ClickTarget {
    nodeId: NodeId;
    kind: ClickTargetKind;
    operatorIndex?: number;
}

export interface NodeContext {
    expressionId: ExpressionId;
    nodeId: NodeId;
    clickTarget: ClickTarget;

    // AST properties
    operatorLatex?: string;
    leftOperandType?: OperandType;
    rightOperandType?: OperandType;

    // Domain properties (optional)
    leftDomain?: Domain;
    rightDomain?: Domain;
    denominatorsEqual?: boolean;
    denominatorsDifferent?: boolean;
    isInsideBrackets?: boolean;

    // Guards
    guards: Record<GuardId, boolean>;

    // Execution Target override (for V5 orchestrator)
    actionNodeId?: string;
}

// --- 3. Primitive Types (Spec Section 4) ---

/**
 * Unique ID for every primitive in the system.
 */
export type PrimitiveId =
    | "P.INT_ADD"
    | "P.INT_SUB"
    | "P.INT_MUL"
    | "P.INT_DIV_EXACT"
    | "P.INT_DIV_TO_FRAC"
    | "P.FRAC_ADD_SAME_DEN"
    | "P.FRAC_SUB_SAME_DEN"
    | "P.FRAC_MUL"
    | "P.FRAC_DIV"
    | "P.INT_TO_FRAC"
    | "P.FRAC_TIMES_ONE"
    | "P.ONE_TO_UNIT_FRAC_2"
    | "P.ONE_TO_UNIT_FRAC_3"
    | "P.ONE_TO_UNIT_FRAC_5"
    | "P.ONE_TO_UNIT_FRAC_7"
    | "P.ONE_TO_UNIT_FRAC_K"
    | "P.MIXED_TO_SUM"
    | "P.FRAC_ADD_DIFF_PREP"
    | "P.FRAC_SUB_DIFF_PREP"
    | "P.FRAC_ADD_DIFF_DEN_MUL1"
    | "P.FRAC_SUB_DIFF_DEN_MUL1"
    | "P.ONE_TO_TARGET_DENOM"
    | "P.DECIMAL_DIV"
    | "P.DECIMAL_TO_FRAC"
    | "P.BRACKETS_REMOVE"
    | "P.BRACKETS_CALC_INSIDE"
    | "P.DISTRIBUTE_MUL_ADD"
    | "P.DISTRIBUTE_MUL_SUB"
    | "P.FACTOR_ADD"
    | "P.FACTOR_SUB"
    | "P.ZERO_ADD_RIGHT"
    | "P.ZERO_ADD_LEFT"
    | "P.ZERO_SUB"
    | "P.ZERO_MUL_RIGHT"
    | "P.ZERO_MUL_LEFT"
    | "P.ONE_MUL_RIGHT"
    | "P.ONE_MUL_LEFT"
    | "P.ONE_DIV"
    | "P.SELF_DIV"
    | "P.DIV_BY_ZERO"
    | "P.ZERO_DIV_NONZERO"
    | "P.FRAC_SIMPLIFY_GCD"
    | "P.FRAC_ZERO_NUM"
    | "P.NEG_NEG"
    | "P.NEG_DISTRIBUTE_ADD"
    | "P.NEG_DISTRIBUTE_SUB"
    | "P.NEG_FRAC_NUM"
    | "P.NEG_FRAC_DEN"
    | "P.NEG_FRAC_BOTH"
    | "P.SUB_TO_ADD_NEG"
    | "P.ADD_NEG_TO_SUB"
    | "P.MUL_NEG_LEFT"
    | "P.MUL_NEG_RIGHT"
    | "P.MUL_NEG_BOTH"
    | "P.ADD_ASSOC_LEFT"
    | "P.ADD_ASSOC_RIGHT"
    | "P.MUL_ASSOC_LEFT"
    | "P.MUL_ASSOC_RIGHT"
    | "P.ADD_COMM"
    | "P.MUL_COMM"
    | "P.FRAC_IMPROPER_TO_MIXED"
    | "P.FRAC_MIXED_TO_IMPROPER"
    // Compatibility IDs (keep legacy IDs if needed by engine for now)
    | "P.FRAC_DIV_AS_MUL"
    | "P.FRAC_EQUIV";

/**
 * Definition of a single primitive row.
 */
export interface PrimitiveRow {
    id: PrimitiveId;

    // Classification
    domain: Domain;
    category: string;

    // Pattern / operator
    clickTargetKind: ClickTargetKind;
    operatorLatex?: string;
    operandTypes?: {
        left?: OperandType;
        right?: OperandType;
    };

    // Guard constraints
    requiredGuards?: GuardId[];
    forbiddenGuards?: GuardId[];

    // Scenario meta
    scenario?: ScenarioMeta | null;

    // UI & pedagogy
    color: PrimitiveColor;
    uiMode: UiMode;
    actionClass: ActionClass;
    label: string;

    // Engine integration
    enginePrimitiveId: PrimitiveId;

    // Optional
    notes?: string;
}

export interface PrimitivesTable {
    version: string;
    rows: PrimitiveRow[];
}

// --- 4. The Table Content (Source of Truth) ---

export const PRIMITIVES_V5_TABLE: PrimitivesTable = {
    version: "v5.0.0",
    rows: [
        {
            id: "P.INT_ADD",
            domain: "integers",
            category: "Integer Operations",
            clickTargetKind: "operator",
            operatorLatex: "+",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Integer Addition",
            enginePrimitiveId: "P.INT_ADD",
            operandTypes: { left: "int", right: "int" },
            notes: "Direct addition of two integers. Constraints: a,b,c ∈ ℤ"
        },
        {
            id: "P.INT_SUB",
            domain: "integers",
            category: "Integer Operations",
            clickTargetKind: "operator",
            operatorLatex: "-",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Integer Subtraction",
            enginePrimitiveId: "P.INT_SUB",
            operandTypes: { left: "int", right: "int" },
            notes: "Direct subtraction of two integers. Constraints: a,b,c ∈ ℤ"
        },
        {
            id: "P.INT_MUL",
            domain: "integers",
            category: "Integer Operations",
            clickTargetKind: "operator",
            operatorLatex: "*",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Integer Multiplication",
            enginePrimitiveId: "P.INT_MUL",
            operandTypes: { left: "int", right: "int" },
            notes: "Direct multiplication of two integers. Constraints: a,b,c ∈ ℤ"
        },
        {
            id: "P.INT_DIV_EXACT",
            domain: "integers",
            category: "Integer Operations",
            clickTargetKind: "operator",
            operatorLatex: "\\div",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Integer Division Exact",
            enginePrimitiveId: "P.INT_DIV_EXACT",
            requiredGuards: ["divisor-nonzero", "remainder-zero"],
            notes: "Integer division with no remainder. Constraints: a,b,c ∈ ℤ; b≠0; a mod b = 0"
        },
        {
            id: "P.INT_DIV_TO_FRAC",
            domain: "integers",
            category: "Integer Operations",
            clickTargetKind: "operator",
            operatorLatex: "\\div",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Integer Division to Fraction",
            enginePrimitiveId: "P.INT_DIV_TO_FRAC",
            requiredGuards: ["divisor-nonzero", "remainder-nonzero"],
            notes: "Convert non-exact division to fraction. Constraints: a,b ∈ ℤ; b≠0; a mod b ≠ 0"
        },
        {
            id: "P.DECIMAL_DIV",
            domain: "integers", // or generic numeric
            category: "Decimal Operations",
            clickTargetKind: "operator",
            operatorLatex: "\\div",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Decimal Division",
            enginePrimitiveId: "P.DECIMAL_DIV",
            operandTypes: { left: "int", right: "int" },
            requiredGuards: ["divisor-nonzero"],
            notes: "Decimal division. Constraints: divisor != 0"
        },
        {
            id: "P.FRAC_ADD_SAME_DEN",
            domain: "fractions",
            category: "Fraction Operations - Same Denominator",
            clickTargetKind: "operator",
            operatorLatex: "+",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Fraction Add Same Denominator",
            enginePrimitiveId: "P.FRAC_ADD_SAME_DEN",
            operandTypes: { left: "fraction", right: "fraction" },
            requiredGuards: ["denominators-equal"],
            notes: "Add numerators with same denominator. Constraints: a,c,b ∈ ℤ; b≠0"
        },
        {
            id: "P.FRAC_SUB_SAME_DEN",
            domain: "fractions",
            category: "Fraction Operations - Same Denominator",
            clickTargetKind: "operator",
            operatorLatex: "-",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Fraction Sub Same Denominator",
            enginePrimitiveId: "P.FRAC_SUB_SAME_DEN",
            notes: "Subtract numerators with same denominator. Constraints: a,c,b ∈ ℤ; b≠0"
        },
        {
            id: "P.FRAC_MUL",
            domain: "fractions",
            category: "Fraction Operations - Multiplication",
            clickTargetKind: "operator",
            operatorLatex: "*",
            operandTypes: { left: "fraction", right: "fraction" },
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Fraction Multiplication",
            enginePrimitiveId: "P.FRAC_MUL",
            notes: "Create product fraction. Constraints: a,b,c,d ∈ ℤ; b,d≠0"
        },
        {
            id: "P.FRAC_DIV_AS_MUL",
            domain: "fractions",
            category: "Fraction Operations - Division",
            clickTargetKind: "operator",
            operatorLatex: "\\div",
            operandTypes: { left: "fraction", right: "fraction" },
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Fraction Div as Mul",
            enginePrimitiveId: "P.FRAC_DIV_AS_MUL",
            notes: "Convert division to multiplication by reciprocal (Keep-Change-Flip)"
        },
        /* P.FRAC_DIV DISABLED for Student Mode - replaced by Div as Mul
        {
            id: "P.FRAC_DIV",
            domain: "fractions",
            category: "Fraction Operations - Division",
            clickTargetKind: "operator",
            operatorLatex: "\\div",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Fraction Division",
            enginePrimitiveId: "P.FRAC_DIV",
            notes: "Create division fraction (reciprocal). Constraints: a,b,c,d ∈ ℤ; b,c,d≠0"
        },
        */
        {
            id: "P.INT_TO_FRAC",
            domain: "integers",
            category: "Type Conversion",
            clickTargetKind: "number",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Integer to Fraction",
            enginePrimitiveId: "P.INT_TO_FRAC",
            forbiddenGuards: ["is-decimal"],
            notes: "Convert integer to fraction. Constraints: n \u2208 \u2124"
        },
        {
            id: "P.FRAC_TIMES_ONE",
            domain: "fractions",
            category: "Preparation for Equivalence",
            clickTargetKind: "number", // or fractionBar?
            color: "yellow",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Fraction Times One",
            enginePrimitiveId: "P.FRAC_TIMES_ONE",
            forbiddenGuards: ["is-decimal"],
            notes: "First step in creating equivalent fraction. Constraints: a,b \u2208 \u2124; b\u22600"
        },
        {
            id: "P.ONE_TO_UNIT_FRAC_2",
            domain: "integers",
            category: "Unit Fraction Conversion",
            clickTargetKind: "number",
            color: "blue",
            uiMode: "context-menu",
            actionClass: "normal",
            label: "1 to 2/2",
            enginePrimitiveId: "P.ONE_TO_UNIT_FRAC_2",
            forbiddenGuards: ["is-decimal"],
            notes: "Convert 1 to unit fraction 2/2. Always applicable"
        },
        {
            id: "P.ONE_TO_UNIT_FRAC_3",
            domain: "integers",
            category: "Unit Fraction Conversion",
            clickTargetKind: "number",
            color: "blue",
            uiMode: "context-menu",
            actionClass: "normal",
            label: "1 to 3/3",
            enginePrimitiveId: "P.ONE_TO_UNIT_FRAC_3",
            forbiddenGuards: ["is-decimal"],
            notes: "Convert 1 to unit fraction 3/3. Always applicable"
        },
        {
            id: "P.ONE_TO_UNIT_FRAC_5",
            domain: "integers",
            category: "Unit Fraction Conversion",
            clickTargetKind: "number",
            color: "blue",
            uiMode: "context-menu",
            actionClass: "normal",
            label: "1 to 5/5",
            enginePrimitiveId: "P.ONE_TO_UNIT_FRAC_5",
            forbiddenGuards: ["is-decimal"],
            notes: "Convert 1 to unit fraction 5/5. Always applicable"
        },
        {
            id: "P.ONE_TO_UNIT_FRAC_7",
            domain: "integers",
            category: "Unit Fraction Conversion",
            clickTargetKind: "number",
            color: "blue",
            uiMode: "context-menu",
            actionClass: "normal",
            label: "1 to 7/7",
            enginePrimitiveId: "P.ONE_TO_UNIT_FRAC_7",
            forbiddenGuards: ["is-decimal"],
            notes: "Convert 1 to unit fraction 7/7. Always applicable"
        },
        {
            id: "P.ONE_TO_UNIT_FRAC_K",
            domain: "integers",
            category: "Unit Fraction Conversion",
            clickTargetKind: "number",
            color: "blue",
            uiMode: "context-menu",
            actionClass: "normal",
            label: "1 to k/k",
            enginePrimitiveId: "P.ONE_TO_UNIT_FRAC_K",
            forbiddenGuards: ["is-decimal"],
            notes: "Convert 1 to unit fraction k/k. Constraints: k ∈ ℤ; k≠0"
        },
        {
            id: "P.MIXED_TO_SUM",
            domain: "mixed",
            category: "Mixed Number Decomposition",
            clickTargetKind: "number",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Mixed to Sum",
            enginePrimitiveId: "P.MIXED_TO_SUM",
            forbiddenGuards: ["is-decimal"], // Decimals should use P.DECIMAL_TO_FRAC instead
            notes: "Decompose mixed number. Constraints: n,a,b ∈ ℤ; b≠0; 0<a<b"
        },
        {
            id: "P.FRAC_ADD_DIFF_PREP",
            domain: "fractions",
            category: "Different Denominator Preparation",
            clickTargetKind: "operator",
            operatorLatex: "__DISABLED__", // DISABLED: legacy PREP primitive was being selected incorrectly
            operandTypes: { left: "int", right: "int" },  // FIXED: Restrict to integers, not fractions
            color: "yellow",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Prep Add Different Denom",
            enginePrimitiveId: "P.FRAC_ADD_DIFF_PREP",
            notes: "Prepare both fractions. Constraints: a,b,c,d ∈ ℤ; b,d≠0; b≠d"
        },
        {
            id: "P.FRAC_SUB_DIFF_PREP",
            domain: "fractions",
            category: "Different Denominator Preparation",
            clickTargetKind: "operator",
            operatorLatex: "__DISABLED__", // DISABLED: legacy PREP primitive was being selected incorrectly
            operandTypes: { left: "int", right: "int" },  // FIXED: Restrict to integers, not fractions
            color: "yellow",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Prep Sub Different Denom",
            enginePrimitiveId: "P.FRAC_SUB_DIFF_PREP",
            notes: "Prepare both fractions. Constraints: a,b,c,d ∈ ℤ; b,d≠0; b≠d"
        },
        {
            id: "P.FRAC_ADD_DIFF_DEN_MUL1",
            domain: "fractions",
            category: "Fraction Operations - Different Denominator",
            clickTargetKind: "operator",
            operatorLatex: "+",
            operandTypes: { left: "fraction", right: "fraction" },
            color: "yellow",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Add Frac Diff Denom (Step 1)",
            enginePrimitiveId: "P.FRAC_ADD_DIFF_DEN_MUL1",
            forbiddenGuards: ["denominators-equal"],
            notes: "Step 1: Multiply both fractions by 1. Constraints: a/b + c/d; b≠d"
        },
        {
            id: "P.FRAC_SUB_DIFF_DEN_MUL1",
            domain: "fractions",
            category: "Fraction Operations - Different Denominator",
            clickTargetKind: "operator",
            operatorLatex: "-",
            operandTypes: { left: "fraction", right: "fraction" },
            color: "yellow",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Sub Frac Diff Denom (Step 1)",
            enginePrimitiveId: "P.FRAC_SUB_DIFF_DEN_MUL1",
            forbiddenGuards: ["denominators-equal"],
            notes: "Step 1: Multiply both fractions by 1. Constraints: a/b - c/d; b≠d"
        },
        {
            id: "P.ONE_TO_TARGET_DENOM",
            domain: "integers",
            category: "Fraction Preparation - Different Denominator",
            clickTargetKind: "number",
            color: "yellow",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Convert 1 to d/d",
            enginePrimitiveId: "P.ONE_TO_TARGET_DENOM",
            forbiddenGuards: ["is-decimal"],
            notes: "Converts 1 to d/d matches the other fraction's denominator."
        },
        {
            id: "P.DECIMAL_TO_FRAC",
            domain: "decimals",
            category: "Decimal Conversion",
            clickTargetKind: "number",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Decimal to Fraction",
            enginePrimitiveId: "P.DECIMAL_TO_FRAC",
            requiredGuards: ["is-decimal"],
            notes: "Convert decimal to fraction. Constraints: Decimal with n digits"
        },
        {
            id: "P.BRACKETS_REMOVE",
            domain: "brackets",
            category: "Bracket Operations",
            clickTargetKind: "bracket",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Remove Brackets",
            enginePrimitiveId: "P.BRACKETS_REMOVE",
            notes: "Remove unnecessary parentheses. Constraints: No operators outside"
        },
        {
            id: "P.BRACKETS_CALC_INSIDE",
            domain: "brackets",
            category: "Bracket Operations",
            clickTargetKind: "bracket",
            color: "yellow",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Calculate Inside Brackets",
            enginePrimitiveId: "P.BRACKETS_CALC_INSIDE",
            notes: "Calculate expression inside. Constraints: Can be calculated"
        },
        {
            id: "P.DISTRIBUTE_MUL_ADD",
            domain: "algebra", // or mixed/integers
            category: "Distributive Property",
            clickTargetKind: "operator", // or number (the factor)
            operatorLatex: "\\times", // Implicit mult?
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Distribute over Addition",
            enginePrimitiveId: "P.DISTRIBUTE_MUL_ADD",
            notes: "Distribute multiplication over addition. Constraints: a,b,c: int/frac"
        },
        {
            id: "P.DISTRIBUTE_MUL_SUB",
            domain: "algebra",
            category: "Distributive Property",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Distribute over Subtraction",
            enginePrimitiveId: "P.DISTRIBUTE_MUL_SUB",
            notes: "Distribute multiplication over subtraction. Constraints: a,b,c: int/frac"
        },
        {
            id: "P.FACTOR_ADD",
            domain: "algebra",
            category: "Factoring",
            clickTargetKind: "operator",
            operatorLatex: "+",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Factor Addition",
            enginePrimitiveId: "P.FACTOR_ADD",
            notes: "Factor common term. Constraints: a,b,c: int/frac; a≠0"
        },
        {
            id: "P.FACTOR_SUB",
            domain: "algebra",
            category: "Factoring",
            clickTargetKind: "operator",
            operatorLatex: "-",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Factor Subtraction",
            enginePrimitiveId: "P.FACTOR_SUB",
            notes: "Factor common term. Constraints: a,b,c: int/frac; a≠0"
        },
        {
            id: "P.ZERO_ADD_RIGHT",
            domain: "integers",
            category: "Identity Properties",
            clickTargetKind: "operator",
            operatorLatex: "+",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Add Zero (Right)",
            enginePrimitiveId: "P.ZERO_ADD_RIGHT",
            notes: "Additive identity. Constraints: Any a"
        },
        {
            id: "P.ZERO_ADD_LEFT",
            domain: "integers",
            category: "Identity Properties",
            clickTargetKind: "operator",
            operatorLatex: "+",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Add Zero (Left)",
            enginePrimitiveId: "P.ZERO_ADD_LEFT",
            notes: "Additive identity. Constraints: Any a"
        },
        {
            id: "P.ZERO_SUB",
            domain: "integers",
            category: "Identity Properties",
            clickTargetKind: "operator",
            operatorLatex: "-",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Subtract Zero",
            enginePrimitiveId: "P.ZERO_SUB",
            notes: "Subtracting zero. Constraints: Any a"
        },
        {
            id: "P.ZERO_MUL_RIGHT",
            domain: "integers",
            category: "Zero Properties",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Multiply Zero (Right)",
            enginePrimitiveId: "P.ZERO_MUL_RIGHT",
            notes: "Multiplication by zero. Constraints: Any a"
        },
        {
            id: "P.ZERO_MUL_LEFT",
            domain: "integers",
            category: "Zero Properties",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Multiply Zero (Left)",
            enginePrimitiveId: "P.ZERO_MUL_LEFT",
            notes: "Multiplication by zero. Constraints: Any a"
        },
        {
            id: "P.ONE_MUL_RIGHT",
            domain: "integers",
            category: "Identity Properties",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Multiply One (Right)",
            enginePrimitiveId: "P.ONE_MUL_RIGHT",
            notes: "Multiplicative identity. Constraints: Any a"
        },
        {
            id: "P.ONE_MUL_LEFT",
            domain: "integers",
            category: "Identity Properties",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Multiply One (Left)",
            enginePrimitiveId: "P.ONE_MUL_LEFT",
            notes: "Multiplicative identity. Constraints: Any a"
        },
        {
            id: "P.ONE_DIV",
            domain: "integers",
            category: "Identity Properties",
            clickTargetKind: "operator",
            operatorLatex: "\\div",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Divide by One",
            enginePrimitiveId: "P.ONE_DIV",
            notes: "Division by one. Constraints: a ∈ ℤ or fraction"
        },
        {
            id: "P.SELF_DIV",
            domain: "integers",
            category: "Identity Properties",
            clickTargetKind: "operator",
            operatorLatex: "\\div",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Divide by Self",
            enginePrimitiveId: "P.SELF_DIV",
            notes: "Number divided by itself. Constraints: a≠0"
        },
        {
            id: "P.DIV_BY_ZERO",
            domain: "integers",
            category: "Error Diagnostics",
            clickTargetKind: "operator",
            operatorLatex: "\\div",
            color: "red",
            uiMode: "diagnostic-only",
            actionClass: "diagnostic",
            label: "Division by Zero",
            enginePrimitiveId: "P.DIV_BY_ZERO",
            notes: "Division by zero is undefined. Constraints: Any a",
            requiredGuards: ["divisor-zero"]
        },
        {
            id: "P.ZERO_DIV_NONZERO",
            domain: "integers",
            category: "Zero Properties",
            clickTargetKind: "operator",
            operatorLatex: "\\div",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Zero Divided by Nonzero",
            enginePrimitiveId: "P.ZERO_DIV_NONZERO",
            notes: "Zero divided by non-zero. Constraints: a≠0"
        },
        {
            id: "P.FRAC_SIMPLIFY_GCD",
            domain: "fractions",
            category: "Fraction Simplification",
            clickTargetKind: "fractionBar",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Simplify Fraction",
            enginePrimitiveId: "P.FRAC_SIMPLIFY_GCD",
            notes: "Reduce fraction. Constraints: g=gcd(a,b)>1"
        },
        {
            id: "P.FRAC_ZERO_NUM",
            domain: "fractions",
            category: "Zero Properties",
            clickTargetKind: "fractionBar",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Fraction Zero Numerator",
            enginePrimitiveId: "P.FRAC_ZERO_NUM",
            notes: "Fraction with zero numerator. Constraints: b≠0"
        },
        {
            id: "P.NEG_NEG",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "operator",
            operatorLatex: "-", // approximate
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Double Negative",
            enginePrimitiveId: "P.NEG_NEG",
            notes: "Double negative elimination"
        },
        {
            id: "P.NEG_DISTRIBUTE_ADD",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "operator",
            operatorLatex: "-",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Distribute Neg (Add)",
            enginePrimitiveId: "P.NEG_DISTRIBUTE_ADD",
            notes: "Distribute negative over addition"
        },
        {
            id: "P.NEG_DISTRIBUTE_SUB",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "operator",
            operatorLatex: "-",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Distribute Neg (Sub)",
            enginePrimitiveId: "P.NEG_DISTRIBUTE_SUB",
            notes: "Distribute negative over subtraction"
        },
        {
            id: "P.NEG_FRAC_NUM",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "fractionBar",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Neg in Numerator",
            enginePrimitiveId: "P.NEG_FRAC_NUM",
            notes: "Negative in numerator to front"
        },
        {
            id: "P.NEG_FRAC_DEN",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "fractionBar",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Neg in Denominator",
            enginePrimitiveId: "P.NEG_FRAC_DEN",
            notes: "Negative in denominator to front"
        },
        {
            id: "P.NEG_FRAC_BOTH",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "fractionBar",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Neg in Both",
            enginePrimitiveId: "P.NEG_FRAC_BOTH",
            notes: "Negatives cancel in fraction"
        },
        {
            id: "P.SUB_TO_ADD_NEG",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "operator",
            operatorLatex: "-",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Sub to Add Neg",
            enginePrimitiveId: "P.SUB_TO_ADD_NEG",
            notes: "Convert subtraction to addition of negative"
        },
        {
            id: "P.ADD_NEG_TO_SUB",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "operator",
            operatorLatex: "+",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Add Neg to Sub",
            enginePrimitiveId: "P.ADD_NEG_TO_SUB",
            notes: "Convert addition of negative to subtraction"
        },
        {
            id: "P.MUL_NEG_LEFT",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Mul Neg Left",
            enginePrimitiveId: "P.MUL_NEG_LEFT",
            notes: "Negative times positive"
        },
        {
            id: "P.MUL_NEG_RIGHT",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Mul Neg Right",
            enginePrimitiveId: "P.MUL_NEG_RIGHT",
            notes: "Positive times negative"
        },
        {
            id: "P.MUL_NEG_BOTH",
            domain: "signs",
            category: "Sign Operations",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Mul Neg Both",
            enginePrimitiveId: "P.MUL_NEG_BOTH",
            notes: "Negative times negative is positive"
        },
        {
            id: "P.ADD_ASSOC_LEFT",
            domain: "integers",
            category: "Associativity",
            clickTargetKind: "operator",
            operatorLatex: "+",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Assoc Add Left",
            enginePrimitiveId: "P.ADD_ASSOC_LEFT",
            notes: "Reassociate addition leftward"
        },
        {
            id: "P.ADD_ASSOC_RIGHT",
            domain: "integers",
            category: "Associativity",
            clickTargetKind: "operator",
            operatorLatex: "+",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Assoc Add Right",
            enginePrimitiveId: "P.ADD_ASSOC_RIGHT",
            notes: "Reassociate addition rightward"
        },
        {
            id: "P.MUL_ASSOC_LEFT",
            domain: "integers",
            category: "Associativity",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Assoc Mul Left",
            enginePrimitiveId: "P.MUL_ASSOC_LEFT",
            notes: "Reassociate multiplication leftward"
        },
        {
            id: "P.MUL_ASSOC_RIGHT",
            domain: "integers",
            category: "Associativity",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Assoc Mul Right",
            enginePrimitiveId: "P.MUL_ASSOC_RIGHT",
            notes: "Reassociate multiplication rightward"
        },
        {
            id: "P.ADD_COMM",
            domain: "integers",
            category: "Commutativity",
            clickTargetKind: "operator",
            operatorLatex: "+",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Commute Add",
            enginePrimitiveId: "P.ADD_COMM",
            notes: "Commute addition operands"
        },
        {
            id: "P.MUL_COMM",
            domain: "integers",
            category: "Commutativity",
            clickTargetKind: "operator",
            operatorLatex: "\\times",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Commute Mul",
            enginePrimitiveId: "P.MUL_COMM",
            notes: "Commute multiplication operands"
        },
        {
            id: "P.FRAC_IMPROPER_TO_MIXED",
            domain: "fractions",
            category: "Fraction Conversion",
            clickTargetKind: "fractionBar",
            color: "yellow",
            uiMode: "requires-confirmation",
            actionClass: "normal",
            label: "Improper to Mixed",
            enginePrimitiveId: "P.FRAC_IMPROPER_TO_MIXED",
            notes: "Convert improper fraction to mixed number"
        },
        {
            id: "P.FRAC_MIXED_TO_IMPROPER",
            domain: "fractions",
            category: "Fraction Conversion",
            clickTargetKind: "number", // Mixed number whole part
            color: "green",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Mixed to Improper",
            enginePrimitiveId: "P.FRAC_MIXED_TO_IMPROPER",
            notes: "Convert mixed number to improper fraction"
        },
        // --- Compatibility/Shim for existing code if needed ---
        // P.FRAC_DIV_AS_MUL moved to main section

        {
            id: "P.FRAC_EQUIV",
            domain: "fractions",
            category: "Compatibility",
            clickTargetKind: "number",
            color: "yellow",
            uiMode: "auto-apply",
            actionClass: "normal",
            label: "Equivalent Fraction",
            enginePrimitiveId: "P.FRAC_TIMES_ONE", // Closest map?
            notes: "Legacy ID"
        }
    ]
};

// --- 5. Validated Exports for Engine Consumption ---

/**
 * Returns the definition for a given primitive ID, or undefined if not found.
 */
export function getPrimitiveDef(id: PrimitiveId): PrimitiveRow | undefined {
    return PRIMITIVES_V5_TABLE.rows.find(r => r.id === id);
}
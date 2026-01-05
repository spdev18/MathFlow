/**
 * Primitive Runner (TzV1.1)
 * 
 * Executes atomic primitives on the AST.
 * This serves as the internal "Engine Stub" for V1.1.
 */

import { AstNode, getNodeAt, parseExpression, replaceNodeAt, toLatex, NodeType, FractionNode } from "../mapmaster/ast";
import { EngineStepExecutionRequest, EngineStepExecutionResult } from "./engine.bridge";
import type { PrimitiveId } from "./primitives.registry";
import { NodeContextBuilder } from "./v5/NodeContextBuilder";
import { ClickTarget } from "./primitives.registry.v5";

export class PrimitiveRunner {
    static run(req: EngineStepExecutionRequest): EngineStepExecutionResult {
        const { expressionLatex, primitiveId, targetPath, bindings, resultPattern } = req;
        const ast = parseExpression(expressionLatex);
        if (!ast) return { ok: false, errorCode: "parse-error" };

        const targetNode = getNodeAt(ast, targetPath);

        try {
            let newAst: AstNode | undefined;

            // Force legacy execution for primitives that require arithmetic simplification
            // which generic pattern execution (substitution only) cannot handle yet.
            const forceLegacy = [
                "P.INT_ADD",
                "P.INT_SUB",
                "P.INT_MUL",
                "P.INT_DIV_TO_INT",
                "P.DEC_TO_FRAC",
                "P.FRAC_EQUIV"
            ].includes(primitiveId);

            if (resultPattern && bindings && !forceLegacy) {
                // Use Generic Pattern Execution
                newAst = this.generateResultFromPattern(ast, targetPath, resultPattern, bindings);
            } else {
                // Fallback to legacy execution
                newAst = this.applyPrimitive(ast, targetNode, primitiveId as PrimitiveId, targetPath);
            }

            if (!newAst) {
                console.log(`[V5-RUNNER-END] primitiveId=${primitiveId} ok=false errorCode=primitive-failed resultLatex=null`);
                return { ok: false, errorCode: "primitive-failed" };
            }

            const resLatex = toLatex(newAst);
            console.log(`[V5-RUNNER-END] primitiveId=${primitiveId} ok=true errorCode=null resultLatex=${resLatex}`);
            return {
                ok: true,
                newExpressionLatex: resLatex
            };
        } catch (e) {
            const errCode = e instanceof Error ? e.message : "unknown-error";
            console.log(`[V5-RUNNER-END] primitiveId=${primitiveId} ok=false errorCode=${errCode} resultLatex=null`);
            return { ok: false, errorCode: errCode };
        }
    }

    private static generateResultFromPattern(root: AstNode, path: string, resultPattern: string, bindings: Record<string, any>): AstNode | undefined {
        // 1. Check for calc(...)
        if (resultPattern.startsWith("calc(")) {
            const expr = resultPattern.substring(5, resultPattern.length - 1);
            // Evaluate expression with bindings
            // We need a simple evaluator that can handle basic arithmetic and variables
            const val = this.evaluateCalc(expr, bindings);
            if (val === null) return undefined;
            return replaceNodeAt(root, path, { type: "integer", value: val.toString() });
        }

        // 2. Structural substitution
        // Parse the result pattern into an AST template
        const templateAst = parseExpression(resultPattern);
        if (!templateAst) return undefined;

        // Substitute variables in the template
        const substitutedAst = this.substituteVariables(templateAst, bindings);

        // Replace the target node with the substituted AST
        return replaceNodeAt(root, path, substitutedAst);
    }

    private static evaluateCalc(expr: string, bindings: Record<string, any>): number | null {
        // Simple evaluator for "a+b", "a*b", etc.
        // Replace variables with values
        let evalExpr = expr;
        for (const [key, node] of Object.entries(bindings)) {
            if (node.type === "integer") {
                evalExpr = evalExpr.replace(new RegExp(key, "g"), node.value);
            } else if (node.type === "fraction") {
                // Handle fraction values if needed?
                // For now assume calc() is only for integers/decimals
                return null;
            }
        }

        try {
            // Safety check: only allow digits, operators, parens, spaces
            if (!/^[\d\+\-\*\/\(\)\s\.]+$/.test(evalExpr)) return null;
            // Use Function constructor for evaluation (safe-ish given the regex check)
            return new Function(`return ${evalExpr}`)();
        } catch (e) {
            return null;
        }
    }

    private static substituteVariables(node: AstNode, bindings: Record<string, any>): AstNode {
        if (node.type === "variable") {
            const binding = bindings[node.name];
            if (binding) {
                return binding; // Return the bound node (deep copy might be safer but immutable structure is fine)
            }
            return node; // Unbound variable? Should not happen if pattern matches
        }

        if (node.type === "binaryOp") {
            return {
                ...node,
                left: this.substituteVariables(node.left, bindings),
                right: this.substituteVariables(node.right, bindings)
            };
        }

        if (node.type === "fraction") {
            let num = node.numerator;
            let den = node.denominator;

            // Check if num/den are variable names
            if (bindings[num]) {
                const bound = bindings[num];
                if (bound.type === "integer") num = bound.value;
            }
            if (bindings[den]) {
                const bound = bindings[den];
                if (bound.type === "integer") den = bound.value;
            }

            return { ...node, numerator: num, denominator: den };
        }

        return node;
    }

    private static applyPrimitive(root: AstNode, target: AstNode | undefined, id: PrimitiveId, path: string): AstNode | undefined {
        switch (id) {
            // --- A. Normalization ---
            case "P.DEC_TO_FRAC":
                // d -> p/q
                // Not implemented fully without decimal parsing support in AST
                return undefined;

            case "P.MIXED_TO_SUM":
                if (target?.type === "mixed") {
                    return replaceNodeAt(root, path, {
                        type: "binaryOp",
                        op: "+",
                        left: { type: "integer", value: target.whole },
                        right: { type: "fraction", numerator: target.numerator, denominator: target.denominator }
                    });
                }
                return undefined;
            case "P.INT_TO_FRAC":
                if (target?.type === "integer") {
                    return replaceNodeAt(root, path, {
                        type: "fraction",
                        numerator: target.value,
                        denominator: "1"
                    });
                }
                return undefined;
            case "P.FRAC_TO_INT":
                if (target?.type === "fraction" && target.denominator === "1") {
                    return replaceNodeAt(root, path, {
                        type: "integer",
                        value: target.numerator
                    });
                }
                return undefined;
            case "P.ONE_TO_UNIT_FRAC":
                if (target?.type === "integer" && target.value === "1") {
                    // Heuristic: try to find a denominator from context
                    const den = this.findContextDenominator(root) || "1";
                    return replaceNodeAt(root, path, {
                        type: "fraction",
                        numerator: den,
                        denominator: den
                    });
                }
                return undefined;

            // --- B. Integers ---
            case "P.INT_ADD":
            case "P.INT_SUB":
            case "P.INT_MUL":
            case "P.INT_DIV_EXACT":
            case "P.INT_DIV_TO_INT":
            case "P.INT_DIV_TO_FRAC":
            case "P.DECIMAL_DIV":
                return this.runIntegerOp(root, target, id, path);

            // --- C. Fractions ---
            case "P.FRAC_ADD_SAME_DEN":
            case "P.FRAC_SUB_SAME_DEN":
            case "P.FRAC_MUL":
            case "P.FRAC_DIV":
            case "P.FRAC_DIV_AS_MUL":
            case "P.FRAC_EQ_SCALE":
            case "P.FRAC_ADD_DIFF_DEN_MUL1":
            case "P.FRAC_SUB_DIFF_DEN_MUL1":
                return this.runFractionOp(root, target, id, path);

            case "P.ONE_TO_TARGET_DENOM":
                return this.runOneToTargetDenom(root, target, path);

            // --- D. Common Denominator ---
            case "P.FRAC_MUL_BY_ONE":
                if (target?.type === "fraction") {
                    return replaceNodeAt(root, path, {
                        type: "binaryOp",
                        op: "*",
                        left: target,
                        right: { type: "integer", value: "1" }
                    });
                }
                return undefined;
            case "P.FRAC_LIFT_LEFT_BY_RIGHT_DEN":
                return this.runLiftFraction(root, target, path, "left");

            case "P.FRAC_LIFT_RIGHT_BY_LEFT_DEN":
                return this.runLiftFraction(root, target, path, "right");

            case "P.FRAC_MUL_UNIT":
                // x/y * k/k -> (xk)/(yk)
                if (target?.type === "binaryOp" && target.op === "*") {
                    if (target.left.type === "fraction" && target.right.type === "fraction") {
                        const n1 = parseInt(target.left.numerator);
                        const d1 = parseInt(target.left.denominator);
                        const n2 = parseInt(target.right.numerator);
                        const d2 = parseInt(target.right.denominator);
                        if (n2 === d2) {
                            return replaceNodeAt(root, path, {
                                type: "fraction",
                                numerator: (n1 * n2).toString(),
                                denominator: (d1 * d2).toString()
                            });
                        }
                    }
                }
                return undefined;

            case "P.FRAC_EQUIV":
                return this.runFracEquiv(root, target, path);

            // --- E. Decimal Conversion ---
            case "P.DECIMAL_TO_FRAC":
                return this.runDecimalToFraction(root, target, path);

            case "P.FRAC_ADD_AFTER_LIFT":
                // a/b + c/b -> (a+c)/b
                // This is same as P.FRAC_ADD_SAME_DEN but maybe strictly for lifted context?
                // Implementation is identical.
                return this.runFractionOp(root, target, "P.FRAC_ADD_SAME_DEN", path);

            // --- E. Signs ---
            case "P.NEG_BEFORE_NUMBER":
                // -(a) -> -a
                // Parser issues with unary minus.
                // If target is `-(a)`, it might be `binaryOp(-, 0, a)` or similar?
                // Or `binaryOp(-, left, right)` where we want to distribute?
                // P.NEG_BEFORE_NUMBER is specifically `-(a)` -> `-a`.
                // If we have `-(3)`, we want `-3`.
                // If `target` is `binaryOp(-, 0, 3)`, result is `integer(-3)`.
                if (target?.type === "binaryOp" && target.op === "-" && target.left.type === "integer" && target.left.value === "0") {
                    if (target.right.type === "integer") {
                        return replaceNodeAt(root, path, {
                            type: "integer",
                            value: "-" + target.right.value
                        });
                    }
                }
                return undefined;

            case "P.NEG_NEG":
                // -(-a) -> a
                return this.runDoubleNeg(root, target, path);

            case "P.NEG_DISTRIB_ADD":
            case "P.NEG_DISTRIB_SUB":
                return this.runDistributeNeg(root, target, id, path);

            // --- F. Parentheses ---
            case "P.PAREN_AROUND_ATOM_INT":
            case "P.PAREN_AROUND_ATOM_FRAC":
            case "P.PAREN_AROUND_EXPR_INT":
            case "P.PAREN_AROUND_EXPR_FRAC":
                // Removing parens is a no-op in our AST/Printer
                return root;

            // --- G. Nested Fractions ---
            case "P.NESTED_FRAC_DIV":
                // (a/b) / (c/d) -> a/b * d/c
                if (target?.type === "binaryOp" && (target.op === "/" || (target.op as string) === ":")) {
                    if (target.left.type === "fraction" && target.right.type === "fraction") {
                        return replaceNodeAt(root, path, {
                            type: "binaryOp",
                            op: "*",
                            left: target.left,
                            right: {
                                type: "fraction",
                                numerator: target.right.denominator,
                                denominator: target.right.numerator
                            }
                        });
                    }
                }
                return undefined;
        }

        return undefined;
    }



    private static runIntegerOp(root: AstNode, target: AstNode | undefined, id: string, path: string): AstNode | undefined {
        // Handle Fraction as Division
        if (target?.type === "fraction" && (id === "P.INT_DIV_TO_INT" || id === "P.INT_DIV_TO_FRAC")) {
            const a = parseInt(target.numerator, 10);
            const b = parseInt(target.denominator, 10);
            switch (id) {
                case "P.INT_DIV_TO_INT":
                    if (b === 0) throw new Error("division-by-zero");
                    if (a % b !== 0) return undefined; // Not exact
                    return replaceNodeAt(root, path, { type: "integer", value: (a / b).toString() });
                case "P.INT_DIV_TO_FRAC":
                    if (b === 0) throw new Error("division-by-zero");
                    return replaceNodeAt(root, path, {
                        type: "fraction",
                        numerator: a.toString(),
                        denominator: b.toString()
                    });
            }
            return undefined;
        }

        if (target?.type !== "binaryOp") return undefined;
        if (target.left.type !== "integer" || target.right.type !== "integer") return undefined;

        let resValue: string | null = null;

        switch (id) {
            case "P.INT_ADD":
                resValue = this.runNumericBinaryOp("+", target.left.value, target.right.value);
                break;
            case "P.INT_SUB":
                resValue = this.runNumericBinaryOp("-", target.left.value, target.right.value);
                break;
            case "P.INT_MUL":
                resValue = this.runNumericBinaryOp("*", target.left.value, target.right.value);
                break;
            case "P.INT_DIV_EXACT":
            case "P.INT_DIV_TO_INT": // Legacy support if needed, but EXACT is the V5 standard
                if (target.left.value.includes(".") || target.right.value.includes(".")) return undefined;
                try {
                    const a = BigInt(target.left.value);
                    const b = BigInt(target.right.value);
                    if (b === 0n) throw new Error("division-by-zero");
                    if (a % b !== 0n) return undefined; // Not exact
                    resValue = (a / b).toString();
                } catch (e: any) {
                    if (e.message === "division-by-zero") throw e;
                    return undefined;
                }
                break;
            case "P.INT_DIV_TO_FRAC":
                if (target.left.value.includes(".") || target.right.value.includes(".")) return undefined;
                try {
                    const num = BigInt(target.left.value);
                    const den = BigInt(target.right.value);
                    if (den === 0n) throw new Error("division-by-zero");
                    // Return fraction node
                    return replaceNodeAt(root, path, {
                        type: "fraction",
                        numerator: num.toString(),
                        denominator: den.toString()
                    });
                } catch (e: any) {
                    if (e.message === "division-by-zero") throw e;
                    return undefined;
                }
            case "P.DECIMAL_DIV":
                resValue = this.runNumericDivision(target.left.value, target.right.value);
                break;
        }

        if (resValue !== null) {
            return replaceNodeAt(root, path, { type: "integer", value: resValue });
        }
        return undefined;
    }

    private static parseNumericToScaledInt(value: string): { n: bigint; scale: number } {
        // Handle optional sign
        let sign = 1n;
        let workVal = value;
        if (workVal.startsWith("-")) {
            sign = -1n;
            workVal = workVal.substring(1);
        } else if (workVal.startsWith("+")) {
            workVal = workVal.substring(1);
        }

        const dotIndex = workVal.indexOf(".");
        if (dotIndex === -1) {
            // Integer
            return { n: sign * BigInt(workVal), scale: 0 };
        }

        // Decimal
        const intPart = workVal.substring(0, dotIndex);
        const fracPart = workVal.substring(dotIndex + 1);
        const scale = fracPart.length;

        // Combine parts: "12" + "5" -> "125"
        const combined = intPart + fracPart;
        return { n: sign * BigInt(combined), scale };
    }

    private static scaledIntToDecimalString(n: bigint, scale: number): string {
        if (scale === 0) return n.toString();

        const sign = n < 0n ? "-" : "";
        let absN = n < 0n ? -n : n;
        let s = absN.toString();

        if (s.length <= scale) {
            // Pad left
            const padding = "0".repeat(scale - s.length);
            s = "0." + padding + s;
        } else {
            // Insert decimal point
            const insertAt = s.length - scale;
            s = s.substring(0, insertAt) + "." + s.substring(insertAt);
        }

        // Optional: Trim trailing zeros in fractional part, but keep .0 if we decide to?
        // User said: "You may optionally trim trailing zeros in the fractional part, but keep at least one digit after the decimal point"
        // Let's implement trimming.
        if (s.includes(".")) {
            while (s.endsWith("0")) {
                s = s.substring(0, s.length - 1);
            }
            if (s.endsWith(".")) {
                // Should not happen via trimming if we ensure at least one digit, but if input was 100 and scale 2 -> 1.00 -> 1.
                // If we strictly want to preserve decimal nature, we might keep .0, but usually 1. is not valid, should be 1.
                // Let's strip the dot if it is last.
                s = s.substring(0, s.length - 1);
            }
        }

        return sign + s;
    }

    private static runNumericBinaryOp(op: "+" | "-" | "*", leftValue: string, rightValue: string): string {
        const { n: n1, scale: s1 } = this.parseNumericToScaledInt(leftValue);
        const { n: n2, scale: s2 } = this.parseNumericToScaledInt(rightValue);

        if (op === "*") {
            const res = n1 * n2;
            const newScale = s1 + s2;
            return this.scaledIntToDecimalString(res, newScale);
        }

        const commonScale = Math.max(s1, s2);

        // Rescale
        const m1 = 10n ** BigInt(commonScale - s1);
        const m2 = 10n ** BigInt(commonScale - s2);

        const val1 = n1 * m1;
        const val2 = n2 * m2;

        let res: bigint;
        if (op === "+") {
            res = val1 + val2;
        } else {
            res = val1 - val2;
        }

        return this.scaledIntToDecimalString(res, commonScale);
    }

    private static runDecimalToFraction(root: AstNode, target: AstNode | undefined, path: string): AstNode | undefined {
        if (!target || target.type !== "integer" || !target.value.includes(".")) {
            return undefined;
        }

        const { n, scale } = this.parseNumericToScaledInt(target.value);
        const denominator = 10n ** BigInt(scale);

        // Simplify using GCD (convert to number for gcd function)
        const absN = n < 0n ? -n : n;
        const gcdValue = BigInt(this.gcd(Number(absN), Number(denominator)));
        const numerator = n / gcdValue;
        const den = denominator / gcdValue;

        return replaceNodeAt(root, path, {
            type: "fraction",
            numerator: numerator.toString(),
            denominator: den.toString()
        });
    }

    private static runNumericDivision(leftValue: string, rightValue: string): string | null {
        const { n: n1, scale: s1 } = this.parseNumericToScaledInt(leftValue);
        const { n: n2, scale: s2 } = this.parseNumericToScaledInt(rightValue);

        if (n2 === 0n) throw new Error("division-by-zero");


        // Division: (n1 * 10^s2) / (n2 * 10^s1)
        // Check if finite: check if denominator (of simplified fraction) is 2^j * 5^k.
        // Simplified denominator logic:
        // Result Value in rationals = (n1 * 10^s2) / (n2 * 10^s1).

        // Actually, we can just try to compute it with high precision or check divisibility.
        // Or, simpler:
        // We want result = K / 10^S.
        // (n1 * 10^s2) / (n2 * 10^s1) = R
        // Let num = n1 * 10^s2
        // Let den = n2 * 10^s1
        // We want num/den to be finite decimal.

        let num = n1 * (10n ** BigInt(s2));
        let den = n2 * (10n ** BigInt(s1));


        // Simplify fraction num/den
        // But we need BigInt gcd.
        // Let's assume for now we just handle cases that divide cleanly with some power of 10 adjustment?
        // Or implement basic long division for BigInt until remainder is zero or loop detected?
        // Since we don't have infinite loop protection easily without a limit, let's limit scale.
        // User requested: 12.5 / 0.5 -> 25. 1.5 / 0.25 -> 6. 12.5 / 5 -> 2.5.
        // These are simple.

        // Let's multiply num by 10^K until num % den == 0.
        // Limit K to say 10 (arbitrary reasonable precision for these elementary steps).

        let extraScale = 0;
        const LIMIT = 10;

        // Handle negative signs first to simplify loop
        let sign = 1n;
        if (num < 0n) { num = -num; sign = -sign; }
        if (den < 0n) { den = -den; sign = -sign; }

        while (num % den !== 0n && extraScale < LIMIT) {
            num = num * 10n;
            extraScale++;
        }

        if (num % den === 0n) {
            const res = (num / den) * sign;
            return this.scaledIntToDecimalString(res, extraScale);
        }

        return null; // Not a finite decimal within limit
    }

    private static runFractionOp(root: AstNode, target: AstNode | undefined, id: string, path: string): AstNode | undefined {
        if (id === "P.FRAC_SIMPLIFY_BASIC" || id === "P0.FRAC_SIMPLIFY") {
            const parts = this.getFractionParts(target);
            if (!parts) return undefined;
            const { n, d } = parts;
            const common = this.gcd(n, d);
            return replaceNodeAt(root, path, {
                type: "fraction",
                numerator: (n / common).toString(),
                denominator: (d / common).toString()
            });
        }

        if (id === "P.FRAC_WHOLE_TO_OVER_ONE") {
            if (target?.type !== "integer") return undefined;
            return replaceNodeAt(root, path, {
                type: "fraction",
                numerator: target.value,
                denominator: "1"
            });
        }

        if (id === "P.FRAC_NEG_NUM" || id === "P.FRAC_MOVE_NEG_DEN") {
            // Move negative sign. 
            if (target?.type !== "fraction") return undefined;
            return root; // No-op
        }

        if (target?.type !== "binaryOp") {
            console.log(`[V5-RUNNER-FRAC] target is not binaryOp: path=${path}, targetType=${target?.type || 'undefined'}`);
            return undefined;
        }

        const leftParts = this.getFractionParts(target.left);
        const rightParts = this.getFractionParts(target.right);

        // Debug logging for fraction parts extraction
        console.log(`[V5-RUNNER-FRAC] path=${path} id=${id}`);
        console.log(`[V5-RUNNER-FRAC] target.op=${target.op}`);
        console.log(`[V5-RUNNER-FRAC] target.left.type=${target.left?.type} leftParts=${JSON.stringify(leftParts)}`);
        console.log(`[V5-RUNNER-FRAC] target.right.type=${target.right?.type} rightParts=${JSON.stringify(rightParts)}`);

        if (!leftParts || !rightParts) {
            console.log(`[V5-RUNNER-FRAC] FAIL: getFractionParts returned null for left or right`);
            return undefined;
        }

        const { n: n1, d: d1 } = leftParts;
        const { n: n2, d: d2 } = rightParts;

        let newFrac: { n: number, d: number } | null = null;
        let newOp: AstNode | undefined;

        switch (id) {
            case "P.FRAC_ADD_SAME_DEN":
                // V5 Logic: Validate via NodeContext
                // 1. Augment IDs (local to this runner instance since it parses fresh AST)
                this.augmentAstWithIds(root);

                // 2. Build Context
                const builder = new NodeContextBuilder();
                const v5Click: ClickTarget = { nodeId: path, kind: "operator" };
                const ctx = builder.buildContext({
                    expressionId: "temp",
                    ast: root,
                    click: v5Click
                });

                // 3. Verify Preconditions (Guards)
                if (ctx.operatorLatex !== "+") throw new Error("bad-window: operator mismatch");

                // [Workaround] NodeContextBuilder guard logic requires a parent, so it fails for Root.
                // We manually re-check if the guard is missing but valid.
                if (!ctx.guards["denominators-equal"]) {
                    if (target?.type === "binaryOp" && target.left?.type === "fraction" && target.right?.type === "fraction") {
                        if (target.left.denominator === target.right.denominator) {
                            ctx.guards["denominators-equal"] = true;
                        }
                    }
                }

                if (!ctx.guards["denominators-equal"]) throw new Error("guards-mismatch: denominators-equal");

                console.log(`[V5-RUNNER-START] primitiveId=${id} operator=${ctx.operatorLatex} left=fraction(${n1}/${d1}) right=fraction(${n2}/${d2}) guards=${JSON.stringify(ctx.guards)}`);

                // 4. Execute
                // Since d1/d2 are already parsed in this.getFractionParts, we use them.
                // The context guaranteed they are equal.
                if (d1 === d2) newFrac = { n: n1 + n2, d: d1 };
                break;
            case "P.FRAC_SUB_SAME_DEN":
                if (d1 === d2) newFrac = { n: n1 - n2, d: d1 };
                break;

            case "P.FRAC_ADD_DIFF_DEN_MUL1":
            case "P.FRAC_SUB_DIFF_DEN_MUL1":
                // a/b +/- c/d -> (a/b)*1 +/- (c/d)*1
                // 1. Verify denominators are different
                if (d1 === d2) return undefined; // Should be handled by guard logic ideally but check here too

                if (target.left.type !== "fraction" || target.right.type !== "fraction") return undefined;

                // 2. Construct the new tree
                // Root: BinaryOp (+|-)
                // Left: BinaryOp (*) -> Left: left_frac, Right: integer(1)
                // Right: BinaryOp (*) -> Left: right_frac, Right: integer(1)

                newOp = {
                    type: "binaryOp",
                    op: id === "P.FRAC_ADD_DIFF_DEN_MUL1" ? "+" : "-",
                    left: {
                        type: "binaryOp",
                        op: "*",
                        left: target.left,
                        right: { type: "integer", value: "1" }
                    },
                    right: {
                        type: "binaryOp",
                        op: "*",
                        left: target.right,
                        right: { type: "integer", value: "1" }
                    }
                };
                break;
            case "P.FRAC_MUL":
                newFrac = { n: n1 * n2, d: d1 * d2 };
                break;
            case "P.FRAC_DIV":
                // a/b : c/d -> (a*d)/(b*c)
                // Check division by zero (if c or new denominator is 0)
                if (n2 === 0) throw new Error("division-by-zero");
                newFrac = { n: n1 * d2, d: d1 * n2 };
                break;
            case "P.FRAC_DIV_AS_MUL":
                // a/b : c/d -> a/b * d/c
                newOp = {
                    type: "binaryOp",
                    op: "*",
                    left: target.left,
                    right: { type: "fraction", numerator: rightParts.d.toString(), denominator: rightParts.n.toString() }
                };
                break;
        }

        if (newOp) return replaceNodeAt(root, path, newOp);

        if (newFrac) {
            return replaceNodeAt(root, path, {
                type: "fraction",
                numerator: newFrac.n.toString(),
                denominator: newFrac.d.toString()
            });
        }
        return undefined;
    }

    private static getFractionParts(node: AstNode | undefined): { n: number, d: number } | null {
        if (!node) return null;
        if (node.type === "fraction") {
            return {
                n: parseInt(node.numerator, 10),
                d: parseInt(node.denominator, 10)
            };
        }
        if (node.type === "mixed") {
            // Treat Mixed including whole part?
            // "New Numerator = left.numerator + right.numerator" -> Logic dictates just Fraction part if whole is 0.
            return {
                n: parseInt(node.numerator, 10),
                d: parseInt(node.denominator, 10)
            };
        }
        return null;
    }

    private static runDistributeNeg(root: AstNode, target: AstNode | undefined, id: string, path: string): AstNode | undefined {
        if (target?.type !== "binaryOp") return undefined;

        if (id === "P.NEG_DISTRIB_ADD") {
            if (target.op === "-" && target.right.type === "binaryOp" && target.right.op === "+") {
                const b = target.right.left;
                const c = target.right.right;
                // Construct a - b - c
                return replaceNodeAt(root, path, {
                    type: "binaryOp",
                    op: "-",
                    left: {
                        type: "binaryOp",
                        op: "-",
                        left: target.left,
                        right: b
                    },
                    right: c
                });
            }
        }

        if (id === "P.NEG_DISTRIB_SUB") {
            // a - (b - c) -> a - b + c
            if (target.op === "-" && target.right.type === "binaryOp" && target.right.op === "-") {
                const b = target.right.left;
                const c = target.right.right;
                // Construct a - b + c
                return replaceNodeAt(root, path, {
                    type: "binaryOp",
                    op: "+",
                    left: {
                        type: "binaryOp",
                        op: "-",
                        left: target.left,
                        right: b
                    },
                    right: c
                });
            }
        }

        return undefined;
    }

    private static runDoubleNeg(root: AstNode, target: AstNode | undefined, path: string): AstNode | undefined {
        if (target?.type === "binaryOp" && target.op === "-") {
            if (target.right.type === "integer" && target.right.value.startsWith("-")) {
                const val = target.right.value.substring(1); // remove -
                return replaceNodeAt(root, path, {
                    type: "binaryOp",
                    op: "+",
                    left: target.left,
                    right: { type: "integer", value: val }
                });
            }
        }
        return undefined;
    }

    private static runLiftFraction(root: AstNode, target: AstNode | undefined, path: string, side: "left" | "right"): AstNode | undefined {
        let parentPath = "";
        if (side === "left" && path.endsWith(".left")) parentPath = path.substring(0, path.length - 5);
        else if (side === "right" && path.endsWith(".right")) parentPath = path.substring(0, path.length - 6);
        else return undefined;

        const parent = getNodeAt(root, parentPath);
        if (parent?.type !== "binaryOp") return undefined;

        const other = side === "left" ? parent.right : parent.left;
        if (other.type !== "fraction") return undefined;

        const den = other.denominator;

        return replaceNodeAt(root, path, {
            type: "binaryOp",
            op: "*",
            left: target!,
            right: { type: "fraction", numerator: den, denominator: den }
        });
    }

    private static gcd(a: number, b: number): number {
        return b === 0 ? a : this.gcd(b, a % b);
    }

    private static findContextDenominator(node: AstNode): string | null {
        if (node.type === "fraction") {
            if (node.denominator !== "1") return node.denominator;
            return null;
        }
        if (node.type === "binaryOp") {
            const left = this.findContextDenominator(node.left);
            if (left) return left;
            return this.findContextDenominator(node.right);
        }
        return null;
    }
    private static runFracEquiv(root: AstNode, target: AstNode | undefined, path: string): AstNode | undefined {
        // Goal: expand current fraction a/b to (a*k)/(b*k) to match the denominator of the neighbour.

        // 0. Normalize Path (fix mismatch between Orchestrator 'left'/'right' and AST 'term[0]'/'term[1]')
        // Simple replacement of exact segments to match ast.ts expectations
        const normalizedPath = path
            .split('.')
            .map(p => {
                if (p === "left") return "term[0]";
                if (p === "right") return "term[1]";
                return p;
            })
            .join('.');

        // 1. Resolve Target if missing (due to path mismatch)
        let effectiveTarget = target;
        if (!effectiveTarget || normalizedPath !== path) {
            effectiveTarget = getNodeAt(root, normalizedPath);
        }

        if (!effectiveTarget || effectiveTarget.type !== "fraction") return undefined;

        // 2. Determine parent path and side
        let parentPath: string = "";
        let side: "left" | "right" | undefined;

        if (normalizedPath === "term[0]") {
            parentPath = "root";
            side = "left";
        } else if (normalizedPath === "term[1]") {
            parentPath = "root";
            side = "right";
        } else if (normalizedPath.endsWith(".term[0]")) {
            parentPath = normalizedPath.substring(0, normalizedPath.length - 8); // remove .term[0]
            side = "left";
        } else if (normalizedPath.endsWith(".term[1]")) {
            parentPath = normalizedPath.substring(0, normalizedPath.length - 8); // remove .term[1]
            side = "right";
        } else {
            return undefined;
        }

        const parent = getNodeAt(root, parentPath);
        if (!parent || parent.type !== "binaryOp") return undefined;
        if (parent.op !== "+" && parent.op !== "-") return undefined;

        const other = side === "left" ? parent.right : parent.left;

        // 3. Determine the neighbour denominator.
        let otherDen: number;
        if (other.type === "fraction") {
            otherDen = parseInt(other.denominator, 10);
        } else if (other.type === "integer") {
            otherDen = 1;
        } else {
            return undefined;
        }

        const currentNum = parseInt(effectiveTarget.numerator, 10);
        const currentDen = parseInt(effectiveTarget.denominator, 10);

        // 4. Calculate LCM and multiplier k.
        const commonDen = this.lcm(currentDen, otherDen);
        if (commonDen === currentDen) return undefined;

        const k = commonDen / currentDen;

        // 5. Return expanded fraction
        return replaceNodeAt(root, normalizedPath, {
            type: "fraction",
            numerator: (currentNum * k).toString(),
            denominator: (currentDen * k).toString(),
        });
    }

    private static lcm(a: number, b: number): number {
        if (a === 0 || b === 0) return 0;
        return Math.abs((a * b) / this.gcd(a, b));
    }

    private static augmentAstWithIds(root: any) {
        if (!root) return;
        const traverse = (node: any, path: string) => {
            if (!node) return;
            node.id = path;
            if (node.type === "binaryOp") {
                traverse(node.left, path === "root" ? "term[0]" : `${path}.term[0]`);
                traverse(node.right, path === "root" ? "term[1]" : `${path}.term[1]`);
            }
        };
        traverse(root, "root");
        return root;
    }
    private static runOneToTargetDenom(root: AstNode, target: AstNode, path: string): AstNode | undefined {
        if (target.type === 'integer') {
            if (target.value !== '1') return undefined;
        } else if (target.type !== 'variable') {
            return undefined;
        }

        const parentPathParts = path.split('.');
        if (parentPathParts.length < 2) return undefined;

        parentPathParts.pop();
        const parentPathStr = parentPathParts.join('.');
        const parent = getNodeAt(root, parentPathStr);

        if (!parent || parent.type !== 'binaryOp' || (parent.op !== '*')) {
            return undefined;
        }

        const grandParentPathParts = [...parentPathParts];
        grandParentPathParts.pop();
        const grandParentPathStr = grandParentPathParts.join('.');

        const grandParent = getNodeAt(root, grandParentPathStr);
        if (!grandParent || grandParent.type !== 'binaryOp' || (grandParent.op !== '+' && grandParent.op !== '-')) {
            return undefined;
        }

        const parentIsLeft = parent === grandParent.left;
        const otherBranch = parentIsLeft ? grandParent.right : grandParent.left;

        let otherDenom = "1";
        const extractDenom = (node: AstNode): string | undefined => {
            if (node.type === "binaryOp" && (node.op === '*')) {
                if (node.left.type === 'fraction') return node.left.denominator;
                if (node.right.type === 'fraction') return node.right.denominator;
            }
            if (node.type === "fraction") return node.denominator;
            return undefined;
        }

        const d = extractDenom(otherBranch);
        if (!d) return undefined;
        otherDenom = d;

        const newFraction: FractionNode = {
            type: "fraction",
            numerator: otherDenom,
            denominator: otherDenom
        };
        const newRoot = replaceNodeAt(root, path, newFraction);

        return newRoot;
    }
}

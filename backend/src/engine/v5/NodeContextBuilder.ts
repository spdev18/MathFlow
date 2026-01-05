import { AstNode } from '../../mapmaster/ast';
import {
    NodeContext,
    ExpressionId,
    ClickTarget,
    OperandType,
    Domain,
    GuardId
} from '../primitives.registry.v5';

export class NodeContextBuilder {

    public buildContext(params: {
        expressionId: ExpressionId;
        ast: AstNode;
        click: ClickTarget;
    }): NodeContext {
        const { ast, click } = params;

        // Normalize effectiveClick.nodeId: empty string means "root" in several Stage-1 paths.
        // NodeContextBuilder must always be able to resolve a concrete nodeId.
        // NOTE: we must NOT reference `effectiveClick` before it is initialized (TDZ).
        const rawNodeId = (click.nodeId ?? "").trim();
        const effectiveNodeId = rawNodeId.length > 0
            ? rawNodeId
            : ((ast as any).id ?? "root");

        const effectiveClick: ClickTarget = { ...click, nodeId: effectiveNodeId };


        console.log(`[NodeContext] Building for Click: ${JSON.stringify(effectiveClick)}`);

        // 1. Resolve Target Node
        const node = this.findNode(ast, effectiveClick.nodeId);
        if (!node) {
            console.error(`[NodeContext] FAILED to find node: ${effectiveClick.nodeId}`);
            // Log Root structure to debug
            console.log(`[DEBUG-ROOT]`, JSON.stringify(ast, null, 2));
            // throw new Error(`Node not found: ${effectiveClick.nodeId}`); // Don't throw, return empty to prevent crash
            return {
                expressionId: params.expressionId,
                nodeId: effectiveClick.nodeId,
                clickTarget: effectiveClick,
                guards: {} as any
            };
        }
        console.log(`[NodeContext] Found Node type: ${node.type}`);

        // 2. Resolve Operator
        let operatorLatex: string | undefined = undefined;

        // Check internal operator
        if ((node as any).op) operatorLatex = (node as any).op;
        else if ((node as any).ops && typeof click.operatorIndex === 'number') {
            operatorLatex = (node as any).ops[click.operatorIndex];
        }

        let actionNodeId: string | undefined = undefined;

        // 3. Parent Lookup
        if (!operatorLatex) {
            const parent = this.findParent(ast, effectiveClick.nodeId);
            if (parent) {
                console.log(`[NodeContext] Found Parent: ${parent.type}`);
                if ((parent as any).op) {
                    operatorLatex = (parent as any).op;
                    // If we found the operator on the parent, that parent usually IS the binary operation we want to execute on.
                    // Especially if the click was on a child (fraction/number).
                    // We store this valid binaryOp ID as the likely action target.
                    if ((parent as any).id) {
                        actionNodeId = (parent as any).id;
                    }
                }
                else if ((parent as any).ops && typeof click.operatorIndex === 'number') {
                    operatorLatex = (parent as any).ops[click.operatorIndex];
                }
            }
        }

        console.log(`[NodeContext] Operator: ${operatorLatex}`);

        // 4. Guards Stub (simplified for stability)
        const guards: Record<GuardId, boolean> = {
            "divisor-nonzero": false,
            "result-is-integer": false,
            "numerators-coprime": false,
            "denominators-equal": false,
            "denominators-different": false,
            "operands-free": true,
            "inside-brackets": false,
            "left-negative": false,
            "right-negative": false,
            "divisor-zero": false,
            "remainder-zero": false,
            "remainder-nonzero": false,
            "is-decimal": false
        };

        // Helper function to extract a comparable key from a denominator (which may be string, number, or AST node)
        function denomKey(den: any): string | null {
            if (!den) return null;
            if (typeof den === 'string') return den;
            if (typeof den === 'number' || typeof den === 'bigint') return String(den);
            if (typeof den === 'object') {
                // Common AST shapes
                if (typeof (den as any).value === 'string' || typeof (den as any).value === 'number') return String((den as any).value);
                if (typeof (den as any).latex === 'string') return (den as any).latex;
                if (typeof (den as any).text === 'string') return (den as any).text;
                if (typeof (den as any).id === 'string') return (den as any).id; // fallback
            }
            return String(den);
        }

        // Recalculate Denominators Equal using Parent OR the node itself (if it's a binaryOp at root)
        const parent = this.findParent(ast, effectiveClick.nodeId);

        // First try: check the clicked node itself if it's a binaryOp with left/right children
        // This handles the case when clicking on the root expression (operator click at root level)
        if (node.type === 'binaryOp' && (node as any).left && (node as any).right) {
            const left = (node as any).left;
            const right = (node as any).right;
            const leftDen = (left as any).denominator;
            const rightDen = (right as any).denominator;

            if (leftDen && rightDen) {
                const leftKey = denomKey(leftDen);
                const rightKey = denomKey(rightDen);
                guards['denominators-equal'] = (leftKey !== null && rightKey !== null && leftKey === rightKey);
                guards['denominators-different'] = !guards['denominators-equal'];
                console.log(`[NodeContext] Computed denominators from node itself: leftKey=${leftKey}, rightKey=${rightKey}, equal=${guards['denominators-equal']}, different=${guards['denominators-different']}`);
            }
        }
        // Fallback: check parent if node itself didn't have fraction operands
        else if (parent && (parent as any).left && (parent as any).right) {
            const left = (parent as any).left;
            const right = (parent as any).right;
            // Check for fractions directly or fractions inside wrappers (Mixed/etc) - though current types used are just checking props
            // We'll use a safer check for denominator existence
            const leftDen = (left as any).denominator;
            const rightDen = (right as any).denominator;

            if (leftDen && rightDen) {
                const leftKey = denomKey(leftDen);
                const rightKey = denomKey(rightDen);
                guards['denominators-equal'] = (leftKey !== null && rightKey !== null && leftKey === rightKey);
                guards['denominators-different'] = !guards['denominators-equal'];
                console.log(`[NodeContext] Computed denominators from parent: leftKey=${leftKey}, rightKey=${rightKey}, equal=${guards['denominators-equal']}, different=${guards['denominators-different']}`);
            }
        }

        // Determine Operand Types from the Action Node (which is either parent or the node itself)
        let leftType: OperandType = 'any';
        let rightType: OperandType = 'any';

        const actionNode = actionNodeId ? this.findNode(ast, actionNodeId) : node;

        // Compute division-related guards for integer and decimal division
        if (actionNode && (actionNode as any).op === '\\div') {
            const left = (actionNode as any).left;
            const right = (actionNode as any).right;

            // Only compute if operands are integer/numeric types (NodeContext "int" usually covers decimals if parser labeled them integer)
            if (left && right && left.type === 'integer' && right.type === 'integer') {
                const leftStr = left.value as string;
                const rightStr = right.value as string;

                const isDecimal = leftStr.includes('.') || rightStr.includes('.');

                if (!isDecimal) {
                    // Integer Path (Strict BigInt)
                    try {
                        const leftVal = BigInt(leftStr);
                        const rightVal = BigInt(rightStr);

                        // Compute divisor guards
                        if (rightVal === 0n) {
                            guards['divisor-zero'] = true;
                            guards['divisor-nonzero'] = false;
                        } else {
                            guards['divisor-zero'] = false;
                            guards['divisor-nonzero'] = true;

                            // Compute remainder guards (only if divisor is non-zero)
                            const remainder = leftVal % rightVal;
                            if (remainder === 0n) {
                                guards['remainder-zero'] = true;
                                guards['remainder-nonzero'] = false;
                            } else {
                                guards['remainder-zero'] = false;
                                guards['remainder-nonzero'] = true;
                            }
                        }
                    } catch (e) {
                        // If BigInt conversion fails, leave guards as false
                    }
                } else {
                    // Decimal Path (Safe numeric check)
                    // We only strictly require divisor-nonzero for decimal division.
                    // We do NOT compute remainder guards for decimals.
                    const rightVal = parseFloat(rightStr);

                    // Simple check for zero (including 0.0, -0.0)
                    // Note: parseFloat("0.0") === 0
                    if (rightVal === 0) {
                        guards['divisor-zero'] = true;
                        guards['divisor-nonzero'] = false;
                    } else if (!isNaN(rightVal)) {
                        guards['divisor-zero'] = false;
                        guards['divisor-nonzero'] = true;
                    }
                }
            }
        }

        // Check if clicked node is a decimal
        if (node && node.type === "integer" && (node as any).value && (node as any).value.includes(".")) {
            guards['is-decimal'] = true;
            console.log(`[NodeContext] Setting is-decimal=true for value: ${(node as any).value}`);
        }

        if (actionNode && (actionNode as any).left) leftType = this.normalizeType((actionNode as any).left.type);
        if (actionNode && (actionNode as any).right) rightType = this.normalizeType((actionNode as any).right.type);

        return {
            expressionId: params.expressionId,
            nodeId: effectiveClick.nodeId,
            clickTarget: effectiveClick,
            operatorLatex,
            leftOperandType: leftType,
            rightOperandType: rightType,
            guards,
            actionNodeId
        };
    }

    // --- UNIVERSAL TRAVERSAL HELPERS ---

    private findNode(root: AstNode, id: string): AstNode | undefined {
        if (!root) return undefined;
        if (process.env.MOTOR_DEBUG_NODE_SEARCH === "1") {
            console.log("[DEBUG-VISIT]", (root as any).id);
        }

        if ((root as any).id === id) return root;

        // 1. Binary Properties
        if ((root as any).left) {
            const found = this.findNode((root as any).left, id);
            if (found) return found;
        }
        if ((root as any).right) {
            const found = this.findNode((root as any).right, id);
            if (found) return found;
        }

        // 2. Array Properties (Universal check)
        const arrayProps = ['args', 'children', 'operands', 'terms', 'items', 'content'];
        for (const prop of arrayProps) {
            const list = (root as any)[prop];
            if (Array.isArray(list)) {
                for (const child of list) {
                    const found = this.findNode(child, id);
                    if (found) return found;
                }
            }
        }

        // 3. Named Object Children (Universal check for single-node props like 'whole', 'numerator', 'denominator')
        const objProps = ['whole', 'numerator', 'denominator', 'base', 'exponent', 'content'];
        for (const prop of objProps) {
            const child = (root as any)[prop];
            if (child && typeof child === 'object' && child.type) {
                const found = this.findNode(child, id);
                if (found) return found;
            }
        }

        return undefined;
    }

    private normalizeType(astType: string): OperandType {
        if (astType === 'integer') return 'int';
        if (astType === 'fraction') return 'fraction';
        if (astType === 'mixed') return 'mixed-number';
        return 'any';
    }

    private findParent(root: AstNode, targetId: string): AstNode | undefined {
        if (!root) return undefined;

        // 1. Check Binary Children
        if ((root as any).left && (root as any).left.id === targetId) return root;
        if ((root as any).right && (root as any).right.id === targetId) return root;

        // 2. Check Array Children
        const arrayProps = ['args', 'children', 'operands', 'terms', 'items', 'content'];
        for (const prop of arrayProps) {
            const list = (root as any)[prop];
            if (Array.isArray(list)) {
                for (const child of list) {
                    if ((child as any).id === targetId) return root;
                }
            }
        }

        // 2b. Check Object Children
        const objProps = ['whole', 'numerator', 'denominator', 'base', 'exponent', 'content'];
        for (const prop of objProps) {
            const child = (root as any)[prop];
            if (child && (child as any).id === targetId) return root;
        }

        // 3. Recurse
        if ((root as any).left) {
            const found = this.findParent((root as any).left, targetId);
            if (found) return found;
        }
        if ((root as any).right) {
            const found = this.findParent((root as any).right, targetId);
            if (found) return found;
        }
        for (const prop of arrayProps) {
            const list = (root as any)[prop];
            if (Array.isArray(list)) {
                for (const child of list) {
                    const found = this.findParent(child, targetId);
                    if (found) return found;
                }
            }
        }
        for (const prop of objProps) {
            const child = (root as any)[prop];
            if (child && typeof child === 'object' && child.type) {
                const found = this.findParent(child, targetId);
                if (found) return found;
            }
        }

        return undefined;
    }
}

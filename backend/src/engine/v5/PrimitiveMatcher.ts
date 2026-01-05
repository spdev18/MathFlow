import { PrimitivesTable, PrimitiveRow, NodeContext, OperandType, GuardId } from '../primitives.registry.v5';

export interface PrimitiveMatch {
    row: PrimitiveRow;
    score: number;
    ctx: NodeContext;
}

export class PrimitiveMatcher {
    match(params: { table: PrimitivesTable; ctx: NodeContext }): PrimitiveMatch[] {
        const { table, ctx } = params;
        const matches: PrimitiveMatch[] = [];

        for (const row of table.rows) {
            if (this.isMatch(row, ctx)) {
                matches.push({ row, score: this.calculateScore(row), ctx });
            }
        }
        return matches;
    }

    private isMatch(row: PrimitiveRow, ctx: NodeContext): boolean {
        if (row.id === "P.FRAC_ADD_SAME_DEN") {
            console.log(`[Matcher] Checking P.FRAC_ADD_SAME_DEN`);
        }

        if (row.clickTargetKind !== ctx.clickTarget.kind) {
            if (row.id === "P.FRAC_ADD_SAME_DEN") {
                console.log(`[Matcher] FAIL: TargetKind mismatch. Row: ${row.clickTargetKind}, Ctx: ${ctx.clickTarget.kind}`);
            }
            return false;
        }

        if (row.operatorLatex && row.operatorLatex !== ctx.operatorLatex) {
            if (row.id === "P.FRAC_ADD_SAME_DEN") {
                console.log(`[Matcher] FAIL: Operator mismatch. Row: ${row.operatorLatex}, Ctx: ${ctx.operatorLatex}`);
            }
            return false;
        }

        if (row.requiredGuards) {
            for (const g of row.requiredGuards) {
                if (!ctx.guards[g]) {
                    if (row.id === "P.FRAC_ADD_SAME_DEN") {
                        console.log(`[Matcher] FAIL: Missing Guard: ${g}`);
                    }
                    return false;
                }
            }
        }
        if (row.forbiddenGuards) {
            for (const g of row.forbiddenGuards) {
                if (ctx.guards[g]) {
                    if (row.id === "P.FRAC_ADD_SAME_DEN") {
                        console.log(`[Matcher] FAIL: Forbidden Guard Active: ${g}`);
                    }
                    return false;
                }
            }
        }

        // Domain / Operand Type Check
        if (row.operandTypes) {
            if (row.operandTypes.left && !this.checkType(row.operandTypes.left, ctx.leftOperandType)) {
                if (row.id === "P.INT_ADD" || row.id === "P.FRAC_ADD_SAME_DEN") {
                    console.log(`[Matcher] FAIL: Left Operand Mismatch. Req: ${row.operandTypes.left}, Act: ${ctx.leftOperandType}`);
                }
                return false;
            }
            if (row.operandTypes.right && !this.checkType(row.operandTypes.right, ctx.rightOperandType)) {
                if (row.id === "P.INT_ADD" || row.id === "P.FRAC_ADD_SAME_DEN") {
                    console.log(`[Matcher] FAIL: Right Operand Mismatch. Req: ${row.operandTypes.right}, Act: ${ctx.rightOperandType}`);
                }
                return false;
            }
        }

        if (row.id === "P.FRAC_ADD_SAME_DEN") {
            console.log(`[Matcher] SUCCESS: P.FRAC_ADD_SAME_DEN matched!`);
        }
        return true;
    }

    private calculateScore(row: PrimitiveRow): number {
        return 1;
    }

    private checkType(required: OperandType, actual: OperandType | undefined): boolean {
        if (!actual) return false;
        if (required === "any") return true;
        if (required === actual) return true;

        // Compatibility: int matches nonzero-int
        if (required === "int" && actual === "nonzero-int") return true;
        // Compatibility: fraction matches nonzero-fraction
        if (required === "fraction" && actual === "nonzero-fraction") return true;

        // Inverse compatibility (if primitive asks for nonzero, standard int is NOT enough?)
        // Usually primitive asks for "int" (broad) or "nonzero-int" (specific).
        // If context has "nonzero-int", it satisfies "int".

        return false;
    }
}

/**
 * MapMaster Rules: Mixed (Stage 1)
 * 
 * Implements candidate generation for mixed number operations
 * (e.g. integer + fraction).
 * 
 * NEW: Also emits support candidates (P.INT_TO_FRAC) when direct rules
 * cannot apply due to mixed operand types.
 */

import type { MapMasterCandidate, MapMasterCandidateId } from './mapmaster.core';
import type { RuleContext } from './mapmaster.rules.common';
import { filterRulesByDomain } from './mapmaster.rules.common';

/**
 * Build candidates for Stage-1 mixed rules.
 * 
 * When the semantic window is a binary operation with mixed operand types
 * (one integer, one fraction), this function:
 * 1. Emits candidates for direct mixed rules (if any)
 * 2. Emits a SUPPORT candidate for P.INT_TO_FRAC targeting the integer operand
 *    so the user can normalize it to a fraction first.
 */
export function buildCandidatesForMixedStage1(ctx: RuleContext): MapMasterCandidate[] {
    const { invariantRules, windowRootPath, windowRootNode } = ctx;
    const candidates: MapMasterCandidate[] = [];

    // Filter for relevant rules
    const mixedRules = filterRulesByDomain(invariantRules, 'Mixed');

    // Emit candidates for direct mixed rules
    for (const rule of mixedRules) {
        for (const primId of rule.primitiveIds) {
            candidates.push({
                id: `cand-mixed-${candidates.length + 1}` as MapMasterCandidateId,
                invariantRuleId: rule.id,
                primitiveIds: [primId],
                targetPath: windowRootPath.join('.'),
                description: rule.description || rule.title,
            });
        }
    }

    // NEW: Emit support candidate for P.INT_TO_FRAC
    // This applies when the window is a binary operation with mixed operand types.
    if (windowRootNode.type === 'binaryOp') {
        const left = (windowRootNode as any).left;
        const right = (windowRootNode as any).right;

        const leftIsInteger = left?.type === 'integer';
        const rightIsInteger = right?.type === 'integer';
        const leftIsFraction = left?.type === 'fraction';
        const rightIsFraction = right?.type === 'fraction';

        // Mixed: one integer, one fraction
        if ((leftIsInteger && rightIsFraction) || (rightIsInteger && leftIsFraction)) {
            // Determine which operand is the integer and build its path
            const integerSide = leftIsInteger ? 'left' : 'right';
            const integerPath = windowRootPath.length > 0
                ? [...windowRootPath, integerSide].join('.')
                : integerSide;

            // Emit support candidate for INT_TO_FRAC
            candidates.push({
                id: `cand-support-int-to-frac-${candidates.length + 1}` as MapMasterCandidateId,
                invariantRuleId: 'R.INT_TO_FRAC',
                primitiveIds: ['P.INT_TO_FRAC'],
                targetPath: integerPath,
                description: 'Normalize integer to fraction (n → n/1) for mixed operation',
                category: 'support',
            });
        }
    }

    return candidates;
}

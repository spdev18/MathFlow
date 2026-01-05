/**
 * MapMaster Rules: Fractions (Stage 1)
 * 
 * Implements candidate generation for basic fraction operations
 * with the same denominator.
 */

import type { MapMasterCandidate, MapMasterCandidateId } from './mapmaster.core';
import type { RuleContext } from './mapmaster.rules.common';
import { filterRulesByDomain } from './mapmaster.rules.common';

/**
 * Build candidates for Stage-1 fraction rules.
 */
export function buildCandidatesForFractionsStage1(ctx: RuleContext): MapMasterCandidate[] {
    const { invariantRules, windowRootPath } = ctx;
    const candidates: MapMasterCandidate[] = [];

    // Filter for relevant rules
    // We want both FractionsSameDen (existing) AND Fractions (new generic)
    const fractionRules = [
        ...filterRulesByDomain(invariantRules, 'FractionsSameDen'),
        ...filterRulesByDomain(invariantRules, 'Fractions')
    ];

    for (const rule of fractionRules) {
        // In Stage 1, we map directly to primitives
        // The rule ID itself might be the primitive ID or mapped

        // CLOD implementation logic:
        // Create a candidate for each primitive ID in the rule

        for (const primId of rule.primitiveIds) {
            candidates.push({
                id: `cand-${candidates.length + 1}` as MapMasterCandidateId, // Simple ID generation
                invariantRuleId: rule.id,
                primitiveIds: [primId], // MapMasterCandidate expects array
                targetPath: windowRootPath.join('.'), // Convert AstPath array to string path
                description: rule.description || rule.title,
            });
        }
    }

    return candidates;
}

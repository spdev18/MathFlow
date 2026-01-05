/**
 * MapMaster Rules: Integers (Stage 1)
 * 
 * Implements candidate generation for basic integer operations.
 */

import type { MapMasterCandidate, MapMasterCandidateId } from './mapmaster.core';
import type { RuleContext } from './mapmaster.rules.common';
import { filterRulesByDomain } from './mapmaster.rules.common';

/**
 * Build candidates for Stage-1 integer rules.
 */
export function buildCandidatesForIntegersStage1(ctx: RuleContext): MapMasterCandidate[] {
    const { invariantRules, windowRootPath } = ctx;
    const candidates: MapMasterCandidate[] = [];

    // Filter for relevant rules
    const integerRules = filterRulesByDomain(invariantRules, 'Integers');

    for (const rule of integerRules) {
        for (const primId of rule.primitiveIds) {
            candidates.push({
                id: `cand-${candidates.length + 1}` as MapMasterCandidateId,
                invariantRuleId: rule.id,
                primitiveIds: [primId],
                targetPath: windowRootPath.join('.'),
                description: rule.description || rule.title,
            });
        }
    }

    return candidates;
}

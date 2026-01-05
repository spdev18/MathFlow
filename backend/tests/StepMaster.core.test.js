import { describe, it, expect } from 'vitest';
import { stepMasterDecide } from '../src/stepmaster/stepmaster.core';
import { createEmptyHistory } from '../src/stepmaster/stepmaster.history-service';
import { createDefaultStudentPolicy } from '../src/stepmaster/stepmaster.policy';
describe('StepMaster Core', () => {
    it('returns no-candidates if input list is empty', () => {
        const input = {
            candidates: [],
            history: { lastStep: null },
            policy: createDefaultStudentPolicy()
        };
        const result = stepMasterDecide(input);
        expect(result.decision.status).toBe('no-candidates');
    });
    it('chooses the first candidate if available', () => {
        const candidate = {
            id: 'cand-1',
            invariantRuleId: 'RULE_1',
            primitiveIds: ['P.1'],
            targetPath: 'root',
            description: 'Test Candidate'
        };
        const input = {
            candidates: [candidate],
            history: { lastStep: null },
            policy: createDefaultStudentPolicy()
        };
        const result = stepMasterDecide(input);
        expect(result.decision.status).toBe('chosen');
        expect(result.decision.chosenCandidateId).toBe('cand-1');
        expect(result.primitivesToApply).toEqual([{ id: 'P.1' }]);
    });
    it('filters out repetitive candidates', () => {
        const candidate = {
            id: 'cand-1',
            invariantRuleId: 'RULE_1',
            primitiveIds: ['P.1'],
            targetPath: 'root',
            description: 'Test Candidate'
        };
        // Simulate history where this exact step was just taken
        const history = createEmptyHistory();
        const historyWithStep = {
            lastStep: {
                stepId: 'step-1',
                candidateId: 'cand-1',
                decisionStatus: 'chosen',
                timestampIso: new Date().toISOString(),
                invariantRuleId: 'RULE_1',
                targetPath: 'root',
                expressionBefore: 'x'
            }
        };
        const input = {
            candidates: [candidate],
            history: historyWithStep,
            policy: createDefaultStudentPolicy()
        };
        const result = stepMasterDecide(input);
        expect(result.decision.status).toBe('no-candidates');
    });
});

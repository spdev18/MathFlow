/**
 * Step Policies (TzV1.1)
 *
 * Responsibilities:
 *  - Provide a minimal policy configuration for student mode.
 */

export type StepPolicyId = "student.default" | "teacher.debug";

export interface StepPolicyConfig {
    id: StepPolicyId;
    maxCandidatesToShow: number; // reserved for future UI
}

/**
 * Create the default student policy.
 *
 * In TzV1.1, this is the only policy we support.
 */
export function createDefaultStudentPolicy(): StepPolicyConfig {
    return {
        id: "student.default",
        maxCandidatesToShow: 1,
    };
}

/**
 * Create the teacher debug policy.
 * Shows all candidates.
 */
export function createTeacherDebugPolicy(): StepPolicyConfig {
    return {
        id: "teacher.debug",
        maxCandidatesToShow: 999, // Show all
    };
}

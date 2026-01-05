/**
 * orchestratorV5Client.js
 * Client for the V5 Orchestrator Endpoint.
 */

/**
 * @typedef {Object} V5StepPayload
 * @property {string} sessionId
 * @property {string} expressionLatex
 * @property {string|null} selectionPath
 * @property {number} [operatorIndex]
 * @property {string} [courseId]
 * @property {string} [userRole]
 * @property {string} [preferredPrimitiveId] - Client's choice from a previous "choice" response
 */

/**
 * @typedef {Object} StepChoice
 * @property {string} id
 * @property {string} label
 * @property {string} primitiveId
 * @property {string} targetNodeId
 */

/**
 * @typedef {Object} V5StepResult
 * @property {"step-applied" | "no-candidates" | "engine-error" | "choice"} status
 * @property {string|null} [primitiveId]
 * @property {Object} [engineResult]
 * @property {string} [engineResult.newExpressionLatex]
 * @property {StepChoice[]} [choices] - Available when status is "choice"
 * @property {any} [rawResponse]
 */

/**
 * Calls the V5 Orchestrator endpoint to apply a step.
 * Returns a standardized result object and never throws.
 * 
 * @param {string} endpointUrl - The full URL (e.g. http://localhost:4201/api/orchestrator/v5/step)
 * @param {V5StepPayload} payload
 * @param {number} [timeoutMs=5000]
 * @returns {Promise<V5StepResult>}
 */
export async function runV5Step(endpointUrl, payload, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(endpointUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            // Network correct but HTTP error (4xx, 5xx)
            return {
                status: "engine-error",
                primitiveId: null,
                rawResponse: {
                    status: response.status,
                    statusText: response.statusText
                }
            };
        }

        const json = await response.json();

        // Standardize the response structure provided by backend
        // Backend returns: { status, primitiveId, engineResult, debugInfo, choices }
        return {
            status: json.status || "engine-error",
            primitiveId: json.primitiveId || null,
            engineResult: json.engineResult,
            choices: json.choices || null, // NEW: Include choices for status=choice
            rawResponse: json
        };

    } catch (err) {
        clearTimeout(timeoutId);
        // Network error, timeout, or parse error
        return {
            status: "engine-error",
            primitiveId: null,
            rawResponse: {
                error: err instanceof Error ? err.message : String(err)
            }
        };
    }
}

/**
 * Get LLM by ID with fallback to default LLM
 * @param {import('../models/llm')} LLM - LLM model
 * @param {string} llmId - LLM ID to lookup
 * @returns {Promise<Object>} - LLM object
 */
export async function getLLMWithFallback(LLM, llmId) {
    let llm;

    if (llmId) {
        llm = await LLM.findOne({ _id: llmId });
    }

    // If no LLM is found, use the default LLM
    if (!llm) {
        llm = await LLM.findOne({ isDefault: true });
    }

    return llm;
}

export async function getAnyAgenticLLM(LLM) {
    const llm = await LLM.findOne({ isAgentic: true });
    if (!llm) {
        return getLLMWithFallback(LLM, null);
    }
    return llm;
}

/**
 * Build the single active file context for chat/media requests.
 * @param {Object} params
 * @param {string|null} params.contextId - Active context ID
 * @param {string|null} params.contextKey - Active context key
 * @param {string|null} params.userContextId - Backward-compatible alias for contextId
 * @param {string|null} params.userContextKey - Backward-compatible alias for contextKey
 * @returns {Array} agentContext array for Cortex API
 */
export function buildAgentContext({
    contextId = null,
    contextKey = null,
    userContextId = null,
    userContextKey = null,
}) {
    const resolvedContextId = contextId || userContextId;
    if (!resolvedContextId) {
        return [];
    }

    return [
        {
            contextId: resolvedContextId,
            contextKey: contextKey || userContextKey || "",
            default: true,
        },
    ];
}

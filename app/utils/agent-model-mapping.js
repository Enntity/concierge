/**
 * Mapping of display names to model IDs for agent model selection
 * Display names are user-friendly, model IDs are what we send to GraphQL
 * provider indicates which icon to show
 */
export const AGENT_MODEL_OPTIONS = [
    { displayName: "GPT 5.2", modelId: "oai-gpt52", provider: "openai" },
    { displayName: "GPT 5.1", modelId: "oai-gpt51", provider: "openai" },
    { displayName: "GPT 4.1", modelId: "oai-gpt41", provider: "openai" },
    { displayName: "O3", modelId: "oai-o3", provider: "openai" },
    {
        displayName: "Claude 4.5 Sonnet",
        modelId: "claude-45-sonnet",
        provider: "anthropic",
    },
    {
        displayName: "Claude 4.5 Opus",
        modelId: "claude-45-opus",
        provider: "anthropic",
    },
    {
        displayName: "Claude 4.6 Opus",
        modelId: "claude-46-opus",
        provider: "anthropic",
    },
    {
        displayName: "Claude 4.6 Sonnet",
        modelId: "claude-46-sonnet",
        provider: "anthropic",
    },
    {
        displayName: "Grok 4.1 Fast Reasoning",
        modelId: "xai-grok-4-1-fast-reasoning",
        provider: "xai",
    },
    {
        displayName: "Grok 4.1 Fast Non-Reasoning",
        modelId: "xai-grok-4-1-fast-non-reasoning",
        provider: "xai",
    },
    {
        displayName: "Gemini 3 Flash",
        modelId: "gemini-flash-3-vision",
        provider: "google",
    },
    {
        displayName: "Gemini 3 Pro",
        modelId: "gemini-pro-3-vision",
        provider: "google",
    },
    {
        displayName: "Gemini 3.1 Pro",
        modelId: "gemini-pro-31-vision",
        provider: "google",
    },
];

/**
 * Get provider for a model ID
 */
export function getProviderFromModelId(modelId) {
    const option = AGENT_MODEL_OPTIONS.find((opt) => opt.modelId === modelId);
    return option?.provider || "openai"; // default
}

/**
 * Get model ID from display name
 */
export function getModelIdFromDisplayName(displayName) {
    const option = AGENT_MODEL_OPTIONS.find(
        (opt) => opt.displayName === displayName,
    );
    return option?.modelId || DEFAULT_AGENT_MODEL;
}

/**
 * Get display name from model ID
 */
export function getDisplayNameFromModelId(modelId) {
    const option = AGENT_MODEL_OPTIONS.find((opt) => opt.modelId === modelId);
    return option?.displayName || "Gemini 3 Flash";
}

/**
 * Default agent model
 */
export const DEFAULT_AGENT_MODEL = "gemini-flash-3-vision";

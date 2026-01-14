import { getTaxonomySets, getTags, getTopics } from "./data/taxonomySets";
import { getSidebarLogo } from "./global/sidebar";
import { getTosContent } from "./global/tos";
import { getPrivacyContent } from "./global/privacy";

// The entire Enntity application can be configured here
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// THESE STRINGS CANNOT BE CHANGED.
// If an identifier ceases to be in this list, the system
// will assume that the LLM no longer exists and assign
// the default LLM to any prompts that were using that LLM.
const LLM_IDENTIFIERS = {
    gpt4o: "gpt4o",
    gpt4omini: "gpt4omini",
    gpt41: "gpt41",
    gpt41mini: "gpt41mini",
    gpt41nano: "gpt41nano",
    gpt5: "gpt5",
    gpt5mini: "gpt5mini",
    gpt5nano: "gpt5nano",
    gpt5chat: "gpt5chat",
    gpt51: "gpt51",
    gpt52: "gpt52",
    claude45sonnet: "claude45sonnet",
    claude45opus: "claude45opus",
    o3mini: "o3mini",
    o3: "o3",
    gemini25flash: "gemini25flash",
    gemini25pro: "gemini25pro",
    gemini30flash: "gemini30flash",
    gemini30pro: "gemini30pro",
};

// eslint-disable-next-line import/no-anonymous-default-export
export default {
    global: {
        siteTitle: "Concierge",
        getLogo: () => "/app/assets/enntity_logo.svg",
        getLogoDark: () => "/app/assets/enntity_logo_dark.svg",
        getTosContent,
        getPrivacyContent,
        getSidebarLogo,
        initialize: async () => {},
        getPublicGraphQLEndpoint: (graphQLEndpoint) => graphQLEndpoint,
    },
    data: {
        getTaxonomySets,
        getTopics,
        getTags,
        llms: [
            {
                identifier: LLM_IDENTIFIERS.gpt4o,
                name: "GPT 4o",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "oai-gpt4o",
                isDefault: true,
            },
            {
                identifier: LLM_IDENTIFIERS.gpt4omini,
                name: "GPT 4o Mini",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "oai-gpt4o-mini",
            },
            {
                identifier: LLM_IDENTIFIERS.gpt41,
                name: "GPT 4.1",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "oai-gpt41",
            },
            {
                identifier: LLM_IDENTIFIERS.gpt41mini,
                name: "GPT 4.1 Mini",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "oai-gpt41-mini",
            },
            {
                identifier: LLM_IDENTIFIERS.gpt41nano,
                name: "GPT 4.1 Nano",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "oai-gpt41-nano",
            },
            {
                identifier: LLM_IDENTIFIERS.gpt5,
                name: "GPT 5",
                cortexPathwayName: "run_gpt5",
                cortexModelName: "oai-gpt5",
            },
            {
                identifier: LLM_IDENTIFIERS.gpt5mini,
                name: "GPT 5 Mini",
                cortexPathwayName: "run_gpt5_mini",
                cortexModelName: "oai-gpt5-mini",
            },
            {
                identifier: LLM_IDENTIFIERS.gpt5nano,
                name: "GPT 5 Nano",
                cortexPathwayName: "run_gpt5_nano",
                cortexModelName: "oai-gpt5-nano",
            },
            {
                identifier: LLM_IDENTIFIERS.gpt5chat,
                name: "GPT 5 Chat",
                cortexPathwayName: "run_gpt5_chat",
                cortexModelName: "oai-gpt5-chat",
            },
            {
                identifier: LLM_IDENTIFIERS.gpt51,
                name: "GPT 5.1",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "oai-gpt51",
            },
            {
                identifier: LLM_IDENTIFIERS.gpt52,
                name: "GPT 5.2",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "oai-gpt52",
            },
            {
                identifier: LLM_IDENTIFIERS.claude45sonnet,
                name: "Claude 4.5 Sonnet",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "claude-45-sonnet",
            },
            {
                identifier: LLM_IDENTIFIERS.claude45opus,
                name: "Claude 4.5 Opus",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "claude-45-opus",
            },
            {
                identifier: LLM_IDENTIFIERS.o3mini,
                name: "o3 Mini",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "oai-o3-mini",
            },
            {
                identifier: LLM_IDENTIFIERS.o3,
                name: "o3",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "oai-o3",
            },
            {
                identifier: LLM_IDENTIFIERS.gemini25flash,
                name: "Gemini 2.5 Flash",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "gemini-flash-25-vision",
            },
            {
                identifier: LLM_IDENTIFIERS.gemini25pro,
                name: "Gemini 2.5 Pro",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "gemini-pro-25-vision",
            },
            {
                identifier: LLM_IDENTIFIERS.gemini30flash,
                name: "Gemini 3.0 Flash",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "gemini-flash-3-vision",
            },
            {
                identifier: LLM_IDENTIFIERS.gemini30pro,
                name: "Gemini 3.0 Pro",
                cortexPathwayName: "run_workspace_prompt",
                cortexModelName: "gemini-pro-3-vision",
            },
        ],
    },
    write: {
        actions: {},
    },
    chat: {
        botName: "Jarvis",
        dataSources: [],
    },
    endpoints: {
        mediaHelper: (serverUrl) => `${serverUrl}${basePath}/media-helper`,
        graphql: (serverUrl, useBlueGraphQL) => {
            if (useBlueGraphQL) {
                return `${serverUrl}${basePath}/graphql-blue`;
            }
            return `${serverUrl}${basePath}/graphql`;
        },
        mediaHelperDirect: () => process.env.CORTEX_MEDIA_API_URL,
    },
    auth: {
        provider: null, // only one value is supported: "entra"
    },
};

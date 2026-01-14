const taxonomySets = [
    {
        setName: "news",
        topics: [],
        tags: [],
    },
];

const LLM_IDENTIFIERS = {
    gpt4o: "gpt4o",
    gpt4omini: "gpt4omini",
    gpt51: "gpt51",
    gpt52: "gpt52",
    claude45sonnet: "claude45sonnet",
    claude45opus: "claude45opus",
    o3mini: "o3mini",
    gemini25flash: "gemini25flash",
    gemini25pro: "gemini25pro",
    gemini30flash: "gemini30flash",
    gemini30pro: "gemini30pro",
};

const config = {
    global: {
        siteTitle: "Enntity",
        getLogo: (language) =>
            `/app/assets/enntity-logo-${language === "ar" ? "ar" : "en"}.png`,
        getTosContent: async () => "",
        getSidebarLogo: () => "/app/assets/enntity_logo.svg",
        getPublicGraphQLEndpoint: (graphQLEndpoint) => graphQLEndpoint,
    },
    data: {
        getTaxonomySets: async () => taxonomySets,
        getTopics: async () => [],
        getTags: async () => [],
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
        ],
    },
    write: {
        actions: {},
    },
    chat: {
        botName: "Test Bot",
        dataSources: [],
    },
    endpoints: {
        mediaHelper: (serverUrl) => `${serverUrl}/media-helper`,
        graphql: (serverUrl) => `${serverUrl}/graphql`,
        mediaHelperDirect: () =>
            process.env.CORTEX_MEDIA_API_URL || "http://localhost:3001",
    },
    auth: {
        provider: "entra",
    },
};

export default config;

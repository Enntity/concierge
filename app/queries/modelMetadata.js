import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApolloClient } from "@apollo/client";
import { SYS_MODEL_METADATA } from "../../src/graphql";

export function useModelMetadata() {
    const client = useApolloClient();

    return useQuery({
        queryKey: ["modelMetadata"],
        queryFn: async () => {
            const { data } = await client.query({
                query: SYS_MODEL_METADATA,
                fetchPolicy: "network-only",
            });
            return JSON.parse(data.sys_model_metadata.result);
        },
        staleTime: Infinity,
    });
}

export function useAgentModels() {
    const { data, ...rest } = useModelMetadata();
    const agentModels = useMemo(
        () => data?.models?.filter((model) => model.isAgentic) || [],
        [data],
    );
    return { data: agentModels, redirects: data?.redirects || {}, ...rest };
}

export function useChatModels() {
    const { data, ...rest } = useModelMetadata();
    const chatModels = useMemo(
        () => data?.models?.filter((model) => model.category === "chat") || [],
        [data],
    );
    return { data: chatModels, redirects: data?.redirects || {}, ...rest };
}

export function useMediaModels() {
    const { data, ...rest } = useModelMetadata();
    const mediaModels = useMemo(
        () =>
            data?.models?.filter(
                (model) =>
                    model.category === "image" || model.category === "video",
            ) || [],
        [data],
    );
    return { data: mediaModels, redirects: data?.redirects || {}, ...rest };
}

export function resolveModelId(modelId, models, redirects) {
    if (!models?.length) return modelId;

    if (modelId && models.some((model) => model.modelId === modelId)) {
        return modelId;
    }

    const redirected = redirects?.[modelId];
    if (redirected && models.some((model) => model.modelId === redirected)) {
        return redirected;
    }

    const defaultModel = models.find((model) => model.isDefault);
    return defaultModel?.modelId || models[0]?.modelId || modelId;
}

export function getDisplayNameFromModelId(modelId, models) {
    const model = models?.find((entry) => entry.modelId === modelId);
    return model?.displayName || modelId;
}

export function getProviderFromModelId(modelId, models) {
    const model = models?.find((entry) => entry.modelId === modelId);
    return model?.provider || "openai";
}

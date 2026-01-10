import { useQuery } from "@apollo/client";
import { SYS_GET_ENTITIES } from "../graphql";

export function useEntities(contextId) {
    const {
        data: entitiesData,
        error,
        loading,
        refetch,
    } = useQuery(SYS_GET_ENTITIES, {
        variables: {
            contextId: contextId || "",
            includeSystem: true,
        },
        skip: !contextId, // Don't run query until we have contextId
        fetchPolicy: "cache-and-network", // Always fetch fresh but show cached immediately
    });

    const defaultResponse = {
        entities: [],
        needsOnboarding: false, // Don't show onboarding if we can't fetch entities
        isLoading: false,
        refetch,
    };

    // If no contextId yet, return loading state
    if (!contextId) {
        return {
            ...defaultResponse,
            isLoading: true,
        };
    }

    // If loading, return loading state
    if (loading) {
        return {
            ...defaultResponse,
            isLoading: true,
        };
    }

    // If there's an error or no data, return empty
    if (error || !entitiesData?.sys_get_entities?.result) {
        return defaultResponse;
    }

    let entities;
    try {
        entities = JSON.parse(entitiesData.sys_get_entities.result);
    } catch (parseError) {
        console.error("Failed to parse entities:", parseError);
        return defaultResponse;
    }

    // Check if user needs onboarding - true if they have no non-system entities
    const userEntities = entities.filter((e) => !e.isSystem);
    const needsOnboarding = userEntities.length === 0;

    return {
        entities,
        needsOnboarding,
        isLoading: false,
        refetch,
    };
}

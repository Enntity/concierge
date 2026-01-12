import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "../../app/utils/axios-client";

export function useEntities(contextId) {
    const queryClient = useQueryClient();

    const {
        data: entities,
        error,
        isLoading,
        refetch,
    } = useQuery({
        queryKey: ["entities", contextId],
        queryFn: async () => {
            if (!contextId) return [];
            const response = await axios.get("/api/entities", {
                params: {
                    includeSystem: true,
                },
            });
            return response.data || [];
        },
        enabled: !!contextId,
        staleTime: 0, // Always fetch fresh data to catch avatar updates
        gcTime: 0, // Don't cache - we want fresh data every time
    });

    // Function to refetch a single entity and update the cache
    const refetchEntity = async (entityId) => {
        if (!contextId || !entityId) return;

        try {
            const response = await axios.get("/api/entities", {
                params: {
                    includeSystem: true,
                    entityId,
                },
            });

            // API always returns an array
            const updatedEntity = response.data?.[0];

            if (updatedEntity && entities) {
                // Update the entities array in cache
                const updatedEntities = entities.map((e) =>
                    e.id === entityId ? updatedEntity : e,
                );
                queryClient.setQueryData(
                    ["entities", contextId],
                    updatedEntities,
                );
            }
        } catch (error) {
            console.error("Error refetching entity:", error);
            // Fall back to full refetch on error
            refetch();
        }
    };

    const defaultResponse = {
        entities: [],
        needsOnboarding: false, // Don't show onboarding if we can't fetch entities
        isLoading: false,
        refetch,
        refetchEntity,
    };

    // If no contextId yet, return loading state
    if (!contextId) {
        return {
            ...defaultResponse,
            isLoading: true,
        };
    }

    // If loading, return loading state
    if (isLoading) {
        return {
            ...defaultResponse,
            isLoading: true,
        };
    }

    // If there's an error or no data, return empty
    if (error || !entities || !Array.isArray(entities)) {
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
        refetchEntity,
    };
}

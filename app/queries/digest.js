import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "../utils/axios-client";
import { composeUserDateTimeInfo } from "../../src/utils/datetimeUtils";

export function useHomeGreeting() {
    const query = useQuery({
        queryKey: ["homeGreeting"],
        queryFn: async () => {
            const userInfo = composeUserDateTimeInfo();
            const { data } = await axios.post(`/api/users/me/greeting`, {
                userInfo,
            });
            return {
                greeting: data?.greeting || null,
                entity: data?.entity || null,
            };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
    });

    return query;
}

export function useDigestEntities() {
    const query = useQuery({
        queryKey: ["digestEntities"],
        queryFn: async () => {
            const { data } = await axios.get(
                `/api/entities?includeSystem=true`,
            );
            return data || [];
        },
        staleTime: 60000, // 1 minute
    });

    return query;
}

export function useCurrentUserDigest() {
    const query = useQuery({
        queryKey: ["currentUserDigest"],
        queryFn: async ({ queryKey }) => {
            const { data } = await axios.get(`/api/users/me/digest`);
            return data;
        },
        staleTime: Infinity,
    });

    return query;
}

export function useUpdateCurrentUserDigest() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ ...data }) => {
            // insert mutation code
            const response = await axios.patch(`/api/users/me/digest`, data);
            return response.data;
        },
        onMutate: async ({ ...data }) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({
                queryKey: ["currentUserDigest"],
            });

            // Snapshot the previous value
            const previousDigest = queryClient.getQueryData([
                "currentUserDigest",
            ]);

            // Optimistically update
            queryClient.setQueryData(["currentUserDigest"], (oldData) => {
                // Only process blocks if they're being updated
                if (data.blocks) {
                    for (const block of data.blocks) {
                        const existingBlock = oldData?.blocks?.find(
                            (b) => b._id?.toString() === block._id?.toString(),
                        );

                        if (existingBlock) {
                            // Regenerate if prompt or entityId changes
                            if (
                                existingBlock.prompt !== block.prompt ||
                                existingBlock.entityId !== block.entityId
                            ) {
                                block.content = null;
                                block.updatedAt = null;
                            }
                        }
                    }
                }

                return {
                    ...oldData,
                    ...data,
                };
            });

            return { previousDigest };
        },
        onError: (err, data, context) => {
            // Roll back on error
            if (context?.previousDigest) {
                queryClient.setQueryData(
                    ["currentUserDigest"],
                    context.previousDigest,
                );
            }
        },
        onSuccess: (responseData) => {
            // Update cache with server response
            queryClient.setQueryData(["currentUserDigest"], responseData);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
    });

    return mutation;
}

export function useRegenerateDigestBlock() {
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async ({ blockId }) => {
            // insert mutation code
            const response = await axios.post(
                `/api/users/me/digest/blocks/${blockId}/regenerate`,
            );
            return response.data;
        },
        onMutate: async ({ blockId }) => {},
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["currentUserDigest"] });
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
        },
    });

    return mutation;
}

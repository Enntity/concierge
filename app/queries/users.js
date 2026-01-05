import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import axios from "../utils/axios-client";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/auth/login", "/privacy", "/published"];

function useIsPublicRoute() {
    const pathname = usePathname();
    return PUBLIC_ROUTES.some((route) => pathname?.startsWith(route));
}

export function useCurrentUser() {
    const isPublicRoute = useIsPublicRoute();

    return useQuery({
        queryKey: ["currentUser"],
        queryFn: async () => {
            const { data } = await axios.get("/api/users/me");
            return data;
        },
        staleTime: 10 * 60 * 1000, // 10 minutes - user data rarely changes
        gcTime: 30 * 60 * 1000, // 30 minutes cache
        enabled: !isPublicRoute,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });
}

export function useUpdateCurrentUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ data }) => {
            const response = await axios.put("/api/users/me", data);
            return response.data;
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["currentUser"] });
        },
    });
}

export function useUserState() {
    const isPublicRoute = useIsPublicRoute();

    return useQuery({
        queryKey: ["userState"],
        queryFn: async () => {
            const { data } = await axios.get("/api/users/me/state");
            return data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 30 * 60 * 1000, // 30 minutes cache
        enabled: !isPublicRoute,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
    });
}

export function useUpdateUserState() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data) => {
            const response = await axios.put("/api/users/me/state", data);
            return response.data;
        },
        onMutate: async ({ data }) => {
            await queryClient.cancelQueries({ queryKey: ["userState"] });
            const previousUserState = queryClient.getQueryData(["userState"]);

            queryClient.setQueryData(["userState"], (old) => ({
                ...old,
                ...data,
            }));

            return { previousUserState };
        },
        onSuccess: (data) => {
            queryClient.setQueryData(["userState"], data);
        },
    });
}

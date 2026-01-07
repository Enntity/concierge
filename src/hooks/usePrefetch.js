"use client";

import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useEffect, useCallback, useRef } from "react";
import axios from "../../app/utils/axios-client";

// All navigable routes in the app
const PREFETCH_ROUTES = [
    "/home",
    "/chat",
    "/translate",
    "/video",
    "/write",
    "/workspaces",
    "/media",
    "/code/jira",
    "/apps",
];

// Public routes that don't require auth
const PUBLIC_ROUTES = ["/auth/login", "/auth/error", "/privacy", "/published"];

// Data queries to prefetch for each route
const ROUTE_DATA_MAP = {
    "/chat": [
        { key: ["activeChats"], url: "/api/chats/active/detail" },
        { key: ["chats", { page: 1 }], url: "/api/chats?page=1" },
        { key: ["chatsCount"], url: "/api/chats/count" },
    ],
    "/workspaces": [{ key: ["workspaces"], url: "/api/workspaces" }],
    "/home": [
        {
            key: ["tasks", { showDismissed: false }],
            url: "/api/tasks?showDismissed=false",
        },
    ],
    "/media": [
        { key: ["mediaItems", { page: 1 }], url: "/api/media-items?page=1" },
    ],
    "/apps": [{ key: ["availableApps"], url: "/api/apps" }],
};

// Track which routes have been prefetched to avoid duplicate work
const prefetchedRoutes = new Set();
const prefetchedData = new Set();

/**
 * Hook to prefetch all navigation routes and their data
 * Only runs when user is authenticated
 */
export function usePrefetchAll() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { status } = useSession();
    const hasPrefetched = useRef(false);

    const isAuthenticated = status === "authenticated";

    const prefetchRoutes = useCallback(() => {
        if (!isAuthenticated) return;

        // Prefetch all routes (only once per session)
        PREFETCH_ROUTES.forEach((route) => {
            if (!prefetchedRoutes.has(route)) {
                router.prefetch(route);
                prefetchedRoutes.add(route);
            }
        });
    }, [router, isAuthenticated]);

    const prefetchData = useCallback(async () => {
        if (!isAuthenticated) return;

        // Prefetch data for all routes
        const allQueries = Object.values(ROUTE_DATA_MAP).flat();

        const queriesToPrefetch = allQueries.filter(
            ({ url }) => !prefetchedData.has(url),
        );

        if (queriesToPrefetch.length === 0) return;

        await Promise.allSettled(
            queriesToPrefetch.map(({ key, url }) => {
                prefetchedData.add(url);
                return queryClient.prefetchQuery({
                    queryKey: key,
                    queryFn: async () => {
                        const { data } = await axios.get(url);
                        return data;
                    },
                    staleTime: 2 * 60 * 1000, // 2 minutes
                });
            }),
        );
    }, [queryClient, isAuthenticated]);

    const prefetchAll = useCallback(async () => {
        if (!isAuthenticated) return;

        // Only prefetch once per app mount
        if (hasPrefetched.current) return;
        hasPrefetched.current = true;

        // Start route prefetching immediately
        prefetchRoutes();

        // Prefetch data in the background (don't await)
        prefetchData();
    }, [prefetchRoutes, prefetchData, isAuthenticated]);

    return { prefetchAll, prefetchRoutes, prefetchData, isAuthenticated };
}

/**
 * Hook to prefetch a specific route and its data on hover
 * Only runs when user is authenticated
 */
export function usePrefetchOnHover() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { status } = useSession();
    const hoverTimeout = useRef(null);

    const isAuthenticated = status === "authenticated";

    const prefetch = useCallback(
        (route) => {
            // Don't prefetch if not authenticated
            if (!isAuthenticated) return;

            // Clear any pending prefetch
            if (hoverTimeout.current) {
                clearTimeout(hoverTimeout.current);
            }

            // Debounce prefetch by 50ms to avoid prefetching on quick mouse movements
            hoverTimeout.current = setTimeout(async () => {
                // Prefetch the route (if not already done)
                if (!prefetchedRoutes.has(route)) {
                    router.prefetch(route);
                    prefetchedRoutes.add(route);
                }

                // Prefetch the data for this route
                const queries = ROUTE_DATA_MAP[route];
                if (queries) {
                    const queriesToPrefetch = queries.filter(
                        ({ url }) => !prefetchedData.has(url),
                    );

                    if (queriesToPrefetch.length > 0) {
                        await Promise.allSettled(
                            queriesToPrefetch.map(({ key, url }) => {
                                prefetchedData.add(url);
                                return queryClient.prefetchQuery({
                                    queryKey: key,
                                    queryFn: async () => {
                                        const { data } = await axios.get(url);
                                        return data;
                                    },
                                    staleTime: 2 * 60 * 1000,
                                });
                            }),
                        );
                    }
                }
            }, 50);
        },
        [router, queryClient, isAuthenticated],
    );

    return prefetch;
}

/**
 * Component that prefetches everything on mount (only when authenticated)
 */
export function PrefetchOnMount({ children }) {
    const { prefetchAll, isAuthenticated } = usePrefetchAll();
    const pathname = usePathname();

    // Check if we're on a public route
    const isPublicRoute = PUBLIC_ROUTES.some((route) =>
        pathname?.startsWith(route),
    );

    useEffect(() => {
        // Don't prefetch on public routes or when not authenticated
        if (isPublicRoute || !isAuthenticated) return;

        // Small delay to not block initial render
        const timer = setTimeout(() => {
            prefetchAll();
        }, 100);

        return () => clearTimeout(timer);
    }, [prefetchAll, isPublicRoute, isAuthenticated]);

    return children;
}

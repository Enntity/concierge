// In Next.js, this file would be called: app/providers.jsx
"use client";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationProvider } from "../src/contexts/NotificationContext";
import { ChatEntityProvider } from "../src/contexts/ChatEntityContext";
import { PrefetchOnMount } from "../src/hooks/usePrefetch";

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Aggressive caching for snappy navigation
                staleTime: 2 * 60 * 1000, // 2 minutes before data is considered stale
                gcTime: 10 * 60 * 1000, // 10 minutes cache time (formerly cacheTime)
                refetchOnWindowFocus: false, // Don't refetch on tab focus
                refetchOnMount: false, // Use cached data on mount
                retry: 1, // Only retry once on failure
            },
        },
    });
}

let browserQueryClient = undefined;

function getQueryClient() {
    if (typeof window === "undefined") {
        // Server: always make a new query client
        return makeQueryClient();
    } else {
        // Browser: make a new query client if we don't already have one
        // This is very important so we don't re-make a new client if React
        // suspends during the initial render. This may not be needed if we
        // have a suspense boundary BELOW the creation of the query client
        if (!browserQueryClient) browserQueryClient = makeQueryClient();
        return browserQueryClient;
    }
}

export default function Providers({ children }) {
    // NOTE: Avoid useState when initializing the query client if you don't
    //       have a suspense boundary between this and the code that may
    //       suspend because React will throw away the client on the initial
    //       render if it suspends and there is no boundary
    const queryClient = getQueryClient();

    return (
        <SessionProvider>
            <QueryClientProvider client={queryClient}>
                <NotificationProvider>
                    <ChatEntityProvider>
                        <PrefetchOnMount>{children}</PrefetchOnMount>
                    </ChatEntityProvider>
                </NotificationProvider>
            </QueryClientProvider>
        </SessionProvider>
    );
}

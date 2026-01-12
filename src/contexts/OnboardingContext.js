"use client";

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
} from "react";
import { useRouter } from "next/navigation";
import { useEntities } from "../hooks/useEntities";
import { AuthContext } from "../App";
import dynamic from "next/dynamic";

// Dynamically import the onboarding component to avoid SSR issues
const EntityOnboarding = dynamic(
    () => import("../components/onboarding/EntityOnboarding"),
    { ssr: false },
);

// Create the context
const OnboardingContext = createContext({
    isOnboardingOpen: false,
    isFirstRun: false,
    openOnboarding: () => {},
    closeOnboarding: () => {},
});

// Hook to use the onboarding context
export function useOnboarding() {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error(
            "useOnboarding must be used within an OnboardingProvider",
        );
    }
    return context;
}

// Provider component
export function OnboardingProvider({ children }) {
    const router = useRouter();
    const { user } = useContext(AuthContext);
    const { needsOnboarding, isLoading: entitiesLoading } = useEntities(
        user?.contextId,
    );

    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    const [isFirstRun, setIsFirstRun] = useState(false);
    const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);

    // Use ref to track if we've already triggered first-run onboarding
    const firstRunTriggeredRef = useRef(false);

    // Check for first-run onboarding when entities load
    useEffect(() => {
        // Don't check until we have user and entities loaded
        if (!user || entitiesLoading || hasCheckedOnboarding) {
            return;
        }

        // Mark as checked so we don't trigger again
        setHasCheckedOnboarding(true);

        // Check if this is a first-run situation
        if (needsOnboarding && !firstRunTriggeredRef.current) {
            // Check localStorage to see if user has dismissed onboarding before
            const hasSkippedOnboarding = localStorage.getItem(
                "enntity_onboarding_skipped",
            );

            if (!hasSkippedOnboarding) {
                firstRunTriggeredRef.current = true;
                setIsFirstRun(true);
                setIsOnboardingOpen(true);
            }
        }
    }, [user, needsOnboarding, entitiesLoading, hasCheckedOnboarding]);

    // Open onboarding (for manual trigger, e.g., from UserOptions)
    const openOnboarding = useCallback(() => {
        setIsFirstRun(false);
        setIsOnboardingOpen(true);
    }, []);

    // Close onboarding
    const closeOnboarding = useCallback(() => {
        // If this was first run and user closed without completing, remember that
        if (isFirstRun) {
            localStorage.setItem("enntity_onboarding_skipped", "true");
        }
        setIsOnboardingOpen(false);
        setIsFirstRun(false);
    }, [isFirstRun]);

    // Handle onboarding completion
    const handleComplete = useCallback(
        (newEntityId, entityData, prefetchedChatId) => {
            // Clear the skipped flag since they've now completed it
            localStorage.removeItem("enntity_onboarding_skipped");

            setIsOnboardingOpen(false);
            setIsFirstRun(false);

            // If we have a prefetched chat, navigate directly to it (instant!)
            if (prefetchedChatId) {
                console.log(
                    "[Onboarding] Navigating to prefetched chat:",
                    prefetchedChatId,
                );
                router.push(`/chat/${prefetchedChatId}`);
                return;
            }

            // Fallback: if no prefetched chat, just go to chat list
            // (the entity should already be in the list from the prefetch)
            console.log("[Onboarding] No prefetched chat, going to chat list");
            router.push("/chat");
        },
        [router],
    );

    return (
        <OnboardingContext.Provider
            value={{
                isOnboardingOpen,
                isFirstRun,
                openOnboarding,
                closeOnboarding,
            }}
        >
            {children}
            <EntityOnboarding
                isOpen={isOnboardingOpen}
                onClose={closeOnboarding}
                onComplete={handleComplete}
                isFirstRun={isFirstRun}
            />
        </OnboardingContext.Provider>
    );
}

export default OnboardingContext;

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
import { useUpdateAiOptions } from "../../app/queries/options";
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
    pendingOnboardingNav: null, // Chat ID we're navigating to
    onboardingChatReady: false, // True when new chat page is loaded
    openOnboarding: () => {},
    closeOnboarding: () => {},
    confirmOnboardingNavigation: () => {}, // Called by chat page when ready
    finalizeOnboarding: () => {}, // Called after "Connected" is shown
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
    const updateAiOptions = useUpdateAiOptions();

    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
    const [isFirstRun, setIsFirstRun] = useState(false);
    const [hasCheckedOnboarding, setHasCheckedOnboarding] = useState(false);
    const [pendingOnboardingNav, setPendingOnboardingNav] = useState(null);
    const [onboardingChatReady, setOnboardingChatReady] = useState(false);

    // Use ref to track if we've already triggered first-run onboarding
    const firstRunTriggeredRef = useRef(false);
    // Ref to track failsafe timeout so we can clear it
    const failsafeTimeoutRef = useRef(null);

    // Called by chat page when it's fully loaded and ready to display
    // This triggers the "Connected" state in the onboarding modal
    const confirmOnboardingNavigation = useCallback(
        (chatId) => {
            if (pendingOnboardingNav && pendingOnboardingNav === chatId) {
                console.log("[Onboarding] Chat confirmed ready:", chatId);
                // Signal that chat is ready - EntityOnboarding will show "Connected"
                // and then close after a brief delay
                setOnboardingChatReady(true);
            }
        },
        [pendingOnboardingNav],
    );

    // Called by EntityOnboarding after showing "Connected" state
    const finalizeOnboarding = useCallback(() => {
        console.log("[Onboarding] Finalizing and closing modal");
        // Clear failsafe timeout since we're closing normally
        if (failsafeTimeoutRef.current) {
            clearTimeout(failsafeTimeoutRef.current);
            failsafeTimeoutRef.current = null;
        }
        setPendingOnboardingNav(null);
        setOnboardingChatReady(false);
        setIsOnboardingOpen(false);
        setIsFirstRun(false);
    }, []);

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

            // Set the new entity as the user's default entity
            // This enables features like home page greeting
            if (newEntityId && newEntityId !== "pending" && user?.userId) {
                console.log(
                    "[Onboarding] Setting default entity to:",
                    newEntityId,
                );
                updateAiOptions.mutate({
                    userId: user.userId,
                    defaultEntityId: newEntityId,
                });
            }

            // Navigate to the new chat - modal stays open until chat confirms ready
            if (prefetchedChatId) {
                console.log(
                    "[Onboarding] Navigating to prefetched chat:",
                    prefetchedChatId,
                );
                setOnboardingChatReady(false); // Reset for new navigation
                setPendingOnboardingNav(prefetchedChatId);
                router.push(`/chat/${prefetchedChatId}`);

                // Failsafe: close after 8 seconds even if chat doesn't confirm
                // Use functional state check since this runs async
                failsafeTimeoutRef.current = setTimeout(() => {
                    setPendingOnboardingNav((current) => {
                        if (current === prefetchedChatId) {
                            console.log(
                                "[Onboarding] Failsafe timeout triggered",
                            );
                            // Can't call finalizeOnboarding here (stale closure),
                            // so we clear state directly
                            if (failsafeTimeoutRef.current) {
                                failsafeTimeoutRef.current = null;
                            }
                            setOnboardingChatReady(false);
                            setIsOnboardingOpen(false);
                            setIsFirstRun(false);
                            return null;
                        }
                        return current;
                    });
                }, 8000);
                return;
            }

            // No prefetched chat - just close and navigate to chat list
            console.log("[Onboarding] No prefetched chat, going to chat list");
            finalizeOnboarding();
            router.push("/chat");
        },
        [router, updateAiOptions, user?.userId, finalizeOnboarding],
    );

    return (
        <OnboardingContext.Provider
            value={{
                isOnboardingOpen,
                isFirstRun,
                hasCheckedOnboarding, // Expose this so TOS can wait for it
                pendingOnboardingNav,
                onboardingChatReady,
                openOnboarding,
                closeOnboarding,
                confirmOnboardingNavigation,
                finalizeOnboarding,
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

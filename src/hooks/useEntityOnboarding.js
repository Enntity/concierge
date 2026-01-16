import { useCallback, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "../../app/utils/axios-client";

/**
 * Hook to manage the entity onboarding flow.
 *
 * This hook:
 * 1. Fetches the onboarding system entity (Vesper)
 * 2. Manages onboarding state (active, completed)
 * 3. Provides handleEntityCreated callback for when CreateEntity tool completes
 */
export function useEntityOnboarding() {
    // State
    const [isOnboardingActive, setIsOnboardingActive] = useState(false);
    const [onboardingEntity, setOnboardingEntity] = useState(null);
    const [createdEntity, setCreatedEntity] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Ref to track if we've detected entity creation
    const entityCreatedRef = useRef(false);

    // Fetch onboarding entity
    const {
        data: onboardingResult,
        isLoading: onboardingLoading,
        refetch: refetchOnboarding,
    } = useQuery({
        queryKey: ["onboarding-entity"],
        queryFn: async () => {
            const response = await axios.get("/api/entities/onboarding");
            return response.data;
        },
        enabled: isOnboardingActive,
        staleTime: 0,
        gcTime: 0,
    });

    // Parse onboarding entity when data arrives
    useEffect(() => {
        if (onboardingResult && isOnboardingActive) {
            if (onboardingResult.success && onboardingResult.entity) {
                setOnboardingEntity(onboardingResult.entity);
                setError(null);
            } else {
                setError(
                    onboardingResult.error ||
                        "Failed to load onboarding entity",
                );
            }
            setIsLoading(false);
        }
    }, [onboardingResult, isOnboardingActive]);

    /**
     * Start the onboarding process
     */
    const startOnboarding = useCallback(async () => {
        // Clear ALL state first to ensure fresh start
        setOnboardingEntity(null);
        setCreatedEntity(null);
        setError(null);
        entityCreatedRef.current = false;

        // Then activate and start loading
        setIsOnboardingActive(true);
        setIsLoading(true);

        // Trigger refetch to get fresh onboarding entity
        await refetchOnboarding();
    }, [refetchOnboarding]);

    /**
     * Cancel/close onboarding
     */
    const cancelOnboarding = useCallback(() => {
        setIsOnboardingActive(false);
        setOnboardingEntity(null);
        setCreatedEntity(null);
        setError(null);
        entityCreatedRef.current = false;
    }, []);

    /**
     * Handle entity creation from tool call result
     * Called when CreateEntity tool returns successfully
     */
    const handleEntityCreated = useCallback((entityData) => {
        console.log(
            "[useEntityOnboarding] handleEntityCreated called with:",
            entityData,
        );
        if (entityCreatedRef.current) {
            console.log("[useEntityOnboarding] Already created, skipping");
            return; // Prevent duplicate handling
        }
        entityCreatedRef.current = true;

        console.log("[useEntityOnboarding] Setting createdEntity state");
        setCreatedEntity({
            id: entityData.entityId,
            name: entityData.name,
            memoryBackend: entityData.memoryBackend,
            message: entityData.message,
            avatarText: entityData.avatarText,
        });
    }, []);

    /**
     * Complete onboarding and switch to new entity
     */
    const completeOnboarding = useCallback(() => {
        const entityId = createdEntity?.id;

        setIsOnboardingActive(false);
        setOnboardingEntity(null);
        setCreatedEntity(null);
        entityCreatedRef.current = false;

        return entityId;
    }, [createdEntity]);

    return {
        // State
        isOnboardingActive,
        isLoading: isLoading || onboardingLoading,
        error,
        onboardingEntity,
        createdEntity,

        // Actions
        startOnboarding,
        cancelOnboarding,
        completeOnboarding,
        handleEntityCreated,
    };
}

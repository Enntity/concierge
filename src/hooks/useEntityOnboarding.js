import { useCallback, useState, useRef, useEffect } from "react";
import { useQuery } from "@apollo/client";
import { SYS_GET_ONBOARDING_ENTITY } from "../graphql";

/**
 * Hook to manage the entity onboarding flow.
 *
 * This hook:
 * 1. Fetches the onboarding system entity (Enntity)
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
        data: onboardingData,
        loading: onboardingLoading,
        refetch: refetchOnboarding,
    } = useQuery(SYS_GET_ONBOARDING_ENTITY, {
        skip: !isOnboardingActive,
        fetchPolicy: "network-only",
    });

    // Parse onboarding entity when data arrives
    useEffect(() => {
        if (
            onboardingData?.sys_get_onboarding_entity?.result &&
            isOnboardingActive
        ) {
            try {
                const result = JSON.parse(
                    onboardingData.sys_get_onboarding_entity.result,
                );
                if (result.success && result.entity) {
                    setOnboardingEntity(result.entity);
                    setError(null);
                } else {
                    setError(
                        result.error || "Failed to load onboarding entity",
                    );
                }
            } catch (e) {
                console.error("Failed to parse onboarding entity:", e);
                setError("Failed to parse onboarding entity response");
            }
            setIsLoading(false);
        }
    }, [onboardingData, isOnboardingActive]);

    /**
     * Start the onboarding process
     */
    const startOnboarding = useCallback(async () => {
        setIsOnboardingActive(true);
        setIsLoading(true);
        setError(null);
        setCreatedEntity(null);
        entityCreatedRef.current = false;

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

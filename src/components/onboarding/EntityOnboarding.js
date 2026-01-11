"use client";

import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    useContext,
} from "react";
import { useTranslation } from "react-i18next";
import { X, Loader2 } from "lucide-react";
import { AuthContext } from "../../App";
import { useEntityOnboarding } from "../../hooks/useEntityOnboarding";
import { useEntities } from "../../hooks/useEntities";
import { useStreamingMessages } from "../../hooks/useStreamingMessages";
import {
    useAddChat,
    useUpdateChat,
    useDeleteChat,
    useGetChatById,
} from "../../../app/queries/chats";
import axios from "../../../app/utils/axios-client";
import {
    Particles,
    GridBackground,
} from "../../../app/auth/components/AuthBackground";
import AnimatedLogo from "../common/AnimatedLogo";
import { composeUserDateTimeInfo } from "../../utils/datetimeUtils";

// Drifting sparkles around the logo (adapted from sidebar)
const OnboardingSparkles = React.memo(({ size = 120 }) => {
    const sparkles = React.useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const driftRadius = 8 + Math.random() * 10;
            return {
                id: i,
                angle: (i * 360) / 12,
                distance: size / 2 + 10 + Math.random() * 15,
                driftDuration: 8 + Math.random() * 6,
                delay: Math.random() * 4,
                sparkleSize: Math.random() * 3 + 2,
                opacity: Math.random() * 0.5 + 0.4,
                driftX1: (Math.random() - 0.5) * driftRadius * 2,
                driftY1: (Math.random() - 0.5) * driftRadius * 2,
                driftX2: (Math.random() - 0.5) * driftRadius * 2,
                driftY2: (Math.random() - 0.5) * driftRadius * 2,
                driftX3: (Math.random() - 0.5) * driftRadius * 2,
                driftY3: (Math.random() - 0.5) * driftRadius * 2,
            };
        });
    }, [size]);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-visible">
            {sparkles.map((sparkle) => {
                const radian = (sparkle.angle * Math.PI) / 180;
                const x = Math.cos(radian) * sparkle.distance;
                const y = Math.sin(radian) * sparkle.distance;

                return (
                    <div
                        key={sparkle.id}
                        className="absolute rounded-full onboarding-sparkle-drift"
                        style={{
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            width: `${sparkle.sparkleSize}px`,
                            height: `${sparkle.sparkleSize}px`,
                            background: `radial-gradient(circle, rgba(34, 211, 238, ${sparkle.opacity}) 0%, rgba(167, 139, 250, ${sparkle.opacity * 0.6}) 50%, transparent 100%)`,
                            boxShadow: `0 0 ${sparkle.sparkleSize * 2}px rgba(34, 211, 238, ${sparkle.opacity * 0.7})`,
                            "--drift-x1": `${sparkle.driftX1}px`,
                            "--drift-y1": `${sparkle.driftY1}px`,
                            "--drift-x2": `${sparkle.driftX2}px`,
                            "--drift-y2": `${sparkle.driftY2}px`,
                            "--drift-x3": `${sparkle.driftX3}px`,
                            "--drift-y3": `${sparkle.driftY3}px`,
                            animationDuration: `${sparkle.driftDuration}s`,
                            animationDelay: `${sparkle.delay}s`,
                        }}
                    />
                );
            })}
        </div>
    );
});

// Floating text component for entity messages
const FloatingEntityMessage = React.memo(
    ({ content, isVisible, isStreaming }) => {
        // Strip markdown for cleaner display
        const cleanContent =
            content
                ?.replace(/\*\*/g, "")
                ?.replace(/\*/g, "")
                ?.replace(/`/g, "")
                ?.trim() || "";

        return (
            <div
                className={`
                transition-all ease-out
                ${isVisible ? "opacity-100 translate-y-0 onboarding-fade-in" : "opacity-0 translate-y-4"}
            `}
                style={{ transitionDuration: isVisible ? "1000ms" : "300ms" }}
            >
                <p
                    className="text-xl md:text-2xl font-light text-center leading-relaxed text-slate-200"
                    style={{
                        textShadow: `
                        0 0 10px rgba(34, 211, 238, 0.5),
                        0 0 20px rgba(34, 211, 238, 0.4),
                        0 0 40px rgba(34, 211, 238, 0.25),
                        0 0 60px rgba(167, 139, 250, 0.2)
                    `,
                    }}
                >
                    {cleanContent}
                    {isStreaming && (
                        <span className="inline-block w-0.5 h-5 ml-1 bg-cyan-400 animate-pulse align-middle" />
                    )}
                </p>
            </div>
        );
    },
);

// User input component with glow
const EtherealInput = React.memo(
    ({ value, onChange, onSubmit, isVisible, isDisabled, placeholder }) => {
        const inputRef = useRef(null);

        useEffect(() => {
            if (isVisible && !isDisabled) {
                inputRef.current?.focus();
            }
        }, [isVisible, isDisabled]);

        const handleKeyDown = (e) => {
            if (e.key === "Enter" && !e.shiftKey && value.trim()) {
                e.preventDefault();
                onSubmit();
            }
        };

        return (
            <div
                className={`
                transition-all ease-out
                ${isVisible ? "opacity-100 translate-y-0 onboarding-fade-in" : "opacity-0 translate-y-2 pointer-events-none"}
            `}
                style={{
                    transitionDuration: isVisible ? "800ms" : "200ms",
                    transitionDelay: isVisible ? "200ms" : "0ms",
                }}
            >
                <div className="relative flex items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isDisabled}
                        placeholder={placeholder}
                        className="
                        w-full px-0 py-3
                        text-lg md:text-xl font-light text-center
                        bg-transparent border-none outline-none
                        text-cyan-100 placeholder-slate-600
                        disabled:opacity-50
                    "
                        style={{
                            textShadow: value
                                ? "0 0 10px rgba(34, 211, 238, 0.5), 0 0 20px rgba(34, 211, 238, 0.3), 0 0 30px rgba(167, 139, 250, 0.2)"
                                : "none",
                        }}
                    />

                    {value.trim() && (
                        <button
                            onClick={onSubmit}
                            disabled={isDisabled}
                            className="
                            absolute right-0 top-1/2 -translate-y-1/2
                            px-3 py-1.5 rounded-full text-xs
                            text-cyan-400/80 border border-cyan-500/30 bg-cyan-500/10
                            hover:bg-cyan-500/20 transition-colors
                        "
                        >
                            Enter ↵
                        </button>
                    )}
                </div>

                {/* Glowing underline */}
                <div
                    className="h-px w-full transition-all duration-300"
                    style={{
                        background: value
                            ? "linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.6), transparent)"
                            : "linear-gradient(90deg, transparent, rgba(100, 116, 139, 0.4), transparent)",
                        boxShadow: value
                            ? "0 0 10px rgba(34, 211, 238, 0.4)"
                            : "none",
                    }}
                />
            </div>
        );
    },
);

// Contacting Screen - clean, minimal "calling" motif
const ContactingScreen = ({
    entityName,
    avatarText,
    avatarImageUrl,
    isConnected,
}) => {
    const { t } = useTranslation();
    const [dots, setDots] = useState("");

    // Animated dots for "Contacting..."
    useEffect(() => {
        if (isConnected) return;
        const interval = setInterval(() => {
            setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
        }, 500);
        return () => clearInterval(interval);
    }, [isConnected]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            {/* Avatar with pulsing rings */}
            <div className="relative mb-10">
                {/* Outer pulsing ring - subtle "calling" effect */}
                {!isConnected && (
                    <>
                        <div
                            className="absolute inset-0 rounded-full border-2 border-cyan-400/20 animate-ping"
                            style={{ animationDuration: "2s" }}
                        />
                        <div
                            className="absolute -inset-4 rounded-full border border-cyan-400/10 animate-ping"
                            style={{
                                animationDuration: "2.5s",
                                animationDelay: "0.5s",
                            }}
                        />
                    </>
                )}

                {/* Connected glow effect */}
                {isConnected && (
                    <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-cyan-400/20 to-purple-400/20 blur-xl animate-pulse" />
                )}

                {/* Avatar container */}
                <div
                    className={`relative w-32 h-32 rounded-full flex items-center justify-center text-6xl overflow-hidden transition-all duration-700 ${isConnected ? "scale-105 ring-2 ring-cyan-400/50" : "scale-100"}`}
                    style={{
                        background: avatarImageUrl
                            ? "transparent"
                            : "linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, rgba(167, 139, 250, 0.15) 100%)",
                        border: `2px solid ${isConnected ? "rgba(34, 211, 238, 0.6)" : "rgba(34, 211, 238, 0.3)"}`,
                        boxShadow: isConnected
                            ? `0 0 40px rgba(34, 211, 238, 0.4)`
                            : `0 0 20px rgba(34, 211, 238, 0.2)`,
                        transition: "all 0.7s ease-out",
                    }}
                >
                    {avatarImageUrl ? (
                        <img
                            src={avatarImageUrl}
                            alt={entityName}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="select-none">
                            {avatarText || "✨"}
                        </span>
                    )}
                </div>
            </div>

            {/* Name */}
            <h1
                className="text-3xl md:text-4xl font-light text-slate-100 mb-3"
                style={{
                    textShadow: `0 0 20px rgba(34, 211, 238, 0.4)`,
                }}
            >
                {entityName}
            </h1>

            {/* Status text */}
            <div className="h-8 flex items-center justify-center">
                {isConnected ? (
                    <p className="text-lg text-cyan-400 font-light">
                        {t("Connected")} ✓
                    </p>
                ) : (
                    <p className="text-lg text-slate-400 font-light">
                        {t("Connecting")}
                        <span className="inline-block w-6 text-left">
                            {dots}
                        </span>
                    </p>
                )}
            </div>

            {/* Subtle progress indicator */}
            {!isConnected && (
                <div className="mt-6 w-32 h-0.5 rounded-full overflow-hidden bg-slate-700/30">
                    <div
                        className="h-full bg-cyan-400/60 rounded-full"
                        style={{
                            width: "100%",
                            animation: "shimmer 1.5s ease-in-out infinite",
                        }}
                    />
                </div>
            )}
        </div>
    );
};

// Main Onboarding Component
export default function EntityOnboarding({
    isOpen,
    onClose,
    onComplete,
    isFirstRun = false,
}) {
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);

    const {
        isLoading,
        error,
        onboardingEntity,
        createdEntity,
        startOnboarding,
        cancelOnboarding,
        completeOnboarding,
        handleEntityCreated,
    } = useEntityOnboarding();

    // Local state
    const [currentMessage, setCurrentMessage] = useState("");
    const [inputValue, setInputValue] = useState("");
    const [showContacting, setShowContacting] = useState(false);
    const [isEntityReady, setIsEntityReady] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [onboardingChat, setOnboardingChat] = useState(null);
    const [prefetchedChatId, setPrefetchedChatId] = useState(null);
    const [actualEntityId, setActualEntityId] = useState(null);
    const [avatarImageUrl, setAvatarImageUrl] = useState(null);
    const [isFading, setIsFading] = useState(false);

    // Simple refs for tracking
    const conversationRef = useRef([]);
    const hasStartedRef = useRef(false);
    const prefetchStartedRef = useRef(false);

    const addChat = useAddChat();
    const updateChat = useUpdateChat();
    const deleteChat = useDeleteChat();
    const {
        entities,
        refetch: refetchEntities,
        refetchEntity,
    } = useEntities(user?.contextId);

    // Monitor prefetched chat for messages and streaming state
    const { data: prefetchedChat, refetch: refetchPrefetchedChat } =
        useGetChatById(prefetchedChatId);

    // Check if the prefetched chat has entity content ready
    // We consider it ready when:
    // 1. Chat exists with messages
    // 2. Has at least one incoming message (from entity)
    // 3. Streaming has completed (isChatLoading is false)
    const chatHasEntityContent = prefetchedChat?.messages?.some(
        (m) => m.direction === "incoming" && m.payload,
    );
    const isChatStreamingComplete =
        prefetchedChat && !prefetchedChat.isChatLoading;
    const isChatReady = chatHasEntityContent && isChatStreamingComplete;

    // Watch for avatar updates from entities array
    useEffect(() => {
        if (!actualEntityId || !entities || avatarImageUrl) return;

        const entity = entities.find((e) => e.id === actualEntityId);
        if (entity?.avatar?.image?.url) {
            console.log(
                "[Onboarding] Avatar found from entities:",
                entity.avatar.image.url,
            );
            setAvatarImageUrl(entity.avatar.image.url);
        }
    }, [entities, actualEntityId, avatarImageUrl]);

    // Poll for entity avatar updates and chat content during connecting phase
    const pollRef = useRef(null);
    useEffect(() => {
        // Stop polling if:
        // - Not in connecting phase
        // - Chat is ready (has entity content and streaming complete)
        // - No prefetched chat ID yet
        if (!showContacting || isChatReady || !prefetchedChatId) {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            return;
        }

        // Poll every 1.5 seconds for:
        // - Avatar updates (entity)
        // - Chat content updates (messages)
        pollRef.current = setInterval(async () => {
            try {
                // Poll for avatar if we don't have one yet
                if (refetchEntity && actualEntityId && !avatarImageUrl) {
                    await refetchEntity(actualEntityId);
                }
                // Poll for chat content
                if (refetchPrefetchedChat) {
                    await refetchPrefetchedChat();
                }
            } catch (e) {
                console.error("[Onboarding] Poll error:", e);
            }
        }, 1500);

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [
        showContacting,
        actualEntityId,
        avatarImageUrl,
        refetchEntity,
        prefetchedChatId,
        refetchPrefetchedChat,
        isChatReady,
    ]);

    // Track entity creation state
    const entityCreatedRef = useRef(false);
    const pendingEntityRef = useRef(null); // Store entity details from start message
    const transitionStartedRef = useRef(false); // Prevent multiple transitions

    const handleToolMessage = useCallback(
        (toolMessage) => {
            const isCreateEntity =
                toolMessage?.toolName?.toLowerCase() === "createentity";
            if (!isCreateEntity) return;

            if (toolMessage.type === "start" && toolMessage.params) {
                // Store entity details from start message
                pendingEntityRef.current = {
                    name: toolMessage.params.name,
                    avatarText: toolMessage.params.avatarText,
                };
                // Show the contacting screen immediately
                setShowContacting(true);
            } else if (toolMessage.type === "finish") {
                entityCreatedRef.current = true;

                // Trigger entity created handler
                handleEntityCreated({
                    entityId: "pending",
                    name:
                        pendingEntityRef.current?.name || "Your new companion",
                    avatarText: pendingEntityRef.current?.avatarText,
                    success: toolMessage.success !== false,
                });
            }
        },
        [handleEntityCreated],
    );

    const handleStreamComplete = useCallback((content) => {
        // Set message content (unless entity was created - celebration will take over)
        if (content && !entityCreatedRef.current) {
            setCurrentMessage(content);
            conversationRef.current.push({ role: "assistant", content });
        }
    }, []);

    const {
        isStreaming,
        streamingContent,
        setIsStreaming,
        setSubscriptionId,
        clearStreamingState,
    } = useStreamingMessages({
        chat: onboardingChat,
        updateChatHook: updateChat,
        currentEntityId: onboardingEntity?.id,
        onToolMessage: handleToolMessage,
        onStreamComplete: handleStreamComplete,
    });

    // Initialize when opened - only reset when isOpen actually changes to true
    useEffect(() => {
        if (isOpen) {
            // Reset everything
            setCurrentMessage("");
            setShowContacting(false);
            setIsEntityReady(false);
            setOnboardingChat(null);
            setPrefetchedChatId(null);
            setActualEntityId(null);
            setAvatarImageUrl(null);
            setIsFading(false);
            setInputValue("");
            conversationRef.current = [];
            hasStartedRef.current = false;
            prefetchStartedRef.current = false;
            entityCreatedRef.current = false;
            transitionStartedRef.current = false;
            pendingEntityRef.current = null;
            clearStreamingState();
            setMounted(true);
            startOnboarding();
        } else {
            setMounted(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]); // Only trigger on isOpen change, not on function reference changes

    // Create chat and start conversation when entity is ready
    useEffect(() => {
        if (!onboardingEntity || hasStartedRef.current || isStreaming) return;
        hasStartedRef.current = true;

        const startConversation = async () => {
            try {
                // First, cleanup any stale onboarding chats (best effort)
                try {
                    const response = await axios.get(
                        "/api/chats/active/detail",
                    );
                    const activeChats = response.data || [];
                    const staleChats = activeChats.filter(
                        (c) => c.selectedEntityId === onboardingEntity.id,
                    );
                    for (const chat of staleChats) {
                        await deleteChat.mutateAsync({ chatId: chat._id });
                    }
                } catch (e) {
                    console.error("[Onboarding] Cleanup error (non-fatal):", e);
                }

                // Create a fresh chat
                const chat = await addChat.mutateAsync({
                    title: "Entity Onboarding",
                    messages: [],
                    selectedEntityId: onboardingEntity.id,
                    selectedEntityName: onboardingEntity.name,
                    forceNew: true,
                });
                setOnboardingChat(chat);

                // Build and send the priming message
                const userName = user?.name || "the user";
                const primingMessage = isFirstRun
                    ? `A user with the following username:${userName} is here to meet a new AI - please start the conversation and get to know them.`
                    : `A user with the following username:${userName} wants to meet another AI companion. This is not their first time - they have spoken with you before. Please help them find a new one.`;

                conversationRef.current = [
                    { role: "user", content: primingMessage },
                ];

                setIsStreaming(true);
                clearStreamingState();

                const streamResponse = await fetch(
                    `/api/chats/${chat._id}/stream`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            conversation: conversationRef.current,
                            agentContext: user.contextId
                                ? [
                                      {
                                          contextId: user.contextId,
                                          contextKey: user.contextKey || "",
                                          default: true,
                                      },
                                  ]
                                : [],
                            aiName: onboardingEntity.name,
                            aiMemorySelfModify: false,
                            title: "Entity Onboarding",
                            entityId: onboardingEntity.id,
                            researchMode: false,
                            model: user.agentModel || "gemini-flash-3-vision",
                            userInfo: composeUserDateTimeInfo(),
                        }),
                    },
                );

                if (!streamResponse.ok)
                    throw new Error(
                        `Stream failed: ${streamResponse.statusText}`,
                    );
                setSubscriptionId(streamResponse);
            } catch (error) {
                console.error("[Onboarding] Start error:", error);
                setCurrentMessage(
                    t("I encountered an issue. Let's try again."),
                );
            }
        };

        startConversation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onboardingEntity]); // Only trigger when entity loads

    // Mark entity as ready when created
    useEffect(() => {
        if (createdEntity && !isEntityReady) {
            setIsEntityReady(true);
        }
    }, [createdEntity, isEntityReady]);

    // Prefetch and prepare chat
    useEffect(() => {
        if (!showContacting || !createdEntity || prefetchStartedRef.current)
            return;
        prefetchStartedRef.current = true;

        const prefetch = async () => {
            try {
                const result = await refetchEntities();
                let entityId = createdEntity.id;

                if (!entityId || entityId === "pending") {
                    // React Query refetch returns { data, ... } where data is the entities array
                    const entities = result?.data;
                    if (entities && Array.isArray(entities)) {
                        const match = entities
                            .filter(
                                (e) =>
                                    e.name === createdEntity.name &&
                                    !e.isSystem,
                            )
                            .sort(
                                (a, b) =>
                                    new Date(b.createdAt || 0) -
                                    new Date(a.createdAt || 0),
                            )[0];
                        if (match) {
                            entityId = match.id;
                            setActualEntityId(entityId);
                            // Capture avatar image URL if available
                            if (match.avatar?.image?.url) {
                                setAvatarImageUrl(match.avatar.image.url);
                            }
                        }
                    }
                } else {
                    setActualEntityId(entityId);
                }

                if (entityId && entityId !== "pending") {
                    const newChat = await addChat.mutateAsync({
                        title: createdEntity.name,
                        messages: [],
                        selectedEntityId: entityId,
                        selectedEntityName: createdEntity.name,
                        forceNew: true,
                    });

                    if (newChat?._id) {
                        setPrefetchedChatId(newChat._id);
                        fetch(`/api/chats/${newChat._id}/stream`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                conversation: [
                                    {
                                        role: "user",
                                        content:
                                            "Please use your tools to create a suitable avatar image for yourself and then introduce yourself warmly to your new friend. This is your first conversation together!",
                                    },
                                ],
                                agentContext: user.contextId
                                    ? [
                                          {
                                              contextId: user.contextId,
                                              contextKey: user.contextKey || "",
                                              default: true,
                                          },
                                      ]
                                    : [],
                                aiName: createdEntity.name,
                                aiMemorySelfModify: true,
                                title: createdEntity.name,
                                entityId,
                                researchMode: false,
                                model:
                                    user.agentModel || "gemini-flash-3-vision",
                                userInfo: composeUserDateTimeInfo(),
                            }),
                        }).catch(console.error);
                    }
                }
            } catch (error) {
                console.error("[Onboarding] Prefetch error:", error);
            }
        };
        prefetch();
    }, [showContacting, createdEntity, refetchEntities, addChat, user]);

    // Auto-transition to chat when everything is ready
    useEffect(() => {
        // Only proceed if:
        // 1. We're in the contacting screen
        // 2. Entity is ready
        // 3. We have a prefetched chat ID (chat was successfully created)
        // 4. Chat has entity content and streaming is complete
        // 5. We haven't started transition yet

        console.log("[Onboarding] Transition check:", {
            showContacting,
            isEntityReady,
            prefetchedChatId,
            isChatReady,
            chatHasEntityContent,
            isChatStreamingComplete,
            transitionStarted: transitionStartedRef.current,
        });

        if (
            showContacting &&
            isEntityReady &&
            prefetchedChatId &&
            isChatReady &&
            !transitionStartedRef.current
        ) {
            transitionStartedRef.current = true;
            console.log(
                "[Onboarding] Starting transition to chat:",
                prefetchedChatId,
            );

            // Brief delay to show "Connected" state, then transition
            const timer = setTimeout(() => {
                const newEntityId = actualEntityId || createdEntity?.id;
                console.log(
                    "[Onboarding] Executing transition with entityId:",
                    newEntityId,
                );

                // Complete onboarding
                completeOnboarding();

                // Delete the onboarding chat - best effort, don't block on failure
                if (onboardingChat?._id) {
                    deleteChat.mutate(
                        { chatId: onboardingChat._id },
                        {
                            onError: () => {}, // Silently ignore delete errors
                        },
                    );
                }

                // Transition to the new chat
                onComplete?.(newEntityId, createdEntity, prefetchedChatId);
                onClose();
            }, 1200);
            return () => clearTimeout(timer);
        }
    }, [
        showContacting,
        isEntityReady,
        prefetchedChatId,
        isChatReady,
        chatHasEntityContent,
        isChatStreamingComplete,
        actualEntityId,
        createdEntity,
        onComplete,
        onClose,
        completeOnboarding,
        deleteChat,
        onboardingChat,
    ]);

    // Handle user sending a message
    const handleSendMessage = useCallback(
        async (messageText) => {
            if (
                !messageText?.trim() ||
                !onboardingChat ||
                !onboardingEntity ||
                isStreaming
            )
                return;

            const userMessage = messageText.trim();

            // Quick fade transition
            setIsFading(true);
            await new Promise((resolve) => setTimeout(resolve, 250));

            // Add to conversation and clear UI
            conversationRef.current.push({
                role: "user",
                content: userMessage,
            });
            setCurrentMessage("");
            setInputValue("");
            setIsFading(false);

            try {
                setIsStreaming(true);
                clearStreamingState();

                const response = await fetch(
                    `/api/chats/${onboardingChat._id}/stream`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            conversation: conversationRef.current,
                            agentContext: user.contextId
                                ? [
                                      {
                                          contextId: user.contextId,
                                          contextKey: user.contextKey || "",
                                          default: true,
                                      },
                                  ]
                                : [],
                            aiName: onboardingEntity.name,
                            aiMemorySelfModify: false,
                            title: "Entity Onboarding",
                            entityId: onboardingEntity.id,
                            researchMode: false,
                            model: user.agentModel || "gemini-flash-3-vision",
                            userInfo: composeUserDateTimeInfo(),
                        }),
                    },
                );

                if (!response.ok)
                    throw new Error(`Stream failed: ${response.statusText}`);
                setSubscriptionId(response);
            } catch (error) {
                console.error("Error sending message:", error);
                setIsStreaming(false);
                setCurrentMessage(
                    t("I encountered an issue. Let's try again."),
                );
            }
        },
        [
            onboardingChat,
            onboardingEntity,
            isStreaming,
            user,
            setIsStreaming,
            setSubscriptionId,
            clearStreamingState,
            t,
        ],
    );

    const handleClose = useCallback(() => {
        // Delete the onboarding chat if one was created
        if (onboardingChat?._id) {
            deleteChat.mutate({ chatId: onboardingChat._id });
        }

        clearStreamingState();
        cancelOnboarding();
        onClose();
    }, [
        clearStreamingState,
        cancelOnboarding,
        onClose,
        onboardingChat,
        deleteChat,
    ]);

    if (!isOpen) return null;

    const displayMessage = isStreaming ? streamingContent : currentMessage;
    const showInput =
        !isStreaming && !showContacting && displayMessage && !isLoading;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Background */}
            <div className="absolute inset-0">
                <GridBackground />
                <Particles />
            </div>

            {/* Close button */}
            {!isFirstRun && (
                <button
                    onClick={handleClose}
                    className={`
                        absolute top-5 right-5 z-50 p-2.5 rounded-full
                        text-slate-500 hover:text-slate-300
                        bg-slate-800/40 hover:bg-slate-800/60
                        border border-slate-700/50
                        transition-all duration-200
                        ${mounted ? "opacity-100" : "opacity-0"}
                    `}
                >
                    <X className="w-5 h-5" />
                </button>
            )}

            {/* Main content */}
            <div
                className={`relative w-full max-w-2xl px-6 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}
            >
                {showContacting ? (
                    <ContactingScreen
                        entityName={
                            pendingEntityRef.current?.name ||
                            createdEntity?.name ||
                            "..."
                        }
                        avatarText={
                            pendingEntityRef.current?.avatarText ||
                            createdEntity?.avatarText
                        }
                        avatarImageUrl={avatarImageUrl}
                        isConnected={
                            isEntityReady && !!prefetchedChatId && isChatReady
                        }
                    />
                ) : (
                    <div className="relative min-h-[60vh]">
                        {/* Logo with sparkles - absolutely positioned, animates independently */}
                        <div
                            className={`absolute left-1/2 transition-all duration-1000 ease-out ${mounted ? "opacity-100" : "opacity-0"} ${isStreaming || (onboardingEntity && !displayMessage) ? "logo-heartbeat" : ""}`}
                            style={{
                                transform: `translateX(-50%) translateY(${onboardingEntity ? "0" : "12vh"})`,
                                top: "0",
                            }}
                        >
                            <OnboardingSparkles size={120} />
                            <AnimatedLogo size={120} animate={true} />
                        </div>

                        {/* Content area - below logo */}
                        <div className="flex flex-col items-center pt-44">
                            {/* Loading */}
                            {isLoading && !onboardingEntity ? (
                                <div className="flex flex-col items-center gap-4 mt-12">
                                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                                    <p className="text-slate-400 font-light">
                                        {t("Preparing...")}
                                    </p>
                                </div>
                            ) : error ? (
                                <div className="text-center">
                                    <p className="text-red-400 mb-4">{error}</p>
                                    <button
                                        onClick={startOnboarding}
                                        className="px-4 py-2 rounded-lg bg-slate-800/50 text-slate-200 hover:bg-slate-700/50 border border-slate-700/50"
                                    >
                                        {t("Try Again")}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Entity message */}
                                    <div
                                        className={`max-w-xl mx-auto mb-10 transition-opacity duration-300 ${isFading ? "opacity-0" : "opacity-100"}`}
                                    >
                                        <FloatingEntityMessage
                                            content={displayMessage}
                                            isVisible={!!displayMessage}
                                            isStreaming={isStreaming}
                                        />
                                    </div>

                                    {/* User input */}
                                    <div
                                        className={`w-full max-w-md mx-auto transition-opacity duration-300 ${isFading ? "opacity-0" : "opacity-100"}`}
                                    >
                                        <EtherealInput
                                            value={inputValue}
                                            onChange={setInputValue}
                                            onSubmit={() =>
                                                handleSendMessage(inputValue)
                                            }
                                            isVisible={showInput}
                                            isDisabled={
                                                isStreaming || !onboardingEntity
                                            }
                                            placeholder={t(
                                                "Type your response...",
                                            )}
                                        />
                                    </div>

                                    {/* Waiting indicator */}
                                    {isStreaming && !streamingContent && (
                                        <div className="flex items-center gap-2 text-slate-500 mt-6">
                                            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                                            <span className="text-sm">
                                                {t("Thinking...")}
                                            </span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Animations */}
            <style jsx global>{`
                @keyframes onboarding-fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .onboarding-fade-in {
                    animation: onboarding-fade-in 1s ease-out forwards;
                }
                @keyframes celebration-float {
                    0% {
                        opacity: 0;
                        transform: translateY(100px);
                    }
                    20% {
                        opacity: 1;
                    }
                    80% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-100vh);
                    }
                }
                .animate-celebration-float {
                    animation: celebration-float 4s ease-out forwards;
                }
                @keyframes sparkle-drift {
                    0%,
                    100% {
                        transform: translate(-50%, -50%) translate(0, 0);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    25% {
                        transform: translate(-50%, -50%)
                            translate(var(--drift-x1), var(--drift-y1));
                        opacity: 0.8;
                    }
                    40% {
                        opacity: 0;
                    }
                    50% {
                        transform: translate(-50%, -50%)
                            translate(var(--drift-x2), var(--drift-y2));
                        opacity: 0;
                    }
                    60% {
                        opacity: 1;
                    }
                    75% {
                        transform: translate(-50%, -50%)
                            translate(var(--drift-x3), var(--drift-y3));
                        opacity: 0.6;
                    }
                    90% {
                        opacity: 0;
                    }
                }
                .onboarding-sparkle-drift {
                    animation: sparkle-drift ease-in-out infinite;
                }
                @keyframes celebration-text-appear {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                        filter: blur(4px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                        filter: blur(0);
                    }
                }
                .celebration-text-appear {
                    animation: celebration-text-appear 1.2s ease-out forwards;
                }
                @keyframes logo-heartbeat {
                    0%,
                    100% {
                        filter: drop-shadow(0 0 8px rgba(103, 232, 249, 0.3));
                    }
                    50% {
                        filter: drop-shadow(0 0 24px rgba(103, 232, 249, 0.8))
                            drop-shadow(0 0 48px rgba(103, 232, 249, 0.5));
                    }
                }
                .logo-heartbeat {
                    animation: logo-heartbeat 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

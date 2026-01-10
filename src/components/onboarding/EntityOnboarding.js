"use client";

import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    useContext,
} from "react";
import { useTranslation } from "react-i18next";
import { X, Send, Loader2, Sparkles, User } from "lucide-react";
import Loader from "../../../app/components/loader";
import { AuthContext } from "../../App";
import { useEntityOnboarding } from "../../hooks/useEntityOnboarding";
import { useEntities } from "../../hooks/useEntities";
import { useStreamingMessages } from "../../hooks/useStreamingMessages";
import { useAddChat, useUpdateChat } from "../../../app/queries/chats";
import BotMessage from "../chat/BotMessage";
import StreamingMessage from "../chat/StreamingMessage";
import {
    Particles,
    GridBackground,
} from "../../../app/auth/components/AuthBackground";
import AnimatedLogo from "../common/AnimatedLogo";
import { composeUserDateTimeInfo } from "../../utils/datetimeUtils";

// User message component for onboarding (matches main chat style)
const UserMessage = React.memo(({ message, user }) => (
    <div className="flex bg-sky-100 dark:bg-gray-600 ps-1 pt-1 relative group rounded-t-lg rounded-br-lg mb-4">
        <div className="absolute top-3 start-3 flex items-center justify-center w-7 h-7 rounded-full bg-sky-200 dark:bg-sky-900/30 overflow-hidden border-2 border-gray-300 dark:border-gray-700">
            {user?.picture || user?.profilePicture ? (
                <img
                    src={user.picture || user.profilePicture}
                    alt={user?.name || "User"}
                    className="w-full h-full object-cover"
                />
            ) : user?.initials ? (
                <span className="text-sm font-medium text-sky-600 dark:text-sky-400 leading-none">
                    {user.initials}
                </span>
            ) : (
                <User className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            )}
        </div>
        <div className="px-1 pb-3 pt-3 ps-12 w-full">
            <pre className="chat-message-user">{message.payload}</pre>
        </div>
    </div>
));

// Entity Created Celebration Component
const EntityCreatedCelebration = ({ entityName, avatarText, onContinue }) => {
    const { t } = useTranslation();
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setShowContent(true), 300);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
            {/* Celebration particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(20)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute animate-float-up"
                        style={{
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 2}s`,
                            animationDuration: `${3 + Math.random() * 2}s`,
                        }}
                    >
                        <Sparkles
                            className="w-4 h-4 text-cyan-400/60"
                            style={{
                                transform: `rotate(${Math.random() * 360}deg)`,
                            }}
                        />
                    </div>
                ))}
            </div>

            <div
                className={`transition-all duration-1000 ${
                    showContent ? "opacity-100 scale-100" : "opacity-0 scale-90"
                }`}
            >
                {/* Avatar */}
                <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border-2 border-cyan-400/50 flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(34,211,238,0.3)]">
                        {avatarText || "✨"}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                        <svg
                            className="w-5 h-5 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                </div>

                {/* Name reveal */}
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-3">
                    {t("Meet")} {entityName}
                </h2>

                <p className="text-slate-400 text-lg mb-8 max-w-md">
                    {t("Nice to meet you! Ready to start chatting?")}
                </p>

                <button
                    onClick={onContinue}
                    className="group relative px-8 py-4 rounded-xl font-medium text-white overflow-hidden transition-all duration-300 hover:scale-105"
                    style={{
                        background:
                            "linear-gradient(135deg, rgba(34, 211, 238, 0.3) 0%, rgba(167, 139, 250, 0.3) 100%)",
                        boxShadow:
                            "0 8px 30px -4px rgba(6, 182, 212, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
                    }}
                >
                    <span className="relative z-10 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" />
                        {t("Say Hi to")} {entityName}
                    </span>
                </button>
            </div>
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
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const [showCelebration, setShowCelebration] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [onboardingChat, setOnboardingChat] = useState(null);
    const [prefetchedChatId, setPrefetchedChatId] = useState(null);
    const [actualEntityId, setActualEntityId] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const hasAutoStartedRef = useRef(false);
    const prefetchStartedRef = useRef(false); // Track if prefetch has started

    const addChat = useAddChat();
    const updateChat = useUpdateChat();
    const { refetch: refetchEntities } = useEntities(user?.contextId);

    // Handle tool status messages from the stream (for UI updates)
    // Note: The actual entity data comes through fullToolCalls in handleStreamComplete
    const handleToolMessage = useCallback((toolMessage) => {
        console.log("[Onboarding] Tool status message:", toolMessage);
        // We just log these for debugging - actual entity creation is triggered
        // in handleStreamComplete when we receive the full tool call data
    }, []);

    // Handle stream completion - add the assistant's message and check for CreateEntity tool
    const handleStreamComplete = useCallback(
        (content, fullToolCalls) => {
            console.log(
                "[Onboarding] Stream complete, content:",
                content?.substring(0, 100),
            );
            console.log("[Onboarding] Full tool calls:", fullToolCalls);

            if (content) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        payload: content,
                        sender: "enntity",
                        sentTime: new Date().toISOString(),
                    },
                ]);
            }

            // Check if CreateEntity was called and extract the entity data
            if (fullToolCalls && fullToolCalls.length > 0) {
                const createEntityCall = fullToolCalls.find(
                    (tc) => tc.name === "CreateEntity",
                );
                if (createEntityCall) {
                    console.log(
                        "[Onboarding] Found CreateEntity call:",
                        createEntityCall,
                    );
                    const args = createEntityCall.arguments;
                    if (args && args.name) {
                        console.log(
                            "[Onboarding] Triggering entity creation with:",
                            args,
                        );
                        handleEntityCreated({
                            entityId: "pending", // Will be resolved by refetch
                            name: args.name,
                            avatarText: args.avatarText,
                            success: true,
                        });
                    }
                }
            }
        },
        [handleEntityCreated],
    );

    // Use the shared streaming hook (we don't show ephemeral/thinking content in onboarding)
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

    // Initialize onboarding when opened
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            startOnboarding();
            setMessages([]);
            clearStreamingState();
            setShowCelebration(false);
            setOnboardingChat(null);
            setPrefetchedChatId(null);
            setActualEntityId(null);
            hasAutoStartedRef.current = false;
            prefetchStartedRef.current = false; // Reset prefetch flag
        } else {
            setMounted(false);
        }
    }, [isOpen, startOnboarding, clearStreamingState]);

    // Show celebration when entity is created
    useEffect(() => {
        console.log(
            "[Onboarding] Celebration effect - createdEntity:",
            createdEntity,
            "showCelebration:",
            showCelebration,
        );
        if (createdEntity && !showCelebration) {
            console.log("[Onboarding] Starting celebration timer");
            // Small delay to let the final message render
            const timer = setTimeout(() => {
                console.log("[Onboarding] Showing celebration!");
                setShowCelebration(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [createdEntity, showCelebration]);

    // Prefetch: Reload entities and create chat as soon as celebration shows
    useEffect(() => {
        if (!showCelebration || !createdEntity || prefetchStartedRef.current)
            return;

        prefetchStartedRef.current = true;
        console.log(
            "[Onboarding] Prefetching - reloading entities and creating chat",
        );
        console.log("[Onboarding] createdEntity:", createdEntity);

        const prefetch = async () => {
            try {
                // Refetch entities to get the new one
                const result = await refetchEntities();
                console.log("[Onboarding] Entities refetched, result:", result);

                // Find the actual entity ID by name
                let entityId = createdEntity.id;
                console.log(
                    "[Onboarding] Initial entityId from createdEntity:",
                    entityId,
                );

                if (!entityId || entityId === "pending") {
                    const entitiesResult =
                        result?.data?.sys_get_entities?.result;
                    console.log(
                        "[Onboarding] Looking for entity by name:",
                        createdEntity.name,
                    );
                    if (entitiesResult) {
                        const entities = JSON.parse(entitiesResult);
                        console.log(
                            "[Onboarding] Available entities:",
                            entities.map((e) => ({
                                id: e.id,
                                name: e.name,
                                isSystem: e.isSystem,
                                createdAt: e.createdAt,
                            })),
                        );

                        // Filter by name match (non-system) and sort by createdAt (most recent first)
                        const matchingEntities = entities
                            .filter(
                                (e) =>
                                    e.name === createdEntity.name &&
                                    !e.isSystem,
                            )
                            .sort((a, b) => {
                                // Sort by createdAt descending (most recent first)
                                const aTime = a.createdAt
                                    ? new Date(a.createdAt).getTime()
                                    : 0;
                                const bTime = b.createdAt
                                    ? new Date(b.createdAt).getTime()
                                    : 0;
                                return bTime - aTime;
                            });

                        if (matchingEntities.length > 0) {
                            const newEntity = matchingEntities[0]; // Most recently created
                            entityId = newEntity.id;
                            setActualEntityId(entityId);
                            console.log(
                                "[Onboarding] Found entity ID (most recent):",
                                entityId,
                                "createdAt:",
                                newEntity.createdAt,
                            );
                        } else {
                            console.log(
                                "[Onboarding] Entity NOT found by name match!",
                            );
                        }
                    } else {
                        console.log(
                            "[Onboarding] No entities result in refetch response",
                        );
                    }
                } else {
                    setActualEntityId(entityId);
                    console.log(
                        "[Onboarding] Using existing entityId:",
                        entityId,
                    );
                }

                // Create the new chat in advance
                if (entityId && entityId !== "pending") {
                    console.log(
                        "[Onboarding] Creating chat with entityId:",
                        entityId,
                    );
                    const newChat = await addChat.mutateAsync({
                        title: createdEntity.name,
                        messages: [],
                        selectedEntityId: entityId,
                        forceNew: true, // Don't reuse existing chats - we need this specific entity
                    });

                    if (newChat?._id) {
                        setPrefetchedChatId(newChat._id);
                        console.log(
                            "[Onboarding] Prefetched chat created:",
                            newChat._id,
                        );

                        // Trigger the entity to introduce itself
                        // Fire and forget - we don't need to wait for or process the response
                        console.log(
                            "[Onboarding] Triggering entity introduction",
                        );
                        fetch(`/api/chats/${newChat._id}/stream`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                conversation: [
                                    {
                                        role: "user",
                                        content:
                                            "Please introduce yourself warmly to your new friend. This is your first conversation together!",
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
                                entityId: entityId,
                                researchMode: false,
                                model:
                                    user.agentModel || "gemini-flash-3-vision",
                                userInfo: composeUserDateTimeInfo(),
                            }),
                        }).catch((err) => {
                            console.error(
                                "[Onboarding] Failed to trigger entity introduction:",
                                err,
                            );
                        });
                    } else {
                        console.log(
                            "[Onboarding] Chat creation returned no _id:",
                            newChat,
                        );
                    }
                } else {
                    console.log(
                        "[Onboarding] Cannot create chat - no valid entityId",
                    );
                }
            } catch (error) {
                console.error("[Onboarding] Prefetch error:", error);
            }
        };

        prefetch();
    }, [showCelebration, createdEntity, refetchEntities, addChat, user]);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingContent]);

    // Focus input when ready
    useEffect(() => {
        if (onboardingEntity && !isStreaming && !showCelebration) {
            inputRef.current?.focus();
        }
    }, [onboardingEntity, isStreaming, showCelebration]);

    const handleSendMessage = useCallback(
        async (messageText, isAutomatic = false) => {
            if (!messageText?.trim() || !onboardingEntity || isStreaming)
                return;

            const userMessage = {
                id: Date.now(),
                payload: messageText.trim(),
                sender: "user",
                sentTime: new Date().toISOString(),
            };

            // Add user message to UI (skip for automatic first message)
            if (!isAutomatic) {
                setMessages((prev) => [...prev, userMessage]);
            }
            setInputValue("");

            try {
                // Build conversation history
                const conversationHistory = [...messages, userMessage].map(
                    (m) => ({
                        role: m.sender === "user" ? "user" : "assistant",
                        content: m.payload,
                    }),
                );

                // Create or get chat for this onboarding session
                let chat = onboardingChat;
                if (!chat) {
                    chat = await addChat.mutateAsync({
                        title: "Entity Onboarding",
                        messages: [],
                        selectedEntityId: onboardingEntity.id,
                        forceNew: true, // Don't reuse - we need a fresh onboarding chat
                    });
                    setOnboardingChat(chat);
                }

                // Build agent context
                const agentContext = user.contextId
                    ? [
                          {
                              contextId: user.contextId,
                              contextKey: user.contextKey || "",
                              default: true,
                          },
                      ]
                    : [];

                // Set streaming state
                setIsStreaming(true);
                clearStreamingState();

                // Stream response from onboarding entity
                const response = await fetch(`/api/chats/${chat._id}/stream`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        conversation: conversationHistory,
                        agentContext,
                        aiName: onboardingEntity.name,
                        aiMemorySelfModify: false,
                        title: "Entity Onboarding",
                        entityId: onboardingEntity.id,
                        researchMode: false,
                        model: user.agentModel || "gemini-flash-3-vision",
                        userInfo: composeUserDateTimeInfo(),
                    }),
                });

                if (!response.ok) {
                    throw new Error(
                        `Stream request failed: ${response.statusText}`,
                    );
                }

                // Let the streaming hook handle the response
                setSubscriptionId(response);
            } catch (error) {
                console.error("Error sending message:", error);
                setIsStreaming(false);
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now(),
                        payload: t("I encountered an issue. Let's try again."),
                        sender: "enntity",
                        sentTime: new Date().toISOString(),
                    },
                ]);
            }
        },
        [
            messages,
            onboardingEntity,
            onboardingChat,
            isStreaming,
            user,
            addChat,
            setIsStreaming,
            setSubscriptionId,
            clearStreamingState,
            t,
        ],
    );

    // Auto-start conversation when onboarding entity is loaded
    // (Placed after handleSendMessage definition to avoid no-use-before-define warning)
    useEffect(() => {
        if (onboardingEntity && !hasAutoStartedRef.current && !isStreaming) {
            hasAutoStartedRef.current = true;
            const userName = user?.name || "the user";
            handleSendMessage(
                `A user with the following username:${userName} is here to meet a new AI - please start the conversation and get to know them.`,
                true,
            );
        }
    }, [onboardingEntity, isStreaming, handleSendMessage, user?.name]);

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(inputValue);
        }
    };

    const handleComplete = useCallback(() => {
        console.log("[Onboarding] handleComplete called");
        console.log("[Onboarding] prefetchedChatId:", prefetchedChatId);
        console.log("[Onboarding] actualEntityId:", actualEntityId);
        console.log("[Onboarding] createdEntity:", createdEntity);

        const newEntityId = actualEntityId || completeOnboarding();

        // Clean up the onboarding chat
        if (onboardingChat?._id) {
            updateChat.mutate({
                chatId: onboardingChat._id,
                messages: [],
                title: "",
            });
        }

        // Pass the prefetched chat ID and actual entity ID for instant transition
        onComplete?.(newEntityId, createdEntity, prefetchedChatId);
        onClose();
    }, [
        completeOnboarding,
        updateChat,
        onboardingChat,
        onComplete,
        onClose,
        createdEntity,
        prefetchedChatId,
        actualEntityId,
    ]);

    const handleClose = useCallback(() => {
        clearStreamingState();
        cancelOnboarding();
        onClose();
    }, [clearStreamingState, cancelOnboarding, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Animated background */}
            <div className="absolute inset-0">
                <GridBackground />
                <Particles />
            </div>

            {/* Close button (only if not first run) */}
            {!isFirstRun && (
                <button
                    onClick={handleClose}
                    className={`absolute top-4 right-4 z-50 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all duration-300 ${
                        mounted ? "opacity-100" : "opacity-0"
                    }`}
                >
                    <X className="w-6 h-6" />
                </button>
            )}

            {/* Main content */}
            <div
                className={`relative w-full max-w-2xl h-[85vh] mx-4 rounded-2xl overflow-hidden transition-all duration-700 ${
                    mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
                }`}
                style={{
                    background:
                        "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(148, 163, 184, 0.1)",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(34, 211, 238, 0.1)",
                }}
            >
                {/* Top accent gradient */}
                <div
                    className="absolute top-0 left-0 right-0 h-px"
                    style={{
                        background:
                            "linear-gradient(90deg, transparent 0%, rgba(34, 211, 238, 0.5) 50%, transparent 100%)",
                    }}
                />

                {showCelebration ? (
                    <EntityCreatedCelebration
                        entityName={createdEntity?.name}
                        avatarText={createdEntity?.avatarText}
                        onContinue={handleComplete}
                    />
                ) : (
                    <div className="flex flex-col h-full">
                        {/* Header */}
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-700/50">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-500/30 flex items-center justify-center">
                                {onboardingEntity?.avatar?.text || (
                                    <AnimatedLogo
                                        size={24}
                                        animate={isLoading}
                                    />
                                )}
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-100">
                                    {isFirstRun
                                        ? t("Welcome to Enntity")
                                        : t("Meet a New AI")}
                                </h2>
                                <p className="text-sm text-slate-400">
                                    {t("Let's discover the right AI for you")}
                                </p>
                            </div>
                        </div>

                        {/* Messages area */}
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            {isLoading && !onboardingEntity ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                                        <p className="text-slate-400">
                                            {t("Preparing your experience...")}
                                        </p>
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <p className="text-red-400 mb-4">
                                            {error}
                                        </p>
                                        <button
                                            onClick={startOnboarding}
                                            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                                        >
                                            {t("Try Again")}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message) =>
                                        message.sender === "user" ? (
                                            <UserMessage
                                                key={message.id}
                                                message={message}
                                                user={user}
                                            />
                                        ) : (
                                            <div
                                                key={message.id}
                                                className="mb-4"
                                            >
                                                <BotMessage
                                                    message={message}
                                                    selectedEntityId={
                                                        onboardingEntity?.id
                                                    }
                                                    entities={
                                                        onboardingEntity
                                                            ? [onboardingEntity]
                                                            : []
                                                    }
                                                    onLoad={() => {}}
                                                />
                                            </div>
                                        ),
                                    )}
                                    {/* Show streaming content using the real StreamingMessage */}
                                    {(streamingContent || isStreaming) &&
                                        messages[messages.length - 1]
                                            ?.payload !== streamingContent && (
                                            <div className="mb-4">
                                                <StreamingMessage
                                                    content={streamingContent}
                                                    ephemeralContent=""
                                                    toolCalls={[]}
                                                    thinkingDuration={0}
                                                    isThinking={false}
                                                    selectedEntityId={
                                                        onboardingEntity?.id
                                                    }
                                                    entities={
                                                        onboardingEntity
                                                            ? [onboardingEntity]
                                                            : []
                                                    }
                                                />
                                            </div>
                                        )}
                                    {/* Show sparkle loader when waiting for response */}
                                    {isStreaming && !streamingContent && (
                                        <div className="mb-4 flex items-center gap-3 ps-2">
                                            <Loader size="small" delay={0} />
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </>
                            )}
                        </div>

                        {/* Input area */}
                        <div className="px-6 py-4 border-t border-slate-700/50">
                            <div className="flex gap-3">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) =>
                                        setInputValue(e.target.value)
                                    }
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        isStreaming
                                            ? t("Waiting for response...")
                                            : t("Type your message...")
                                    }
                                    disabled={
                                        isStreaming ||
                                        !onboardingEntity ||
                                        showCelebration
                                    }
                                    className="flex-1 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-all disabled:opacity-50"
                                />
                                <button
                                    onClick={() =>
                                        handleSendMessage(inputValue)
                                    }
                                    disabled={
                                        !inputValue.trim() ||
                                        isStreaming ||
                                        !onboardingEntity ||
                                        showCelebration
                                    }
                                    className="px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 hover:from-cyan-500/30 hover:to-purple-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isStreaming ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-slate-500 text-center">
                                {t("Tell me about yourself...")}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* CSS for animations */}
            <style jsx global>{`
                @keyframes fade-in-up {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in-up {
                    animation: fade-in-up 0.3s ease-out forwards;
                }
                @keyframes fade-in {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
                .animate-fade-in {
                    animation: fade-in 0.5s ease-out forwards;
                }
                @keyframes float-up {
                    0% {
                        opacity: 0;
                        transform: translateY(100vh) rotate(0deg);
                    }
                    10% {
                        opacity: 1;
                    }
                    90% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-20px) rotate(360deg);
                    }
                }
                .animate-float-up {
                    animation: float-up 4s ease-out forwards;
                }
            `}</style>
        </div>
    );
}

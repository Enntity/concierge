import { useCallback, useRef, useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useQueryClient } from "@tanstack/react-query";

/**
 * AppCommand types supported by the streaming message handler:
 *
 * - showOverlay: Display media/text in floating overlay
 *   { type: 'showOverlay', items: [{ type: 'image'|'video'|'text', url?, content?, duration?, label? }], entityId? }
 *
 * - createEntity: Entity creation progress (used by onboarding)
 *   { type: 'createEntity', status: 'start'|'complete', name?, avatarText?, avatarIcon?, identity?, entityId?, success? }
 */

export function useStreamingMessages({
    chat,
    updateChatHook,
    currentEntityId,
    onAppCommand,
    onStreamComplete,
}) {
    const queryClient = useQueryClient();
    const streamingMessageRef = useRef("");
    const ephemeralContentRef = useRef("");
    const hasReceivedPersistentRef = useRef(false);
    const messageQueueRef = useRef([]);
    const processingRef = useRef(false);
    const accumulatedInfoRef = useRef({});
    const [subscriptionId, setSubscriptionId] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState("");
    const [ephemeralContent, setEphemeralContent] = useState("");
    const [toolCalls, setToolCalls] = useState([]);
    const [thinkingDuration, setThinkingDuration] = useState(0);
    const [isThinking, setIsThinking] = useState(false);
    const startTimeRef = useRef(null);
    const accumulatedThinkingTimeRef = useRef(0);
    const isThinkingRef = useRef(false);
    const toolCallsMapRef = useRef(new Map());
    const streamReaderRef = useRef(null);

    // Record start time when streaming begins
    useEffect(() => {
        if (isStreaming && startTimeRef.current === null) {
            startTimeRef.current = Date.now();
            accumulatedThinkingTimeRef.current = 0;
            setThinkingDuration(0);
            setIsThinking(true);
            isThinkingRef.current = true;
        }
    }, [isStreaming]);

    // Update thinking duration while streaming
    useEffect(() => {
        if (isStreaming && startTimeRef.current && isThinking) {
            const interval = setInterval(() => {
                const currentPeriodTime = Math.floor(
                    (Date.now() - startTimeRef.current) / 1000,
                );
                setThinkingDuration(
                    accumulatedThinkingTimeRef.current + currentPeriodTime,
                );
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isStreaming, isThinking]);

    const clearStreamingState = useCallback(() => {
        streamingMessageRef.current = "";
        ephemeralContentRef.current = "";
        hasReceivedPersistentRef.current = false;
        accumulatedInfoRef.current = {};
        setStreamingContent("");
        setEphemeralContent("");
        setToolCalls([]);
        setSubscriptionId(null);
        setIsStreaming(false);
        setThinkingDuration(0);
        setIsThinking(false);
        isThinkingRef.current = false;
        messageQueueRef.current = [];
        processingRef.current = false;
        startTimeRef.current = null;
        accumulatedThinkingTimeRef.current = 0;
        toolCallsMapRef.current.clear();
        streamReaderRef.current = null;
    }, []);

    const stopStreaming = useCallback(async () => {
        if (chat?._id) {
            if (streamReaderRef.current) {
                streamReaderRef.current.cancel().catch(() => {});
                streamReaderRef.current = null;
            }
            await updateChatHook.mutateAsync({
                chatId: String(chat?._id),
                isChatLoading: false,
                stopRequested: true,
            });
            clearStreamingState();
        }
    }, [chat, updateChatHook, clearStreamingState]);

    // Track tool calls for UI display
    // Supports both old format (type: 'start'/'finish') and new format (status: 'start'/'complete')
    const updateToolCalls = useCallback((toolInfo) => {
        if (!toolInfo?.callId) return;

        const { type, status, callId, icon, userMessage, success, error } = toolInfo;
        const actionType = status || type; // Support both formats

        if (actionType === "start") {
            toolCallsMapRef.current.set(callId, {
                icon: icon || "🛠️",
                userMessage: userMessage || "Running tool...",
                status: "thinking",
            });
        } else if (actionType === "complete" || actionType === "finish") {
            const existing = toolCallsMapRef.current.get(callId);
            if (existing) {
                toolCallsMapRef.current.set(callId, {
                    ...existing,
                    status: success ? "completed" : "failed",
                    error: error || null,
                });
            }
        }

        setToolCalls(Array.from(toolCallsMapRef.current.values()));
    }, []);

    const updateStreamingContent = useCallback(
        (newContent, isEphemeral = false) => {
            if (newContent.trim() === "") return;

            if (isEphemeral) {
                ephemeralContentRef.current = newContent;
                setEphemeralContent(newContent);

                const currentlyThinking = isThinkingRef.current || isThinking;
                if (!currentlyThinking && isStreaming) {
                    if (startTimeRef.current !== null) {
                        const elapsed = Math.floor(
                            (Date.now() - startTimeRef.current) / 1000,
                        );
                        accumulatedThinkingTimeRef.current += elapsed;
                        startTimeRef.current = null;
                    }
                    startTimeRef.current = Date.now();
                    setIsThinking(true);
                    isThinkingRef.current = true;
                } else if (currentlyThinking && startTimeRef.current === null) {
                    startTimeRef.current = Date.now();
                }
            } else {
                const wasThinking = isThinkingRef.current || isThinking;
                if (wasThinking && startTimeRef.current !== null) {
                    const elapsed = Math.floor(
                        (Date.now() - startTimeRef.current) / 1000,
                    );
                    accumulatedThinkingTimeRef.current += elapsed;
                    startTimeRef.current = null;
                }
                setIsThinking(false);
                isThinkingRef.current = false;
                streamingMessageRef.current = newContent;
                hasReceivedPersistentRef.current = true;
                setStreamingContent(newContent);
            }
        },
        [isStreaming, isThinking],
    );

    // Refs to hold latest values for SSE effect
    const latestChatRef = useRef(chat);
    const latestUpdateChatHookRef = useRef(updateChatHook);
    const latestClearStreamingStateRef = useRef(clearStreamingState);
    const latestQueryClientRef = useRef(queryClient);
    const latestOnStreamCompleteRef = useRef(onStreamComplete);
    const latestOnAppCommandRef = useRef(onAppCommand);

    useEffect(() => {
        latestChatRef.current = chat;
        latestUpdateChatHookRef.current = updateChatHook;
        latestClearStreamingStateRef.current = clearStreamingState;
        latestQueryClientRef.current = queryClient;
        latestOnStreamCompleteRef.current = onStreamComplete;
        latestOnAppCommandRef.current = onAppCommand;
    });

    const processMessageQueue = useCallback(async () => {
        if (processingRef.current || messageQueueRef.current.length === 0)
            return;

        processingRef.current = true;
        const message = messageQueueRef.current.shift();

        try {
            const { result, info } = message;
            let isEphemeral = false;

            if (info) {
                try {
                    const parsedInfo =
                        typeof info === "string"
                            ? JSON.parse(info)
                            : { ...info };

                    isEphemeral = !!parsedInfo.ephemeral;

                    // Handle structured tool messages (for UI status display)
                    if (parsedInfo.toolMessage) {
                        updateToolCalls(parsedInfo.toolMessage);
                    }

                    // Handle app commands - the clean, formalized structure
                    if (
                        parsedInfo.appCommand &&
                        latestOnAppCommandRef.current
                    ) {
                        latestOnAppCommandRef.current(parsedInfo.appCommand);

                        // Track tool display for createEntity commands
                        if (parsedInfo.appCommand.type === "createEntity") {
                            const cmd = parsedInfo.appCommand;
                            updateToolCalls({
                                callId: `createEntity-${Date.now()}`,
                                status: cmd.status,
                                icon: cmd.avatarIcon || "✨",
                                userMessage:
                                    cmd.status === "start"
                                        ? `Creating ${cmd.name || "entity"}...`
                                        : `Created ${cmd.name || "entity"}`,
                                success: cmd.success !== false,
                            });

                            // Start thinking mode for entity creation
                            if (
                                cmd.status === "start" &&
                                isStreaming &&
                                !isThinkingRef.current
                            ) {
                                if (startTimeRef.current === null) {
                                    startTimeRef.current = Date.now();
                                    accumulatedThinkingTimeRef.current = 0;
                                }
                                setIsThinking(true);
                                isThinkingRef.current = true;
                            }
                        }
                    }

                    // Store accumulated info
                    accumulatedInfoRef.current = {
                        ...accumulatedInfoRef.current,
                        ...parsedInfo,
                    };
                    accumulatedInfoRef.current.citations = [
                        ...(accumulatedInfoRef.current.citations || []),
                        ...(parsedInfo.citations || []),
                    ];
                } catch (e) {
                    console.error("Failed to parse info block:", e);
                }
            }

            if (result) {
                let content;
                try {
                    const parsed = JSON.parse(result);
                    if (typeof parsed === "string") {
                        content = parsed;
                    } else if (parsed?.choices?.[0]?.delta?.content) {
                        content = parsed.choices[0].delta.content;
                    } else if (parsed?.content) {
                        content = parsed.content;
                    } else if (parsed?.message) {
                        content = parsed.message;
                    }
                } catch {
                    content = result;
                }

                if (content) {
                    if (isEphemeral) {
                        updateStreamingContent(
                            ephemeralContentRef.current + content,
                            true,
                        );
                    } else {
                        updateStreamingContent(
                            streamingMessageRef.current + content,
                            false,
                        );
                    }
                }
            }
        } catch (e) {
            console.error("Failed to process subscription data:", e);
            toast.error("Failed to process response data");

            if (chat?._id) {
                await updateChatHook.mutateAsync({
                    chatId: String(chat._id),
                    isChatLoading: false,
                });
            }
            clearStreamingState();
        }

        processingRef.current = false;

        if (messageQueueRef.current.length > 0) {
            requestAnimationFrame(async () => await processMessageQueue());
        }
    }, [
        chat,
        updateChatHook,
        updateStreamingContent,
        clearStreamingState,
        updateToolCalls,
        isStreaming,
    ]);

    const latestProcessMessageQueueRef = useRef(processMessageQueue);
    useEffect(() => {
        latestProcessMessageQueueRef.current = processMessageQueue;
    });

    // Handle SSE stream
    useEffect(() => {
        if (!subscriptionId || !(subscriptionId instanceof Response)) return;

        let cancelled = false;
        const reader = subscriptionId.body.getReader();
        streamReaderRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = "";

        const readStream = async () => {
            try {
                while (!cancelled) {
                    const { done, value } = await reader.read();

                    if (done) {
                        // Process remaining buffer
                        if (buffer.trim()) {
                            const remainingLines = buffer.split("\n\n");
                            for (const line of remainingLines) {
                                if (cancelled) break;
                                if (line.startsWith("data: ")) {
                                    try {
                                        const data = JSON.parse(line.slice(6));
                                        const { event, data: eventData } = data;
                                        if (
                                            event === "data" ||
                                            event === "info" ||
                                            event === "progress"
                                        ) {
                                            messageQueueRef.current.push({
                                                progress: eventData?.progress,
                                                result:
                                                    event === "data"
                                                        ? eventData?.result
                                                        : null,
                                                info: eventData?.info || null,
                                            });
                                        }
                                    } catch (e) {
                                        // Incomplete JSON, skip
                                    }
                                }
                            }
                            if (
                                messageQueueRef.current.length > 0 &&
                                !processingRef.current
                            ) {
                                await latestProcessMessageQueueRef.current();
                            }
                        }

                        const accumulatedContent = streamingMessageRef.current;
                        if (
                            accumulatedContent &&
                            latestOnStreamCompleteRef.current
                        ) {
                            latestOnStreamCompleteRef.current(
                                accumulatedContent,
                            );
                        }

                        if (!cancelled && latestChatRef.current?._id) {
                            const chatId = String(latestChatRef.current._id);
                            await latestQueryClientRef.current.refetchQueries({
                                queryKey: ["chat", chatId],
                            });
                            latestClearStreamingStateRef.current();
                        } else if (!cancelled) {
                            latestClearStreamingStateRef.current();
                        }
                        break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (cancelled) break;
                        if (line.startsWith("data: ")) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                const { event, data: eventData } = data;

                                if (event === "error") {
                                    toast.error(
                                        eventData?.error || "Stream error",
                                    );
                                    if (latestChatRef.current?._id) {
                                        const chatId = String(
                                            latestChatRef.current._id,
                                        );
                                        await latestQueryClientRef.current.refetchQueries(
                                            { queryKey: ["chat", chatId] },
                                        );
                                        await latestUpdateChatHookRef.current.mutateAsync(
                                            { chatId, isChatLoading: false },
                                        );
                                    }
                                    latestClearStreamingStateRef.current();
                                    return;
                                }

                                if (event === "complete") {
                                    const content = streamingMessageRef.current;
                                    if (latestOnStreamCompleteRef.current) {
                                        latestOnStreamCompleteRef.current(
                                            content,
                                        );
                                    }
                                    if (latestChatRef.current?._id) {
                                        const chatId = String(
                                            latestChatRef.current._id,
                                        );
                                        await latestQueryClientRef.current.refetchQueries(
                                            { queryKey: ["chat", chatId] },
                                        );
                                    }
                                    latestClearStreamingStateRef.current();
                                    return;
                                }

                                if (
                                    event === "data" ||
                                    event === "info" ||
                                    event === "progress"
                                ) {
                                    messageQueueRef.current.push({
                                        progress: eventData?.progress,
                                        result:
                                            event === "data"
                                                ? eventData?.result
                                                : null,
                                        info: eventData?.info || null,
                                    });
                                    if (!processingRef.current) {
                                        requestAnimationFrame(() =>
                                            latestProcessMessageQueueRef.current(),
                                        );
                                    }
                                }
                            } catch (e) {
                                console.error("Error parsing SSE message:", e);
                            }
                        }
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Error reading SSE stream:", error);
                    toast.error("Stream connection error");
                    if (latestChatRef.current?._id) {
                        const chatId = String(latestChatRef.current._id);
                        await latestQueryClientRef.current.refetchQueries({
                            queryKey: ["chat", chatId],
                        });
                        await latestUpdateChatHookRef.current.mutateAsync({
                            chatId,
                            isChatLoading: false,
                        });
                    }
                    latestClearStreamingStateRef.current();
                }
            }
        };

        readStream();

        return () => {
            cancelled = true;
            streamReaderRef.current = null;
            reader.cancel().catch(() => {});
        };
    }, [subscriptionId, queryClient]);

    return {
        isStreaming,
        streamingContent,
        ephemeralContent,
        toolCalls,
        stopStreaming,
        setIsStreaming,
        setSubscriptionId,
        streamingMessageRef,
        clearStreamingState,
        thinkingDuration,
        isThinking,
    };
}

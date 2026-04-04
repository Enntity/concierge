/**
 * Shared message accumulation logic for streaming messages
 * Extracted from useStreamingMessages hook for server-side use
 */
import {
    appendAssistantTextChunk,
    appendAssistantThinkingChunk,
    appendAssistantThinkingSummary,
    buildAssistantPayloadFromItems,
    createAssistantToolEventItem,
    updateAssistantThinkingDuration,
    upsertAssistantToolEvent,
} from "../../../src/utils/assistantInlinePayload.js";

export class StreamAccumulator {
    constructor() {
        this.streamingMessage = "";
        this.ephemeralContent = "";
        this.hasReceivedPersistent = false;
        this.accumulatedInfo = {};
        this.toolCallsMap = new Map(); // UI status tracking (icon, userMessage, status)
        this.inlinePayloadItems = [];
        this.toolEventIndexMap = new Map();
        this.activeTextIndex = null;
        this.activeThinkingIndex = null;
        this.toolHistory = null;
        this.thinkingStartTime = null;
        this.accumulatedThinkingTime = 0;
        this.isThinking = false;
    }

    /**
     * Process an info block from the stream
     */
    processInfo(info) {
        if (!info) return;

        try {
            const parsedInfo =
                typeof info === "string"
                    ? JSON.parse(info)
                    : typeof info === "object"
                      ? { ...info }
                      : {};

            // Handle structured tool messages
            if (parsedInfo.toolMessage) {
                this.updateToolCalls(parsedInfo.toolMessage);

                // If we receive a tool start message, we should be thinking
                if (parsedInfo.toolMessage.type === "start") {
                    if (!this.isThinking) {
                        if (this.thinkingStartTime === null) {
                            this.thinkingStartTime = Date.now();
                        }
                        this.isThinking = true;
                    }
                }
            }

            // Extract toolHistory before merging into accumulatedInfo
            if (parsedInfo.toolHistory) {
                this.toolHistory = parsedInfo.toolHistory;
                delete parsedInfo.toolHistory;
            }

            // Store accumulated info
            this.accumulatedInfo = {
                ...this.accumulatedInfo,
                ...parsedInfo,
            };

            // Always preserve citations array
            this.accumulatedInfo.citations = [
                ...(this.accumulatedInfo.citations || []),
                ...(parsedInfo.citations || []),
            ];
        } catch (e) {
            console.error("Failed to parse info block:", e);
        }
    }

    /**
     * Process a result block from the stream
     */
    processResult(result) {
        if (!result) return false; // Return true if content was processed

        try {
            const parsed = JSON.parse(result);

            // Skip tool call chunks - they come via info block toolMessage instead
            const hasToolCalls = parsed?.choices?.[0]?.delta?.tool_calls;
            if (hasToolCalls) {
                return true; // Processed (but skipped) - don't treat as content
            }

            let content;
            if (typeof parsed === "string") {
                content = parsed;
            } else if (parsed?.choices?.[0]?.delta?.content) {
                content = parsed.choices[0].delta.content;
            } else if (parsed?.content) {
                content = parsed.content;
            } else if (parsed?.message) {
                content = parsed.message;
            }

            if (content) {
                const isEphemeral = !!this.accumulatedInfo.ephemeral;

                if (isEphemeral) {
                    this.ephemeralContent += content;
                    const nextInline = appendAssistantThinkingChunk(
                        this.inlinePayloadItems,
                        content,
                        this.getThinkingDuration(),
                        this.activeThinkingIndex,
                    );
                    this.inlinePayloadItems = nextInline.items;
                    this.activeThinkingIndex = nextInline.index;
                    this.activeTextIndex = null;
                    // If we're receiving ephemeral content, we should be thinking
                    if (!this.isThinking) {
                        if (this.thinkingStartTime !== null) {
                            const elapsed = Math.floor(
                                (Date.now() - this.thinkingStartTime) / 1000,
                            );
                            this.accumulatedThinkingTime += elapsed;
                            this.thinkingStartTime = null;
                        }
                        this.thinkingStartTime = Date.now();
                    }
                    this.isThinking = true;
                } else {
                    // This is persistent content
                    this.streamingMessage += content;
                    this.hasReceivedPersistent = true;
                    const nextText = appendAssistantTextChunk(
                        this.inlinePayloadItems,
                        content,
                        this.activeTextIndex,
                    );
                    this.inlinePayloadItems = updateAssistantThinkingDuration(
                        nextText.items,
                        this.activeThinkingIndex,
                        this.getThinkingDuration(),
                    );
                    this.activeTextIndex = nextText.index;
                }
                return true;
            }

            return false;
        } catch {
            // If parsing fails, treat as raw string content
            const isEphemeral = !!this.accumulatedInfo.ephemeral;
            if (isEphemeral) {
                this.ephemeralContent += result;
            } else {
                this.streamingMessage += result;
                this.hasReceivedPersistent = true;
            }
            return true;
        }
    }

    /**
     * Update tool calls tracking
     */
    updateToolCalls(toolMessage) {
        if (!toolMessage || !toolMessage.callId) return;

        const { type, callId, icon, userMessage, success, error } = toolMessage;

        if (type === "start") {
            const nextToolState = {
                icon: icon || "🛠️",
                userMessage: userMessage || "Running tool...",
                status: "thinking",
                error: null,
                presentation: toolMessage.presentation || "default",
            };
            this.toolCallsMap.set(callId, nextToolState);
            const nextInline = upsertAssistantToolEvent(
                this.inlinePayloadItems,
                createAssistantToolEventItem({
                    callId,
                    ...nextToolState,
                }),
                this.toolEventIndexMap.get(callId) ?? null,
            );
            this.inlinePayloadItems = nextInline.items;
            this.toolEventIndexMap.set(callId, nextInline.index);
            this.activeTextIndex = null;
            this.activeThinkingIndex = null;
        } else if (type === "finish") {
            const existing = this.toolCallsMap.get(callId);
            const nextToolState = {
                ...(existing || {}),
                icon: icon || existing?.icon || "🛠️",
                userMessage:
                    userMessage || existing?.userMessage || "Running tool...",
                status: success ? "completed" : "failed",
                error: error || null,
                presentation:
                    toolMessage.presentation ||
                    existing?.presentation ||
                    "default",
            };
            this.toolCallsMap.set(callId, nextToolState);
            const nextInline = upsertAssistantToolEvent(
                this.inlinePayloadItems,
                createAssistantToolEventItem({
                    callId,
                    ...nextToolState,
                }),
                this.toolEventIndexMap.get(callId) ?? null,
            );
            this.inlinePayloadItems = nextInline.items;
            this.toolEventIndexMap.set(callId, nextInline.index);
            this.activeTextIndex = null;
            this.activeThinkingIndex = null;
        }
    }

    /**
     * Get the final thinking duration
     */
    getThinkingDuration() {
        let finalDuration = this.accumulatedThinkingTime;
        if (this.isThinking && this.thinkingStartTime !== null) {
            const elapsed = Math.floor(
                (Date.now() - this.thinkingStartTime) / 1000,
            );
            finalDuration = this.accumulatedThinkingTime + elapsed;
        }
        return finalDuration;
    }

    /**
     * Build the final message object
     */
    buildFinalMessage(currentEntityId) {
        // Check if we have any content to save
        const hasContent =
            this.streamingMessage ||
            this.ephemeralContent ||
            this.toolCallsMap.size > 0;

        if (!hasContent) return null;

        // If we have no persistent content but do have ephemeral content, use the ephemeral content
        let finalContent = this.streamingMessage;
        if (!this.hasReceivedPersistent && this.ephemeralContent) {
            finalContent = this.ephemeralContent;
        }

        const finalDuration = this.getThinkingDuration();
        const finalizedInlineItems =
            this.inlinePayloadItems.length > 0
                ? appendAssistantThinkingSummary(
                      updateAssistantThinkingDuration(
                          this.inlinePayloadItems,
                          this.activeThinkingIndex,
                          finalDuration,
                      ),
                      finalDuration,
                  )
                : [];
        const finalPayload =
            buildAssistantPayloadFromItems(finalizedInlineItems) ||
            finalContent;

        const toolString = JSON.stringify({
            ...this.accumulatedInfo,
            citations: this.accumulatedInfo.citations || [],
        });

        const finalEphemeralContent = this.ephemeralContent;
        const finalToolCalls = Array.from(this.toolCallsMap.values());
        const hasToolCalls = finalToolCalls.length > 0;
        const hasEphemeralContent = finalEphemeralContent || hasToolCalls;

        return {
            payload: finalPayload,
            tool: toolString,
            sentTime: new Date().toISOString(),
            direction: "incoming",
            position: "single",
            sender: "enntity",
            entityId: currentEntityId,
            isStreaming: false,
            ephemeralContent: hasEphemeralContent
                ? finalEphemeralContent || ""
                : undefined,
            thinkingDuration: finalDuration,
            toolCalls: hasToolCalls ? finalToolCalls : null,
            toolHistory: this.toolHistory || null,
        };
    }

    /**
     * Get accumulated info (for codeRequestId, etc.)
     */
    getAccumulatedInfo() {
        return { ...this.accumulatedInfo };
    }

    /**
     * Reset the accumulator
     */
    reset() {
        this.streamingMessage = "";
        this.ephemeralContent = "";
        this.hasReceivedPersistent = false;
        this.accumulatedInfo = {};
        this.toolCallsMap.clear();
        this.inlinePayloadItems = [];
        this.toolEventIndexMap.clear();
        this.activeTextIndex = null;
        this.activeThinkingIndex = null;
        this.toolHistory = null;
        this.thinkingStartTime = null;
        this.accumulatedThinkingTime = 0;
        this.isThinking = false;
    }
}

/**
 * Shared message accumulation logic for streaming messages
 * Extracted from useStreamingMessages hook for server-side use
 */

export class StreamAccumulator {
    constructor() {
        this.streamingMessage = "";
        this.ephemeralContent = "";
        this.hasReceivedPersistent = false;
        this.accumulatedInfo = {};
        this.toolCallsMap = new Map(); // UI status tracking (icon, userMessage, status)
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
                    if (this.isThinking && this.thinkingStartTime !== null) {
                        const elapsed = Math.floor(
                            (Date.now() - this.thinkingStartTime) / 1000,
                        );
                        this.accumulatedThinkingTime += elapsed;
                        this.thinkingStartTime = null;
                    }
                    this.isThinking = false;
                    this.streamingMessage += content;
                    this.hasReceivedPersistent = true;
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
            this.toolCallsMap.set(callId, {
                icon: icon || "🛠️",
                userMessage: userMessage || "Running tool...",
                status: "thinking",
            });
        } else if (type === "finish") {
            const existing = this.toolCallsMap.get(callId);
            if (existing) {
                this.toolCallsMap.set(callId, {
                    ...existing,
                    status: success ? "completed" : "failed",
                    error: error || null,
                });
            }
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

        const toolString = JSON.stringify({
            ...this.accumulatedInfo,
            citations: this.accumulatedInfo.citations || [],
        });

        const finalEphemeralContent = this.ephemeralContent;
        const finalToolCalls = Array.from(this.toolCallsMap.values());
        const hasToolCalls = finalToolCalls.length > 0;
        const hasEphemeralContent = finalEphemeralContent || hasToolCalls;

        return {
            payload: finalContent,
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
            thinkingDuration: this.getThinkingDuration(),
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
        this.toolHistory = null;
        this.thinkingStartTime = null;
        this.accumulatedThinkingTime = 0;
        this.isThinking = false;
    }
}

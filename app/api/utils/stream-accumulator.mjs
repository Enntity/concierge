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
        this.fullToolCallsMap = new Map(); // Full tool calls with accumulated arguments
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

            // Check for tool_calls in OpenAI format and accumulate them
            const toolCalls = parsed?.choices?.[0]?.delta?.tool_calls;
            if (toolCalls) {
                this.accumulateToolCalls(toolCalls);
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

            // Even if no content, we may have processed tool calls
            return toolCalls ? true : false;
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
     * Accumulate tool calls from OpenAI streaming format
     * Tool calls stream in with: id and name in first chunk, arguments in subsequent chunks
     */
    accumulateToolCalls(toolCalls) {
        for (const toolCall of toolCalls) {
            const index = toolCall.index ?? 0;
            const existing = this.fullToolCallsMap.get(index) || {
                id: null,
                name: null,
                arguments: "",
            };

            // First chunk has id and function name
            if (toolCall.id) {
                existing.id = toolCall.id;
            }
            if (toolCall.function?.name) {
                existing.name = toolCall.function.name;
            }

            // Arguments stream in chunks
            if (toolCall.function?.arguments) {
                existing.arguments += toolCall.function.arguments;
            }

            this.fullToolCallsMap.set(index, existing);
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
            this.toolCallsMap.size > 0 ||
            this.fullToolCallsMap.size > 0;

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

        // Build full tool calls with parsed arguments
        const fullToolCalls = this.getFullToolCalls();

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
            // Full tool calls with parsed arguments (for taking action on specific tools)
            fullToolCalls: fullToolCalls.length > 0 ? fullToolCalls : undefined,
        };
    }

    /**
     * Get full tool calls with parsed arguments
     */
    getFullToolCalls() {
        const result = [];
        for (const [, toolCall] of this.fullToolCallsMap) {
            if (toolCall.name && toolCall.arguments) {
                try {
                    const parsedArgs = JSON.parse(toolCall.arguments);
                    result.push({
                        id: toolCall.id,
                        name: toolCall.name,
                        arguments: parsedArgs,
                    });
                } catch {
                    // If args don't parse as JSON, include raw
                    result.push({
                        id: toolCall.id,
                        name: toolCall.name,
                        arguments: toolCall.arguments,
                    });
                }
            }
        }
        return result;
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
        this.fullToolCallsMap.clear();
        this.thinkingStartTime = null;
        this.accumulatedThinkingTime = 0;
        this.isThinking = false;
    }
}

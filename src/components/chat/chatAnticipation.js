export function createEmptySpeculativePreparation() {
    return {
        chatId: "",
        entityId: "",
        anticipation: null,
        timestamp: 0,
    };
}

export function buildAssistantAnticipationKey(chatId = "", message = null) {
    if (!chatId || !message || message.sender !== "enntity") {
        return "";
    }

    return [
        chatId,
        message.id || message._id || "",
        message.sentTime || "",
        message.tool || "",
        JSON.stringify(message.payload || ""),
    ].join("::");
}

export function shouldTriggerPostReplyAnticipation({
    chatId = "",
    latestMessage = null,
    viewingReadOnlyChat = false,
    isEntityUnavailable = false,
    isStreaming = false,
    hasPendingReply = false,
    previousAssistantKey = "",
} = {}) {
    const assistantKey = buildAssistantAnticipationKey(chatId, latestMessage);

    if (
        !chatId ||
        viewingReadOnlyChat ||
        isEntityUnavailable ||
        isStreaming ||
        !hasPendingReply ||
        !assistantKey ||
        assistantKey === previousAssistantKey
    ) {
        return {
            assistantKey,
            shouldTrigger: false,
        };
    }

    return {
        assistantKey,
        shouldTrigger: true,
    };
}

export const ASSISTANT_PAYLOAD_ITEM_TYPES = {
    TEXT: "text",
    TOOL_EVENT: "tool_event",
    THINKING: "thinking",
};

export function parseAssistantPayloadItem(item) {
    if (!item) return null;

    if (typeof item === "string") {
        try {
            const parsed = JSON.parse(item);
            return parsed && typeof parsed === "object" ? parsed : null;
        } catch {
            return null;
        }
    }

    return typeof item === "object" ? item : null;
}

export function serializeAssistantPayloadItem(item) {
    return JSON.stringify(item);
}

export function createAssistantThinkingItem(text, duration = 0) {
    return {
        type: ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING,
        text,
        duration,
    };
}

export function createAssistantToolEventItem({
    callId = null,
    icon = "🛠️",
    userMessage = "Running tool...",
    status = "thinking",
    error = null,
    presentation = "default",
}) {
    return {
        type: ASSISTANT_PAYLOAD_ITEM_TYPES.TOOL_EVENT,
        callId,
        icon,
        userMessage,
        status,
        error,
        presentation,
    };
}

export function buildLegacyInlineAssistantPayloadItems({
    ephemeralContent = "",
    toolCalls = [],
    thinkingDuration = 0,
}) {
    const payload = [];

    if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        payload.push(
            ...toolCalls.map((toolCall) =>
                serializeAssistantPayloadItem(
                    createAssistantToolEventItem(toolCall),
                ),
            ),
        );
    }

    if (typeof ephemeralContent === "string" && ephemeralContent.trim()) {
        payload.push(
            serializeAssistantPayloadItem(
                createAssistantThinkingItem(
                    ephemeralContent,
                    thinkingDuration || 0,
                ),
            ),
        );
    }

    return payload;
}

export function extractCopyTextFromAssistantPayload(payload) {
    if (typeof payload === "string") return payload;
    if (!Array.isArray(payload)) return "";

    return payload
        .map((item) => {
            const parsed = parseAssistantPayloadItem(item);
            if (!parsed) {
                return typeof item === "string" ? item : "";
            }

            if (
                parsed.type === ASSISTANT_PAYLOAD_ITEM_TYPES.TEXT ||
                parsed.type === ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING
            ) {
                return typeof parsed.text === "string" ? parsed.text : "";
            }

            return "";
        })
        .filter(Boolean)
        .join("\n\n");
}

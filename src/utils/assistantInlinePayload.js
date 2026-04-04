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

export function createAssistantTextItem(text) {
    return {
        type: ASSISTANT_PAYLOAD_ITEM_TYPES.TEXT,
        text,
    };
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

function getParsedItemAt(items, index) {
    if (!Array.isArray(items)) return null;
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
        return null;
    }
    return parseAssistantPayloadItem(items[index]);
}

export function hasAssistantThinkingItem(items = []) {
    if (!Array.isArray(items)) {
        return false;
    }

    return items.some((item) => {
        const parsed = parseAssistantPayloadItem(item);
        return parsed?.type === ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING;
    });
}

export function appendAssistantThinkingSummary(items = [], duration = 0) {
    if (!Array.isArray(items) || hasAssistantThinkingItem(items)) {
        return Array.isArray(items) ? items : [];
    }

    return [
        ...items,
        serializeAssistantPayloadItem(
            createAssistantThinkingItem("", duration || 0),
        ),
    ];
}

export function appendAssistantTextChunk(
    items = [],
    text,
    activeTextIndex = null,
) {
    if (!text) {
        return { items, index: activeTextIndex };
    }

    const nextItems = [...items];
    const existingItem = getParsedItemAt(nextItems, activeTextIndex);

    if (existingItem?.type === ASSISTANT_PAYLOAD_ITEM_TYPES.TEXT) {
        nextItems[activeTextIndex] = serializeAssistantPayloadItem({
            ...existingItem,
            text: `${existingItem.text || ""}${text}`,
        });
        return { items: nextItems, index: activeTextIndex };
    }

    const index = nextItems.length;
    nextItems.push(
        serializeAssistantPayloadItem(createAssistantTextItem(text)),
    );
    return { items: nextItems, index };
}

export function appendAssistantThinkingChunk(
    items = [],
    text,
    duration = 0,
    activeThinkingIndex = null,
) {
    if (!text) {
        return { items, index: activeThinkingIndex };
    }

    const nextItems = [...items];
    const existingItem = getParsedItemAt(nextItems, activeThinkingIndex);

    if (existingItem?.type === ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING) {
        nextItems[activeThinkingIndex] = serializeAssistantPayloadItem({
            ...existingItem,
            text: `${existingItem.text || ""}${text}`,
            duration,
        });
        return { items: nextItems, index: activeThinkingIndex };
    }

    const index = nextItems.length;
    nextItems.push(
        serializeAssistantPayloadItem(
            createAssistantThinkingItem(text, duration),
        ),
    );
    return { items: nextItems, index };
}

export function updateAssistantThinkingDuration(
    items = [],
    activeThinkingIndex = null,
    duration = 0,
) {
    const nextItems = [...items];
    const existingItem = getParsedItemAt(nextItems, activeThinkingIndex);

    if (existingItem?.type !== ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING) {
        return nextItems;
    }

    nextItems[activeThinkingIndex] = serializeAssistantPayloadItem({
        ...existingItem,
        duration,
    });
    return nextItems;
}

export function upsertAssistantToolEvent(
    items = [],
    toolEvent,
    existingIndex = null,
) {
    const nextItems = [...items];
    const serialized = serializeAssistantPayloadItem(toolEvent);

    if (Number.isInteger(existingIndex) && existingIndex >= 0) {
        nextItems[existingIndex] = serialized;
        return { items: nextItems, index: existingIndex };
    }

    const index = nextItems.length;
    nextItems.push(serialized);
    return { items: nextItems, index };
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

export function buildAssistantPayloadFromItems(items = []) {
    const normalized = (items || [])
        .map((item) => {
            const parsed = parseAssistantPayloadItem(item);
            if (parsed) {
                return serializeAssistantPayloadItem(parsed);
            }
            return typeof item === "string" && item.trim() ? item : null;
        })
        .filter(Boolean);

    if (!normalized.length) {
        return null;
    }

    if (normalized.length === 1) {
        const parsed = parseAssistantPayloadItem(normalized[0]);
        if (
            parsed?.type === ASSISTANT_PAYLOAD_ITEM_TYPES.TEXT &&
            typeof parsed.text === "string"
        ) {
            return parsed.text;
        }
    }

    return normalized;
}

function parseInlinePayloadDumpString(payload) {
    if (typeof payload !== "string") {
        return null;
    }

    const trimmed = payload.trim();
    if (
        !trimmed.includes('"type"') ||
        (!trimmed.includes('"tool_event"') &&
            !trimmed.includes('"text"') &&
            !trimmed.includes('"thinking"'))
    ) {
        return null;
    }

    const lines = trimmed
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    if (!lines.length) {
        return null;
    }

    const parsedItems = [];
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line);
            if (!parsed || typeof parsed !== "object" || !parsed.type) {
                return null;
            }
            parsedItems.push(serializeAssistantPayloadItem(parsed));
        } catch {
            return null;
        }
    }

    return parsedItems;
}

export function buildModelPayloadFromStoredPayload(payload) {
    if (typeof payload === "string") {
        if (!payload.trim()) {
            return null;
        }

        const parsedInlineDump = parseInlinePayloadDumpString(payload);
        if (parsedInlineDump) {
            return buildModelPayloadFromStoredPayload(parsedInlineDump);
        }

        return payload;
    }

    if (!Array.isArray(payload)) {
        return payload ?? null;
    }

    const sanitizedItems = payload
        .map((item) => {
            const parsed = parseAssistantPayloadItem(item);

            if (!parsed) {
                return typeof item === "string" && item.trim() ? item : null;
            }

            if (
                parsed.type === ASSISTANT_PAYLOAD_ITEM_TYPES.THINKING ||
                parsed.type === ASSISTANT_PAYLOAD_ITEM_TYPES.TOOL_EVENT ||
                parsed.hideFromModel === true ||
                parsed.hideFromClient === true ||
                parsed.isDeletedFile === true
            ) {
                return null;
            }

            if (
                parsed.type === ASSISTANT_PAYLOAD_ITEM_TYPES.TEXT &&
                (typeof parsed.text !== "string" ||
                    parsed.text.trim().length === 0)
            ) {
                return null;
            }

            return serializeAssistantPayloadItem(parsed);
        })
        .filter(Boolean);

    return buildAssistantPayloadFromItems(sanitizedItems);
}

function serializeModelPayloadForComparison(payload) {
    if (typeof payload === "string") {
        return `string:${payload}`;
    }

    return `json:${JSON.stringify(payload ?? null)}`;
}

export function appendDraftPayloadToConversation(
    conversation = [],
    draftPayload = null,
) {
    const nextConversation = Array.isArray(conversation)
        ? [...conversation]
        : [];
    const normalizedDraft = buildModelPayloadFromStoredPayload(draftPayload);

    if (normalizedDraft === null) {
        return nextConversation;
    }

    const lastMessage = nextConversation[nextConversation.length - 1];
    if (
        lastMessage?.role === "user" &&
        serializeModelPayloadForComparison(lastMessage.content) ===
            serializeModelPayloadForComparison(normalizedDraft)
    ) {
        return nextConversation;
    }

    nextConversation.push({
        role: "user",
        content: normalizedDraft,
    });

    return nextConversation;
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

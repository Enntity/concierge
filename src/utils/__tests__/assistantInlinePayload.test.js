import {
    appendDraftPayloadToConversation,
    buildModelPayloadFromStoredPayload,
    createAssistantTextItem,
    createAssistantThinkingItem,
    createAssistantToolEventItem,
    serializeAssistantPayloadItem,
} from "../assistantInlinePayload";

describe("buildModelPayloadFromStoredPayload", () => {
    test("collapses assistant text plus thinking summary to plain text", () => {
        const payload = [
            serializeAssistantPayloadItem(createAssistantTextItem("Hello")),
            serializeAssistantPayloadItem(createAssistantThinkingItem("", 3)),
        ];

        expect(buildModelPayloadFromStoredPayload(payload)).toBe("Hello");
    });

    test("removes assistant-only inline metadata and preserves real content", () => {
        const payload = [
            serializeAssistantPayloadItem(
                createAssistantToolEventItem({
                    callId: "tool-1",
                    userMessage: "Running search",
                }),
            ),
            serializeAssistantPayloadItem({
                type: "image_url",
                url: "https://example.com/cat.png",
            }),
            serializeAssistantPayloadItem(createAssistantTextItem("Done")),
            serializeAssistantPayloadItem(
                createAssistantThinkingItem("hidden reasoning", 5),
            ),
        ];

        expect(buildModelPayloadFromStoredPayload(payload)).toEqual([
            serializeAssistantPayloadItem({
                type: "image_url",
                url: "https://example.com/cat.png",
            }),
            serializeAssistantPayloadItem(createAssistantTextItem("Done")),
        ]);
    });

    test("drops payloads that only contain assistant metadata", () => {
        const payload = [
            serializeAssistantPayloadItem(createAssistantThinkingItem("", 2)),
            serializeAssistantPayloadItem(
                createAssistantToolEventItem({
                    callId: "tool-1",
                    userMessage: "Running search",
                }),
            ),
        ];

        expect(buildModelPayloadFromStoredPayload(payload)).toBeNull();
    });

    test("recovers text from newline-delimited inline payload dump strings", () => {
        const payload = [
            JSON.stringify(
                createAssistantToolEventItem({
                    callId: "tool-1",
                    userMessage: "Running search",
                }),
            ),
            JSON.stringify(createAssistantTextItem("Recovered answer")),
            JSON.stringify(createAssistantThinkingItem("", 4)),
        ].join("\n");

        expect(buildModelPayloadFromStoredPayload(payload)).toBe(
            "Recovered answer",
        );
    });
});

describe("appendDraftPayloadToConversation", () => {
    test("normalizes inline text payload arrays before appending", () => {
        const conversation = [
            { role: "user", content: "Previous question" },
            { role: "assistant", content: "Previous answer" },
        ];

        expect(
            appendDraftPayloadToConversation(conversation, [
                JSON.stringify({
                    type: "text",
                    text: "What do you know about me?",
                }),
            ]),
        ).toEqual([
            { role: "user", content: "Previous question" },
            { role: "assistant", content: "Previous answer" },
            { role: "user", content: "What do you know about me?" },
        ]);
    });

    test("does not append a duplicate trailing user draft", () => {
        const conversation = [
            { role: "assistant", content: "Previous answer" },
            { role: "user", content: "What do you know about me?" },
        ];

        expect(
            appendDraftPayloadToConversation(conversation, [
                JSON.stringify({
                    type: "text",
                    text: "What do you know about me?",
                }),
            ]),
        ).toEqual(conversation);
    });
});

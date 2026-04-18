import {
    buildAssistantAnticipationKey,
    createEmptySpeculativePreparation,
    shouldTriggerPostReplyAnticipation,
} from "../chatAnticipation";

describe("chatAnticipation", () => {
    test("creates an empty speculative preparation shape", () => {
        expect(createEmptySpeculativePreparation()).toEqual({
            chatId: "",
            entityId: "",
            anticipation: null,
            timestamp: 0,
        });
    });

    test("builds a stable assistant anticipation key for entity replies", () => {
        expect(
            buildAssistantAnticipationKey("chat-1", {
                id: "message-1",
                sender: "enntity",
                sentTime: "2026-04-18T00:00:00.000Z",
                tool: "",
                payload: ['{"type":"text","text":"hello"}'],
            }),
        ).toBe(
            'chat-1::message-1::2026-04-18T00:00:00.000Z::::["{\\"type\\":\\"text\\",\\"text\\":\\"hello\\"}"]',
        );
    });

    test("does not trigger post-reply warmup for historical assistant messages", () => {
        const result = shouldTriggerPostReplyAnticipation({
            chatId: "chat-1",
            latestMessage: {
                id: "message-1",
                sender: "enntity",
                sentTime: "2026-04-18T00:00:00.000Z",
                payload: ['{"type":"text","text":"hello"}'],
            },
            hasPendingReply: false,
        });

        expect(result.shouldTrigger).toBe(false);
        expect(result.assistantKey).toContain("chat-1::message-1");
    });

    test("triggers post-reply warmup for the first live assistant reply", () => {
        const result = shouldTriggerPostReplyAnticipation({
            chatId: "chat-1",
            latestMessage: {
                id: "message-2",
                sender: "enntity",
                sentTime: "2026-04-18T00:01:00.000Z",
                payload: ['{"type":"text","text":"here you go"}'],
            },
            hasPendingReply: true,
            previousAssistantKey: "",
        });

        expect(result.shouldTrigger).toBe(true);
        expect(result.assistantKey).toContain("chat-1::message-2");
    });

    test("does not retrigger post-reply warmup for the same assistant message", () => {
        const previousAssistantKey = buildAssistantAnticipationKey("chat-1", {
            id: "message-2",
            sender: "enntity",
            sentTime: "2026-04-18T00:01:00.000Z",
            payload: ['{"type":"text","text":"here you go"}'],
        });

        const result = shouldTriggerPostReplyAnticipation({
            chatId: "chat-1",
            latestMessage: {
                id: "message-2",
                sender: "enntity",
                sentTime: "2026-04-18T00:01:00.000Z",
                payload: ['{"type":"text","text":"here you go"}'],
            },
            hasPendingReply: true,
            previousAssistantKey,
        });

        expect(result.shouldTrigger).toBe(false);
    });
});

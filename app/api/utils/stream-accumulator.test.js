/**
 * @jest-environment node
 */

import { StreamAccumulator } from "./stream-accumulator.mjs";

const parsePayload = (payload) => payload.map((item) => JSON.parse(item));

describe("StreamAccumulator", () => {
    test("keeps counting thinking time after persistent text starts", () => {
        const accumulator = new StreamAccumulator();
        const originalNow = Date.now;
        let now = 1000;
        Date.now = jest.fn(() => now);

        try {
            accumulator.isThinking = true;
            accumulator.thinkingStartTime = now;

            now += 1000;
            accumulator.processResult(JSON.stringify("Visible answer text"));

            now += 2000;
            expect(accumulator.getThinkingDuration()).toBe(3);
        } finally {
            Date.now = originalNow;
        }
    });

    test("preserves tool events inline with assistant text", () => {
        const accumulator = new StreamAccumulator();

        accumulator.processResult(
            JSON.stringify("Let me call some tools.\n\n"),
        );

        accumulator.processInfo({
            toolMessage: {
                type: "start",
                callId: "tool-1",
                icon: "🌐",
                userMessage: "Tool call 1",
            },
        });
        accumulator.processInfo({
            toolMessage: {
                type: "finish",
                callId: "tool-1",
                success: true,
            },
        });
        accumulator.processInfo({
            toolMessage: {
                type: "start",
                callId: "tool-2",
                icon: "🌐",
                userMessage: "Tool call 2",
            },
        });
        accumulator.processInfo({
            toolMessage: {
                type: "finish",
                callId: "tool-2",
                success: true,
            },
        });

        accumulator.processResult(
            JSON.stringify("Hmmm... need to know more about x.\n\n"),
        );

        accumulator.processInfo({
            toolMessage: {
                type: "start",
                callId: "tool-3",
                icon: "🔎",
                userMessage: "Tool call 3",
            },
        });
        accumulator.processInfo({
            toolMessage: {
                type: "finish",
                callId: "tool-3",
                success: true,
            },
        });
        accumulator.processInfo({
            toolMessage: {
                type: "start",
                callId: "tool-4",
                icon: "🔎",
                userMessage: "Tool call 4",
            },
        });
        accumulator.processInfo({
            toolMessage: {
                type: "finish",
                callId: "tool-4",
                success: true,
            },
        });

        accumulator.processResult(JSON.stringify("Okay - here's the answer."));

        const finalMessage = accumulator.buildFinalMessage("entity-1");
        const payload = parsePayload(finalMessage.payload);

        expect(payload).toEqual([
            { type: "text", text: "Let me call some tools.\n\n" },
            {
                type: "tool_event",
                callId: "tool-1",
                icon: "🌐",
                userMessage: "Tool call 1",
                status: "completed",
                error: null,
                presentation: "default",
            },
            {
                type: "tool_event",
                callId: "tool-2",
                icon: "🌐",
                userMessage: "Tool call 2",
                status: "completed",
                error: null,
                presentation: "default",
            },
            { type: "text", text: "Hmmm... need to know more about x.\n\n" },
            {
                type: "tool_event",
                callId: "tool-3",
                icon: "🔎",
                userMessage: "Tool call 3",
                status: "completed",
                error: null,
                presentation: "default",
            },
            {
                type: "tool_event",
                callId: "tool-4",
                icon: "🔎",
                userMessage: "Tool call 4",
                status: "completed",
                error: null,
                presentation: "default",
            },
            { type: "text", text: "Okay - here's the answer." },
            { type: "thinking", text: "", duration: 0 },
        ]);
    });
});

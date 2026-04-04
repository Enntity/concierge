/**
 * @jest-environment jsdom
 */

/* eslint-disable import/first */
import { ReadableStream } from "node:stream/web";

global.ReadableStream = ReadableStream;
global.Response = class Response {
    constructor(body) {
        this._body = body;
    }

    get body() {
        return this._body;
    }
};

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStreamingMessages } from "./useStreamingMessages";

jest.mock("react-toastify", () => ({
    toast: { error: jest.fn() },
}));

function createMockSSEStream() {
    let controller;
    const stream = new ReadableStream({
        start(c) {
            controller = c;
        },
    });
    const encoder = new TextEncoder();

    return {
        response: new Response(stream),
        pushEvent(event, data) {
            controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`),
            );
        },
        close() {
            controller.close();
        },
    };
}

describe("useStreamingMessages", () => {
    let queryClient;
    let originalRAF;

    const wrapper = ({ children }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        });
        originalRAF = global.requestAnimationFrame;
        global.requestAnimationFrame = (cb) => {
            cb();
            return 0;
        };
        jest.clearAllMocks();
    });

    afterEach(() => {
        global.requestAnimationFrame = originalRAF;
        jest.useRealTimers();
        queryClient.clear();
    });

    test("interleaves streamed tool events with assistant text", async () => {
        const { response, pushEvent, close } = createMockSSEStream();
        const { result } = renderHook(
            () =>
                useStreamingMessages({
                    chat: { _id: "chat-1", messages: [], isChatLoading: true },
                    updateChatHook: { mutateAsync: jest.fn() },
                }),
            { wrapper },
        );

        act(() => {
            result.current.setSubscriptionId(response);
        });

        pushEvent("data", {
            result: JSON.stringify("Let me call some tools.\n"),
        });
        pushEvent("info", {
            info: JSON.stringify({
                toolMessage: {
                    type: "start",
                    callId: "tool-1",
                    icon: "🌐",
                    userMessage: "Tool call 1",
                },
            }),
        });
        pushEvent("info", {
            info: JSON.stringify({
                toolMessage: {
                    type: "finish",
                    callId: "tool-1",
                    success: true,
                },
            }),
        });
        pushEvent("data", {
            result: JSON.stringify("Okay - here's the answer."),
        });

        await waitFor(() => {
            expect(result.current.inlinePayloadItems).toHaveLength(3);
        });

        expect(
            result.current.inlinePayloadItems.map((item) => JSON.parse(item)),
        ).toEqual([
            {
                type: "text",
                text: "Let me call some tools.\n",
            },
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
                type: "text",
                text: "Okay - here's the answer.",
            },
        ]);

        pushEvent("complete", {});
        close();
    });

    test("keeps updating thinking duration after visible text starts streaming", async () => {
        jest.useFakeTimers();

        const { response, pushEvent } = createMockSSEStream();
        const { result } = renderHook(
            () =>
                useStreamingMessages({
                    chat: { _id: "chat-2", messages: [], isChatLoading: true },
                    updateChatHook: { mutateAsync: jest.fn() },
                }),
            { wrapper },
        );

        act(() => {
            result.current.setIsStreaming(true);
            result.current.setSubscriptionId(response);
        });

        act(() => {
            jest.advanceTimersByTime(1000);
        });

        pushEvent("data", { result: JSON.stringify("Visible answer text") });

        await waitFor(() => {
            expect(result.current.streamingContent).toBe("Visible answer text");
        });

        act(() => {
            jest.advanceTimersByTime(2000);
        });

        await waitFor(() => {
            expect(result.current.thinkingDuration).toBeGreaterThanOrEqual(3);
        });
    });
});

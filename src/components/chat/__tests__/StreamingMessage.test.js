import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import StreamingMessage from "../StreamingMessage";

jest.mock("react-i18next", () => ({
    __esModule: true,
    useTranslation: () => ({
        t: (key, options) => {
            if (key === "Thinking with duration") {
                return `Thinking for ${options?.duration}s`;
            }
            return key;
        },
        i18n: { language: "en" },
    }),
}));

jest.mock("../../../App", () => {
    const React = require("react");
    return {
        AuthContext: React.createContext({ user: null }),
    };
});

jest.mock("../BotMessage", () => ({
    __esModule: true,
    InlineAssistantPayload: ({ items }) => (
        <div data-testid="inline-payload">
            {items
                .map((item) => {
                    try {
                        return JSON.parse(item).type;
                    } catch {
                        return "raw";
                    }
                })
                .join(",")}
        </div>
    ),
}));

describe("StreamingMessage", () => {
    test("renders inline payload items in order", () => {
        render(
            <StreamingMessage
                content="ignored fallback"
                inlinePayloadItems={[
                    JSON.stringify({
                        type: "text",
                        text: "Let me call some tools.",
                    }),
                    JSON.stringify({
                        type: "tool_event",
                        callId: "tool-1",
                        userMessage: "Tool call 1",
                        status: "completed",
                    }),
                    JSON.stringify({
                        type: "text",
                        text: "Okay - here's the answer.",
                    }),
                ]}
                thinkingDuration={2}
                isThinking={true}
            />,
        );

        expect(screen.getByTestId("inline-payload")).toHaveTextContent(
            "text,tool_event,text",
        );
        expect(screen.getByText("Thinking for 2s")).toBeInTheDocument();
    });

    test("suppresses the footer when a thinking item is already inline", () => {
        render(
            <StreamingMessage
                content=""
                inlinePayloadItems={[
                    JSON.stringify({
                        type: "thinking",
                        text: "Private note",
                        duration: 3,
                    }),
                ]}
                thinkingDuration={3}
                isThinking={true}
            />,
        );

        expect(screen.getByTestId("inline-payload")).toBeInTheDocument();
        expect(screen.queryByText("Thinking for 3s")).not.toBeInTheDocument();
    });
});

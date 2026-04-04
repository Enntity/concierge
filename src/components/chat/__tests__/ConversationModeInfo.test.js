import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ConversationModeInfoButton } from "../ConversationModeInfo";

describe("ConversationModeInfoButton", () => {
    it("does not render when there is no mode data", () => {
        const { container } = render(<ConversationModeInfoButton />);

        expect(container).toBeEmptyDOMElement();
    });

    it("keeps the detected mode hidden until requested", () => {
        render(
            <ConversationModeInfoButton
                modeData={{ mode: "research", label: "Research" }}
            />,
        );

        expect(screen.getByLabelText("View detected mode")).toBeInTheDocument();
        expect(screen.queryByText("Detected mode")).not.toBeInTheDocument();
        expect(screen.queryByText("Research")).not.toBeInTheDocument();

        fireEvent.click(screen.getByLabelText("View detected mode"));

        expect(screen.getByText("Detected mode")).toBeInTheDocument();
        expect(screen.getByText("Research")).toBeInTheDocument();
    });

    it("shows execution path details when route metadata is present", () => {
        render(
            <ConversationModeInfoButton
                modeData={{
                    mode: "chat",
                    label: "Chat",
                    routeMode: "plan",
                    routeReason: "current_info",
                    routeSource: "model",
                }}
            />,
        );

        fireEvent.click(screen.getByLabelText("View detected mode"));

        expect(screen.getByText("Detected mode")).toBeInTheDocument();
        expect(screen.getByText("Chat")).toBeInTheDocument();
        expect(screen.getByText("Execution path")).toBeInTheDocument();
        expect(screen.getByText("Plan")).toBeInTheDocument();
        expect(
            screen.getByText("Reason: Current Info · Source: model"),
        ).toBeInTheDocument();
    });
});

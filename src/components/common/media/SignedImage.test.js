import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SignedImage from "./SignedImage";
import { useSignedFileUrl } from "../../../hooks/useSignedFileUrl";

jest.mock("../../../hooks/useSignedFileUrl", () => ({
    useSignedFileUrl: jest.fn(),
}));

describe("SignedImage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders the fallback when refresh-on-error cannot recover the image", async () => {
        const refreshOnError = jest.fn().mockResolvedValue(null);
        useSignedFileUrl.mockReturnValue({
            url: "https://files.example.com/avatar.png?sig=old",
            refreshOnError,
        });

        render(
            <SignedImage
                src="https://files.example.com/avatar.png?sig=old"
                alt="Avatar"
                fallback={<div>Avatar fallback</div>}
            />,
        );

        fireEvent.error(screen.getByAltText("Avatar"));

        await waitFor(() => {
            expect(screen.getByText("Avatar fallback")).toBeInTheDocument();
        });

        expect(refreshOnError).toHaveBeenCalledTimes(1);
    });

    it("keeps rendering the image when refresh-on-error succeeds", async () => {
        const refreshOnError = jest
            .fn()
            .mockResolvedValue("https://files.example.com/avatar.png?sig=new");

        useSignedFileUrl.mockReturnValue({
            url: "https://files.example.com/avatar.png?sig=old",
            refreshOnError,
        });

        render(
            <SignedImage
                src="https://files.example.com/avatar.png?sig=old"
                alt="Avatar"
                fallback={<div>Avatar fallback</div>}
            />,
        );

        fireEvent.error(screen.getByAltText("Avatar"));

        await waitFor(() => {
            expect(refreshOnError).toHaveBeenCalledTimes(1);
        });

        expect(screen.queryByText("Avatar fallback")).not.toBeInTheDocument();
        expect(screen.getByAltText("Avatar")).toBeInTheDocument();
    });
});

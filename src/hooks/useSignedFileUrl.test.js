/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import {
    __resetSignedFileUrlCacheForTests,
    useSignedFileUrl,
} from "./useSignedFileUrl";
import { checkFileUrlExists } from "../components/files/chatFileUtils";

jest.mock("../components/files/chatFileUtils", () => ({
    checkFileUrlExists: jest.fn(),
}));

describe("useSignedFileUrl", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        __resetSignedFileUrlCacheForTests();
    });

    test("refreshes a signed URL on mount when blobPath is available", async () => {
        checkFileUrlExists.mockResolvedValue({
            exists: true,
            refreshedUrl: "https://files.example.com/avatar.png?sig=new",
        });

        const { result } = renderHook(() =>
            useSignedFileUrl({
                url: "https://files.example.com/avatar.png?sig=old",
                blobPath: "user-1/media/avatar.png",
            }),
        );

        expect(result.current.url).toBe(
            "https://files.example.com/avatar.png?sig=old",
        );

        await waitFor(() => {
            expect(result.current.url).toBe(
                "https://files.example.com/avatar.png?sig=new",
            );
        });

        expect(checkFileUrlExists).toHaveBeenCalledWith({
            url: "https://files.example.com/avatar.png?sig=old",
            blobPath: "user-1/media/avatar.png",
        });
    });

    test("does not render an unsigned managed GCS URL before refresh completes", async () => {
        checkFileUrlExists.mockResolvedValue({
            exists: true,
            refreshedUrl:
                "https://storage.googleapis.com/bucket/user-1/chats/chat-1/avatar.webp?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=new",
        });

        const originalUrl =
            "https://storage.googleapis.com/bucket/user-1/chats/chat-1/avatar.webp";

        const { result } = renderHook(() =>
            useSignedFileUrl({
                url: originalUrl,
                blobPath: "user-1/chats/chat-1/avatar.webp",
            }),
        );

        expect(result.current.url).toBeNull();

        await waitFor(() => {
            expect(result.current.url).toBe(
                "https://storage.googleapis.com/bucket/user-1/chats/chat-1/avatar.webp?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Signature=new",
            );
        });
    });

    test("does not refresh on mount when blobPath is missing", () => {
        const { result } = renderHook(() =>
            useSignedFileUrl({
                url: "https://example.com/image.png",
            }),
        );

        expect(result.current.url).toBe("https://example.com/image.png");
        expect(checkFileUrlExists).not.toHaveBeenCalled();
    });

    test("infers blobPath from storage URL when explicit blobPath is missing", async () => {
        checkFileUrlExists.mockResolvedValue({
            exists: true,
            refreshedUrl:
                "https://storage.googleapis.com/bucket/user-1/media/avatar.png?sig=new",
        });

        const originalUrl =
            "https://storage.googleapis.com/bucket/user-1/media/avatar.png?sig=old";

        renderHook(() =>
            useSignedFileUrl({
                url: originalUrl,
            }),
        );

        await waitFor(() => {
            expect(checkFileUrlExists).toHaveBeenCalledWith({
                url: originalUrl,
                blobPath: "user-1/media/avatar.png",
            });
        });
    });

    test("dedupes concurrent lookups for the same blobPath", async () => {
        let resolveLookup;
        checkFileUrlExists.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveLookup = resolve;
                }),
        );

        const first = renderHook(() =>
            useSignedFileUrl({
                url: "https://files.example.com/shared.png?sig=old",
                blobPath: "user-1/media/shared.png",
            }),
        );
        const second = renderHook(() =>
            useSignedFileUrl({
                url: "https://files.example.com/shared.png?sig=old",
                blobPath: "user-1/media/shared.png",
            }),
        );

        expect(checkFileUrlExists).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveLookup({
                exists: true,
                refreshedUrl: "https://files.example.com/shared.png?sig=new",
            });
        });

        await waitFor(() => {
            expect(first.result.current.url).toBe(
                "https://files.example.com/shared.png?sig=new",
            );
            expect(second.result.current.url).toBe(
                "https://files.example.com/shared.png?sig=new",
            );
        });
    });

    test("refreshOnError forces a new lookup", async () => {
        checkFileUrlExists
            .mockResolvedValueOnce({
                exists: true,
                refreshedUrl: "https://files.example.com/file.png?sig=mount",
            })
            .mockResolvedValueOnce({
                exists: true,
                refreshedUrl: "https://files.example.com/file.png?sig=retry",
            });

        const { result } = renderHook(() =>
            useSignedFileUrl({
                url: "https://files.example.com/file.png?sig=old",
                blobPath: "user-1/media/file.png",
            }),
        );

        await waitFor(() => {
            expect(result.current.url).toBe(
                "https://files.example.com/file.png?sig=mount",
            );
        });

        await act(async () => {
            await result.current.refreshOnError();
        });

        await waitFor(() => {
            expect(result.current.url).toBe(
                "https://files.example.com/file.png?sig=retry",
            );
        });

        expect(checkFileUrlExists).toHaveBeenCalledTimes(2);
    });
});

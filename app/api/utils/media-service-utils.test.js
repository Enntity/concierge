jest.mock("../../../config/index.js", () => ({
    __esModule: true,
    default: {
        endpoints: {
            mediaHelperDirect: () => "https://media-helper.test/files",
        },
    },
}));

describe("media-service-utils", () => {
    beforeEach(() => {
        process.env.CORTEX_API_KEY = "test-key";
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                blobPath: "user-1/global/renamed.pdf",
                filename: "renamed.pdf",
                url: "https://signed.test/renamed.pdf",
            }),
        });
    });

    afterEach(() => {
        jest.resetModules();
        delete process.env.CORTEX_API_KEY;
        delete global.fetch;
    });

    test("deleteFileFromMediaService forwards blobPath when available", async () => {
        const { deleteFileFromMediaService } = await import(
            "./media-service-utils.js"
        );

        await deleteFileFromMediaService({
            blobPath: "user-1/global/report.pdf",
            storageTarget: {
                kind: "user-global",
                userContextId: "user-1",
            },
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [requestUrl, options] = global.fetch.mock.calls[0];
        const parsedUrl = new URL(requestUrl);

        expect(parsedUrl.searchParams.get("filename")).toBe("report.pdf");
        expect(parsedUrl.searchParams.get("blobPath")).toBe(
            "user-1/global/report.pdf",
        );
        expect(options.method).toBe("DELETE");
        expect(options.headers.Authorization).toBe("Bearer test-key");
    });

    test("renameFileInMediaService forwards blobPath when available", async () => {
        const { renameFileInMediaService } = await import(
            "./media-service-utils.js"
        );

        await renameFileInMediaService({
            blobPath: "user-1/global/report.pdf",
            newFilename: "renamed.pdf",
            storageTarget: {
                kind: "user-global",
                userContextId: "user-1",
            },
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [requestUrl, options] = global.fetch.mock.calls[0];
        const parsedUrl = new URL(requestUrl);
        const body = JSON.parse(options.body);

        expect(parsedUrl.searchParams.get("operation")).toBe("rename");
        expect(body.blobPath).toBe("user-1/global/report.pdf");
        expect(body.filename).toBe("report.pdf");
        expect(body.newFilename).toBe("renamed.pdf");
        expect(options.headers.Authorization).toBe("Bearer test-key");
    });
});

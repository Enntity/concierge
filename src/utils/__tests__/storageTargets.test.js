import {
    buildMediaHelperListParams,
    createChatStorageTarget,
    createUserGlobalStorageTarget,
} from "../storageTargets";

describe("storageTargets", () => {
    describe("buildMediaHelperListParams", () => {
        test("preserves explicit all scope when listing with a storage target", () => {
            expect(
                buildMediaHelperListParams({
                    storageTarget: createUserGlobalStorageTarget("user-1"),
                    fileScope: "all",
                }),
            ).toEqual({
                userId: "user-1",
                fileScope: "all",
            });
        });

        test("preserves explicit chatId and all scope when listing with a chat storage target", () => {
            expect(
                buildMediaHelperListParams({
                    storageTarget: createChatStorageTarget("user-1", "chat-1"),
                    fileScope: "all",
                    chatId: "chat-1",
                }),
            ).toEqual({
                userId: "user-1",
                fileScope: "all",
                chatId: "chat-1",
            });
        });
    });
});

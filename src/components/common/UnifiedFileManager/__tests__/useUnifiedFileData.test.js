import "@testing-library/jest-dom";
import { buildFolderTree, countFiles } from "../useUnifiedFileData";

describe("buildFolderTree", () => {
    it("adds the current chat folder even when it has no files yet", () => {
        const tree = buildFolderTree(
            [
                {
                    blobPath: "user-1/global/report.pdf",
                    filename: "report.pdf",
                },
            ],
            "user-1/",
            "chat-123",
        );

        expect(tree.children.global).toBeDefined();
        expect(tree.children.chats).toBeDefined();
        expect(tree.children.chats.children["chat-123"]).toEqual({
            name: "chat-123",
            children: {},
            files: [],
            path: "chats/chat-123",
        });
        expect(countFiles(tree.children.chats.children["chat-123"])).toBe(0);
    });
});

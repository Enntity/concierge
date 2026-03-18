import { createFileId } from "../../fileIdUtils";

describe("createFileId", () => {
    it("prefers blobPath when both blobPath and _id exist", () => {
        const file = {
            _id: "mongo-1",
            blobPath: "user-1/global/file.txt",
        };

        expect(createFileId(file)).toBe("bp-user-1/global/file.txt");
    });

    it("falls back to _id when blobPath is missing", () => {
        const file = {
            _id: "mongo-2",
        };

        expect(createFileId(file)).toBe("id-mongo-2");
    });
});

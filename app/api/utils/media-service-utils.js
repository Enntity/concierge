import { NextResponse } from "next/server";
import config from "../../../config/index.js";
import {
    buildMediaHelperFileParams,
    buildMediaHelperListParams,
    extractBlobPathFromUrl,
    getFilenameFromBlobPath,
} from "../../../src/utils/storageTargets.js";

export function normalizeMediaServiceUpload(data, defaults = {}) {
    const publicUrl =
        (typeof data?.url === "string" ? data.url : null) ||
        defaults.url ||
        null;
    const blobPath =
        data?.blobPath ||
        defaults.blobPath ||
        extractBlobPathFromUrl(publicUrl);
    const filename =
        data?.filename ||
        data?.displayFilename ||
        defaults.filename ||
        getFilenameFromBlobPath(blobPath);

    return {
        ...data,
        url: publicUrl,
        blobPath: blobPath || null,
        filename: filename || null,
        displayFilename:
            data?.displayFilename || defaults.displayFilename || filename || null,
    };
}

export async function deleteFileFromMediaService({
    blobPath = null,
    filename = null,
    storageTarget = null,
    contextId = null,
} = {}) {
    const resolvedFilename = filename || getFilenameFromBlobPath(blobPath);
    if (!resolvedFilename) {
        return false;
    }

    const mediaHelperUrl = config.endpoints.mediaHelperDirect();
    if (!mediaHelperUrl) {
        throw new Error("Media helper URL is not defined");
    }

    const routingParams = buildMediaHelperFileParams({
        storageTarget,
        contextId,
    });
    const deleteUrl = new URL(mediaHelperUrl);
    deleteUrl.searchParams.set("filename", resolvedFilename);
    for (const [key, value] of Object.entries(routingParams)) {
        deleteUrl.searchParams.set(key, value);
    }

    const response = await fetch(deleteUrl.toString(), {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (response.status === 404) {
        return false;
    }

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
            `Failed to delete file ${resolvedFilename}: ${response.statusText}. Response body: ${errorBody}`,
        );
    }

    return true;
}

export async function listFilesFromMediaService({
    storageTarget = null,
    userContextId = null,
    contextId = null,
    fileScope = "all",
    chatId = null,
} = {}) {
    const mediaHelperUrl = config.endpoints.mediaHelperDirect();
    if (!mediaHelperUrl) {
        throw new Error("Media helper URL is not defined");
    }

    const listParams = buildMediaHelperListParams({
        storageTarget,
        userContextId,
        contextId,
        fileScope,
        chatId,
    });

    const listUrl = new URL(mediaHelperUrl);
    listUrl.searchParams.set("operation", "listFolder");
    for (const [key, value] of Object.entries(listParams)) {
        listUrl.searchParams.set(key, value);
    }

    const response = await fetch(listUrl.toString());
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
            `Failed to list files: ${response.statusText}. Response body: ${errorBody}`,
        );
    }

    const files = await response.json();
    if (!Array.isArray(files)) {
        throw new Error("Media helper returned an unexpected file listing");
    }

    return files.map((file) =>
        normalizeMediaServiceUpload(file, {
            blobPath: file?.blobPath || null,
            filename: file?.filename || null,
            displayFilename: file?.displayFilename || file?.filename || null,
        }),
    );
}

export function findMediaServiceFile(files, { blobPath = null, filename = null } = {}) {
    if (!Array.isArray(files) || (!blobPath && !filename)) {
        return null;
    }

    const normalizedFilename = filename ? String(filename).trim() : null;

    return (
        files.find(
            (file) =>
                (blobPath && file?.blobPath === blobPath) ||
                (normalizedFilename && file?.filename === normalizedFilename),
        ) || null
    );
}

/**
 * Upload buffer to media service
 * @param {Buffer} fileBuffer - The file buffer
 * @param {Object} metadata - File metadata
 * @param {Object} options - Upload options
 * @returns {Object} Upload result with data or error
 */
export async function uploadBufferToMediaService(
    fileBuffer,
    metadata,
    options = {},
) {
    try {
        const mediaHelperUrl = config.endpoints.mediaHelperDirect();
        if (!mediaHelperUrl) {
            throw new Error("Media helper URL is not defined");
        }

        const { storageTarget = null, contextId = null } = options || {};
        const routingParams = buildMediaHelperFileParams({
            storageTarget,
            contextId,
        });

        const blob = new Blob([fileBuffer], { type: metadata.mimeType });
        const uploadFormData = new FormData();
        uploadFormData.append("file", blob, metadata.filename || "file");
        for (const [key, value] of Object.entries(routingParams)) {
            uploadFormData.append(key, value);
        }

        const uploadResponse = await fetch(mediaHelperUrl, {
            method: "POST",
            body: uploadFormData,
        });

        if (!uploadResponse.ok) {
            const errorBody = await uploadResponse.text();
            throw new Error(
                `Upload failed: ${uploadResponse.statusText}. Response body: ${errorBody}`,
            );
        }

        const uploadData = normalizeMediaServiceUpload(
            await uploadResponse.json(),
            {
                filename: metadata.filename,
                displayFilename: metadata.filename,
                blobPath:
                    metadata.blobPath ||
                    extractBlobPathFromUrl(metadata.url),
            },
        );

        if (!uploadData.url) {
            throw new Error("Media file upload failed: Missing file URL");
        }

        return { success: true, data: uploadData };
    } catch (error) {
        console.error("Error uploading to media service:", error);
        return {
            error: NextResponse.json(
                {
                    error:
                        "Failed to upload to media service: " + error.message,
                },
                { status: 500 },
            ),
        };
    }
}

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

function getMediaHelperUrl() {
    const mediaHelperUrl = config.endpoints.mediaHelperDirect();
    if (!mediaHelperUrl) {
        throw new Error("Media helper URL is not defined");
    }
    return mediaHelperUrl;
}

function appendQueryParams(url, params = {}) {
    for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== "") {
            url.searchParams.set(key, value);
        }
    }
}

async function throwMediaServiceError(response, message) {
    const errorBody = await response.text();
    const error = new Error(
        `${message}: ${response.statusText}. Response body: ${errorBody}`,
    );
    error.status = response.status;
    error.details = errorBody;
    throw error;
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

    const mediaHelperUrl = getMediaHelperUrl();

    const routingParams = buildMediaHelperFileParams({
        storageTarget,
        contextId,
    });
    const deleteUrl = new URL(mediaHelperUrl);
    deleteUrl.searchParams.set("filename", resolvedFilename);
    appendQueryParams(deleteUrl, routingParams);

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
        await throwMediaServiceError(
            response,
            `Failed to delete file ${resolvedFilename}`,
        );
    }

    return true;
}

export async function deletePrefixFromMediaService(prefix) {
    if (!prefix) {
        throw new Error("Prefix is required");
    }

    const deleteUrl = new URL(getMediaHelperUrl());
    deleteUrl.searchParams.set("prefix", prefix);

    const response = await fetch(deleteUrl.toString(), {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (!response.ok) {
        await throwMediaServiceError(
            response,
            `Failed to delete prefix ${prefix}`,
        );
    }

    return response.json();
}

export async function listFilesFromMediaService({
    storageTarget = null,
    userContextId = null,
    contextId = null,
    fileScope = "all",
    chatId = null,
} = {}) {
    const mediaHelperUrl = getMediaHelperUrl();

    const listParams = buildMediaHelperListParams({
        storageTarget,
        userContextId,
        contextId,
        fileScope,
        chatId,
    });

    const listUrl = new URL(mediaHelperUrl);
    listUrl.searchParams.set("operation", "listFolder");
    appendQueryParams(listUrl, listParams);

    const response = await fetch(listUrl.toString());
    if (!response.ok) {
        await throwMediaServiceError(response, "Failed to list files");
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

export async function signFileFromMediaService({
    blobPath = null,
    minutes = 5,
} = {}) {
    if (!blobPath) {
        throw new Error("blobPath is required");
    }

    const signUrl = new URL(getMediaHelperUrl());
    signUrl.searchParams.set("operation", "signUrl");
    signUrl.searchParams.set("blobPath", blobPath);
    if (minutes) {
        signUrl.searchParams.set("minutes", String(minutes));
    }

    const response = await fetch(signUrl.toString(), {
        method: "GET",
    });

    if (!response.ok) {
        await throwMediaServiceError(
            response,
            `Failed to sign file ${blobPath}`,
        );
    }

    return normalizeMediaServiceUpload(await response.json(), {
        blobPath,
    });
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
        const mediaHelperUrl = getMediaHelperUrl();

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
            await throwMediaServiceError(uploadResponse, "Upload failed");
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
                    ...(error.details ? { details: error.details } : {}),
                },
                { status: error.status || 500 },
            ),
        };
    }
}

export async function importUrlToMediaService(
    remoteUrl,
    options = {},
) {
    if (!remoteUrl) {
        throw new Error("remoteUrl is required");
    }

    const { storageTarget = null, contextId = null } = options || {};
    const routingParams = buildMediaHelperFileParams({
        storageTarget,
        contextId,
    });
    const importUrl = new URL(getMediaHelperUrl());
    importUrl.searchParams.set("fetch", remoteUrl);
    appendQueryParams(importUrl, routingParams);

    const response = await fetch(importUrl.toString(), {
        method: "GET",
    });

    if (!response.ok) {
        await throwMediaServiceError(response, "Failed to import remote file");
    }

    return normalizeMediaServiceUpload(await response.json(), {
        url: remoteUrl,
    });
}

export async function renameFileInMediaService({
    blobPath = null,
    filename = null,
    newFilename = null,
    storageTarget = null,
    contextId = null,
} = {}) {
    const resolvedFilename = filename || getFilenameFromBlobPath(blobPath);
    if (!resolvedFilename) {
        throw new Error("filename or blobPath is required");
    }
    if (!newFilename) {
        throw new Error("newFilename is required");
    }

    const routingParams = buildMediaHelperFileParams({
        storageTarget,
        contextId,
    });
    const renameUrl = new URL(getMediaHelperUrl());
    renameUrl.searchParams.set("operation", "rename");

    const response = await fetch(renameUrl.toString(), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            ...routingParams,
            filename: resolvedFilename,
            newFilename,
        }),
    });

    if (!response.ok) {
        await throwMediaServiceError(
            response,
            `Failed to rename file ${resolvedFilename}`,
        );
    }

    return normalizeMediaServiceUpload(await response.json(), {
        blobPath,
        filename: newFilename,
        displayFilename: newFilename,
    });
}

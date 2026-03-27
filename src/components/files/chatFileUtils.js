/**
 * Utility functions for deleting files from chat messages
 */

import {
    buildMediaHelperFileParams,
    extractBlobPathFromUrl,
    getFilenameFromBlobPath,
    inferStorageTargetFromFile,
} from "../../utils/storageTargets";

function getFileBlobPath(fileObj) {
    return (
        fileObj?.blobPath ||
        fileObj?.name ||
        extractBlobPathFromUrl(fileObj?.url) ||
        extractBlobPathFromUrl(fileObj?.image_url?.url)
    );
}

/**
 * Delete a file from cloud storage using the CFH API
 * @param {Object} fileObj - File object
 * @param {Object} options
 * @param {string} options.contextId - Optional context ID for file scoping
 * @returns {Promise<void>} - Resolves even if deletion fails (errors are logged)
 */
export async function deleteFileFromCloud(fileObj, options = {}) {
    const { contextId = null } = options;

    if (!fileObj) return;

    const blobPath = getFileBlobPath(fileObj);
    const filename =
        fileObj?.filename ||
        fileObj?.displayFilename ||
        fileObj?.originalFilename ||
        getFilenameFromBlobPath(blobPath);
    const storageTarget = inferStorageTargetFromFile(fileObj, contextId);
    const routingParams = buildMediaHelperFileParams({
        storageTarget: storageTarget || undefined,
        contextId,
    });

    if (!blobPath && !filename) {
        return;
    }

    try {
        const deleteUrl = new URL("/api/files/delete", window.location.origin);
        if (blobPath) {
            deleteUrl.searchParams.set("blobPath", blobPath);
        }
        if (filename) {
            deleteUrl.searchParams.set("filename", filename);
        }
        for (const [key, value] of Object.entries(routingParams)) {
            deleteUrl.searchParams.set(key, value);
        }

        const response = await fetch(deleteUrl.toString(), {
            method: "DELETE",
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.warn(
                `Failed to delete file from cloud: ${response.statusText}. ${errorBody}`,
            );
        } else {
            console.log(
                `Successfully deleted file ${blobPath || filename} from cloud storage`,
            );
        }
    } catch (error) {
        console.error("Error deleting file from cloud storage:", error);
    }
}

/**
 * Check if a file URL exists by making a server-side request
 * This avoids CORS issues and doesn't rely on legacy file metadata
 * @param {Object} options
 * @param {string} options.url - File URL to check
 * @param {string} options.blobPath - Stable blob path for CFH-managed files
 * @returns {Promise<{exists: boolean, refreshedUrl?: string, url?: string}>}
 */
export async function checkFileUrlExists({ url = null, blobPath = null } = {}) {
    if (!url && !blobPath) {
        return { exists: false };
    }

    try {
        // Use POST to avoid logging sensitive SAS URLs in server logs
        const response = await fetch("/api/files/check-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, blobPath }),
        });

        if (!response.ok) {
            console.warn(`Failed to check file URL: ${response.statusText}`);
            return { exists: false };
        }

        return (await response.json().catch(() => null)) || { exists: false };
    } catch (error) {
        console.error("Error checking file URL:", error);
        return { exists: false };
    }
}

/**
 * Create a placeholder replacement for a deleted file
 * Includes metadata to show a visual indicator in the UI while still sending text to LLM
 * @param {Object} fileObj - The file object parsed from message payload
 * @param {Function} t - Translation function
 * @param {string} filename - Optional filename (if not provided, extracts from fileObj)
 * @returns {string} - Replacement payload item
 */
export function createFilePlaceholder(fileObj, t, filename = null) {
    const deletedFileInfo =
        filename ||
        fileObj.displayFilename ||
        fileObj.originalFilename ||
        fileObj.filename ||
        "file";

    return JSON.stringify({
        type: "text",
        text: t("File deleted by user: {{filename}}", {
            filename: deletedFileInfo,
        }),
        hideFromClient: true, // Hide text from UI, but send to LLM
        isDeletedFile: true, // Flag to show visual indicator in UI
        deletedFilename: deletedFileInfo, // Preserve filename for display
        originalFileType: fileObj.type, // Preserve original file type (image_url or file)
    });
}

/**
 * Delete a file from a chat message payload item
 * Deletes from cloud storage and returns the replacement payload item
 * @param {Object} fileObj - The file object parsed from message payload
 * @param {Function} t - Translation function
 * @param {string} filename - Optional filename (if not provided, extracts from fileObj)
 * @returns {Promise<string | null>} - Replacement payload item or null to remove
 */
export async function deleteFileFromChatPayload(fileObj, t, filename = null) {
    if (!fileObj || !["image_url", "file"].includes(fileObj.type)) {
        return null;
    }

    // Delete from cloud storage
    // Note: This function doesn't receive contextId, so it will use default user.contextId
    // For chat files, use purgeFiles instead which accepts contextId
    if (
        getFileBlobPath(fileObj) ||
        fileObj.filename ||
        fileObj.displayFilename ||
        fileObj.originalFilename
    ) {
        await deleteFileFromCloud(fileObj);
    }

    // Create replacement message
    return createFilePlaceholder(fileObj, t, filename);
}

/**
 * Unified function to purge files from all locations:
 * - Cloud storage (if blobPath/filename exists)
 * - Memory files collection (if contextId/contextKey available)
 * - Chat messages (if chatId/messages/updateChatHook available)
 *
 * This ensures consistent deletion behavior across all scenarios.
 * Processes all files in a single chat update to avoid race conditions.
 *
 * @param {Object} options - Configuration object
 * @param {Array} options.fileObjs - Array of file objects to purge
 * @param {Object} options.apolloClient - Apollo client for memory files operations (optional)
 * @param {string} options.contextId - Context ID for memory files (optional)
 * @param {string} options.contextKey - Context key for memory files (optional)
 * @param {string} options.chatId - Chat ID for updating messages (optional)
 * @param {Array} options.messages - Current messages array (optional)
 * @param {Object} options.updateChatHook - Hook for updating chat (optional)
 * @param {Function} options.t - Translation function
 * @param {Function} options.getFilename - Optional function to get filename from file object (for bulk operations)
 * @param {boolean} options.skipCloudDelete - If true, skip cloud deletion (e.g., files already gone)
 * @param {boolean} options.skipUserFileCollection - If true, skip file collection update (CFH handles it automatically)
 * @returns {Promise<Object>} - Result object with success flags and updated messages (if applicable)
 */
export async function purgeFiles({
    fileObjs,
    apolloClient = null,
    contextId = null,
    contextKey = null,
    chatId = null,
    messages = null,
    updateChatHook = null,
    t,
    getFilename = null,
    skipCloudDelete = false,
    skipUserFileCollection = false,
}) {
    void apolloClient;
    void contextKey;

    // Normalize to array
    const files = Array.isArray(fileObjs) ? fileObjs : [fileObjs];

    if (
        files.length === 0 ||
        !files.every((f) => f && ["image_url", "file"].includes(f?.type))
    ) {
        return { success: false, error: "Invalid file objects" };
    }

    const results = {
        cloudDeleted: 0,
        userFileCollectionRemoved: false,
        chatUpdated: false,
        updatedMessages: null,
    };

    // 1. Delete from cloud storage (in parallel)
    // Use the provided contextId for deletion (e.g., user.contextId for user files)
    if (!skipCloudDelete) {
        await Promise.allSettled(
            files
                .filter(
                    (fileObj) =>
                        fileObj?.blobPath ||
                        fileObj?.name ||
                        fileObj?.url ||
                        fileObj?.filename ||
                        fileObj?.displayFilename ||
                        fileObj?.originalFilename,
                )
                .map((fileObj) =>
                    deleteFileFromCloud(fileObj, {
                        contextId,
                    }),
                ),
        );
        results.cloudDeleted = files.length;
    }

    // 2. CFH automatically updates Redis on delete, so no manual collection update needed
    results.userFileCollectionRemoved = !skipUserFileCollection;

    // 3. Replace in chat messages with placeholders (single update for all files)
    if (chatId && messages && Array.isArray(messages) && updateChatHook) {
        try {
            // Create a Set of file identifiers for fast lookup
            const fileIdentifiers = new Set();
            files.forEach((fileObj) => {
                if (fileObj?.url) fileIdentifiers.add(`url:${fileObj.url}`);
                if (getFileBlobPath(fileObj)) {
                    fileIdentifiers.add(`blobPath:${getFileBlobPath(fileObj)}`);
                }
                if (fileObj?.image_url?.url)
                    fileIdentifiers.add(`image_url:${fileObj.image_url.url}`);
            });

            const updatedMessages = messages.map((message) => {
                if (!Array.isArray(message.payload)) return message;

                const updatedPayload = message.payload.map((payloadItem) => {
                    try {
                        const payloadObj = JSON.parse(payloadItem);
                        if (
                            (payloadObj.type === "image_url" ||
                                payloadObj.type === "file") &&
                            !payloadObj.hideFromClient
                        ) {
                            const matches =
                                (payloadObj.url &&
                                    fileIdentifiers.has(
                                        `url:${payloadObj.url}`,
                                    )) ||
                                (getFileBlobPath(payloadObj) &&
                                    fileIdentifiers.has(
                                        `blobPath:${getFileBlobPath(payloadObj)}`,
                                    )) ||
                                (payloadObj.image_url?.url &&
                                    fileIdentifiers.has(
                                        `image_url:${payloadObj.image_url.url}`,
                                    ));

                            if (matches) {
                                // Find matching fileObj for filename
                                const matchingFileObj = files.find(
                                    (fileObj) =>
                                        (fileObj.url &&
                                            payloadObj.url === fileObj.url) ||
                                        (getFileBlobPath(fileObj) &&
                                            getFileBlobPath(payloadObj) ===
                                                getFileBlobPath(fileObj)) ||
                                        (fileObj.image_url?.url &&
                                            payloadObj.image_url?.url ===
                                                fileObj.image_url.url),
                                );

                                const filename =
                                    matchingFileObj && getFilename
                                        ? getFilename(matchingFileObj)
                                        : payloadObj.displayFilename ||
                                          payloadObj.originalFilename ||
                                          payloadObj.filename ||
                                          "file";

                                return createFilePlaceholder(
                                    payloadObj,
                                    t,
                                    filename,
                                );
                            }
                        }
                    } catch (e) {
                        // Not a JSON object, keep as is
                    }
                    return payloadItem;
                });

                return { ...message, payload: updatedPayload };
            });

            await updateChatHook.mutateAsync({
                chatId: String(chatId),
                messages: updatedMessages,
            });

            results.chatUpdated = true;
            results.updatedMessages = updatedMessages;
        } catch (error) {
            console.error(
                "Failed to update chat with file placeholders:",
                error,
            );
        }
    }

    return results;
}

/**
 * Convenience wrapper for purging a single file
 * @param {Object} options - Same as purgeFiles, but fileObj instead of fileObjs, and filename instead of getFilename
 */
export async function purgeFile({ fileObj, filename = null, ...rest }) {
    if (!fileObj || !["image_url", "file"].includes(fileObj?.type)) {
        return { success: false, error: "Invalid file object" };
    }

    const result = await purgeFiles({
        fileObjs: [fileObj],
        getFilename: filename ? () => filename : null,
        ...rest,
    });

    // Convert bulk result format to single-file format for backward compatibility
    return {
        cloudDeleted: result.cloudDeleted > 0,
        userFileCollectionRemoved: result.userFileCollectionRemoved,
        chatUpdated: result.chatUpdated,
        updatedMessages: result.updatedMessages,
    };
}

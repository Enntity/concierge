import {
    buildMediaHelperFileParams,
    buildMediaHelperListParams,
    extractBlobPathFromUrl,
    getStorageContextId,
} from "./storageTargets";

function normalizeUploadResult(data, defaults = {}) {
    const publicUrl =
        (typeof data?.url === "string" ? data.url : null) ||
        null;

    return {
        ...data,
        url: publicUrl,
        blobPath:
            data?.blobPath ||
            extractBlobPathFromUrl(publicUrl),
        displayFilename:
            data?.displayFilename || data?.filename || defaults.filename || null,
        filename: data?.filename || defaults.filename || null,
    };
}

export async function listUserFolder(userId, options = {}) {
    const {
        serverUrl = "/media-helper",
        storageTarget = null,
        fileScope = "all",
        chatId = null,
    } = options;
    const listParams = buildMediaHelperListParams({
        storageTarget,
        userContextId: userId,
        contextId: userId,
        fileScope,
        chatId,
    });

    const url = new URL(serverUrl, window.location.origin);
    url.searchParams.set("operation", "listFolder");
    for (const [key, value] of Object.entries(listParams)) {
        url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Failed to list folder: ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error("CFH listFolder returned an unexpected payload");
    }

    return data.map((file) =>
        normalizeUploadResult(
            {
                ...file,
                blobPath: file?.blobPath || null,
            },
            {
                filename: file?.filename || null,
            },
        ),
    );
}

/**
 * Upload a file to the media helper service
 * @param {File} file - The file to upload
 * @param {Object} options - Upload options
 * @param {string} options.contextId - Optional contextId for file scoping
 * @param {Function} options.onProgress - Progress callback (percentage: number) => void
 * @param {AbortSignal} options.signal - Optional abort signal
 * @param {string} options.serverUrl - Server URL (default: "/media-helper")
 * @param {Function} options.getXHR - Optional callback to get the XHR object for custom handling
 * @returns {Promise<Object>} Upload result with url, blobPath, filename, displayFilename, etc.
 * @throws {Error} If upload fails
 */
export async function uploadFileToMediaHelper(file, options = {}) {
    const {
        storageTarget = null,
        onProgress = null,
        signal = null,
        serverUrl = "/media-helper",
        getXHR = null,
    } = options;
    const routingParams = buildMediaHelperFileParams({
        storageTarget,
        ...options,
    });
    const targetContextId =
        storageTarget || routingParams.fileScope
            ? getStorageContextId({
                  storageTarget,
                  ...options,
              })
            : options.contextId;

    const formData = new FormData();
    if (targetContextId) {
        formData.append("contextId", targetContextId);
    }
    for (const [key, value] of Object.entries(routingParams)) {
        if (key === "contextId") continue;
        formData.append(key, value);
    }
    formData.append("file", file, file.name);

    const uploadUrl = new URL(serverUrl, window.location.origin);
    for (const [key, value] of Object.entries(routingParams)) {
        uploadUrl.searchParams.set(key, value);
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Expose XHR to caller if requested (for custom progress handling)
        if (getXHR) {
            getXHR(xhr);
        }

        // Handle abort signal
        if (signal) {
            signal.addEventListener("abort", () => {
                xhr.abort();
                reject(new Error("Upload aborted"));
            });
        }

        // Monitor upload progress
        if (onProgress) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    // Always pass percentage - it's the most common use case
                    // and works with React state setters
                    const percentage = Math.round(
                        (event.loaded / event.total) * 100,
                    );
                    onProgress(percentage);
                }
            };
        }

        // Handle upload response
        xhr.onload = () => {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(
                        normalizeUploadResult(data, {
                            filename: file.name,
                        }),
                    );
                } catch (error) {
                    reject(
                        new Error(
                            `Failed to parse upload response: ${error.message}`,
                        ),
                    );
                }
            } else {
                reject(
                    new Error(
                        `Upload failed: ${xhr.statusText} (${xhr.status})`,
                    ),
                );
            }
        };

        // Handle upload errors
        xhr.onerror = () => {
            reject(new Error("File upload failed"));
        };

        // Handle abort
        xhr.onabort = () => {
            reject(new Error("Upload aborted"));
        };

        // Start upload
        xhr.open("POST", uploadUrl.toString(), true);
        xhr.send(formData);
    });
}

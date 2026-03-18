function cleanObject(object) {
    return Object.fromEntries(
        Object.entries(object).filter(
            ([, value]) => value != null && value !== "",
        ),
    );
}

function toNullableString(value) {
    return value == null || value === "" ? null : String(value);
}

export const STORAGE_TARGET_KINDS = Object.freeze({
    USER_GLOBAL: "user-global",
    CHAT: "chat",
    MEDIA: "media",
    PROFILE: "profile",
});

const FILE_SCOPE_BY_KIND = Object.freeze({
    [STORAGE_TARGET_KINDS.USER_GLOBAL]: "global",
    [STORAGE_TARGET_KINDS.CHAT]: "chat",
    [STORAGE_TARGET_KINDS.MEDIA]: "media",
    [STORAGE_TARGET_KINDS.PROFILE]: "profile",
});

function inferStorageTargetKind({
    kind = null,
    fileScope = null,
    chatId = null,
} = {}) {
    if (kind) {
        return kind;
    }

    if (fileScope === "chat" || chatId) {
        return STORAGE_TARGET_KINDS.CHAT;
    }
    if (fileScope === "media") {
        return STORAGE_TARGET_KINDS.MEDIA;
    }
    if (fileScope === "profile") {
        return STORAGE_TARGET_KINDS.PROFILE;
    }

    return STORAGE_TARGET_KINDS.USER_GLOBAL;
}

export function createStorageTarget(kind, options = {}) {
    return cleanObject({
        kind,
        userContextId: options.userContextId,
        chatId: options.chatId,
    });
}

export function createUserGlobalStorageTarget(userContextId) {
    return createStorageTarget(STORAGE_TARGET_KINDS.USER_GLOBAL, {
        userContextId,
    });
}

export function createChatStorageTarget(userContextId, chatId) {
    return createStorageTarget(STORAGE_TARGET_KINDS.CHAT, {
        userContextId,
        chatId,
    });
}

export function createMediaStorageTarget(userContextId) {
    return createStorageTarget(STORAGE_TARGET_KINDS.MEDIA, {
        userContextId,
    });
}

export function createProfileStorageTarget(userContextId) {
    return createStorageTarget(STORAGE_TARGET_KINDS.PROFILE, {
        userContextId,
    });
}

export function resolveStorageTarget(input = {}) {
    const target = input.storageTarget || input.target || input;
    const kind = inferStorageTargetKind({
        kind: target.kind ?? input.kind,
        fileScope: target.fileScope ?? input.fileScope,
        chatId: target.chatId ?? input.chatId,
    });
    const userContextId = toNullableString(
        target.userContextId ??
            target.userId ??
            input.userContextId ??
            input.userId ??
            target.contextId ??
            input.contextId,
    );
    const chatId =
        kind === STORAGE_TARGET_KINDS.CHAT
            ? toNullableString(target.chatId ?? input.chatId)
            : null;

    return {
        kind,
        userContextId,
        chatId,
        fileScope: FILE_SCOPE_BY_KIND[kind] || "global",
        contextId: userContextId,
    };
}

export function getStorageContextId(input = {}) {
    return resolveStorageTarget(input).contextId;
}

export function buildMediaHelperFileParams(input = {}) {
    const resolved = resolveStorageTarget(input);
    return cleanObject({
        contextId: resolved.contextId,
        userId: resolved.userContextId,
        chatId: resolved.chatId,
        fileScope: resolved.fileScope,
    });
}

export function buildMediaHelperListParams({
    storageTarget = null,
    userContextId = null,
    contextId = null,
    fileScope = "all",
    chatId = null,
} = {}) {
    if (storageTarget) {
        const resolved = resolveStorageTarget({ storageTarget });
        return cleanObject({
            userId: resolved.userContextId || resolved.contextId,
            fileScope: resolved.fileScope,
            chatId: resolved.chatId,
        });
    }

    return cleanObject({
        userId: toNullableString(userContextId ?? contextId),
        fileScope,
        chatId: toNullableString(chatId),
    });
}

export function extractBlobPathFromUrl(url) {
    if (!url || typeof url !== "string") {
        return null;
    }

    if (url.startsWith("gs://")) {
        const withoutProtocol = url.slice(5);
        const slashIndex = withoutProtocol.indexOf("/");
        return slashIndex === -1
            ? null
            : decodeURIComponent(withoutProtocol.slice(slashIndex + 1));
    }

    try {
        const parsed = new URL(url);
        const storageObjectMarker = "/o/";
        const markerIndex = parsed.pathname.indexOf(storageObjectMarker);

        if (markerIndex !== -1) {
            return decodeURIComponent(
                parsed.pathname.slice(markerIndex + storageObjectMarker.length),
            );
        }

        const pathSegments = parsed.pathname.split("/").filter(Boolean);
        if (
            pathSegments.length > 1 &&
            (parsed.hostname.includes("storage.googleapis.com") ||
                parsed.hostname.includes("storage.cloud.google.com"))
        ) {
            return decodeURIComponent(pathSegments.slice(1).join("/"));
        }

        return decodeURIComponent(pathSegments.join("/")) || null;
    } catch {
        return null;
    }
}

export function getFilenameFromBlobPath(blobPath) {
    if (!blobPath) {
        return null;
    }

    const parts = String(blobPath).split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : null;
}

export function inferStorageTargetFromBlobPath(blobPath, userContextId = null) {
    const normalized = toNullableString(blobPath)?.replace(/^\/+/, "") || null;
    const userPrefix = userContextId ? `${userContextId}/` : null;
    const relativePath =
        userPrefix && normalized?.startsWith(userPrefix)
            ? normalized.slice(userPrefix.length)
            : normalized;

    if (!relativePath) {
        return userContextId ? createUserGlobalStorageTarget(userContextId) : null;
    }

    if (relativePath.startsWith("chats/")) {
        const [, chatId] = relativePath.split("/");
        if (userContextId && chatId) {
            return createChatStorageTarget(userContextId, chatId);
        }
    }

    if (relativePath.startsWith("media/") && userContextId) {
        return createMediaStorageTarget(userContextId);
    }

    if (relativePath.startsWith("profile/") && userContextId) {
        return createProfileStorageTarget(userContextId);
    }

    if (relativePath.startsWith("global/") && userContextId) {
        return createUserGlobalStorageTarget(userContextId);
    }

    return userContextId ? createUserGlobalStorageTarget(userContextId) : null;
}

export function inferStorageTargetFromFile(file, userContextId = null) {
    const blobPath = file?.blobPath || extractBlobPathFromUrl(file?.url);

    return inferStorageTargetFromBlobPath(blobPath, userContextId);
}

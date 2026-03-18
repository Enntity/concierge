import {
    buildMediaHelperFileParams,
    resolveStorageTarget,
} from "../../../src/utils/storageTargets.js";

function createHttpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

export async function resolveAuthorizedMediaRouting({
    user,
    routingInput = {},
} = {}) {
    const requestedUserId =
        routingInput.userId ||
        routingInput.userContextId ||
        routingInput.contextId ||
        null;

    if (requestedUserId && requestedUserId !== user.contextId) {
        throw createHttpError(
            403,
            "Not authorized to access files in this context",
        );
    }

    const storageTarget = resolveStorageTarget({
        ...routingInput,
        userId: requestedUserId || user.contextId,
        contextId: user.contextId,
    });

    if (storageTarget.contextId && storageTarget.contextId !== user.contextId) {
        throw createHttpError(
            403,
            "Not authorized to access files in this context",
        );
    }

    return {
        storageTarget,
        routingParams: buildMediaHelperFileParams({ storageTarget }),
    };
}

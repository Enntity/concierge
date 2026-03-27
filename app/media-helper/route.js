import { NextResponse } from "next/server";
import { getCurrentUser } from "../api/utils/auth.js";
import { resolveAuthorizedMediaRouting } from "../api/utils/file-route-utils.js";
import { parseStreamingMultipart } from "../api/utils/upload-utils.js";
import {
    deleteFileFromMediaService,
    deletePrefixFromMediaService,
    importUrlToMediaService,
    listFilesFromMediaService,
    renameFileInMediaService,
    signFileFromMediaService,
    uploadBufferToMediaService,
} from "../api/utils/media-service-utils.js";
import {
    extractBlobPathFromUrl,
    getFilenameFromBlobPath,
    inferStorageTargetFromBlobPath,
} from "../../src/utils/storageTargets.js";

function buildRoutingInput(source) {
    const get = (key) =>
        typeof source?.get === "function" ? source.get(key) : source?.[key];

    return {
        contextId: get("contextId"),
        userId: get("userId"),
        chatId: get("chatId"),
        fileScope: get("fileScope"),
    };
}

function jsonError(message, status = 500, details = null) {
    return NextResponse.json(
        {
            error: message,
            ...(details ? { details } : {}),
        },
        { status },
    );
}

async function requireUser() {
    const user = await getCurrentUser();
    if (!user) {
        return null;
    }
    return user;
}

async function resolveAuthorizedFileTarget({
    user,
    routingInput = {},
    blobPath = null,
} = {}) {
    const normalizedBlobPath = blobPath ? String(blobPath).replace(/^\/+/, "") : null;
    if (
        normalizedBlobPath &&
        (!user?.contextId ||
            !normalizedBlobPath.startsWith(`${user.contextId}/`))
    ) {
        const error = new Error("Not authorized to access files in this context");
        error.status = 403;
        throw error;
    }

    const inferredStorageTarget =
        normalizedBlobPath && user?.contextId
            ? inferStorageTargetFromBlobPath(normalizedBlobPath, user.contextId)
            : null;

    return resolveAuthorizedMediaRouting({
        user,
        routingInput: {
            ...routingInput,
            ...(inferredStorageTarget
                ? { storageTarget: inferredStorageTarget }
                : {}),
        },
    });
}

export async function GET(request) {
    try {
        const user = await requireUser();
        if (!user) {
            return jsonError("Authentication required", 401);
        }

        const { searchParams } = new URL(request.url);
        const routingInput = buildRoutingInput(searchParams);
        const operation = searchParams.get("operation");

        if (operation === "listFolder") {
            const { storageTarget } = await resolveAuthorizedMediaRouting({
                user,
                routingInput,
            });
            const files = await listFilesFromMediaService({ storageTarget });
            return NextResponse.json(files);
        }

        if (operation === "signUrl") {
            const blobPath =
                searchParams.get("blobPath") ||
                extractBlobPathFromUrl(searchParams.get("url"));
            if (!blobPath) {
                return jsonError(
                    "Missing or invalid file reference (provide blobPath)",
                    400,
                );
            }

            await resolveAuthorizedFileTarget({
                user,
                routingInput,
                blobPath,
            });

            const signedFile = await signFileFromMediaService({
                blobPath,
                minutes: parseInt(searchParams.get("minutes"), 10) || 5,
            });
            return NextResponse.json(signedFile);
        }

        const remoteUrl =
            searchParams.get("fetch") ||
            searchParams.get("load") ||
            searchParams.get("restore");
        if (remoteUrl) {
            const { storageTarget } = await resolveAuthorizedMediaRouting({
                user,
                routingInput,
            });
            const result = await importUrlToMediaService(remoteUrl, {
                storageTarget,
            });
            return NextResponse.json(result);
        }

        return jsonError("Missing required operation or parameters", 400);
    } catch (error) {
        if (error.status) {
            return jsonError(error.message, error.status);
        }
        return jsonError(
            "Internal server error while handling media request",
            500,
            error.message,
        );
    }
}

export async function POST(request) {
    try {
        const user = await requireUser();
        if (!user) {
            return jsonError("Authentication required", 401);
        }

        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            const result = await parseStreamingMultipart(request);
            if (result.error) {
                return result.error;
            }

            const { fileBuffer, metadata } = result.data;
            const { storageTarget } = await resolveAuthorizedMediaRouting({
                user,
                routingInput: buildRoutingInput(metadata),
            });
            const uploadResult = await uploadBufferToMediaService(
                fileBuffer,
                metadata,
                { storageTarget },
            );

            if (uploadResult.error) {
                return uploadResult.error;
            }

            return NextResponse.json(uploadResult.data);
        }

        const body = await request.json().catch(() => null);
        if (body?.operation === "rename") {
            const { storageTarget } = await resolveAuthorizedFileTarget({
                user,
                routingInput: buildRoutingInput(body),
                blobPath: body?.blobPath || null,
            });
            const result = await renameFileInMediaService({
                blobPath: body?.blobPath || null,
                filename: body?.filename || null,
                newFilename: body?.newFilename?.trim() || null,
                storageTarget,
            });
            return NextResponse.json(result);
        }

        return jsonError(
            "Expected multipart/form-data for upload or JSON rename payload",
            400,
        );
    } catch (error) {
        if (error.status) {
            return jsonError(error.message, error.status);
        }
        return jsonError(
            "Internal server error while handling media request",
            500,
            error.message,
        );
    }
}

export async function DELETE(request) {
    try {
        const user = await requireUser();
        if (!user) {
            return jsonError("Authentication required", 401);
        }

        const { searchParams } = new URL(request.url);
        const routingInput = buildRoutingInput(searchParams);
        const prefix = searchParams.get("prefix") || searchParams.get("requestId");

        if (prefix) {
            if (
                !user.contextId ||
                !prefix.startsWith(`${user.contextId}/`)
            ) {
                return jsonError(
                    "Not authorized to access files in this context",
                    403,
                );
            }

            const result = await deletePrefixFromMediaService(prefix);
            return NextResponse.json(result);
        }

        const blobPath =
            searchParams.get("blobPath") ||
            extractBlobPathFromUrl(searchParams.get("url"));
        const filename =
            searchParams.get("filename") || getFilenameFromBlobPath(blobPath);

        if (!filename && !blobPath) {
            return jsonError("Please provide filename, blobPath, or prefix", 400);
        }

        const { storageTarget } = await resolveAuthorizedFileTarget({
            user,
            routingInput,
            blobPath,
        });
        await deleteFileFromMediaService({
            blobPath,
            filename,
            storageTarget,
        });

        return NextResponse.json({
            success: true,
            deleted: {
                filename: filename || getFilenameFromBlobPath(blobPath),
                blobPath: blobPath || null,
            },
        });
    } catch (error) {
        if (error.status) {
            return jsonError(error.message, error.status);
        }
        return jsonError(
            "Internal server error while handling media request",
            500,
            error.message,
        );
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

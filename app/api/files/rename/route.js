import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth.js";
import config from "../../../../config/index.js";
import { INVALID_FILENAME_CHARS } from "../../../../src/utils/fileDownloadUtils.js";
import { resolveAuthorizedMediaRouting } from "../../utils/file-route-utils.js";
import { getFilenameFromBlobPath } from "../../../../src/utils/storageTargets.js";

/**
 * POST /api/files/rename
 * Rename a file in folder-backed storage.
 *
 * Body parameters:
 * - blobPath: Blob path within the folder tree (preferred identifier)
 * - filename: Current filename in the resolved folder
 * - newFilename: New filename (required)
 */
export async function POST(request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 },
            );
        }

        const body = await request.json();
        const {
            blobPath,
            filename: filenameParam,
            newFilename,
            contextId,
            userId,
            chatId,
            fileScope,
        } = body;
        const filename = filenameParam || getFilenameFromBlobPath(blobPath);

        if (!filename) {
            return NextResponse.json(
                {
                    error: "filename or blobPath is required for rename",
                },
                { status: 400 },
            );
        }

        if (!newFilename || !newFilename.trim()) {
            return NextResponse.json(
                { error: "newFilename parameter is required" },
                { status: 400 },
            );
        }

        INVALID_FILENAME_CHARS.lastIndex = 0;
        if (INVALID_FILENAME_CHARS.test(newFilename)) {
            return NextResponse.json(
                { error: "Filename contains invalid characters" },
                { status: 400 },
            );
        }

        const mediaHelperUrl = config.endpoints.mediaHelperDirect();
        if (!mediaHelperUrl) {
            return NextResponse.json(
                { error: "Media helper URL is not configured" },
                { status: 500 },
            );
        }

        const { routingParams } = await resolveAuthorizedMediaRouting({
            user,
            routingInput: {
                contextId,
                userId,
                chatId,
                fileScope,
            },
        });

        const renameUrl = new URL(mediaHelperUrl);
        renameUrl.searchParams.set("operation", "rename");

        const renameResponse = await fetch(renameUrl.toString(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...routingParams,
                filename,
                newFilename: newFilename.trim(),
            }),
        });

        if (!renameResponse.ok) {
            const errorBody = await renameResponse.text();
            return NextResponse.json(
                {
                    error: `Failed to rename file: ${renameResponse.statusText}`,
                    details: errorBody,
                },
                { status: renameResponse.status },
            );
        }

        const result = await renameResponse.json();

        return NextResponse.json({
            success: true,
            message: `File renamed to ${newFilename.trim()}`,
            result,
        });
    } catch (error) {
        if (error.status) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }
        console.error("Error renaming file:", error);
        return NextResponse.json(
            {
                error: "Internal server error while renaming file",
                details: error.message,
            },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

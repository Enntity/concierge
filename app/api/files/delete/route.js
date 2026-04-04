import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth.js";
import config from "../../../../config/index.js";
import { resolveAuthorizedMediaRouting } from "../../utils/file-route-utils.js";
import {
    extractBlobPathFromUrl,
    getFilenameFromBlobPath,
} from "../../../../src/utils/storageTargets.js";

/**
 * DELETE /api/files/delete
 * Delete a file from cloud storage using CFH (cortex-file-handler)
 *
 * Query parameters:
 * - blobPath: Blob path within the folder tree (preferred identifier)
 * - filename: Filename within the resolved folder (supported)
 * - contextId: Optional context ID for file scoping (e.g., user.contextId)
 *              If not provided, defaults to user.contextId
 */
export async function DELETE(request) {
    try {
        // Get current user for authentication
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(request.url);
        const blobPath = searchParams.get("blobPath");
        const filenameParam = searchParams.get("filename");
        const routingInput = {
            contextId: searchParams.get("contextId"),
            userId: searchParams.get("userId"),
            chatId: searchParams.get("chatId"),
            fileScope: searchParams.get("fileScope"),
        };
        const filename =
            filenameParam ||
            getFilenameFromBlobPath(blobPath) ||
            getFilenameFromBlobPath(
                extractBlobPathFromUrl(searchParams.get("url")),
            );

        if (!filename) {
            return NextResponse.json(
                {
                    error: "filename or blobPath is required for deletion",
                },
                { status: 400 },
            );
        }

        const mediaHelperUrl = config.endpoints.mediaHelperDirect();
        if (!mediaHelperUrl) {
            console.error(
                "CORTEX_MEDIA_API_URL is not set or mediaHelperUrl is undefined.",
            );
            return NextResponse.json(
                {
                    error: "Media helper URL is not configured. Please set CORTEX_MEDIA_API_URL.",
                },
                { status: 500 },
            );
        }

        const { routingParams } = await resolveAuthorizedMediaRouting({
            user,
            routingInput,
        });

        const deleteUrl = new URL(mediaHelperUrl);
        deleteUrl.searchParams.set("filename", filename);
        for (const [key, value] of Object.entries(routingParams)) {
            deleteUrl.searchParams.set(key, value);
        }

        const deleteResponse = await fetch(deleteUrl.toString(), {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!deleteResponse.ok) {
            const errorBody = await deleteResponse.text();
            console.warn(
                `Failed to delete file: ${deleteResponse.statusText}. Response: ${errorBody}`,
            );
            return NextResponse.json(
                {
                    error: `Failed to delete file: ${deleteResponse.statusText}`,
                    details: errorBody,
                },
                { status: deleteResponse.status },
            );
        }

        const deleteResult = await deleteResponse.json();
        const fileIdentifier = blobPath || filename;
        console.log(`Successfully deleted file ${fileIdentifier}`);

        return NextResponse.json({
            success: true,
            message: `File ${fileIdentifier} deleted successfully`,
            deleted: deleteResult.deleted || deleteResult,
        });
    } catch (error) {
        if (error.status) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }
        console.error("Error deleting file:", error);
        return NextResponse.json(
            {
                error: "Internal server error while deleting file",
                details: error.message,
            },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

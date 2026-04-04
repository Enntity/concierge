import { getCurrentUser } from "../../utils/auth.js";
import MediaItem from "../../models/media-item.mjs";
import {
    createMediaStorageTarget,
    extractBlobPathFromUrl,
    getFilenameFromBlobPath,
    inferStorageTargetFromBlobPath,
} from "../../../../src/utils/storageTargets.js";
import { deleteFileFromMediaService } from "../../utils/media-service-utils.js";

function normalizeMediaItemUpdates(body = {}) {
    const url = body.url || null;
    const blobPath = body.blobPath || extractBlobPathFromUrl(url);
    const filename = body.filename || getFilenameFromBlobPath(blobPath);

    return {
        ...body,
        ...(url ? { url } : {}),
        ...(blobPath ? { blobPath } : {}),
        ...(filename ? { filename } : {}),
    };
}

function serializeMediaItem(mediaItem) {
    const item =
        typeof mediaItem?.toJSON === "function"
            ? mediaItem.toJSON()
            : mediaItem;
    return JSON.parse(JSON.stringify(item));
}

export async function PUT(req, { params }) {
    const user = await getCurrentUser();
    const { id } = params;
    const body = normalizeMediaItemUpdates(await req.json());

    try {
        const mediaItem = await MediaItem.findOneAndUpdate(
            { user: user._id, taskId: id },
            body,
            { new: true, runValidators: true },
        );

        if (!mediaItem) {
            return Response.json(
                { error: "Media item not found" },
                { status: 404 },
            );
        }

        return Response.json(serializeMediaItem(mediaItem));
    } catch (error) {
        console.error("Error updating media item:", error);
        return Response.json(
            { error: "Failed to update media item" },
            { status: 500 },
        );
    }
}

export async function DELETE(req, { params }) {
    const user = await getCurrentUser();
    const { id } = params;

    try {
        const mediaItem = await MediaItem.findOne({
            user: user._id,
            taskId: id,
        });

        if (!mediaItem) {
            return Response.json(
                { error: "Media item not found" },
                { status: 404 },
            );
        }

        const blobPath =
            mediaItem.blobPath || extractBlobPathFromUrl(mediaItem.url);
        const filename =
            mediaItem.filename || getFilenameFromBlobPath(blobPath);
        const storageTarget =
            inferStorageTargetFromBlobPath(blobPath, user.contextId) ||
            createMediaStorageTarget(user.contextId);

        if (filename) {
            try {
                await deleteFileFromMediaService({
                    blobPath,
                    filename,
                    storageTarget,
                });
            } catch (error) {
                console.warn(
                    `Failed to delete media file ${filename}: ${error.message}`,
                );
            }
        }

        await MediaItem.deleteOne({ _id: mediaItem._id });

        return Response.json({ success: true });
    } catch (error) {
        console.error("Error deleting media item:", error);
        return Response.json(
            { error: "Failed to delete media item" },
            { status: 500 },
        );
    }
}

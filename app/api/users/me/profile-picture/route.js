import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../utils/auth.js";
import {
    parseStreamingMultipart,
    uploadBufferToMediaService,
} from "../../../utils/upload-utils.js";
import { deleteFileFromMediaService } from "../../../utils/media-service-utils.js";
import { normalizeProfilePicture } from "../../../utils/image-utils.mjs";
import {
    createProfileStorageTarget,
    extractBlobPathFromUrl,
    getFilenameFromBlobPath,
} from "../../../../../src/utils/storageTargets.js";

/**
 * POST /api/users/me/profile-picture
 * Upload a profile picture
 */
export async function POST(request) {
    try {
        const user = await getCurrentUser(false);
        if (!user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 },
            );
        }

        const profileStorageTarget = createProfileStorageTarget(user.contextId);
        const oldProfilePictureBlobPath =
            user.profilePictureBlobPath ||
            extractBlobPathFromUrl(user.profilePicture);
        const oldProfilePictureFilename =
            user.profilePictureFilename ||
            getFilenameFromBlobPath(oldProfilePictureBlobPath);

        // Parse the streaming multipart data
        const result = await parseStreamingMultipart(request, user);
        if (result.error) {
            return result.error;
        }

        const { fileBuffer, metadata } = result.data;

        // Normalize the image to a standard size (400x400 square)
        let normalizedBuffer;
        try {
            normalizedBuffer = await normalizeProfilePicture(fileBuffer, {
                size: 400,
                quality: 90,
            });
        } catch (error) {
            console.error("Error normalizing profile picture:", error);
            return NextResponse.json(
                {
                    error: "Failed to process image. Please ensure it's a valid image file.",
                },
                { status: 400 },
            );
        }

        // Update metadata for normalized image
        const normalizedMetadata = {
            ...metadata,
            filename: `profile-${Date.now()}.jpg`,
            mimeType: "image/jpeg",
            size: normalizedBuffer.length,
        };

        const uploadResult = await uploadBufferToMediaService(
            normalizedBuffer,
            normalizedMetadata,
            {
                storageTarget: profileStorageTarget,
            },
        );

        if (uploadResult.error) {
            return uploadResult.error;
        }

        const { data } = uploadResult;
        const nextBlobPath = data.blobPath || extractBlobPathFromUrl(data.url);
        const nextFilename =
            data.filename || getFilenameFromBlobPath(nextBlobPath);

        // Update user with new profile picture
        user.profilePicture = data.url;
        user.profilePictureBlobPath = nextBlobPath || undefined;
        user.profilePictureFilename = nextFilename || undefined;
        await user.save();

        // Delete the previous profile picture after the new one is saved.
        if (
            oldProfilePictureBlobPath &&
            oldProfilePictureBlobPath !== nextBlobPath
        ) {
            try {
                await deleteFileFromMediaService({
                    blobPath: oldProfilePictureBlobPath,
                    filename: oldProfilePictureFilename,
                    storageTarget: profileStorageTarget,
                });
            } catch (error) {
                console.error("Error deleting old profile picture:", error);
            }
        }

        return NextResponse.json({
            success: true,
            url: data.url,
            blobPath: user.profilePictureBlobPath,
            filename: user.profilePictureFilename,
        });
    } catch (error) {
        console.error("Error uploading profile picture:", error);
        return NextResponse.json(
            { error: "Failed to upload profile picture" },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/users/me/profile-picture
 * Delete the current user's profile picture
 */
export async function DELETE(request) {
    try {
        const user = await getCurrentUser(false);
        if (!user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 },
            );
        }

        const profilePictureBlobPath =
            user.profilePictureBlobPath ||
            extractBlobPathFromUrl(user.profilePicture);
        const profilePictureFilename =
            user.profilePictureFilename ||
            getFilenameFromBlobPath(profilePictureBlobPath);

        if (!user.profilePicture && !profilePictureBlobPath) {
            return NextResponse.json(
                { error: "No profile picture to delete" },
                { status: 404 },
            );
        }

        if (profilePictureBlobPath || profilePictureFilename) {
            try {
                await deleteFileFromMediaService({
                    blobPath: profilePictureBlobPath,
                    filename: profilePictureFilename,
                    storageTarget: createProfileStorageTarget(user.contextId),
                });
            } catch (error) {
                console.error(
                    "Error deleting profile picture from cloud:",
                    error,
                );
            }
        }

        // Update user model
        user.profilePicture = undefined;
        user.profilePictureBlobPath = undefined;
        user.profilePictureFilename = undefined;
        await user.save();

        return NextResponse.json({
            success: true,
            message: "Profile picture deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting profile picture:", error);
        return NextResponse.json(
            { error: "Failed to delete profile picture" },
            { status: 500 },
        );
    }
}

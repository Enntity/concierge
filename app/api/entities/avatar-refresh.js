import { signFileFromMediaService } from "../utils/media-service-utils.js";
import {
    extractBlobPathFromUrl,
    getFilenameFromBlobPath,
} from "../../../src/utils/storageTargets.js";

export async function refreshManagedImage(image) {
    if (!image || typeof image !== "object") {
        return image;
    }

    const blobPath =
        typeof image.blobPath === "string" && image.blobPath.trim()
            ? image.blobPath.replace(/^\/+/, "")
            : extractBlobPathFromUrl(image.url);

    if (!blobPath) {
        return image;
    }

    const fallbackFilename =
        image.filename || getFilenameFromBlobPath(blobPath) || null;

    try {
        const signedImage = await signFileFromMediaService({ blobPath });
        return {
            ...image,
            url: signedImage.url || image.url || null,
            blobPath,
            filename: signedImage.filename || fallbackFilename,
        };
    } catch (error) {
        console.warn(
            `Failed to refresh managed image ${blobPath}:`,
            error.message,
        );

        return {
            ...image,
            url: null,
            blobPath,
            filename: fallbackFilename,
        };
    }
}

export async function refreshEntityAvatar(entity) {
    if (!entity?.avatar?.image) {
        return entity;
    }

    const nextImage = await refreshManagedImage(entity.avatar.image);
    return {
        ...entity,
        avatar: {
            ...entity.avatar,
            image: nextImage,
        },
    };
}

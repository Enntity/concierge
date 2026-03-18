import { getCurrentUser } from "../../utils/auth";
import {
    findMediaServiceFile,
    listFilesFromMediaService,
} from "../../utils/media-service-utils.js";
import {
    createProfileStorageTarget,
    extractBlobPathFromUrl,
    getFilenameFromBlobPath,
} from "../../../../src/utils/storageTargets.js";

async function serializeUser(user) {
    const userJson = JSON.parse(JSON.stringify(user.toJSON()));
    const blobPath =
        user.profilePictureBlobPath ||
        extractBlobPathFromUrl(user.profilePicture);
    const filename =
        user.profilePictureFilename || getFilenameFromBlobPath(blobPath);

    if (!user.contextId || (!blobPath && !filename)) {
        return userJson;
    }

    try {
        const files = await listFilesFromMediaService({
            storageTarget: createProfileStorageTarget(user.contextId),
        });
        const profileFile = findMediaServiceFile(files, {
            blobPath,
            filename,
        });

        if (profileFile?.url) {
            userJson.profilePicture = profileFile.url;
        }
    } catch (error) {
        console.warn("Failed to refresh profile picture URL:", error.message);
    }

    return userJson;
}

export async function GET() {
    const user = await getCurrentUser(false); // Get the mongoose object, not JSON

    const userJson = await serializeUser(user);
    return Response.json(userJson);
}

export async function PUT(request) {
    try {
        const user = await getCurrentUser(false);
        const data = await request.json();

        if (data.profilePicture !== undefined) {
            user.profilePicture = data.profilePicture;
        }

        await user.save();

        const userJson = await serializeUser(user);
        return Response.json(userJson);
    } catch (error) {
        console.error("Error updating user:", error);
        return Response.json(
            { error: "Failed to update user" },
            { status: 500 },
        );
    }
}

// don't want nextjs to cache this endpoint
export const dynamic = "force-dynamic";

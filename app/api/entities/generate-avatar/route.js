import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";
import { getClient, IMAGE_FLUX } from "../../../../src/graphql";
import { uploadBufferToMediaService } from "../../utils/media-service-utils";
import { createMediaStorageTarget } from "../../../../src/utils/storageTargets.js";

/**
 * POST /api/entities/generate-avatar
 * Generate an avatar image using Flux
 * Then fetch and upload properly to cloud storage
 */
export async function POST(req) {
    try {
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const body = await req.json();
        const { avatarText } = body;

        if (!avatarText || typeof avatarText !== "string") {
            return NextResponse.json(
                { error: "avatarText is required" },
                { status: 400 },
            );
        }

        // Build the prompt for avatar generation
        const prompt = `Portrait avatar for AI companion: ${avatarText}. 
Photo-realistic, centered face, clean background, suitable for profile picture, high quality.`;

        console.log(
            "[GenerateAvatar] Starting generation for:",
            avatarText.substring(0, 50),
        );

        // Call Flux to generate the image
        const client = getClient();
        const response = await client.query({
            query: IMAGE_FLUX,
            variables: {
                text: prompt,
                model: "replicate-flux-2-pro",
                async: false,
                aspectRatio: "1:1",
                resolution: "512",
            },
            fetchPolicy: "network-only",
        });

        // Extract image URL from resultData.artifacts
        const resultData = JSON.parse(response.data?.image_flux?.resultData);
        const imageUrl = resultData?.artifacts?.[0]?.url;

        if (!imageUrl) {
            console.error("[GenerateAvatar] No image URL in artifacts");
            return NextResponse.json(
                { error: "Image generation failed - no image returned" },
                { status: 500 },
            );
        }

        console.log(
            "[GenerateAvatar] Generated image URL:",
            imageUrl.substring(0, 60) + "...",
        );

        // Fetch the image data locally
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            console.error("[GenerateAvatar] Failed to fetch generated image");
            return NextResponse.json(
                { error: "Failed to fetch generated image" },
                { status: 502 },
            );
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        // Determine content type and filename
        const contentType =
            imageResponse.headers.get("content-type") || "image/webp";
        const extension = contentType.includes("webp")
            ? "webp"
            : contentType.includes("png")
              ? "png"
              : "jpg";
        const filename = `avatar-${Date.now()}.${extension}`;

        // Upload avatar to folder-backed media storage.
        const uploadResult = await uploadBufferToMediaService(
            imageBuffer,
            {
                filename,
                mimeType: contentType,
            },
            {
                storageTarget: createMediaStorageTarget(user.contextId),
            },
        );

        if (uploadResult.error) {
            return uploadResult.error;
        }

        const finalUrl = uploadResult.data.url;

        console.log(
            "[GenerateAvatar] Success:",
            finalUrl.substring(0, 50) + "...",
        );

        return NextResponse.json({
            success: true,
            url: finalUrl,
            blobPath: uploadResult.data.blobPath,
            filename: uploadResult.data.filename,
        });
    } catch (error) {
        console.error("[GenerateAvatar] Error:", error.message);
        return NextResponse.json(
            { error: error.message || "Avatar generation failed" },
            { status: 500 },
        );
    }
}

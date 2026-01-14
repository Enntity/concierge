import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";
import { getClient, IMAGE_FLUX } from "../../../../src/graphql";
import {
    hashBuffer,
    uploadBufferToMediaService,
} from "../../utils/media-service-utils";

/**
 * POST /api/entities/generate-avatar
 * Generate an avatar image using Flux
 * Then fetch, hash, and upload properly to cloud storage
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
            return NextResponse.json({
                success: true,
                url: imageUrl, // Fall back to original URL
            });
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const hash = await hashBuffer(imageBuffer);

        // Determine content type and filename
        const contentType =
            imageResponse.headers.get("content-type") || "image/webp";
        const extension = contentType.includes("webp")
            ? "webp"
            : contentType.includes("png")
              ? "png"
              : "jpg";
        const filename = `avatar-${hash.substring(0, 8)}.${extension}`;

        console.log(
            "[GenerateAvatar] Uploading with hash:",
            hash.substring(0, 16),
        );

        // Upload properly with hash to media service
        const uploadResult = await uploadBufferToMediaService(
            imageBuffer,
            {
                filename,
                mimeType: contentType,
                hash,
            },
            false, // not permanent (entity avatars can be regenerated)
            user.contextId,
        );

        if (uploadResult.error) {
            // Fall back to the original URL if upload fails
            console.warn("[GenerateAvatar] Upload failed, using direct URL");
            return NextResponse.json({
                success: true,
                url: imageUrl,
            });
        }

        const finalUrl = uploadResult.data.url || imageUrl;

        console.log(
            "[GenerateAvatar] Success:",
            finalUrl.substring(0, 50) + "...",
        );

        return NextResponse.json({
            success: true,
            url: finalUrl,
            hash: uploadResult.data.hash,
        });
    } catch (error) {
        console.error("[GenerateAvatar] Error:", error.message);
        return NextResponse.json(
            { error: error.message || "Avatar generation failed" },
            { status: 500 },
        );
    }
}

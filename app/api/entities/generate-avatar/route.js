import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";
import { getClient, IMAGE_FLUX } from "../../../../src/graphql";

/**
 * POST /api/entities/generate-avatar
 * Generate an avatar image using Flux
 * Then re-upload to our cloud storage for consistency
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
                model: "replicate-flux-11-pro",
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

        // Re-upload to our cloud storage for consistency and user scoping
        const mediaApiUrl = process.env.CORTEX_MEDIA_API_URL;
        if (!mediaApiUrl) {
            // If no media API, just return the Replicate URL directly
            return NextResponse.json({
                success: true,
                url: imageUrl,
            });
        }

        // Upload the URL to our cloud storage
        const uploadUrl = new URL(mediaApiUrl);
        uploadUrl.searchParams.set("fetch", imageUrl);
        uploadUrl.searchParams.set("contextId", user.contextId);

        const uploadResponse = await fetch(uploadUrl.toString(), {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        if (!uploadResponse.ok) {
            // Fall back to the original URL if upload fails
            console.warn("[GenerateAvatar] Re-upload failed, using direct URL");
            return NextResponse.json({
                success: true,
                url: imageUrl,
            });
        }

        const uploadData = await uploadResponse.json();
        const finalUrl = uploadData.url || uploadData.gcs || imageUrl;

        console.log(
            "[GenerateAvatar] Success:",
            finalUrl.substring(0, 50) + "...",
        );

        return NextResponse.json({
            success: true,
            url: finalUrl,
        });
    } catch (error) {
        console.error("[GenerateAvatar] Error:", error.message);
        return NextResponse.json(
            { error: error.message || "Avatar generation failed" },
            { status: 500 },
        );
    }
}

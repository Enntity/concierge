import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";

/**
 * GET /api/voices/preview?provider=X&voiceId=Y&text=Z
 * Proxy to voice server's TTS preview endpoint.
 * Generates an MP3 clip of the given text spoken by the specified voice.
 */
export async function GET(request) {
    try {
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(request.url);
        const provider = searchParams.get("provider");
        const voiceId = searchParams.get("voiceId");
        const text = searchParams.get("text");

        if (!provider || !voiceId || !text) {
            return NextResponse.json(
                { error: "provider, voiceId, and text are required" },
                { status: 400 },
            );
        }

        const voiceServerUrl = process.env.VOICE_SERVER_URL?.trim();
        if (!voiceServerUrl) {
            return NextResponse.json(
                { error: "Voice server not configured" },
                { status: 503 },
            );
        }

        const params = new URLSearchParams({ provider, voiceId, text });
        const response = await fetch(
            `${voiceServerUrl}/voices/preview?${params.toString()}`,
            {
                headers: {
                    "x-auth-secret": process.env.VOICE_AUTH_SECRET || "",
                },
            },
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error(
                `[api/voices/preview] Voice server error: ${response.status} - ${errorText}`,
            );
            return NextResponse.json(
                { error: "Failed to generate preview" },
                { status: response.status },
            );
        }

        const audioBuffer = await response.arrayBuffer();
        const contentType =
            response.headers.get("content-type") || "audio/mpeg";

        return new NextResponse(audioBuffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400",
            },
        });
    } catch (error) {
        console.error("[api/voices/preview] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate preview" },
            { status: 500 },
        );
    }
}

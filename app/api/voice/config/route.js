/**
 * Voice configuration API endpoint
 * Returns the URL of the voice server for client connection
 */

export async function GET() {
    // Trim whitespace from URL - trailing spaces cause socket.io namespace issues
    const voiceServerUrl = process.env.VOICE_SERVER_URL?.trim();

    if (!voiceServerUrl) {
        return Response.json(
            { error: "Voice server URL not configured" },
            { status: 503 }
        );
    }

    // Validate URL format
    try {
        new URL(voiceServerUrl);
    } catch {
        console.error(`[voice/config] Invalid VOICE_SERVER_URL: "${process.env.VOICE_SERVER_URL}"`);
        return Response.json(
            { error: "Invalid voice server URL configuration" },
            { status: 500 }
        );
    }

    return Response.json({
        voiceServerUrl,
        // Additional config can be added here as needed
        sampleRate: 24000,
        features: {
            interruption: true,
            transcription: true,
        },
    });
}

// Don't cache this endpoint
export const dynamic = "force-dynamic";

/**
 * Voice configuration API endpoint
 * Returns the URL of the voice server for client connection
 */

export async function GET() {
    const voiceServerUrl = process.env.VOICE_SERVER_URL;

    if (!voiceServerUrl) {
        return Response.json(
            { error: "Voice server URL not configured" },
            { status: 503 }
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

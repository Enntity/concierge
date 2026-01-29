import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";

/**
 * GET /api/voices/elevenlabs
 * List available ElevenLabs voices
 *
 * Returns: Array of voices with voice_id, name, category, labels, preview_url
 * Keeps API key server-side for security
 */
export async function GET() {
    try {
        // Require authentication
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "ElevenLabs API key not configured" },
                { status: 503 },
            );
        }

        // Fetch voices from ElevenLabs API
        const response = await fetch("https://api.elevenlabs.io/v1/voices", {
            headers: {
                "xi-api-key": apiKey,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(
                `[voices/elevenlabs] ElevenLabs API error: ${response.status} - ${errorText}`,
            );
            return NextResponse.json(
                { error: "Failed to fetch voices from ElevenLabs" },
                { status: 502 },
            );
        }

        const data = await response.json();

        // Transform to only include fields we need
        const voices = (data.voices || []).map((voice) => ({
            voice_id: voice.voice_id,
            name: voice.name,
            category: voice.category,
            labels: voice.labels || {},
            preview_url: voice.preview_url,
            description: voice.description,
        }));

        // Sort by name for consistent ordering
        voices.sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({
            voices,
            count: voices.length,
        });
    } catch (error) {
        console.error("[voices/elevenlabs] Error fetching voices:", error);
        return NextResponse.json(
            { error: "Failed to fetch voices" },
            { status: 500 },
        );
    }
}

// Cache for 5 minutes since voice lists don't change frequently
export const revalidate = 300;

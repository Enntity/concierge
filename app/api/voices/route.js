import { NextResponse } from "next/server";
import { getCurrentUser } from "../utils/auth";

/**
 * GET /api/voices
 * Proxy to voice server's unified voice listing endpoint.
 * Returns all available voices across all configured providers.
 */
export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const voiceServerUrl = process.env.VOICE_SERVER_URL?.trim();
        if (!voiceServerUrl) {
            return NextResponse.json(
                { error: "Voice server not configured" },
                { status: 503 },
            );
        }

        const response = await fetch(`${voiceServerUrl}/voices`, {
            headers: {
                "Content-Type": "application/json",
                "x-auth-secret":
                    process.env.VOICE_AUTH_SECRET ||
                    process.env.AUTH_SECRET ||
                    "",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(
                `[api/voices] Voice server error: ${response.status} - ${errorText}`,
            );
            return NextResponse.json(
                { error: "Failed to fetch voices from voice server" },
                { status: 502 },
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("[api/voices] Error fetching voices:", error);
        return NextResponse.json(
            { error: "Failed to fetch voices" },
            { status: 500 },
        );
    }
}

// Cache for 5 minutes since voice lists don't change frequently
export const revalidate = 300;

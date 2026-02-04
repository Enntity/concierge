import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";
import { getClient, QUERIES } from "../../../../src/graphql";

/**
 * POST /api/voices/greeting
 * Generate a short greeting from an entity for voice preview purposes.
 * The greeting text is then used as the sample phrase for TTS previews.
 *
 * Body: { entityId: string }
 * Returns: { text: string }
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

        const { entityId, entityName } = await req.json();
        if (!entityId) {
            return NextResponse.json(
                { error: "entityId is required" },
                { status: 400 },
            );
        }

        const client = await getClient();

        const nameClause = entityName
            ? ` Your name is ${entityName} — use that name, not any other.`
            : "";
        const prompt = `Generate a very short, friendly one-sentence greeting introducing yourself.${nameClause} Be natural and match your personality. Just output the greeting text, nothing else. Keep it under 15 words.`;

        const result = await client.query({
            query: QUERIES.SYS_ENTITY_AGENT,
            variables: {
                chatHistory: [{ role: "user", content: prompt }],
                message: "",
                contextId: user.contextId,
                entityId,
                stream: false,
            },
        });

        const text = result.data?.sys_entity_agent?.result;

        if (!text) {
            // Fallback if LLM fails
            return NextResponse.json({
                text: "Hi there! Great to meet you.",
            });
        }

        // Strip quotes if the model wrapped the greeting in them
        const cleaned = text.replace(/^["']+|["']+$/g, "").trim();

        return NextResponse.json({ text: cleaned });
    } catch (error) {
        console.error("[api/voices/greeting] Error:", error);
        return NextResponse.json({
            text: "Hi there! Great to meet you.",
        });
    }
}

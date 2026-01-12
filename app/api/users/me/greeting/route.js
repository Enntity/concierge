import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../utils/auth";
import { getClient, QUERIES } from "../../../../../src/graphql";

export async function GET(req) {
    try {
        const user = await getCurrentUser();

        if (!user?.defaultEntityId) {
            return NextResponse.json({ greeting: null });
        }

        const client = await getClient();

        // Get current time info for the greeting
        const now = new Date();
        const hour = now.getHours();
        const timeOfDay =
            hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
        const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

        const userName = user.name?.split(" ")[0] || "friend";
        const prompt = `Generate a warm, friendly greeting (1-2 sentences) for ${userName}'s home dashboard. It's ${timeOfDay} on ${dayOfWeek}. 

This is NOT a chat interface - do NOT offer assistance or ask how you can help. Instead, greet them like a friend would, acknowledge the time of day, and let them know their personalized content is ready below.

Examples of good greetings:
- "Hey ${userName}! Hope your ${dayOfWeek} ${timeOfDay} is off to a great start. Here's what I've put together for you."
- "Good ${timeOfDay}, ${userName}! Ready to catch up? I've got your updates waiting below."
- "${dayOfWeek} ${timeOfDay}s are the best. Welcome back, ${userName} - let's see what's new."

Be casual, warm, and natural. Vary your style. Keep it brief. Just output the greeting, nothing else.`;

        const result = await client.query({
            query: QUERIES.SYS_ENTITY_AGENT,
            variables: {
                chatHistory: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                message: "",
                contextId: user.contextId,
                entityId: user.defaultEntityId,
                stream: false,
            },
        });

        const greeting = result.data?.sys_entity_agent?.result;

        return NextResponse.json({ greeting });
    } catch (error) {
        console.error("Error generating greeting:", error.message);
        return NextResponse.json({ greeting: null });
    }
}

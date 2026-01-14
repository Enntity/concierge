import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../utils/auth";
import { getClient, QUERIES } from "../../../../../src/graphql";

// Generate a simple fallback greeting when AI greeting fails
function getFallbackGreeting(user) {
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay =
        hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const userName = user?.name?.split(" ")[0] || "there";

    // Format date nicely: "Monday, January 13"
    const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
    });

    return `Good ${timeOfDay}, ${userName}! It's ${dateStr}.`;
}

export async function POST(req) {
    let user;

    try {
        user = await getCurrentUser();
        const body = await req.json();
        const { userInfo } = body;

        console.log(
            "[Greeting] User:",
            user?._id,
            "defaultEntityId:",
            user?.defaultEntityId,
        );

        // Use defaultEntityId, or fall back to first available entity
        let entityId = user?.defaultEntityId;

        if (!entityId) {
            console.log(
                "[Greeting] No defaultEntityId, fetching fallback entity...",
            );
            // Try to get the user's first non-system entity as fallback
            try {
                const baseUrl =
                    process.env.NEXTAUTH_URL || "http://localhost:3000";
                const cookies = req.headers.get("cookie") || "";
                const entitiesResponse = await fetch(
                    `${baseUrl}/api/entities?includeSystem=false`,
                    {
                        headers: { cookie: cookies },
                    },
                );
                console.log(
                    "[Greeting] Entities response status:",
                    entitiesResponse.status,
                );
                if (entitiesResponse.ok) {
                    const entities = await entitiesResponse.json();
                    console.log(
                        "[Greeting] Found",
                        entities?.length,
                        "entities",
                    );
                    if (entities?.length > 0) {
                        entityId = entities[0].id;
                        console.log(
                            "[Greeting] Using fallback entityId:",
                            entityId,
                        );
                    }
                }
            } catch (e) {
                console.error(
                    "[Greeting] Error fetching fallback entity:",
                    e.message,
                );
            }
        }

        if (!entityId) {
            console.log(
                "[Greeting] No entityId available, using static fallback",
            );
            // No entity available, use simple fallback greeting
            return NextResponse.json({ greeting: getFallbackGreeting(user) });
        }

        const client = await getClient();

        // Parse userInfo to get time of day info, fallback to server time if not provided
        let timeOfDay = "day";
        let dayOfWeek = "today";
        if (userInfo) {
            try {
                const parsed = JSON.parse(userInfo);
                timeOfDay = parsed?.datetime?.timeOfDay || "day";
                dayOfWeek = parsed?.datetime?.dayOfWeek || "today";
            } catch (e) {
                // Use server time as fallback
                const now = new Date();
                const hour = now.getHours();
                timeOfDay =
                    hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
                dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
            }
        } else {
            // Use server time as fallback
            const now = new Date();
            const hour = now.getHours();
            timeOfDay =
                hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
            dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
        }

        const userName = user.name?.split(" ")[0] || "friend";
        const prompt = `Generate a warm, friendly greeting (1-2 sentences) for ${userName}'s home dashboard. It's ${timeOfDay} on ${dayOfWeek}. 

This is NOT a chat interface - do NOT offer assistance or ask how you can help. Instead, greet them like a friend would, acknowledge the time of day, and let them know their personalized content is ready below.

Examples of good greetings:
- "Hey ${userName}! Hope your ${dayOfWeek} ${timeOfDay} is off to a great start. Here's what I've put together for you."
- "Good ${timeOfDay}, ${userName}! Ready to catch up? I've got your updates waiting below."
- "${dayOfWeek} ${timeOfDay}s are the best. Welcome back, ${userName} - let's see what's new."

Be casual, warm, and natural. Vary your style. Keep it brief. Just output the greeting, nothing else.`;

        console.log(
            "[Greeting] Calling SYS_ENTITY_AGENT with entityId:",
            entityId,
            "contextId:",
            user.contextId,
        );
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
                entityId: entityId,
                stream: false,
                userInfo,
            },
        });

        const greeting = result.data?.sys_entity_agent?.result;
        const errors = result.data?.sys_entity_agent?.errors;

        if (errors?.length) {
            console.error("[Greeting] AI returned errors:", errors);
        }

        // If AI greeting failed, use fallback
        if (!greeting) {
            console.log(
                "[Greeting] AI returned null/empty, using fallback. Full result:",
                JSON.stringify(result.data?.sys_entity_agent),
            );
            return NextResponse.json({ greeting: getFallbackGreeting(user) });
        }

        console.log("[Greeting] Success, greeting length:", greeting.length);
        return NextResponse.json({ greeting });
    } catch (error) {
        console.error(
            "[Greeting] Error generating greeting:",
            error.message,
            error.stack,
        );
        // Return fallback greeting instead of null
        return NextResponse.json({ greeting: getFallbackGreeting(user) });
    }
}

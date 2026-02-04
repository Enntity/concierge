import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../src/db.mjs";
import { getClient, QUERIES } from "../../../../src/graphql";
import { verifyMobileToken } from "../../utils/mobile-auth";
import User from "../../models/user";

/**
 * GET /api/mobile/entities
 * Get entities for mobile user
 *
 * Headers:
 * - Authorization: Bearer <token>
 *
 * Query params:
 * - includeSystem: boolean (default: false)
 */
export async function GET(request) {
    console.log("[mobile/entities] Request received");
    try {
        // Verify token
        const payload = await verifyMobileToken(request);
        if (!payload) {
            return NextResponse.json(
                { error: "Missing or invalid authorization" },
                { status: 401 },
            );
        }

        console.log("[mobile/entities] Token verified");

        const { contextId } = payload;
        if (!contextId) {
            return NextResponse.json(
                { error: "Invalid token: missing contextId" },
                { status: 401 },
            );
        }

        await connectToDatabase();

        // Verify user still exists and is not blocked
        const user = await User.findOne({ contextId: payload.contextId });
        if (!user || user.blocked) {
            return NextResponse.json(
                { error: "Account not found or blocked" },
                { status: 403 },
            );
        }

        const { searchParams } = new URL(request.url);
        // Default to excluding system entities - only show user's contact list
        const includeSystem = searchParams.get("includeSystem") === "true";

        // Get entities from cortex via GraphQL
        try {
            console.log(
                "[mobile/entities] Fetching entities for contextId:",
                contextId,
                "includeSystem:",
                includeSystem,
            );
            const graphqlClient = getClient();
            const result = await graphqlClient.query({
                query: QUERIES.SYS_GET_ENTITIES,
                variables: {
                    contextId: contextId,
                    includeSystem: includeSystem,
                },
                fetchPolicy: "network-only",
            });

            const resultStr = result?.data?.sys_get_entities?.result;
            // Result comes as JSON string from GraphQL
            const entities = resultStr ? JSON.parse(resultStr) : [];
            console.log(
                "[mobile/entities] Parsed entities count:",
                entities.length,
            );

            // Transform to simplified format for mobile
            const mobileEntities = entities.map((entity) => ({
                id: entity.id,
                name: entity.name,
                displayName: entity.displayName || entity.name,
                avatarUrl: entity.avatar?.imageUrl || entity.avatarUrl,
                voiceId:
                    Array.isArray(entity.voice) && entity.voice.length > 0
                        ? entity.voice[0].voiceId
                        : entity.voiceId,
                description: entity.description,
                isSystem: entity.isSystem || false,
            }));

            console.log(
                "[mobile/entities] Returning",
                mobileEntities.length,
                "entities",
            );
            return NextResponse.json({ entities: mobileEntities });
        } catch (graphqlError) {
            console.error("[mobile/entities] GraphQL error:", graphqlError);
            return NextResponse.json(
                { error: "Failed to fetch entities", entities: [] },
                { status: 500 },
            );
        }
    } catch (error) {
        console.error("Mobile entities error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}

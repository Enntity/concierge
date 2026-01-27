import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import dbConnect from "../../../../src/lib/dbConnect";
import { getClient, QUERIES } from "../../../../src/graphql";

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
    try {
        // Verify token
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "Missing or invalid authorization header" },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

        let payload;
        try {
            const result = await jwtVerify(token, secret);
            payload = result.payload;
        } catch (err) {
            return NextResponse.json(
                { error: "Invalid or expired token" },
                { status: 401 }
            );
        }

        const { contextId } = payload;
        if (!contextId) {
            return NextResponse.json(
                { error: "Invalid token: missing contextId" },
                { status: 401 }
            );
        }

        await dbConnect();

        const { searchParams } = new URL(request.url);
        const includeSystem = searchParams.get("includeSystem") === "true";

        // Get entities from cortex via GraphQL
        try {
            const graphqlClient = getClient();
            const result = await graphqlClient.query({
                query: QUERIES.SYS_GET_ENTITIES,
                variables: {
                    contextId: contextId,
                    includeSystem: includeSystem,
                },
                fetchPolicy: "network-only",
            });

            const entities = result?.data?.sys_get_entities?.result || [];

            // Transform to simplified format for mobile
            const mobileEntities = entities.map(entity => ({
                id: entity.entityId,
                name: entity.name,
                displayName: entity.displayName || entity.name,
                avatarUrl: entity.avatarUrl,
                voiceId: entity.voiceId,
                description: entity.description,
                isSystem: entity.isSystem || false,
            }));

            return NextResponse.json({ entities: mobileEntities });
        } catch (graphqlError) {
            console.error("GraphQL error fetching entities:", graphqlError);
            return NextResponse.json(
                { error: "Failed to fetch entities", entities: [] },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error("Mobile entities error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "../utils/auth";
import { getEntitiesCollection, isValidEntityId } from "./_lib";

/**
 * GET /api/entities
 * Get all entities for the current user
 * Query params:
 * - includeSystem: boolean (default: false) - Include system entities
 * - entityId: string (optional) - Get a specific entity by ID
 */
export async function GET(req) {
    try {
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(req.url);
        const includeSystem = searchParams.get("includeSystem") === "true";
        const entityId = searchParams.get("entityId");

        // Validate entityId if provided
        if (entityId && !isValidEntityId(entityId)) {
            return NextResponse.json(
                { error: "Invalid entity ID format" },
                { status: 400 },
            );
        }

        // Get MongoDB collection
        let client;
        try {
            const result = await getEntitiesCollection();
            client = result.client;
            const { collection } = result;

            let entities;

            if (entityId) {
                // Get specific entity by ID
                const entity = await collection.findOne({ id: entityId });
                if (!entity) {
                    return NextResponse.json(
                        { error: "Entity not found" },
                        { status: 404 },
                    );
                }

                // Check access permissions
                if (
                    !entity.isSystem &&
                    (!entity.assocUserIds ||
                        !Array.isArray(entity.assocUserIds) ||
                        !entity.assocUserIds.includes(user.contextId))
                ) {
                    return NextResponse.json(
                        { error: "Unauthorized" },
                        { status: 403 },
                    );
                }

                const { _id, ...entityData } = entity;
                entities = [entityData]; // Always return array for consistency
            } else {
                // Build query for all entities
                const query = {};

                // Filter by user association
                if (includeSystem) {
                    // Include system entities and user-associated entities
                    query.$or = [
                        { isSystem: true }, // System entities always accessible
                        {
                            isSystem: { $ne: true },
                            assocUserIds: {
                                $exists: true,
                                $ne: [],
                                $in: [user.contextId],
                            },
                        },
                    ];
                } else {
                    // Only user-associated entities (exclude system entities)
                    query.isSystem = { $ne: true };
                    query.assocUserIds = {
                        $exists: true,
                        $ne: [],
                        $in: [user.contextId],
                    };
                }

                const entitiesArray = await collection.find(query).toArray();
                entities = entitiesArray.map((e) => {
                    const { _id, ...entityData } = e;
                    return entityData;
                });
            }

            return NextResponse.json(entities);
        } finally {
            if (client) {
                await client.close().catch(console.error);
            }
        }
    } catch (error) {
        console.error("Error fetching entities:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch entities" },
            { status: 500 },
        );
    }
}

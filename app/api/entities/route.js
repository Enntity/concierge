import { NextResponse } from "next/server";
import { getCurrentUser } from "../utils/auth";
import { getEntitiesCollection, isValidEntityId } from "./_lib";
import { getClient, QUERIES } from "../../../src/graphql";

/**
 * GET /api/entities
 * Get all entities for the current user via cortex sys_get_entities pathway
 * This ensures data is read from cortex's synchronized cache
 *
 * Query params:
 * - includeSystem: boolean (default: false) - Include system entities
 * - entityId: string (optional) - Get a specific entity by ID (falls back to MongoDB)
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

        // If requesting a specific entity, use MongoDB for now
        // (sys_get_entities returns all entities, not optimized for single entity lookup)
        if (entityId) {
            return await getEntityFromMongoDB(entityId, user.contextId);
        }

        // Try cortex pathway first for consistent data from synchronized cache
        try {
            const graphqlClient = getClient();
            const result = await graphqlClient.query({
                query: QUERIES.SYS_GET_ENTITIES,
                variables: {
                    contextId: user.contextId,
                    includeSystem: includeSystem,
                },
                fetchPolicy: "network-only",
            });

            const pathwayResult = result.data?.sys_get_entities?.result;
            if (pathwayResult) {
                // Parse the JSON result from the pathway
                let entities;
                try {
                    entities =
                        typeof pathwayResult === "string"
                            ? JSON.parse(pathwayResult)
                            : pathwayResult;
                } catch (e) {
                    console.error(
                        "Failed to parse sys_get_entities response:",
                        e,
                    );
                    // Fall through to MongoDB fallback
                    throw new Error("Invalid response from cortex");
                }

                // Check for error response
                if (entities.error) {
                    console.error(
                        "sys_get_entities returned error:",
                        entities.error,
                    );
                    throw new Error(entities.error);
                }

                return NextResponse.json(entities);
            }
        } catch (cortexError) {
            console.warn(
                "Cortex sys_get_entities failed, falling back to MongoDB:",
                cortexError.message,
            );
            // Fall through to MongoDB fallback
        }

        // Fallback: Direct MongoDB access if cortex is unavailable
        return await getEntitiesFromMongoDB(user.contextId, includeSystem);
    } catch (error) {
        console.error("Error fetching entities:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch entities" },
            { status: 500 },
        );
    }
}

/**
 * Fallback: Get a single entity from MongoDB
 */
async function getEntityFromMongoDB(entityId, contextId) {
    let client;
    try {
        const result = await getEntitiesCollection();
        client = result.client;
        const { collection } = result;

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
                !entity.assocUserIds.includes(contextId))
        ) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 403 },
            );
        }

        const { _id, ...entityData } = entity;
        // Strip encrypted secret values — only expose key names
        if (entityData.secrets) {
            entityData.secretKeys = Object.keys(entityData.secrets);
            delete entityData.secrets;
        }
        return NextResponse.json([entityData]); // Always return array for consistency
    } finally {
        if (client) {
            await client.close().catch(console.error);
        }
    }
}

/**
 * Fallback: Get all entities from MongoDB
 */
async function getEntitiesFromMongoDB(contextId, includeSystem) {
    let client;
    try {
        const result = await getEntitiesCollection();
        client = result.client;
        const { collection } = result;

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
                        $in: [contextId],
                    },
                },
            ];
        } else {
            // Only user-associated entities (exclude system entities)
            query.isSystem = { $ne: true };
            query.assocUserIds = {
                $exists: true,
                $ne: [],
                $in: [contextId],
            };
        }

        const entitiesArray = await collection.find(query).toArray();
        const entities = entitiesArray.map((e) => {
            const { _id, ...entityData } = e;
            // Strip encrypted secret values — only expose key names
            if (entityData.secrets) {
                entityData.secretKeys = Object.keys(entityData.secrets);
                delete entityData.secrets;
            }
            return entityData;
        });

        return NextResponse.json(entities);
    } finally {
        if (client) {
            await client.close().catch(console.error);
        }
    }
}

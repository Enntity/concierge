import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../utils/auth";
import { getContinuityMemoriesCollection, isValidEntityId } from "./_lib";
import { randomUUID } from "crypto";
import { getClient, MUTATIONS } from "../../../../../src/graphql";

/**
 * GET /api/entities/[entityId]/memory
 * Get all continuity memories for an entity and user context
 */
export async function GET(req, { params }) {
    try {
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { entityId } = params;
        if (!entityId || !isValidEntityId(entityId)) {
            return NextResponse.json(
                { error: "Invalid entity ID" },
                { status: 400 },
            );
        }

        // Get MongoDB collection (uses shared mongoose connection with CSFLE)
        const { collection } = await getContinuityMemoriesCollection();

        // Query memories for this entity and user context
        // Security: Always filter by entityId AND userId in assocEntityIds array
        // Memories are partitioned by entityId, and userId (contextId) must be in assocEntityIds array
        const query = {
            entityId: entityId,
            assocEntityIds: user.contextId, // MongoDB query: field contains value (array contains)
        };

        const memories = await collection.find(query).toArray();

        // Debug logging (can be removed in production)
        if (process.env.NODE_ENV === "development") {
            console.log(
                `[Continuity Memory] Query:`,
                JSON.stringify(query),
                `found ${memories.length} memories`,
            );
            // Also check total count for this entity (across all users) for debugging
            const totalForEntity = await collection.countDocuments({
                entityId,
            });
            console.log(
                `[Continuity Memory] Total memories for entity ${entityId}: ${totalForEntity}`,
            );
        }

        // Keep vectors in response but show placeholder in UI (not editable)
        // Vectors are needed for export/import to be idempotent
        const sanitizedMemories = memories.map((memory) => {
            // Return full memory including vector
            return memory;
        });

        return NextResponse.json({
            success: true,
            memories: sanitizedMemories,
        });
    } catch (error) {
        console.error("Error fetching continuity memories:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch memories" },
            { status: 500 },
        );
    }
}

/**
 * POST /api/entities/[entityId]/memory
 * Create a new continuity memory
 */
export async function POST(req, { params }) {
    try {
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { entityId } = params;
        if (!entityId || !isValidEntityId(entityId)) {
            return NextResponse.json(
                { error: "Invalid entity ID" },
                { status: 400 },
            );
        }

        const body = await req.json();
        const {
            id,
            contentVector,
            entityId: bodyEntityId,
            userId: bodyUserId,
            ...memoryData
        } = body;

        // Security: Always set entityId and add userId to assocEntityIds array from params/auth, never from request body
        // Also explicitly reject contentVector, entityId, and userId from body
        const now = new Date().toISOString();

        // Validate memory type
        const validTypes = [
            "CORE",
            "CORE_EXTENSION",
            "CAPABILITY",
            "ANCHOR",
            "ARTIFACT",
            "IDENTITY",
            "EXPRESSION",
            "VALUE",
            "EPISODE",
        ];
        const memoryType = memoryData.type || "ANCHOR";
        if (!validTypes.includes(memoryType)) {
            return NextResponse.json(
                {
                    error: `Invalid memory type. Must be one of: ${validTypes.join(", ")}`,
                },
                { status: 400 },
            );
        }

        // Validate importance (1-10)
        const importance = memoryData.importance || 5;
        if (
            typeof importance !== "number" ||
            importance < 1 ||
            importance > 10
        ) {
            return NextResponse.json(
                { error: "Importance must be a number between 1 and 10" },
                { status: 400 },
            );
        }

        // Get MongoDB collection (uses shared mongoose connection with CSFLE)
        const { collection } = await getContinuityMemoriesCollection();

        // Use cortex pathway to store memory (generates embeddings and stores in MongoDB)
        if (memoryData.content && memoryData.content.trim()) {
            try {
                const graphqlClient = getClient();
                const storeResult = await graphqlClient.mutate({
                    mutation: MUTATIONS.SYS_STORE_CONTINUITY_MEMORY,
                    variables: {
                        entityId: entityId,
                        userId: user.contextId,
                        content: memoryData.content,
                        memoryType: memoryType,
                        importance: importance,
                        tags: Array.isArray(memoryData.tags)
                            ? memoryData.tags
                            : [],
                        emotionalValence: memoryData.emotionalState || null,
                        emotionalIntensity:
                            typeof memoryData.emotionalState === "object" &&
                            memoryData.emotionalState?.intensity
                                ? memoryData.emotionalState.intensity
                                : 0.5,
                        skipDedup: false,
                    },
                    fetchPolicy: "network-only",
                });

                // Pathway handles storage - result contains success/error info
                const pathwayResult =
                    storeResult.data?.sys_store_continuity_memory?.result;
                let pathwaySuccess = false;
                if (pathwayResult) {
                    try {
                        const parsed =
                            typeof pathwayResult === "string"
                                ? JSON.parse(pathwayResult)
                                : pathwayResult;
                        pathwaySuccess = parsed.success === true;
                        if (parsed.error) {
                            console.error(
                                "Pathway returned error:",
                                parsed.error,
                            );
                        }
                    } catch (e) {
                        // Result might not be JSON, that's fine
                    }
                }

                if (!pathwaySuccess) {
                    throw new Error("Pathway returned unsuccessful result");
                }

                // Pathway has stored the memory, fetch it to return to client
                // The pathway generates the ID, so we need to query by content and timestamp
                // For now, let's just return success - the client can refetch if needed
                return NextResponse.json({
                    success: true,
                    message: "Memory stored successfully",
                });
            } catch (error) {
                console.error(
                    "Error storing memory via cortex pathway:",
                    error,
                );
                // Fallback: Store directly in MongoDB without embedding
                // This allows the editor to work even if cortex is unavailable
                const memory = {
                    id: id || randomUUID(),
                    entityId,
                    assocEntityIds: [user.contextId],
                    type: memoryType,
                    content: memoryData.content || "",
                    contentVector: null,
                    relatedMemoryIds: Array.isArray(memoryData.relatedMemoryIds)
                        ? memoryData.relatedMemoryIds
                        : [],
                    parentMemoryId: memoryData.parentMemoryId || null,
                    tags: Array.isArray(memoryData.tags) ? memoryData.tags : [],
                    timestamp: memoryData.timestamp || now,
                    lastAccessed: now,
                    recallCount:
                        typeof memoryData.recallCount === "number"
                            ? memoryData.recallCount
                            : 0,
                    importance,
                    confidence:
                        typeof memoryData.confidence === "number"
                            ? Math.max(0, Math.min(1, memoryData.confidence))
                            : 0.8,
                    decayRate:
                        typeof memoryData.decayRate === "number"
                            ? Math.max(0, Math.min(1, memoryData.decayRate))
                            : 0.1,
                    emotionalState: memoryData.emotionalState || null,
                    relationalContext: memoryData.relationalContext || null,
                    synthesizedFrom: Array.isArray(memoryData.synthesizedFrom)
                        ? memoryData.synthesizedFrom
                        : null,
                    synthesisType: memoryData.synthesisType || null,
                };
                await collection.insertOne(memory);
                return NextResponse.json({
                    success: true,
                    memory: memory,
                    warning:
                        "Memory stored without embedding (cortex pathway unavailable)",
                });
            }
        } else {
            // Empty content - store directly in MongoDB
            const memory = {
                id: id || randomUUID(),
                entityId,
                assocEntityIds: [user.contextId],
                type: memoryType,
                content: memoryData.content || "",
                contentVector: null,
                relatedMemoryIds: Array.isArray(memoryData.relatedMemoryIds)
                    ? memoryData.relatedMemoryIds
                    : [],
                parentMemoryId: memoryData.parentMemoryId || null,
                tags: Array.isArray(memoryData.tags) ? memoryData.tags : [],
                timestamp: memoryData.timestamp || now,
                lastAccessed: now,
                recallCount:
                    typeof memoryData.recallCount === "number"
                        ? memoryData.recallCount
                        : 0,
                importance,
                confidence:
                    typeof memoryData.confidence === "number"
                        ? Math.max(0, Math.min(1, memoryData.confidence))
                        : 0.8,
                decayRate:
                    typeof memoryData.decayRate === "number"
                        ? Math.max(0, Math.min(1, memoryData.decayRate))
                        : 0.1,
                emotionalState: memoryData.emotionalState || null,
                relationalContext: memoryData.relationalContext || null,
                synthesizedFrom: Array.isArray(memoryData.synthesizedFrom)
                    ? memoryData.synthesizedFrom
                    : null,
                synthesisType: memoryData.synthesisType || null,
            };
            await collection.insertOne(memory);
            const storedMemory = await collection.findOne({
                id: memory.id,
            });

            // Return created memory (vectors included for export/import)
            return NextResponse.json({
                success: true,
                memory: storedMemory || memory,
            });
        }
    } catch (error) {
        console.error("Error creating continuity memory:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create memory" },
            { status: 500 },
        );
    }
}

/**
 * PUT /api/entities/[entityId]/memory
 * Bulk update continuity memories (for import/export)
 */
export async function PUT(req, { params }) {
    try {
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { entityId } = params;
        if (!entityId || !isValidEntityId(entityId)) {
            return NextResponse.json(
                { error: "Invalid entity ID" },
                { status: 400 },
            );
        }

        const body = await req.json();
        const { memories } = body;

        if (!Array.isArray(memories)) {
            return NextResponse.json(
                { error: "memories must be an array" },
                { status: 400 },
            );
        }

        // Get MongoDB collection (uses shared mongoose connection with CSFLE)
        const { collection } = await getContinuityMemoriesCollection();

        // Delete all existing memories for this entity/user
        await collection.deleteMany({
            entityId,
            assocEntityIds: user.contextId, // MongoDB query: array contains
        });

        // Insert new memories (with security: always set entityId and userId)
        const now = new Date().toISOString();
        const validTypes = [
            "CORE",
            "CORE_EXTENSION",
            "CAPABILITY",
            "ANCHOR",
            "ARTIFACT",
            "IDENTITY",
            "EXPRESSION",
            "VALUE",
            "EPISODE",
        ];

        const memoriesToInsert = memories.map((mem) => {
            const {
                entityId: bodyEntityId,
                userId: bodyUserId,
                assocEntityIds: bodyAssocEntityIds,
                ...rest
            } = mem;

            // Validate and sanitize
            const type = validTypes.includes(rest.type) ? rest.type : "ANCHOR";
            const importance =
                typeof rest.importance === "number" &&
                rest.importance >= 1 &&
                rest.importance <= 10
                    ? rest.importance
                    : 5;

            // Preserve contentVector if provided (for idempotent import)
            // If not provided, it will remain null and can be generated later if needed
            const contentVector = Array.isArray(rest.contentVector)
                ? rest.contentVector
                : null;

            return {
                ...rest,
                type,
                importance,
                entityId, // Always from params
                assocEntityIds: [user.contextId], // Always from auth - array of user contextIds
                contentVector, // Preserve vector if provided, otherwise null
                relatedMemoryIds: Array.isArray(rest.relatedMemoryIds)
                    ? rest.relatedMemoryIds
                    : [],
                tags: Array.isArray(rest.tags) ? rest.tags : [],
                lastAccessed: now,
            };
        });

        if (memoriesToInsert.length > 0) {
            await collection.insertMany(memoriesToInsert);
        }

        return NextResponse.json({
            success: true,
            count: memoriesToInsert.length,
        });
    } catch (error) {
        console.error("Error updating continuity memories:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update memories" },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/entities/[entityId]/memory
 * Bulk delete all continuity memories for an entity/user
 */
export async function DELETE(req, { params }) {
    try {
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { entityId } = params;
        if (!entityId || !isValidEntityId(entityId)) {
            return NextResponse.json(
                { error: "Invalid entity ID" },
                { status: 400 },
            );
        }

        // Get MongoDB collection (uses shared mongoose connection with CSFLE)
        const { collection } = await getContinuityMemoriesCollection();

        // Delete all memories for this entity/user
        const deleteResult = await collection.deleteMany({
            entityId,
            assocEntityIds: user.contextId, // MongoDB query: array contains
        });

        return NextResponse.json({
            success: true,
            deletedCount: deleteResult.deletedCount,
        });
    } catch (error) {
        console.error("Error deleting continuity memories:", error);
        return NextResponse.json(
            { error: error.message || "Failed to delete memories" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

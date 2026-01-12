import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../utils/auth";
import { getContinuityMemoriesCollection, isValidEntityId } from "../_lib";
import { getClient, QUERIES } from "../../../../../../src/graphql";

/**
 * PUT /api/entities/[entityId]/memory/[memoryId]
 * Update a continuity memory
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

        const { entityId, memoryId } = params;
        if (!entityId || !isValidEntityId(entityId)) {
            return NextResponse.json(
                { error: "Invalid entity ID" },
                { status: 400 },
            );
        }

        if (!memoryId) {
            return NextResponse.json(
                { error: "Memory ID is required" },
                { status: 400 },
            );
        }

        const body = await req.json();
        const {
            contentVector,
            entityId: bodyEntityId,
            userId: bodyUserId,
            ...updateData
        } = body;

        // Validate memory type if provided
        if (updateData.type) {
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
            if (!validTypes.includes(updateData.type)) {
                return NextResponse.json(
                    {
                        error: `Invalid memory type. Must be one of: ${validTypes.join(", ")}`,
                    },
                    { status: 400 },
                );
            }
        }

        // Validate importance if provided (1-10)
        if (updateData.importance !== undefined) {
            if (
                typeof updateData.importance !== "number" ||
                updateData.importance < 1 ||
                updateData.importance > 10
            ) {
                return NextResponse.json(
                    { error: "Importance must be a number between 1 and 10" },
                    { status: 400 },
                );
            }
        }

        // Get MongoDB collection (uses shared mongoose connection with CSFLE)
        const { collection } = await getContinuityMemoriesCollection();

        // Security: Verify memory belongs to this entity and user
        // userId (contextId) must be in assocEntityIds array
        const existingMemory = await collection.findOne({
            id: memoryId,
            entityId,
            assocEntityIds: user.contextId, // MongoDB query: array contains
        });

        if (!existingMemory) {
            return NextResponse.json(
                { error: "Memory not found" },
                { status: 404 },
            );
        }

        // Check if content changed - if so, regenerate embeddings
        const contentChanged =
            updateData.content !== undefined &&
            updateData.content !== existingMemory.content;

        let newContentVector = existingMemory.contentVector;
        if (contentChanged && updateData.content && updateData.content.trim()) {
            try {
                const graphqlClient = getClient();
                const embeddingResult = await graphqlClient.query({
                    query: QUERIES.EMBEDDINGS,
                    variables: { text: updateData.content },
                    fetchPolicy: "network-only",
                });

                // Parse the result - embeddings pathway returns JSON string array
                const embeddingsResult =
                    embeddingResult.data?.embeddings?.result;
                if (embeddingsResult) {
                    try {
                        const parsed =
                            typeof embeddingsResult === "string"
                                ? JSON.parse(embeddingsResult)
                                : embeddingsResult;
                        newContentVector = Array.isArray(parsed)
                            ? parsed
                            : Array.isArray(parsed[0])
                              ? parsed[0]
                              : null;
                    } catch (e) {
                        console.error("Error parsing embeddings result:", e);
                        // Keep existing vector if parsing fails
                    }
                }
            } catch (error) {
                console.error(
                    "Error generating embedding for updated memory:",
                    error,
                );
                // Continue with update without new embedding - keep existing vector
            }
        }

        // Build update object (don't allow changing entityId or assocEntityIds)
        // Ensure arrays are properly formatted
        if (
            updateData.relatedMemoryIds !== undefined &&
            !Array.isArray(updateData.relatedMemoryIds)
        ) {
            updateData.relatedMemoryIds = [];
        }
        if (updateData.tags !== undefined && !Array.isArray(updateData.tags)) {
            updateData.tags = [];
        }
        if (
            updateData.synthesizedFrom !== undefined &&
            !Array.isArray(updateData.synthesizedFrom)
        ) {
            updateData.synthesizedFrom = null;
        }
        // Handle assocEntityIds - if provided, ensure current user is included
        if (updateData.assocEntityIds !== undefined) {
            if (!Array.isArray(updateData.assocEntityIds)) {
                updateData.assocEntityIds = [user.contextId];
            } else if (!updateData.assocEntityIds.includes(user.contextId)) {
                // Security: Always include current user in assocEntityIds
                updateData.assocEntityIds.push(user.contextId);
            }
        }

        const update = {
            ...updateData,
            lastAccessed: new Date().toISOString(),
        };

        // Include new contentVector if content changed
        if (contentChanged) {
            update.contentVector = newContentVector;
        }

        delete update.entityId;
        // Don't delete assocEntityIds - allow updates but ensure current user is included

        // Update memory
        await collection.updateOne(
            {
                id: memoryId,
                entityId,
                assocEntityIds: user.contextId, // MongoDB query: array contains
            },
            { $set: update },
        );

        // Fetch updated memory
        const updatedMemory = await collection.findOne({
            id: memoryId,
            entityId,
            assocEntityIds: user.contextId, // MongoDB query: array contains
        });

        // Return updated memory (vectors included for export/import)
        return NextResponse.json({
            success: true,
            memory: updatedMemory,
        });
    } catch (error) {
        console.error("Error updating continuity memory:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update memory" },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/entities/[entityId]/memory/[memoryId]
 * Delete a continuity memory
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

        const { entityId, memoryId } = params;
        if (!entityId || !isValidEntityId(entityId)) {
            return NextResponse.json(
                { error: "Invalid entity ID" },
                { status: 400 },
            );
        }

        if (!memoryId) {
            return NextResponse.json(
                { error: "Memory ID is required" },
                { status: 400 },
            );
        }

        // Get MongoDB collection (uses shared mongoose connection with CSFLE)
        const { collection } = await getContinuityMemoriesCollection();

        // Security: Verify memory belongs to this entity and user before deleting
        // userId (contextId) must be in assocEntityIds array
        const deleteResult = await collection.deleteOne({
            id: memoryId,
            entityId,
            assocEntityIds: user.contextId, // MongoDB query: array contains
        });

        if (deleteResult.deletedCount === 0) {
            return NextResponse.json(
                { error: "Memory not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({
            success: true,
        });
    } catch (error) {
        console.error("Error deleting continuity memory:", error);
        return NextResponse.json(
            { error: error.message || "Failed to delete memory" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

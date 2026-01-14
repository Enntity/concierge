import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../utils/auth";
import {
    getEntitiesCollection,
    isValidEntityId,
} from "../../../../entities/_lib";
import { getContinuityMemoriesCollection } from "../../../../entities/[entityId]/memory/_lib";

/**
 * DELETE /api/admin/entities/[entityId]/delete
 * Delete an entity and its continuity memories (admin only)
 */
export async function DELETE(req, { params }) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== "admin") {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 },
            );
        }

        const { entityId } = params;
        if (!entityId || !isValidEntityId(entityId)) {
            return NextResponse.json(
                { error: "Invalid entity ID" },
                { status: 400 },
            );
        }

        let entitiesClient;
        try {
            // 1. Delete continuity_memories first
            const { collection: memoriesCollection } =
                await getContinuityMemoriesCollection();
            const memoriesResult = await memoriesCollection.deleteMany({
                entityId: entityId,
            });

            // 2. Delete the entity
            const result = await getEntitiesCollection();
            entitiesClient = result.client;
            const { collection: entitiesCollection } = result;

            const deleteResult = await entitiesCollection.deleteOne({
                id: entityId,
            });

            if (deleteResult.deletedCount === 0) {
                return NextResponse.json(
                    { error: "Entity not found" },
                    { status: 404 },
                );
            }

            return NextResponse.json({
                success: true,
                deletedMemories: memoriesResult.deletedCount,
            });
        } finally {
            if (entitiesClient) {
                await entitiesClient.close().catch(console.error);
            }
        }
    } catch (error) {
        console.error("Error deleting entity:", error);
        return NextResponse.json(
            { error: "Failed to delete entity" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

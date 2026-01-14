import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../utils/auth";
import { getEntitiesCollection } from "../../../entities/_lib";
import { getContinuityMemoriesCollection } from "../../../entities/[entityId]/memory/_lib";

/**
 * POST /api/admin/entities/purge-orphaned
 * Purge entities with no assocUserIds (admin only)
 */
export async function POST(req) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== "admin") {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 },
            );
        }

        let client;
        try {
            const result = await getEntitiesCollection();
            client = result.client;
            const { collection } = result;

            // Find orphaned entities (no assocUserIds or empty array, excluding system entities)
            const orphanedEntities = await collection
                .find({
                    $or: [
                        { assocUserIds: { $exists: false } },
                        { assocUserIds: { $size: 0 } },
                        { assocUserIds: null },
                    ],
                    isSystem: { $ne: true },
                })
                .toArray();

            const { collection: memoriesCollection } =
                await getContinuityMemoriesCollection();

            let totalMemoriesDeleted = 0;
            let entitiesDeleted = 0;

            // Delete each orphaned entity and its memories
            for (const entity of orphanedEntities) {
                // Delete continuity_memories first
                const memoriesResult = await memoriesCollection.deleteMany({
                    entityId: entity.id,
                });
                totalMemoriesDeleted += memoriesResult.deletedCount;

                // Delete the entity
                await collection.deleteOne({ id: entity.id });
                entitiesDeleted++;
            }

            return NextResponse.json({
                success: true,
                deletedEntities: entitiesDeleted,
                deletedMemories: totalMemoriesDeleted,
            });
        } finally {
            if (client) {
                await client.close().catch(console.error);
            }
        }
    } catch (error) {
        console.error("Error purging orphaned entities:", error);
        return NextResponse.json(
            { error: "Failed to purge orphaned entities" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";
import { getEntitiesCollection } from "../../entities/_lib";
import { getContinuityMemoriesCollection } from "../../entities/[entityId]/memory/_lib";

/**
 * GET /api/admin/entities
 * List all entities (admin only)
 */
export async function GET(req) {
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

            const { collection: memoriesCollection } =
                await getContinuityMemoriesCollection();

            const entities = await collection.find({}).toArray();

            const entitiesData = await Promise.all(
                entities.map(async (e) => {
                    const { _id, ...entityData } = e;
                    const memoryCount = await memoriesCollection.countDocuments(
                        {
                            entityId: entityData.id,
                        },
                    );
                    return {
                        ...entityData,
                        assocUserIds: entityData.assocUserIds || [],
                        memoryCount,
                        name: entityData.name || "Unnamed",
                    };
                }),
            );

            return NextResponse.json(entitiesData);
        } finally {
            if (client) {
                await client.close().catch(console.error);
            }
        }
    } catch (error) {
        console.error("Error fetching entities:", error);
        return NextResponse.json(
            { error: "Failed to fetch entities" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

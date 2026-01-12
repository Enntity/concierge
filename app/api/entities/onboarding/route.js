import { NextResponse } from "next/server";
import { getEntitiesCollection } from "../_lib";

/**
 * GET /api/entities/onboarding
 * Get the onboarding system entity (Enntity)
 */
export async function GET() {
    let client;
    try {
        // Get MongoDB collection
        const result = await getEntitiesCollection();
        client = result.client;
        const { collection } = result;

        // Find the Enntity system entity
        const entity = await collection.findOne({
            name: { $regex: /^Enntity$/i },
            isSystem: true,
        });

        if (!entity) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Onboarding entity not found. It should be auto-created on startup.",
                },
                { status: 404 },
            );
        }

        const { _id, ...entityData } = entity;

        return NextResponse.json({
            success: true,
            entity: {
                id: entityData.id,
                name: entityData.name,
                description: entityData.description || "",
                isSystem: true,
                useMemory: entityData.useMemory ?? false,
                memoryBackend: entityData.memoryBackend || "continuity",
                avatar: entityData.avatar || { text: "✨" },
                createdAt: entityData.createdAt
                    ? entityData.createdAt instanceof Date
                        ? entityData.createdAt.toISOString()
                        : entityData.createdAt
                    : null,
                updatedAt: entityData.updatedAt
                    ? entityData.updatedAt instanceof Date
                        ? entityData.updatedAt.toISOString()
                        : entityData.updatedAt
                    : null,
            },
        });
    } catch (error) {
        console.error("Error fetching onboarding entity:", error);
        return NextResponse.json(
            {
                success: false,
                error: `Failed to get onboarding entity: ${error.message}`,
            },
            { status: 500 },
        );
    } finally {
        if (client) {
            await client.close().catch(console.error);
        }
    }
}

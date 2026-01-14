import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../utils/auth";
import { getEntitiesCollection, isValidEntityId } from "../../_lib";

/**
 * PATCH /api/entities/[entityId]/avatar
 * Update an entity's avatar image
 */
export async function PATCH(req, { params }) {
    let client;
    try {
        const user = await getCurrentUser();
        if (!user?.contextId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { entityId } = params;
        if (!entityId) {
            return NextResponse.json(
                { error: "Entity ID is required" },
                { status: 400 },
            );
        }

        // Validate entityId format
        if (!isValidEntityId(entityId)) {
            return NextResponse.json(
                { error: "Invalid entity ID format" },
                { status: 400 },
            );
        }

        const body = await req.json();
        const { imageUrl } = body;

        if (!imageUrl || typeof imageUrl !== "string") {
            return NextResponse.json(
                { error: "imageUrl is required and must be a string" },
                { status: 400 },
            );
        }

        // Get MongoDB collection
        const result = await getEntitiesCollection();
        client = result.client;
        const { collection } = result;

        // Verify entity exists and user has access
        const entity = await collection.findOne({ id: entityId });
        if (!entity) {
            return NextResponse.json(
                { error: "Entity not found" },
                { status: 404 },
            );
        }

        // Check access - user must be in assocUserIds (unless system entity)
        if (
            !entity.isSystem &&
            (!entity.assocUserIds ||
                !Array.isArray(entity.assocUserIds) ||
                !entity.assocUserIds.includes(user.contextId))
        ) {
            return NextResponse.json(
                {
                    error: "Unauthorized - you don't have access to this entity",
                },
                { status: 403 },
            );
        }

        // Update the entity's avatar
        const updateResult = await collection.updateOne(
            { id: entityId },
            {
                $set: {
                    "avatar.image.url": imageUrl,
                    updatedAt: new Date(),
                },
            },
        );

        if (updateResult.modifiedCount === 0) {
            return NextResponse.json(
                { error: "Failed to update avatar" },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            message: "Avatar updated successfully",
        });
    } catch (error) {
        console.error("Error updating entity avatar:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update avatar" },
            { status: 500 },
        );
    } finally {
        if (client) {
            await client.close().catch(console.error);
        }
    }
}

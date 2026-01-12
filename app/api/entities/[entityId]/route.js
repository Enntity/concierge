import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";
import { getEntitiesCollection, isValidEntityId } from "../_lib";

/**
 * DELETE /api/entities/[entityId]
 * Disassociate the current user from an entity
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

        // Get MongoDB collection
        let client;
        try {
            const result = await getEntitiesCollection();
            client = result.client;
            const { collection } = result;

            // Verify entity exists
            const entity = await collection.findOne({ id: entityId });
            if (!entity) {
                return NextResponse.json(
                    { error: "Entity not found" },
                    { status: 404 },
                );
            }

            // Remove user from entity's assocUserIds
            const updateResult = await collection.updateOne(
                { id: entityId },
                {
                    $pull: { assocUserIds: user.contextId },
                    $set: { updatedAt: new Date() },
                },
            );

            if (updateResult.modifiedCount === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "User was not associated with this entity",
                    },
                    { status: 400 },
                );
            }

            return NextResponse.json({
                success: true,
                message: `User disassociated from entity successfully`,
            });
        } finally {
            if (client) {
                await client.close().catch(console.error);
            }
        }
    } catch (error) {
        console.error("Error disassociating entity:", error);
        return NextResponse.json(
            { error: error.message || "Failed to disassociate entity" },
            { status: 500 },
        );
    }
}

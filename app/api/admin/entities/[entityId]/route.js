import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../utils/auth";
import { getEntitiesCollection, isValidEntityId } from "../../../entities/_lib";

/**
 * PATCH /api/admin/entities/[entityId]
 * Update entity assocUserIds (admin only)
 */
export async function PATCH(req, { params }) {
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

        const body = await req.json();
        const { assocUserIds } = body;

        if (!Array.isArray(assocUserIds)) {
            return NextResponse.json(
                { error: "assocUserIds must be an array" },
                { status: 400 },
            );
        }

        // Validate all items are non-empty strings
        const validatedIds = assocUserIds.filter(
            (id) => typeof id === "string" && id.trim().length > 0,
        );
        if (validatedIds.length !== assocUserIds.length) {
            return NextResponse.json(
                { error: "All assocUserIds must be non-empty strings" },
                { status: 400 },
            );
        }

        let client;
        try {
            const result = await getEntitiesCollection();
            client = result.client;
            const { collection } = result;

            const updateResult = await collection.updateOne(
                { id: entityId },
                { $set: { assocUserIds: validatedIds } },
            );

            if (updateResult.matchedCount === 0) {
                return NextResponse.json(
                    { error: "Entity not found" },
                    { status: 404 },
                );
            }

            return NextResponse.json({ success: true });
        } finally {
            if (client) {
                await client.close().catch(console.error);
            }
        }
    } catch (error) {
        console.error("Error updating entity:", error);
        return NextResponse.json(
            { error: "Failed to update entity" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

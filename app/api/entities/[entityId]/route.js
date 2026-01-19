import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";
import { getEntitiesCollection, isValidEntityId } from "../_lib";

/**
 * GET /api/entities/[entityId]
 * Get a single entity by ID
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

            // Check access - must be system entity or associated with user
            if (
                !entity.isSystem &&
                (!entity.assocUserIds ||
                    !entity.assocUserIds.includes(user.contextId))
            ) {
                return NextResponse.json(
                    { error: "Unauthorized" },
                    { status: 403 },
                );
            }

            const { _id, ...entityData } = entity;
            return NextResponse.json(entityData);
        } finally {
            if (client) {
                await client.close().catch(console.error);
            }
        }
    } catch (error) {
        console.error("Error fetching entity:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch entity" },
            { status: 500 },
        );
    }
}

/**
 * PATCH /api/entities/[entityId]
 * Update entity settings (preferredModel, modelOverride, reasoningEffort, tools)
 * - preferredModel: Default model for this entity (can be overridden by user preferences)
 * - modelOverride: Forced model that always takes precedence over user preferences
 * - reasoningEffort: How much thinking time (low, medium, high)
 * - tools: Array of lowercase tool names the entity can use (empty array = no tools)
 */
export async function PATCH(req, { params }) {
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
        const { preferredModel, modelOverride, reasoningEffort, tools } = body;

        // Validate reasoningEffort if provided
        const validReasoningEfforts = ["low", "medium", "high"];
        if (
            reasoningEffort &&
            !validReasoningEfforts.includes(reasoningEffort)
        ) {
            return NextResponse.json(
                {
                    error: "Invalid reasoning effort. Must be: low, medium, or high",
                },
                { status: 400 },
            );
        }

        // Validate tools if provided - must be an array of strings
        if (tools !== undefined) {
            if (!Array.isArray(tools)) {
                return NextResponse.json(
                    { error: "Tools must be an array of strings" },
                    { status: 400 },
                );
            }
            // Ensure all items are lowercase strings (never write ['*'] - that's legacy)
            const invalidTools = tools.filter(
                (t) => typeof t !== "string" || t === "*",
            );
            if (invalidTools.length > 0) {
                return NextResponse.json(
                    {
                        error: "Tools must be lowercase tool names. Wildcard '*' is not allowed.",
                    },
                    { status: 400 },
                );
            }
        }

        let client;
        try {
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

            // Check access - must be associated with user (not system entities)
            if (
                entity.isSystem ||
                !entity.assocUserIds ||
                !entity.assocUserIds.includes(user.contextId)
            ) {
                return NextResponse.json(
                    { error: "Unauthorized to modify this entity" },
                    { status: 403 },
                );
            }

            // Build update object - separate $set and $unset operations
            const updateFields = { updatedAt: new Date() };
            const unsetFields = {};

            // Handle preferredModel - null means clear it
            if (preferredModel !== undefined) {
                if (preferredModel === null) {
                    unsetFields.preferredModel = "";
                } else {
                    updateFields.preferredModel = preferredModel;
                }
            }

            // Handle modelOverride - null means clear it
            if (modelOverride !== undefined) {
                if (modelOverride === null) {
                    unsetFields.modelOverride = "";
                } else {
                    updateFields.modelOverride = modelOverride;
                }
            }

            if (reasoningEffort !== undefined) {
                updateFields.reasoningEffort = reasoningEffort;
            }

            // Handle tools - store as array of lowercase strings
            if (tools !== undefined) {
                // Normalize to lowercase
                updateFields.tools = tools.map((t) => t.toLowerCase());
            }

            // Build the update operation
            const updateOp = { $set: updateFields };
            if (Object.keys(unsetFields).length > 0) {
                updateOp.$unset = unsetFields;
            }

            const updateResult = await collection.updateOne(
                { id: entityId },
                updateOp,
            );

            if (
                updateResult.modifiedCount === 0 &&
                updateResult.matchedCount === 0
            ) {
                return NextResponse.json(
                    { error: "Failed to update entity" },
                    { status: 500 },
                );
            }

            // Return updated entity
            const updatedEntity = await collection.findOne({ id: entityId });
            const { _id, ...entityData } = updatedEntity;

            return NextResponse.json({
                success: true,
                entity: entityData,
            });
        } finally {
            if (client) {
                await client.close().catch(console.error);
            }
        }
    } catch (error) {
        console.error("Error updating entity:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update entity" },
            { status: 500 },
        );
    }
}

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

import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../utils/auth";
import { isValidEntityId } from "../../_lib";
import { getClient, MUTATIONS } from "../../../../../src/graphql";

/**
 * PATCH /api/entities/[entityId]/avatar
 * Update an entity's avatar image via Cortex pathway
 * This ensures Cortex's entity cache stays in sync
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

        // Update via Cortex pathway to keep cache in sync
        const graphqlClient = getClient();
        const result = await graphqlClient.mutate({
            mutation: MUTATIONS.SYS_UPDATE_ENTITY,
            variables: {
                entityId,
                contextId: user.contextId,
                avatarImageUrl: imageUrl,
            },
        });

        const pathwayResult = result.data?.sys_update_entity?.result;
        if (pathwayResult) {
            let parsed;
            try {
                parsed =
                    typeof pathwayResult === "string"
                        ? JSON.parse(pathwayResult)
                        : pathwayResult;
            } catch (e) {
                // If we can't parse, assume success if we got a result
                parsed = { success: true };
            }

            if (parsed.error) {
                return NextResponse.json(
                    { error: parsed.error },
                    { status: 400 },
                );
            }

            return NextResponse.json({
                success: true,
                message: "Avatar updated successfully",
            });
        }

        return NextResponse.json(
            { error: "No response from Cortex" },
            { status: 500 },
        );
    } catch (error) {
        console.error("Error updating entity avatar:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update avatar" },
            { status: 500 },
        );
    }
}

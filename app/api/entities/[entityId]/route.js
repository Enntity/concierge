import { NextResponse } from "next/server";
import { getCurrentUser } from "../../utils/auth";
import { getEntitiesCollection, isValidEntityId } from "../_lib";
import { getClient, MUTATIONS } from "../../../../src/graphql";

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
 * Update entity settings via cortex sys_update_entity pathway
 * This ensures changes are immediately reflected in both MongoDB and cortex's internal cache
 *
 * Supported properties:
 * - preferredModel: Default model for this entity (can be overridden by user preferences)
 * - modelOverride: Forced model that always takes precedence over user preferences
 * - reasoningEffort: How much thinking time (low, medium, high)
 * - tools: Array of lowercase tool names the entity can use (empty array = no tools)
 * - voiceProvider: TTS provider (e.g., 'elevenlabs')
 * - voiceId: Provider-specific voice ID
 * - voiceName: Display name for the voice
 * - voiceStability: Voice stability setting (0.0 - 1.0)
 * - voiceSimilarity: Voice similarity setting (0.0 - 1.0)
 * - voiceStyle: Voice style setting (0.0 - 1.0)
 * - voiceSpeakerBoost: Enable speaker boost (boolean)
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
        const {
            preferredModel,
            modelOverride,
            reasoningEffort,
            tools,
            // Voice fields
            voiceProvider,
            voiceId,
            voiceName,
            voiceStability,
            voiceSimilarity,
            voiceStyle,
            voiceSpeakerBoost,
        } = body;

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

        // Build variables for the pathway - only include defined values
        const variables = {
            entityId: entityId,
            contextId: user.contextId,
        };

        // Handle preferredModel - null means clear it
        if (preferredModel !== undefined) {
            variables.preferredModel = preferredModel;
        }

        // Handle modelOverride - null means clear it
        if (modelOverride !== undefined) {
            variables.modelOverride = modelOverride;
        }

        if (reasoningEffort !== undefined) {
            variables.reasoningEffort = reasoningEffort;
        }

        // Handle tools - normalize to lowercase
        if (tools !== undefined) {
            variables.tools = tools.map((t) => t.toLowerCase());
        }

        // Handle voice fields
        if (voiceProvider !== undefined) {
            variables.voiceProvider = voiceProvider;
        }
        if (voiceId !== undefined) {
            variables.voiceId = voiceId;
        }
        if (voiceName !== undefined) {
            variables.voiceName = voiceName;
        }
        if (voiceStability !== undefined) {
            const stability = parseFloat(voiceStability);
            if (isNaN(stability) || stability < 0 || stability > 1) {
                return NextResponse.json(
                    { error: "voiceStability must be a number between 0 and 1" },
                    { status: 400 },
                );
            }
            variables.voiceStability = stability;
        }
        if (voiceSimilarity !== undefined) {
            const similarity = parseFloat(voiceSimilarity);
            if (isNaN(similarity) || similarity < 0 || similarity > 1) {
                return NextResponse.json(
                    { error: "voiceSimilarity must be a number between 0 and 1" },
                    { status: 400 },
                );
            }
            variables.voiceSimilarity = similarity;
        }
        if (voiceStyle !== undefined) {
            const style = parseFloat(voiceStyle);
            if (isNaN(style) || style < 0 || style > 1) {
                return NextResponse.json(
                    { error: "voiceStyle must be a number between 0 and 1" },
                    { status: 400 },
                );
            }
            variables.voiceStyle = style;
        }
        if (voiceSpeakerBoost !== undefined) {
            variables.voiceSpeakerBoost = voiceSpeakerBoost === true || voiceSpeakerBoost === "true";
        }

        // Check if there are any properties to update (besides entityId and contextId)
        const propertyKeys = Object.keys(variables).filter(
            (k) => k !== "entityId" && k !== "contextId",
        );
        if (propertyKeys.length === 0) {
            return NextResponse.json(
                { error: "No properties provided to update" },
                { status: 400 },
            );
        }

        // Defense-in-depth: Pre-flight authorization check before calling cortex
        // (cortex also checks, but we verify here as a second layer)
        let mongoClient;
        try {
            const mongoResult = await getEntitiesCollection();
            mongoClient = mongoResult.client;
            const { collection } = mongoResult;

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
        } finally {
            if (mongoClient) {
                await mongoClient.close().catch(console.error);
            }
        }

        // Call cortex sys_update_entity pathway via GraphQL
        // This updates both MongoDB and the internal cache for immediate synchronization
        try {
            const graphqlClient = getClient();
            const result = await graphqlClient.mutate({
                mutation: MUTATIONS.SYS_UPDATE_ENTITY,
                variables: variables,
                fetchPolicy: "network-only",
            });

            const pathwayResult = result.data?.sys_update_entity?.result;
            if (!pathwayResult) {
                console.error(
                    "No result from sys_update_entity pathway:",
                    result,
                );
                return NextResponse.json(
                    { error: "Failed to update entity via cortex" },
                    { status: 500 },
                );
            }

            // Parse the JSON result from the pathway
            let parsed;
            try {
                parsed =
                    typeof pathwayResult === "string"
                        ? JSON.parse(pathwayResult)
                        : pathwayResult;
            } catch (e) {
                console.error("Failed to parse pathway response:", e);
                return NextResponse.json(
                    { error: "Invalid response from cortex" },
                    { status: 500 },
                );
            }

            if (!parsed.success) {
                // Map pathway errors to appropriate HTTP status codes
                const error = parsed.error || "Failed to update entity";
                if (error.includes("not found")) {
                    return NextResponse.json({ error }, { status: 404 });
                }
                if (
                    error.includes("Not authorized") ||
                    error.includes("Cannot update system")
                ) {
                    return NextResponse.json({ error }, { status: 403 });
                }
                return NextResponse.json({ error }, { status: 400 });
            }

            // Fetch the updated entity to return full data
            // (pathway only returns success status and updated property names)
            let mongoClient;
            try {
                const mongoResult = await getEntitiesCollection();
                mongoClient = mongoResult.client;
                const { collection } = mongoResult;

                const updatedEntity = await collection.findOne({
                    id: entityId,
                });
                if (!updatedEntity) {
                    // Entity was updated but we can't fetch it - return partial success
                    return NextResponse.json({
                        success: true,
                        updatedProperties: parsed.updatedProperties,
                    });
                }

                const { _id, ...entityData } = updatedEntity;
                return NextResponse.json({
                    success: true,
                    entity: entityData,
                    updatedProperties: parsed.updatedProperties,
                });
            } finally {
                if (mongoClient) {
                    await mongoClient.close().catch(console.error);
                }
            }
        } catch (graphqlError) {
            console.error(
                "Error calling sys_update_entity pathway:",
                graphqlError,
            );
            // Don't expose internal error details to client
            return NextResponse.json(
                { error: "Failed to update entity" },
                { status: 500 },
            );
        }
    } catch (error) {
        console.error("Error updating entity:", error);
        // Don't expose internal error details to client
        return NextResponse.json(
            { error: "Failed to update entity" },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/entities/[entityId]
 * Disassociate the current user from an entity via cortex sys_disassociate_entity pathway
 * This ensures the change is immediately reflected in both MongoDB and cortex's internal cache
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

        // Call cortex sys_disassociate_entity pathway via GraphQL
        try {
            const graphqlClient = getClient();
            const result = await graphqlClient.mutate({
                mutation: MUTATIONS.SYS_DISASSOCIATE_ENTITY,
                variables: {
                    entityId: entityId,
                    contextId: user.contextId,
                },
                fetchPolicy: "network-only",
            });

            const pathwayResult = result.data?.sys_disassociate_entity?.result;
            if (!pathwayResult) {
                console.error(
                    "No result from sys_disassociate_entity pathway:",
                    result,
                );
                return NextResponse.json(
                    { error: "Failed to disassociate entity via cortex" },
                    { status: 500 },
                );
            }

            // Parse the JSON result from the pathway
            let parsed;
            try {
                parsed =
                    typeof pathwayResult === "string"
                        ? JSON.parse(pathwayResult)
                        : pathwayResult;
            } catch (e) {
                console.error("Failed to parse pathway response:", e);
                return NextResponse.json(
                    { error: "Invalid response from cortex" },
                    { status: 500 },
                );
            }

            if (!parsed.success) {
                const error = parsed.error || "Failed to disassociate entity";
                if (error.includes("not found")) {
                    return NextResponse.json({ error }, { status: 404 });
                }
                return NextResponse.json({ error }, { status: 400 });
            }

            return NextResponse.json({
                success: true,
                message:
                    parsed.message ||
                    "User disassociated from entity successfully",
            });
        } catch (graphqlError) {
            console.error(
                "Error calling sys_disassociate_entity pathway:",
                graphqlError,
            );
            return NextResponse.json(
                { error: "Failed to disassociate entity" },
                { status: 500 },
            );
        }
    } catch (error) {
        console.error("Error disassociating entity:", error);
        return NextResponse.json(
            { error: "Failed to disassociate entity" },
            { status: 500 },
        );
    }
}

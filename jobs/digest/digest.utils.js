import { QUERIES, getClient } from "../graphql.mjs";
import { getEntitiesCollection } from "../../app/api/entities/_lib.js";

const APPROXIMATE_DURATION_SECONDS = 60;
const PROGRESS_UPDATE_INTERVAL = 3000;

/**
 * Validates that an entityId is in the user's contact list
 * Returns { entityId, preferredModel } if valid, { entityId: null } otherwise
 */
async function validateEntityAccess(entityId, userContextId, logger) {
    if (!entityId || !userContextId) return { entityId: null };

    let client;
    try {
        const result = await getEntitiesCollection();
        client = result.client;
        const { collection } = result;

        const entity = await collection.findOne({ id: entityId });

        if (!entity) {
            logger?.log(`Entity ${entityId} not found`);
            return { entityId: null };
        }

        const entityInfo = {
            entityId,
            preferredModel: entity.modelOverride || entity.preferredModel || null,
        };

        // System entities are always accessible
        if (entity.isSystem) {
            return entityInfo;
        }

        // Check if user has this entity in their contacts
        if (
            entity.assocUserIds &&
            Array.isArray(entity.assocUserIds) &&
            entity.assocUserIds.includes(userContextId)
        ) {
            return entityInfo;
        }

        logger?.log(
            `User ${userContextId} no longer has access to entity ${entityId}`,
        );
        return { entityId: null };
    } catch (e) {
        logger?.log(`Error validating entity access: ${e.message}`);
        return { entityId: null };
    } finally {
        if (client) {
            await client.close().catch(() => {});
        }
    }
}

const generateDigestBlockContent = async (
    block,
    user,
    logger,
    onProgressUpdate,
) => {
    const { prompt, entityId } = block;

    const systemMessage = {
        role: "system",
        content: [
            "Your output is being displayed in the user interface, not in a chat conversation. The user cannot respond to your messages. Please complete the requested task fully and do not ask follow-up questions or otherwise attempt to engage the user in conversation.",
        ],
    };

    // Build agentContext for user (single user context as default)
    const agentContext = user?.contextId
        ? [
              {
                  contextId: user.contextId,
                  contextKey: user.contextKey || "",
                  default: true,
              },
          ]
        : [];

    // Validate that the entityId is still accessible to the user
    // Falls back to user's default entity if not
    let resolvedEntityId = null;
    let entityPreferredModel = null;
    if (entityId) {
        const entityAccess = await validateEntityAccess(
            entityId,
            user?.contextId,
            logger,
        );
        resolvedEntityId = entityAccess.entityId;
        entityPreferredModel = entityAccess.preferredModel;
        if (!resolvedEntityId && entityId) {
            logger?.log(
                `Entity ${entityId} no longer accessible, falling back to default`,
                user?._id,
                block?._id,
            );
        }
    }

    // Fall back to user's default entity
    if (!resolvedEntityId) {
        resolvedEntityId = user?.defaultEntityId || null;
    }

    // Model priority: user override > entity preferred > default
    // (matches ChatContent.js logic; entity modelOverride is handled server-side in cortex)
    const model = user?.agentModel || entityPreferredModel || "gemini-flash-3-vision";

    const variables = {
        chatHistory: [systemMessage, { role: "user", content: [prompt] }],
        agentContext,
        aiName: user?.aiName,
        model,
        useMemory: true,
        entityId: resolvedEntityId,
    };

    const client = await getClient();
    let tool = null;
    let content;
    let progress = { progress: 0.05 };
    const interval = setInterval(() => {
        const increment =
            PROGRESS_UPDATE_INTERVAL / (APPROXIMATE_DURATION_SECONDS * 1000);
        progress.progress = Math.min(progress.progress + increment, 0.95);
        const progressUpdate = Math.floor(progress.progress * 100);
        onProgressUpdate(progressUpdate);
        logger.log(`progress ${progressUpdate}`, user?._id, block?._id);
    }, PROGRESS_UPDATE_INTERVAL);

    try {
        const result = await client.query({
            query: QUERIES.SYS_ENTITY_AGENT,
            variables,
            fetchPolicy: 'network-only',
        });

        tool = result.data.sys_entity_agent.tool;

        try {
            content = JSON.stringify({
                payload: result.data.sys_entity_agent.result,
                tool,
            });
        } catch (e) {
            logger.log(
                `Error while parsing sys_entity_agent result: ${e.message}`,
                user?._id,
                block?._id,
            );
            content = JSON.stringify({
                payload: JSON.stringify(result.data),
                tool: null,
            });
        }
    } catch (e) {
        console.error(e);
        logger.log(
            `Error while generating content: ${e.message}`,
            user?._id,
            block?._id,
        );
        content = JSON.stringify({
            payload: "Error while generating content: " + e.message,
        });
    } finally {
        clearInterval(interval);
        onProgressUpdate(1);
    }

    return content;
};

export { generateDigestBlockContent };

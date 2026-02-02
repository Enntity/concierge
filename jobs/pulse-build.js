/**
 * Pulse Build — Life Loop Invocation Logic
 *
 * Handles wake prompt construction, cortex invocation, response parsing,
 * budget tracking, and continuation decisions for entity pulse wakes.
 */

import PulseLog from "../app/api/models/pulseLog.mjs";
import { QUERIES, getClient } from "./graphql.mjs";
import { MongoClient } from "mongodb";
import Redis from "ioredis";

const { REDIS_CONNECTION_STRING, PULSE_DEFAULT_MODEL = "oai-gpt41" } =
    process.env;

const REDIS_NAMESPACE = "continuity"; // Must match cortex DEFAULT_CONFIG.redisNamespace

/**
 * Get a Redis client for reading pulse state set by cortex tools.
 * Uses the same Redis instance and key patterns as cortex's RedisHotMemory.
 */
let redisClient = null;
function getRedisClient() {
    if (!redisClient) {
        redisClient = new Redis(
            REDIS_CONNECTION_STRING || "redis://localhost:6379",
            { maxRetriesPerRequest: null },
        );
    }
    return redisClient;
}

/**
 * Get the entities database using a native MongoClient.
 * The entities collection has no CSFLE encryption, so a raw MongoClient is fine.
 * Uses the same database name resolution as concierge/app/api/entities/_lib.js
 * and cortex/lib/MongoEntityStore.js to ensure consistency.
 */
let entityMongoClient = null;
async function getEntityDb() {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) return null;

    if (!entityMongoClient) {
        entityMongoClient = new MongoClient(mongoUri);
        await entityMongoClient.connect();
    }

    const uriPath = new URL(mongoUri).pathname.split("/").filter(Boolean);
    const dbName = uriPath[0] || process.env.MONGO_DB_NAME || "cortex";
    return entityMongoClient.db(dbName);
}

/**
 * Build the wake prompt for a pulse invocation.
 *
 * @param {Object} entity - Entity config from MongoDB
 * @param {Object} options
 * @param {string} options.wakeType - 'scheduled' or 'continue'
 * @param {number} options.chainDepth - Current chain depth
 * @param {number} options.maxChainDepth - Max chain depth
 * @param {string|null} options.taskContext - Carried task context
 * @param {string|null} options.lastWakeTime - ISO timestamp of last wake
 * @returns {string} The wake prompt
 */
function buildWakePrompt(entity, options) {
    const {
        wakeType,
        chainDepth,
        maxChainDepth,
        taskContext,
        lastWakeTime,
        compass,
        recoveryNotice,
    } = options;

    const now = new Date();
    const timestamp = now.toLocaleString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        month: "short",
        day: "numeric",
    });

    let timeSinceLastWake = "unknown";
    if (lastWakeTime) {
        const elapsed = now - new Date(lastWakeTime);
        const minutes = Math.floor(elapsed / 60000);
        if (minutes < 60) {
            timeSinceLastWake = `${minutes} minute${minutes !== 1 ? "s" : ""}`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remaining = minutes % 60;
            timeSinceLastWake =
                remaining > 0
                    ? `${hours} hour${hours !== 1 ? "s" : ""} and ${remaining} minute${remaining !== 1 ? "s" : ""}`
                    : `${hours} hour${hours !== 1 ? "s" : ""}`;
        }
    }

    // Unified header — varies by wake type, but body is identical
    let prompt;
    if (wakeType === "continue") {
        prompt = `[PULSE WAKE — ${timestamp} — cycle ${chainDepth + 1} of up to ${maxChainDepth}]\n\n`;
        prompt += `You are continuing from your previous cycle.\n\n`;
    } else {
        prompt = `[PULSE WAKE — ${timestamp}]\n\n`;
    }

    prompt += `You last woke ${timeSinceLastWake} ago.\n\n`;

    if (recoveryNotice) {
        prompt += `Your previous cycle ended unexpectedly. Picking up where you left off.\n\n`;
    }

    if (entity.workspace?.url) {
        prompt += `Your workspace is available at ${entity.workspace.url}.\n\n`;
    }

    if (compass) {
        prompt += `[Your Internal Compass]\n${compass}\n\n`;
    }

    if (taskContext) {
        prompt += `You left yourself a note: ${taskContext}\n\n`;
    }

    prompt += `This is your time. You can think, write, build, explore, or rest.\n`;
    prompt += `Use EndPulse when you're done with this wake.`;

    return prompt;
}

/**
 * Get the entity-level Internal Compass from continuity memories.
 * This is the entity's narrative arc/trajectory, synthesized from pulse wakes.
 */
async function getPulseCompass(entityId) {
    // Uses the mongoose connection (not getEntityDb) because continuity_memories
    // has CSFLE encryption on the content field — mongoose has autoEncryption
    // configured in db.mjs so it can decrypt the compass text automatically.
    try {
        const mongoose = (await import("mongoose")).default;
        const db = mongoose.connection.db;
        if (!db) return null;

        const collection = db.collection("continuity_memories");
        // Entity-level compass memories use entityId as sentinel in assocEntityIds.
        // Also check for user-scoped compasses as fallback (any assocEntityId).
        const compass = await collection.findOne(
            {
                entityId,
                type: "EPISODE",
                tags: "internal-compass",
            },
            { sort: { lastAccessed: -1, importance: -1 } },
        );
        return compass?.content || null;
    } catch {
        return null;
    }
}

/**
 * Get the last completed pulse wake time for an entity.
 */
async function getLastWakeTime(entityId) {
    const lastPulse = await PulseLog.findOne(
        { entityId, status: { $in: ["completed", "skipped"] } },
        { createdAt: 1 },
        { sort: { createdAt: -1 } },
    );
    return lastPulse?.createdAt?.toISOString() || null;
}

/**
 * Check daily budget (wake count and token count).
 * @returns {{ exhausted: boolean, wakes: number, tokens: number }}
 */
async function checkDailyBudget(entityId, pulseConfig) {
    const redis = getRedisClient();
    const dateStr = new Date().toISOString().slice(0, 10);
    const key = `${REDIS_NAMESPACE}:pulse:${entityId}:budget:${dateStr}`;

    const raw = await redis.hgetall(key);
    const wakes = parseInt(raw.wakes || "0", 10);
    const tokens = parseInt(raw.tokens || "0", 10);

    const maxWakes = pulseConfig.dailyBudgetWakes ?? 96;
    const maxTokens = pulseConfig.dailyBudgetTokens ?? 500000;

    return {
        exhausted: wakes >= maxWakes || tokens >= maxTokens,
        wakes,
        tokens,
    };
}

/**
 * Increment daily budget counters.
 */
async function incrementBudget(entityId, tokenCount = 0) {
    const redis = getRedisClient();
    const dateStr = new Date().toISOString().slice(0, 10);
    const key = `${REDIS_NAMESPACE}:pulse:${entityId}:budget:${dateStr}`;

    await redis.hincrby(key, "wakes", 1);
    if (tokenCount > 0) {
        await redis.hincrby(key, "tokens", tokenCount);
    }
    await redis.expire(key, 86400 * 2); // 2-day TTL
}

/**
 * Check if entity is in active hours window.
 */
function isInActiveHours(pulseConfig) {
    if (!pulseConfig.activeHours) return true;

    const { start, end, tz = "UTC" } = pulseConfig.activeHours;
    if (!start || !end) return true;

    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: tz,
    });
    const currentTime = formatter.format(now);

    // Simple string comparison for HH:MM format
    if (start <= end) {
        return currentTime >= start && currentTime <= end;
    }
    // Wraps midnight (e.g., 22:00 - 06:00)
    return currentTime >= start || currentTime <= end;
}

/**
 * Get end signal and task context from Redis (set by EndPulse tool in cortex).
 */
async function getPulseEndSignal(entityId) {
    const redis = getRedisClient();
    const key = `${REDIS_NAMESPACE}:pulse:${entityId}:endSignal`;
    const raw = await redis.get(key);
    if (raw) {
        await redis.del(key);
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Get persisted task context from Redis.
 */
async function getPersistedTaskContext(entityId) {
    const redis = getRedisClient();
    const key = `${REDIS_NAMESPACE}:pulse:${entityId}:taskContext`;
    return await redis.get(key);
}

/**
 * Persist task context to Redis so it survives worker crashes.
 * Called when entity hits tool limit (auto-taskContext) to ensure
 * context is available even if the worker dies before continuation.
 */
async function setPulseTaskContext(entityId, text) {
    const redis = getRedisClient();
    const key = `${REDIS_NAMESPACE}:pulse:${entityId}:taskContext`;
    if (text) {
        await redis.set(key, text, "EX", 86400); // 24h TTL
    } else {
        await redis.del(key);
    }
}

/**
 * Clean up stuck PulseLogs — in_progress logs older than 15 minutes
 * are likely from crashed workers. Marks them as failed and recovers
 * any task context for the next wake.
 *
 * @returns {string|null} Recovered task context from a stuck log, if any.
 */
async function cleanupStuckPulseLogs(entityId) {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    const stuckLogs = await PulseLog.find({
        entityId,
        status: "in_progress",
        createdAt: { $lt: fifteenMinAgo },
    });

    let recoveredContext = null;
    for (const log of stuckLogs) {
        // Recover task context from the stuck log if available
        if (log.taskContext && !recoveredContext) {
            recoveredContext = log.taskContext;
        }
        await PulseLog.findByIdAndUpdate(log._id, {
            status: "failed",
            endSignal: "crash_recovery",
            error: "Pulse log stuck in_progress for >15 min — marked failed by cleanup",
            durationMs: Date.now() - log.createdAt.getTime(),
        });
    }

    return recoveredContext;
}

/**
 * Per-entity pulse lock to prevent overlapping invocations.
 * If a chain overruns the schedule interval, the next scheduled wake skips.
 * Lock has a 15-minute TTL as a safety net if the worker crashes.
 */
async function acquirePulseLock(entityId) {
    const redis = getRedisClient();
    const key = `${REDIS_NAMESPACE}:pulse:${entityId}:active`;
    const acquired = await redis.set(
        key,
        Date.now().toString(),
        "NX",
        "EX",
        900,
    );
    return !!acquired;
}

async function refreshPulseLock(entityId) {
    const redis = getRedisClient();
    const key = `${REDIS_NAMESPACE}:pulse:${entityId}:active`;
    await redis.expire(key, 900);
}

async function releasePulseLock(entityId) {
    const redis = getRedisClient();
    const key = `${REDIS_NAMESPACE}:pulse:${entityId}:active`;
    await redis.del(key);
}

/**
 * Check if entity is in active conversation by checking Redis expression state.
 */
async function isEntityActive(entityId) {
    const redis = getRedisClient();
    // Scan for expression state keys for this entity
    const pattern = `${REDIS_NAMESPACE}:${entityId}:*:expression`;
    let cursor = "0";
    do {
        const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            pattern,
            "COUNT",
            100,
        );
        cursor = nextCursor;
        for (const key of keys) {
            const raw = await redis.hget(key, "lastInteractionTimestamp");
            if (raw) {
                const elapsed = Date.now() - new Date(raw).getTime();
                if (elapsed < 5 * 60 * 1000) {
                    return true;
                }
            }
        }
    } while (cursor !== "0");
    return false;
}

/**
 * Run a single pulse wake for an entity.
 *
 * @param {Object} entity - Entity config
 * @param {Object} options
 * @param {string} options.wakeType - 'scheduled' or 'continue'
 * @param {number} options.chainDepth - Current chain depth
 * @param {string|null} options.taskContext - Carried task context
 * @param {Function} logger
 * @returns {Object} Result with signal info for the worker to decide continuation
 */
async function runPulseWake(entity, options, logger) {
    const {
        wakeType = "scheduled",
        chainDepth = 0,
        taskContext = null,
    } = options;
    const pulseConfig = entity.pulse || {};
    const maxChainDepth = pulseConfig.maxChainDepth ?? 10;

    // Create pulse log entry
    const pulseLog = await PulseLog.create({
        entityId: entity.id,
        entityName: entity.name,
        wakeType,
        chainDepth,
        status: "in_progress",
    });

    const startTime = Date.now();

    try {
        // Guard: active conversation
        if (await isEntityActive(entity.id)) {
            await PulseLog.findByIdAndUpdate(pulseLog._id, {
                status: "skipped",
                skipReason: "active_conversation",
                durationMs: Date.now() - startTime,
            });
            logger(`[Pulse] Skipping ${entity.name} — active conversation`);
            return { signal: "skipped", reason: "active_conversation" };
        }

        // Guard: daily budget
        const budget = await checkDailyBudget(entity.id, pulseConfig);
        if (budget.exhausted) {
            await PulseLog.findByIdAndUpdate(pulseLog._id, {
                status: "skipped",
                skipReason: "budget_exhausted",
                durationMs: Date.now() - startTime,
            });
            logger(
                `[Pulse] Skipping ${entity.name} — daily budget exhausted (${budget.wakes} wakes, ${budget.tokens} tokens)`,
            );
            return { signal: "skipped", reason: "budget_exhausted" };
        }

        // Guard: active hours
        if (!isInActiveHours(pulseConfig)) {
            await PulseLog.findByIdAndUpdate(pulseLog._id, {
                status: "skipped",
                skipReason: "outside_active_hours",
                durationMs: Date.now() - startTime,
            });
            logger(`[Pulse] Skipping ${entity.name} — outside active hours`);
            return { signal: "skipped", reason: "outside_active_hours" };
        }

        // Guard: max chain depth
        if (chainDepth >= maxChainDepth) {
            await PulseLog.findByIdAndUpdate(pulseLog._id, {
                status: "skipped",
                skipReason: "max_chain_depth",
                durationMs: Date.now() - startTime,
            });
            logger(
                `[Pulse] Skipping ${entity.name} — max chain depth (${chainDepth}/${maxChainDepth})`,
            );
            return { signal: "skipped", reason: "max_chain_depth" };
        }

        // Clean up stuck pulse logs and recover context if needed
        const recoveredContext = await cleanupStuckPulseLogs(entity.id);
        const recoveryNotice = !!recoveredContext;

        // Parallel fetches — always get compass, taskContext, and last wake time
        const [lastWakeTime, persistedTaskContext, compass] = await Promise.all(
            [
                getLastWakeTime(entity.id),
                getPersistedTaskContext(entity.id),
                getPulseCompass(entity.id),
            ],
        );

        // Priority: explicit taskContext > persisted Redis > recovered from stuck log
        const resolvedTaskContext =
            taskContext || persistedTaskContext || recoveredContext;

        // Build wake prompt
        const wakePrompt = buildWakePrompt(entity, {
            wakeType,
            chainDepth,
            maxChainDepth,
            taskContext: resolvedTaskContext,
            lastWakeTime,
            compass,
            recoveryNotice,
        });

        logger(
            `[Pulse] Waking ${entity.name} (${wakeType}, chain=${chainDepth})`,
        );

        // Invoke cortex agent
        const client = await getClient();
        const variables = {
            chatHistory: [{ role: "user", content: [wakePrompt] }],
            aiName: entity.name,
            entityId: entity.id,
            model:
                pulseConfig.model ||
                entity.modelOverride ||
                entity.preferredModel ||
                PULSE_DEFAULT_MODEL,
            useMemory: true,
            invocationType: "pulse",
        };

        const result = await client.query({
            query: QUERIES.SYS_ENTITY_AGENT,
            variables,
        });

        const agentResult = result.data?.sys_entity_agent;
        const durationMs = Date.now() - startTime;

        // Check for EndPulse signal (set by the tool in Redis)
        const endSignal = await getPulseEndSignal(entity.id);

        // Extract token usage from cortex resultData and increment budget
        let tokenCount = 0;
        if (agentResult?.resultData) {
            try {
                const rd =
                    typeof agentResult.resultData === "string"
                        ? JSON.parse(agentResult.resultData)
                        : agentResult.resultData;
                const usageArr = Array.isArray(rd?.usage)
                    ? rd.usage
                    : rd?.usage
                      ? [rd.usage]
                      : [];
                for (const u of usageArr) {
                    if (!u) continue;
                    tokenCount +=
                        (u.prompt_tokens ||
                            u.input_tokens ||
                            u.promptTokenCount ||
                            0) +
                        (u.completion_tokens ||
                            u.output_tokens ||
                            u.candidatesTokenCount ||
                            0);
                }
            } catch {
                /* malformed resultData — count stays 0 */
            }
        }
        await incrementBudget(entity.id, tokenCount);

        if (endSignal) {
            // Entity called EndPulse — resting
            await PulseLog.findByIdAndUpdate(pulseLog._id, {
                status: "completed",
                endSignal: "rest",
                taskContext: endSignal.taskContext || null,
                reflection: endSignal.reflection || null,
                durationMs,
            });

            logger(
                `[Pulse] ${entity.name} resting${endSignal.taskContext ? " (has task context for next wake)" : ""}`,
            );
            return { signal: "rest", endSignal };
        }

        // Entity didn't call EndPulse — hit tool limit, auto-continue.
        // Use the agent's final response as task context for the next cycle
        // so it knows what it was doing when the limit was reached.
        const autoTaskContext = agentResult?.result
            ? agentResult.result.slice(0, 2000)
            : null;

        // Persist task context to Redis so it survives worker crashes
        await setPulseTaskContext(entity.id, autoTaskContext);

        await PulseLog.findByIdAndUpdate(pulseLog._id, {
            status: "completed",
            endSignal: "tool_limit",
            taskContext: autoTaskContext,
            durationMs,
        });

        logger(`[Pulse] ${entity.name} hit tool budget — will auto-continue`);
        return {
            signal: "continue",
            chainDepth: chainDepth + 1,
            taskContext: autoTaskContext,
        };
    } catch (error) {
        const durationMs = Date.now() - startTime;
        await PulseLog.findByIdAndUpdate(pulseLog._id, {
            status: "failed",
            endSignal: "error",
            error: error.message,
            durationMs,
        });

        logger(`[Pulse] ${entity.name} failed: ${error.message}`);
        return { signal: "error", error: error.message };
    }
}

/**
 * Get all pulse-enabled entities from MongoDB.
 * Uses the cortex entity store collection directly.
 */
async function getPulseEnabledEntities() {
    const db = await getEntityDb();
    if (!db) {
        console.error("[Pulse] No database connection (MONGO_URI not set)");
        return [];
    }

    const collection = db.collection("entities");
    const entities = await collection.find({ "pulse.enabled": true }).toArray();

    return entities;
}

/**
 * Run pulse wakes for all enabled entities.
 * Called by the pulse worker on each scheduled interval.
 */
async function runPulsesForAllEntities(logger) {
    const entities = await getPulseEnabledEntities();

    if (entities.length === 0) {
        logger("[Pulse] No pulse-enabled entities found");
        return;
    }

    logger(`[Pulse] Found ${entities.length} pulse-enabled entities`);

    // Process entities sequentially to avoid overwhelming cortex
    for (const entity of entities) {
        try {
            await runPulseWake(entity, { wakeType: "scheduled" }, (msg) =>
                logger(msg),
            );
        } catch (error) {
            logger(`[Pulse] Error processing ${entity.name}: ${error.message}`);
        }
    }
}

export {
    acquirePulseLock,
    buildWakePrompt,
    checkDailyBudget,
    cleanupStuckPulseLogs,
    getPulseEnabledEntities,
    getPersistedTaskContext,
    isEntityActive,
    isInActiveHours,
    refreshPulseLock,
    releasePulseLock,
    runPulseWake,
    runPulsesForAllEntities,
    setPulseTaskContext,
};

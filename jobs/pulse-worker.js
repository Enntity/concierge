/**
 * Pulse Worker — Life Loop Scheduler
 *
 * BullMQ queue and worker for scheduling entity pulse wakes.
 * Each pulse-enabled entity gets a repeatable job at its configured interval.
 *
 * Integration:
 * - Imported and started by worker.js alongside digest and task workers
 * - Uses the same Redis connection as other workers
 * - Reads entity pulse config from MongoDB entities collection
 */

import { Queue, Worker } from "bullmq";
import {
    acquirePulseLock,
    getPulseEnabledEntities,
    refreshPulseLock,
    releasePulseLock,
    runPulseWake,
} from "./pulse-build.js";
import { Logger } from "./logger.js";

const PULSE_QUEUE_NAME = "pulse";
const PULSE_WAKE_JOB = "pulse-wake";
const PULSE_CONTINUE_JOB = "pulse-continue";
const PULSE_RESCHEDULE_JOB = "pulse-reschedule";

// Default interval: 15 minutes (in milliseconds)
const DEFAULT_PULSE_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Initialize the pulse queue and schedule repeatable jobs for each entity.
 *
 * @param {import('ioredis').Redis} connection - Shared Redis connection
 * @returns {{ queue: Queue, worker: Worker }}
 */
export function initializePulseSystem(connection) {
    const queue = new Queue(PULSE_QUEUE_NAME, { connection });

    // Worker processes pulse wake and continuation jobs
    // NOTE: Do NOT call closeDatabaseConnection() per-job. With concurrency: 5,
    // one job finishing would call mongoose.disconnect() and kill concurrent jobs.
    // The database connection is established once via startWorkers() in worker.js
    // and mongoose handles connection pooling automatically.
    const worker = new Worker(
        PULSE_QUEUE_NAME,
        async (job) => {
            try {
                const logger = new Logger({
                    id: job.id,
                    name: job.name,
                    queueName: PULSE_QUEUE_NAME,
                });

                if (job.name === PULSE_WAKE_JOB) {
                    await handlePulseWake(job, queue, logger);
                } else if (job.name === PULSE_CONTINUE_JOB) {
                    await handlePulseContinue(job, queue, logger);
                } else if (job.name === PULSE_RESCHEDULE_JOB) {
                    logger.log(
                        "[Pulse Worker] Rescheduling pulse jobs (config changed)",
                    );
                    await schedulePulseJobs(queue);
                }
            } catch (error) {
                console.error(`[Pulse Worker] Job failed: ${error.message}`);
                throw error;
            }
        },
        {
            connection,
            autorun: false,
            concurrency: 5,
            lockDuration: 600000, // 10 min — pulse invocations are long-running
            maxStalledCount: 0, // Never retry stalled jobs — cortex may still be running
        },
    );

    worker.on("completed", (job) => {
        const logger = new Logger({
            id: job.id,
            name: job.name,
            queueName: PULSE_QUEUE_NAME,
        });
        logger.log("[Pulse Worker] job completed");
    });

    worker.on("failed", (job, error) => {
        const logger = new Logger({
            id: job.id,
            name: job.name,
            queueName: PULSE_QUEUE_NAME,
        });
        logger.log(`[Pulse Worker] job failed: ${error.message}`);
    });

    return { queue, worker };
}

/**
 * Schedule repeatable pulse jobs for all enabled entities.
 * Called on worker startup after DB is initialized.
 *
 * @param {Queue} queue
 */
export async function schedulePulseJobs(queue) {
    try {
        // Clear existing repeatable pulse jobs
        const existing = await queue.getRepeatableJobs();
        for (const job of existing) {
            await queue.removeRepeatableByKey(job.key);
        }

        // Clear pending jobs
        for (const job of await queue.getJobs(["waiting", "delayed"])) {
            try {
                await queue.remove(job.id);
            } catch {
                // Job may have already been processed
            }
        }

        // Load pulse-enabled entities and schedule
        const entities = await getPulseEnabledEntities();

        if (entities.length === 0) {
            console.log(
                "[Pulse] No pulse-enabled entities — no jobs scheduled",
            );
            return;
        }

        for (const entity of entities) {
            const pulseConfig = entity.pulse || {};
            const intervalMs =
                (pulseConfig.wakeIntervalMinutes || 15) * 60 * 1000;

            await queue.add(
                PULSE_WAKE_JOB,
                {
                    entityId: entity.id,
                    entityName: entity.name,
                    wakeType: "scheduled",
                    chainDepth: 0,
                },
                {
                    repeat: { every: intervalMs },
                    jobId: `pulse-${entity.id}`,
                    delay: 60 * 1000, // 1 minute delay to avoid startup race
                },
            );

            console.log(
                `[Pulse] Scheduled ${entity.name} every ${pulseConfig.wakeIntervalMinutes || 15} min`,
            );
        }

        console.log(`[Pulse] Scheduled ${entities.length} entity pulse jobs`);
    } catch (error) {
        console.error(
            `[Pulse] Failed to schedule pulse jobs: ${error.message}`,
        );
    }
}

/**
 * Handle a scheduled pulse wake job.
 * Acquires a per-entity lock to prevent overlapping invocations —
 * if a chain overruns the schedule interval, the next scheduled wake skips.
 */
async function handlePulseWake(job, queue, logger) {
    const { entityId, entityName } = job.data;

    // Guard: prevent overlapping pulse invocations for the same entity
    if (!(await acquirePulseLock(entityId))) {
        logger.log(
            `[Pulse] Skipping scheduled wake for ${entityName} — pulse already in progress`,
        );
        return;
    }

    let shouldRelease = true;
    try {
        // Load fresh entity config
        const entities = await getPulseEnabledEntities();
        const entity = entities.find((e) => e.id === entityId);

        if (!entity) {
            logger.log(
                `[Pulse] Entity ${entityName} (${entityId}) no longer pulse-enabled — skipping`,
            );
            return;
        }

        if (!entity.pulse?.enabled) {
            logger.log(
                `[Pulse] Entity ${entity.name} pulse disabled — skipping`,
            );
            return;
        }

        const result = await runPulseWake(
            entity,
            {
                wakeType: "scheduled",
                chainDepth: 0,
            },
            (msg) => logger.log(msg),
        );

        // Handle auto-continuation — keep lock held through the chain
        if (result.signal === "continue") {
            try {
                await enqueueContinuation(
                    queue,
                    entity,
                    result.chainDepth,
                    result.taskContext,
                );
                shouldRelease = false; // Only hold lock if enqueue succeeded
            } catch (enqueueError) {
                logger.log(
                    `[Pulse] Failed to enqueue continuation for ${entityName}: ${enqueueError.message}`,
                );
                // shouldRelease stays true — lock will be released in finally
            }
        }
    } finally {
        if (shouldRelease) {
            await releasePulseLock(entityId);
        }
    }
}

/**
 * Handle a continuation job (entity hit tool limit, wants more time).
 * Refreshes the per-entity lock TTL and releases it when the chain ends.
 */
async function handlePulseContinue(job, queue, logger) {
    const { entityId, chainDepth, taskContext } = job.data;

    // Refresh lock TTL — this continuation is proof the chain is still alive
    await refreshPulseLock(entityId);

    let shouldRelease = true;
    try {
        // Load fresh entity config
        const entities = await getPulseEnabledEntities();
        const entity = entities.find((e) => e.id === entityId);

        if (!entity || !entity.pulse?.enabled) {
            logger.log(
                `[Pulse] Entity ${entityId} no longer pulse-enabled — stopping chain`,
            );
            return;
        }

        const result = await runPulseWake(
            entity,
            {
                wakeType: "continue",
                chainDepth,
                taskContext,
            },
            (msg) => logger.log(msg),
        );

        // Continue the chain — keep lock held
        if (result.signal === "continue") {
            try {
                await enqueueContinuation(
                    queue,
                    entity,
                    result.chainDepth,
                    result.taskContext,
                );
                shouldRelease = false; // Only hold lock if enqueue succeeded
            } catch (enqueueError) {
                logger.log(
                    `[Pulse] Failed to enqueue continuation for ${entity.name}: ${enqueueError.message}`,
                );
            }
        }
    } finally {
        if (shouldRelease) {
            await releasePulseLock(entityId);
        }
    }
}

/**
 * Enqueue a continuation job with a small delay.
 */
async function enqueueContinuation(queue, entity, chainDepth, taskContext) {
    await queue.add(
        PULSE_CONTINUE_JOB,
        {
            entityId: entity.id,
            entityName: entity.name,
            wakeType: "continue",
            chainDepth,
            taskContext,
        },
        {
            delay: 2000, // 2 second delay between continuations
        },
    );
}

export { PULSE_QUEUE_NAME };

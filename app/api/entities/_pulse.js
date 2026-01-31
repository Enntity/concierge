import { Queue } from "bullmq";
import Redis from "ioredis";

const PULSE_QUEUE_NAME = "pulse";
const { REDIS_CONNECTION_STRING } = process.env;

let pulseQueue = null;

function getPulseQueue() {
    if (!pulseQueue) {
        const connection = new Redis(
            REDIS_CONNECTION_STRING || "redis://localhost:6379",
            { maxRetriesPerRequest: null },
        );
        pulseQueue = new Queue(PULSE_QUEUE_NAME, { connection });
    }
    return pulseQueue;
}

/**
 * Trigger pulse job rescheduling by adding a reschedule job to the pulse queue.
 * The pulse worker picks this up and re-reads entity configs from MongoDB.
 */
export async function triggerPulseReschedule() {
    const queue = getPulseQueue();
    await queue.add("pulse-reschedule", {}, { delay: 2000 });
}

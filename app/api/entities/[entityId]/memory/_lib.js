import mongoose from "mongoose";
import { connectToDatabase } from "../../../../../src/db.mjs";

const DEFAULT_COLLECTION = "continuity_memories";

/**
 * Get MongoDB collection for continuity memories
 * Uses the mongoose connection which has CSFLE configured for the content field
 * @returns {Promise<{collection: import('mongodb').Collection, client: null}>}
 */
export async function getContinuityMemoriesCollection() {
    // Ensure database is connected (with CSFLE if configured)
    await connectToDatabase();

    // Use the mongoose connection's underlying MongoDB client
    // This client has autoEncryption configured in db.mjs
    const db = mongoose.connection.db;
    if (!db) {
        throw new Error("MongoDB not connected");
    }

    const collection = db.collection(DEFAULT_COLLECTION);

    // Return null for client since we're using the shared mongoose connection
    // Callers should NOT close this client
    return { collection, client: null };
}

/**
 * Validate entityId format (UUID)
 * @param {string} entityId
 * @returns {boolean}
 */
export function isValidEntityId(entityId) {
    if (!entityId || typeof entityId !== "string") return false;
    // UUID v4 format: 8-4-4-4-12 hex digits
    const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(entityId);
}

import { MongoClient } from "mongodb";
import { connectToDatabase } from "../../../src/db.mjs";

const DEFAULT_COLLECTION = "entities";

/**
 * Get MongoDB collection for entities
 * @returns {Promise<{collection: import('mongodb').Collection, client: MongoClient}>}
 */
export async function getEntitiesCollection() {
    await connectToDatabase();
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error("MongoDB not configured");
    }

    const client = new MongoClient(mongoUri);
    await client.connect();

    // Get database name from URI or use default
    const uriPath = new URL(mongoUri).pathname.split("/").filter(Boolean);
    const dbName = uriPath[0] || process.env.MONGO_DB_NAME || "cortex";
    const db = client.db(dbName);
    const collection = db.collection(DEFAULT_COLLECTION);

    return { collection, client };
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

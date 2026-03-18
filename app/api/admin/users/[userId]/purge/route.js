import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../utils/auth";
import User from "../../../../models/user";
import Chat from "../../../../models/chat";
import Task from "../../../../models/task";
import MediaItem from "../../../../models/media-item";
import UserState from "../../../../models/user-state";
import Digest from "../../../../models/digest";
import mongoose from "mongoose";
import { connectToDatabase } from "../../../../../../src/db.mjs";

/**
 * DELETE /api/admin/users/[userId]/purge
 * Completely purge a user and all associated data
 * Requires admin role
 */
export async function DELETE(req, { params }) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== "admin") {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 },
            );
        }

        const { userId } = params;
        if (!userId) {
            return NextResponse.json(
                { error: "User ID required" },
                { status: 400 },
            );
        }

        // Prevent admin from purging themselves
        if (currentUser._id.toString() === userId) {
            return NextResponse.json(
                { error: "Cannot purge your own account" },
                { status: 400 },
            );
        }

        await connectToDatabase();

        // Find the user to be purged
        const userToPurge = await User.findById(userId);
        if (!userToPurge) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 },
            );
        }

        const contextId = userToPurge.contextId;
        const userObjectId = userToPurge._id;

        console.log(
            `[Admin] Starting purge for user ${userToPurge.username} (${userId})`,
        );

        const results = {
            user: null,
            chats: 0,
            tasks: 0,
            mediaItems: 0,
            userState: 0,
            digest: 0,
            entities: 0,
            memories: 0,
        };

        // 1. Delete all chats
        const chatResult = await Chat.deleteMany({ userId: userObjectId });
        results.chats = chatResult.deletedCount;

        // 2. Delete tasks
        const taskResult = await Task.deleteMany({ owner: userObjectId });
        results.tasks = taskResult.deletedCount;

        // 3. Delete media items
        const mediaResult = await MediaItem.deleteMany({ user: userObjectId });
        results.mediaItems = mediaResult.deletedCount;

        // 4. Delete user state
        const stateResult = await UserState.deleteMany({ user: userObjectId });
        results.userState = stateResult.deletedCount;

        // 5. Delete digest
        const digestResult = await Digest.deleteMany({ owner: userObjectId });
        results.digest = digestResult.deletedCount;

        // 6. Remove user from entities' assocUserIds (Cortex entities)
        if (contextId) {
            try {
                const db = mongoose.connection.db;
                const entitiesCollection = db.collection("entities");

                // Pull the user's contextId from assocUserIds array in all entities
                const entityResult = await entitiesCollection.updateMany(
                    { assocUserIds: contextId },
                    { $pull: { assocUserIds: contextId } },
                );
                results.entities = entityResult.modifiedCount;
            } catch (error) {
                console.error("Error updating entities:", error);
                // Continue with purge even if this fails
            }

            // 7. Delete user's memories from continuity_memories
            try {
                const db = mongoose.connection.db;
                const memoriesCollection = db.collection("continuity_memories");

                // Delete all memories where user's contextId is in assocEntityIds
                const memoryResult = await memoriesCollection.deleteMany({
                    assocEntityIds: contextId,
                });
                results.memories = memoryResult.deletedCount;
            } catch (error) {
                console.error("Error deleting memories:", error);
                // Continue with purge even if this fails
            }
        }

        // 8. Finally, delete the user
        await User.findByIdAndDelete(userId);
        results.user = userToPurge.username;

        console.log(
            `[Admin] Purge complete for user ${userToPurge.username}:`,
            results,
        );

        return NextResponse.json({
            success: true,
            message: `User ${userToPurge.username} and all associated data purged`,
            results,
        });
    } catch (error) {
        console.error("[Admin] Purge error:", error);
        return NextResponse.json(
            { error: error.message || "Purge failed" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

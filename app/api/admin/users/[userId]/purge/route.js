import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../utils/auth";
import User from "../../../../models/user";
import Chat from "../../../../models/chat";
import Workspace from "../../../../models/workspace";
import WorkspaceMembership from "../../../../models/workspace-membership";
import Task from "../../../../models/task";
import MediaItem from "../../../../models/media-item";
import UserState from "../../../../models/user-state";
import Digest from "../../../../models/digest";
import Prompt from "../../../../models/prompt";
import Applet from "../../../../models/applet";
import AppletData from "../../../../models/applet-data";
import AppletFile from "../../../../models/applet-file";
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
            workspaces: 0,
            memberships: 0,
            tasks: 0,
            mediaItems: 0,
            userState: 0,
            digest: 0,
            entities: 0,
            memories: 0,
            prompts: 0,
            applets: 0,
            appletData: 0,
            appletFiles: 0,
        };

        // 1. Delete all chats
        const chatResult = await Chat.deleteMany({ userId: userObjectId });
        results.chats = chatResult.deletedCount;

        // 2. Delete workspaces and associated data
        const userWorkspaces = await Workspace.find({ owner: userObjectId });
        for (const workspace of userWorkspaces) {
            // Delete prompts associated with workspace
            if (workspace.prompts?.length > 0) {
                const promptResult = await Prompt.deleteMany({
                    _id: { $in: workspace.prompts },
                });
                results.prompts += promptResult.deletedCount;
            }

            // Delete applet and associated data
            if (workspace.applet) {
                await AppletData.deleteMany({ applet: workspace.applet });
                await AppletFile.deleteMany({ applet: workspace.applet });
                await Applet.findByIdAndDelete(workspace.applet);
                results.applets += 1;
            }
        }
        const workspaceResult = await Workspace.deleteMany({
            owner: userObjectId,
        });
        results.workspaces = workspaceResult.deletedCount;

        // 3. Delete workspace memberships
        const membershipResult = await WorkspaceMembership.deleteMany({
            user: userObjectId,
        });
        results.memberships = membershipResult.deletedCount;

        // 4. Delete tasks
        const taskResult = await Task.deleteMany({ owner: userObjectId });
        results.tasks = taskResult.deletedCount;

        // 5. Delete media items
        const mediaResult = await MediaItem.deleteMany({ user: userObjectId });
        results.mediaItems = mediaResult.deletedCount;

        // 6. Delete user state
        const stateResult = await UserState.deleteMany({ user: userObjectId });
        results.userState = stateResult.deletedCount;

        // 7. Delete digest
        const digestResult = await Digest.deleteMany({ owner: userObjectId });
        results.digest = digestResult.deletedCount;

        // 8. Remove user from entities' assocUserIds (Cortex entities)
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

            // 9. Delete user's memories from continuity_memories
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

        // 10. Finally, delete the user
        await User.findByIdAndDelete(userId);
        results.user = userToPurge.username;

        console.log(`[Admin] Purge complete for user ${userToPurge.username}:`, results);

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

import { auth } from "../../../auth";
import User from "../models/user";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import crypto from "crypto";

export const getCurrentUser = async (convertToJsonObj = true) => {
    if (!mongoose.connection.readyState) {
        return { userId: "nodb", name: "No Database Connected" };
    }

    // Get user from NextAuth session
    const session = await auth();

    if (!session?.user) {
        return { userId: "anonymous", name: "Anonymous" };
    }

    const id =
        session.user.id ||
        `oauth_${session.user.email?.replace("@", "_").replace(/\./g, "_")}`;
    const username = session.user.email;

    // Find or create user in database
    let user = await User.findOne({ userId: id });

    // If not found by userId, try to find by username (for users with existing accounts)
    if (!user) {
        user = await User.findOne({ username: username });
        if (user) {
            // Update the userId to the OAuth ID
            user.userId = id;
            try {
                await user.save();
            } catch (err) {
                console.log("Error updating user userId:", err);
            }
        }
    }

    // Create new user if not found
    if (!user) {
        const name = session.user.name || username.split("@")[0];
        const contextId = uuidv4();
        const contextKey = crypto.randomBytes(32).toString("hex");

        try {
            user = await User.create({
                userId: id,
                username,
                name,
                contextId,
                contextKey,
                aiMemorySelfModify: true,
                aiName: "Enntity",
                agentModel: "oai-gpt51",
            });
        } catch (error) {
            // Handle race condition: if user was created by another request
            if (error.code === 11000) {
                user =
                    (await User.findOne({ userId: id })) ||
                    (await User.findOne({ username }));
                if (!user) throw error;
            } else {
                throw error;
            }
        }
    }

    // Ensure user has contextId and contextKey
    let needsSave = false;

    if (!user.contextId) {
        user.contextId = uuidv4();
        needsSave = true;
    }

    if (!user.contextKey) {
        user.contextKey = crypto.randomBytes(32).toString("hex");
        needsSave = true;
    }

    // Update lastActiveAt if more than 30 mins
    if (!user.lastActiveAt || dayjs().diff(user.lastActiveAt, "minute") > 30) {
        user.lastActiveAt = new Date();
        needsSave = true;
    }

    if (needsSave) {
        try {
            user = await user.save();
        } catch (err) {
            console.log("Error saving user:", err);
        }
    }

    if (convertToJsonObj) {
        user = JSON.parse(JSON.stringify(user.toJSON()));
    }

    return user;
};

export const handleError = (error) => {
    console.error(
        error?.response?.data?.errors ||
            error?.response?.data?.error ||
            error?.response?.data ||
            error?.toString(),
    );
    return Response.json(
        {
            error: JSON.stringify(
                error?.response?.data?.errors ||
                    error?.response?.data?.error ||
                    error?.response?.data ||
                    error?.toString(),
            ),
        },
        { status: 500 },
    );
};

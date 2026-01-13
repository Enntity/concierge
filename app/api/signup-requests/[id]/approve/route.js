import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../utils/auth";
import UserSignupRequest from "../../../models/user-signup-request.mjs";
import User from "../../../models/user.mjs";
import { connectToDatabase } from "../../../../../src/db.mjs";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";

export async function POST(request, { params }) {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role !== "admin") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 403 },
            );
        }

        const { id } = params;

        await connectToDatabase();

        // Find the signup request
        const signupRequest = await UserSignupRequest.findById(id);
        if (!signupRequest) {
            return NextResponse.json(
                { error: "Signup request not found" },
                { status: 404 },
            );
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [
                { username: signupRequest.email },
                { userId: `oauth_${signupRequest.email.replace("@", "_").replace(/\./g, "_")}` },
            ],
        });

        if (existingUser) {
            // User already exists, just delete the signup request
            await UserSignupRequest.findByIdAndDelete(id);
            return NextResponse.json({
                success: true,
                message: "User already exists, signup request removed",
            });
        }

        // Create new user
        const userId = `oauth_${signupRequest.email.replace("@", "_").replace(/\./g, "_")}`;
        const contextId = uuidv4();
        const contextKey = crypto.randomBytes(32).toString("hex");
        const name = signupRequest.name || signupRequest.email.split("@")[0];

        const newUser = await User.create({
            userId,
            username: signupRequest.email,
            name,
            contextId,
            contextKey,
            aiMemorySelfModify: true,
            aiName: "Enntity",
            agentModel: "gemini-flash-3-vision",
            role: "user",
        });

        // Delete the signup request
        await UserSignupRequest.findByIdAndDelete(id);

        return NextResponse.json({
            success: true,
            user: {
                _id: newUser._id.toString(),
                username: newUser.username,
                name: newUser.name,
            },
        });
    } catch (error) {
        console.error("Error approving signup request:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}

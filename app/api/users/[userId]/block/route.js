import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../utils/auth";
import User from "../../../models/user.mjs";

export async function PATCH(request, { params }) {
    try {
        const currentUser = await getCurrentUser();

        if (!currentUser || currentUser.role !== "admin") {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 403 },
            );
        }

        const { userId } = params;
        const { blocked } = await request.json();

        if (typeof blocked !== "boolean") {
            return NextResponse.json(
                { error: "blocked must be a boolean" },
                { status: 400 },
            );
        }

        // Prevent self-blocking
        if (userId === currentUser._id) {
            return NextResponse.json(
                { error: "Cannot block yourself" },
                { status: 400 },
            );
        }

        const user = await User.findById(userId);
        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 },
            );
        }

        user.blocked = blocked;
        await user.save();

        return NextResponse.json({
            success: true,
            blocked: user.blocked,
        });
    } catch (error) {
        console.error("Error updating user block status:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}

import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { connectToDatabase } from "../../../../src/db.mjs";
import User from "../../models/user";

/**
 * GET /api/auth/mobile
 * Verify mobile token and return user info
 *
 * Headers:
 * - Authorization: Bearer <token>
 */
export async function GET(request) {
    try {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json(
                { error: "Missing or invalid authorization header" },
                { status: 401 },
            );
        }

        const token = authHeader.substring(7);
        console.log("[mobile/auth] Token present:", !!token);
        const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

        let payload;
        try {
            const result = await jwtVerify(token, secret);
            payload = result.payload;
            console.log(
                "[mobile/auth] Token verified, userId:",
                payload.userId,
            );
        } catch (err) {
            console.error(
                "[mobile/auth] Token verification failed:",
                err.message,
            );
            return NextResponse.json(
                { error: "Invalid or expired token" },
                { status: 401 },
            );
        }

        // Get fresh user data from database
        await connectToDatabase();
        const user = await User.findOne({ userId: payload.userId });

        if (!user) {
            return NextResponse.json(
                { error: "User not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({
            userId: user.userId,
            contextId: user.contextId,
            email: payload.email,
            name: user.name,
            image: payload.image,
            aiName: user.aiName,
            selectedEntityId: user.selectedEntityId,
        });
    } catch (error) {
        console.error("Mobile auth error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}

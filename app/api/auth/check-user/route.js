import { connectToDatabase } from "../../../../src/db.mjs";
import User from "../../models/user.mjs";

/**
 * POST /api/auth/check-user
 * Checks if a user exists and is not blocked.
 * Used by auth.js in Edge Runtime to verify user access.
 *
 * Protected by AUTH_SECRET to prevent abuse - only callable from auth.js
 */
export async function POST(req) {
    try {
        // Verify request is from our auth flow using AUTH_SECRET
        const authHeader = req.headers.get("x-auth-secret");
        if (authHeader !== process.env.AUTH_SECRET) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { email } = await req.json();

        if (!email) {
            return Response.json(
                { error: "Email is required" },
                { status: 400 },
            );
        }

        await connectToDatabase();

        // Check if user exists
        const user = await User.findOne({
            username: email.toLowerCase(),
        });

        if (!user) {
            // User doesn't exist - they need to be approved
            return Response.json({
                exists: false,
                blocked: false,
            });
        }

        // User exists - check if blocked
        return Response.json({
            exists: true,
            blocked: user.blocked === true,
        });
    } catch (error) {
        console.error("Failed to check user:", error);
        // Don't expose internal errors
        return Response.json(
            { error: "Failed to check user" },
            { status: 500 },
        );
    }
}

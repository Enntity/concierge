import { connectToDatabase } from "../../../../src/db.mjs";
import UserSignupRequest from "../../models/user-signup-request.mjs";

/**
 * POST /api/auth/log-signup-request
 * Logs a signup request from a user whose domain is not allowed.
 * Uses upsert to prevent duplicate entries and rate-limit database writes.
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

        const { email, name, domain } = await req.json();

        if (!email) {
            return Response.json(
                { error: "Email is required" },
                { status: 400 },
            );
        }

        await connectToDatabase();

        // Use upsert to update existing request or create new one
        await UserSignupRequest.findOneAndUpdate(
            { email: email.toLowerCase() },
            {
                $set: {
                    name: name || null,
                    domain: domain || null,
                    requestedAt: new Date(),
                },
            },
            { upsert: true, new: true },
        );

        return Response.json({ success: true });
    } catch (error) {
        console.error("Failed to log signup request:", error);
        // Don't expose internal errors
        return Response.json(
            { error: "Failed to log request" },
            { status: 500 },
        );
    }
}

import { createHmac } from "crypto";
import { getCurrentUser } from "../../utils/auth";

/**
 * Voice token API endpoint
 * Generates an HMAC-signed token for authenticating with the voice server.
 * Requires an authenticated session.
 */
export async function POST() {
    const user = await getCurrentUser();
    if (!user?.contextId) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const authSecret = process.env.AUTH_SECRET;
    if (!authSecret) {
        return Response.json({ error: "Auth not configured" }, { status: 500 });
    }

    const payload = {
        userId: user.userId,
        contextId: user.contextId,
        contextKey: user.contextKey,
        exp: Date.now() + 5 * 60 * 1000, // 5 minute expiry
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    const signature = createHmac("sha256", authSecret)
        .update(payloadB64)
        .digest("hex");

    return Response.json({ token: `${payloadB64}.${signature}` });
}

export const dynamic = "force-dynamic";

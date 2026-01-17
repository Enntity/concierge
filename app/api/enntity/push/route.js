import crypto from "crypto";
import webpush from "web-push";
import { connectToDatabase } from "../../../../src/db.mjs";
import { getCurrentUser } from "../../utils/auth";
import User from "../../models/user.mjs";

const VAPID_PUBLIC_KEY =
    process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT =
    process.env.VAPID_SUBJECT || "mailto:notifications@enntity.ai";
const SHARED_KEY = process.env.ENNTITY_API_SHARED_KEY;

// Configure VAPID once at module load
let vapidConfigured = false;
function ensureVapidConfigured() {
    if (vapidConfigured) return;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        throw new Error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY");
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
}

function hasValidSharedKey(request) {
    if (!SHARED_KEY) {
        throw new Error("Missing ENNTITY_API_SHARED_KEY");
    }

    const provided =
        request.headers.get("x-enntity-push-key") ||
        request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!provided) {
        return false;
    }

    const expectedBuffer = Buffer.from(SHARED_KEY, "utf8");
    const providedBuffer = Buffer.from(provided, "utf8");

    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request) {
    try {
        if (!hasValidSharedKey(request)) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectToDatabase();
        ensureVapidConfigured();
        const data = await request.json();
        const title = data?.title || "Enntity";
        const body = data?.body || "";
        const rawUrl = data?.url || "/chat";
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
        const url = basePath
            ? `${basePath}${rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`}`
            : rawUrl;

        let user = null;
        if (data?.userId || data?.username) {
            // userId from Cortex is actually the user's contextId
            user = await User.findOne({
                ...(data.userId ? { contextId: data.userId } : {}),
                ...(data.username ? { username: data.username } : {}),
            });
        } else {
            user = await getCurrentUser(false);
        }

        if (!user) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }

        const subscriptions = user.pushSubscriptions || [];
        if (!subscriptions.length) {
            return Response.json(
                { error: "No push subscriptions available" },
                { status: 400 },
            );
        }

        const tag = data?.tag || null;
        const payload = JSON.stringify({ title, body, url, tag });
        const results = await Promise.allSettled(
            subscriptions.map((subscription) =>
                webpush.sendNotification(subscription, payload),
            ),
        );

        const invalidEndpoints = new Set();
        results.forEach((result, index) => {
            if (result.status === "rejected") {
                const statusCode = result.reason?.statusCode;
                if (statusCode === 404 || statusCode === 410) {
                    invalidEndpoints.add(subscriptions[index].endpoint);
                }
            }
        });

        if (invalidEndpoints.size > 0) {
            user.pushSubscriptions = user.pushSubscriptions.filter(
                (sub) => !invalidEndpoints.has(sub.endpoint),
            );
            await user.save();
        }

        return Response.json({
            ok: true,
            sent: subscriptions.length - invalidEndpoints.size,
            removed: invalidEndpoints.size,
        });
    } catch (error) {
        console.error("Error sending push notification:", error);
        return Response.json(
            { error: "Failed to send push notification" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

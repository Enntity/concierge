import { connectToDatabase } from "../../../src/db.mjs";
import { getCurrentUser } from "../utils/auth";

export async function POST(request) {
    try {
        await connectToDatabase();
        const user = await getCurrentUser(false);

        // Ensure we have an authenticated user with a mongoose document
        if (!user?._id || !user.pushSubscriptions) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();
        const subscription = data?.subscription;

        if (!subscription?.endpoint || !subscription?.keys?.p256dh) {
            return Response.json(
                { error: "Invalid subscription payload" },
                { status: 400 },
            );
        }

        const now = new Date();
        const normalized = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
            },
            expirationTime: subscription.expirationTime || null,
            userAgent: data?.userAgent || null,
            updatedAt: now,
        };

        const existingIndex = user.pushSubscriptions.findIndex(
            (item) => item.endpoint === subscription.endpoint,
        );

        if (existingIndex >= 0) {
            user.pushSubscriptions[existingIndex] = {
                ...user.pushSubscriptions[existingIndex],
                ...normalized,
            };
        } else {
            user.pushSubscriptions.push({
                ...normalized,
                createdAt: now,
            });
        }

        await user.save();

        return Response.json({ ok: true });
    } catch (error) {
        console.error("Error saving push subscription:", error);
        return Response.json(
            { error: "Failed to save push subscription" },
            { status: 500 },
        );
    }
}

export async function DELETE(request) {
    try {
        await connectToDatabase();
        const user = await getCurrentUser(false);

        if (!user?._id || !user.pushSubscriptions) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();
        const endpoint = data?.endpoint;

        if (!endpoint) {
            return Response.json(
                { error: "Missing endpoint" },
                { status: 400 },
            );
        }

        user.pushSubscriptions = user.pushSubscriptions.filter(
            (sub) => sub.endpoint !== endpoint,
        );
        await user.save();

        return Response.json({ ok: true });
    } catch (error) {
        console.error("Error deleting push subscription:", error);
        return Response.json(
            { error: "Failed to delete push subscription" },
            { status: 500 },
        );
    }
}

export const dynamic = "force-dynamic";

import { getCurrentUser } from "../utils/auth";
import Feedback from "../models/feedback.mjs";
import { connectToDatabase } from "../../../src/db.mjs";

export async function POST(req, res) {
    try {
        const body = await req.json();
        const { message, screenshot } = body;

        const user = await getCurrentUser();
        if (!user || ["anonymous", "nodb"].includes(user.userId)) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!message || typeof message !== "string") {
            return Response.json(
                { error: "Message is required" },
                { status: 400 },
            );
        }

        await connectToDatabase();

        const userId =
            user?._id && typeof user._id.toString === "function"
                ? user._id.toString()
                : user?._id || null;

        await Feedback.create({
            message: message.trim(),
            screenshot: screenshot || null,
            userId,
            username: user?.username || null,
            name: user?.name || null,
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error("Error saving feedback:", error);
        return Response.json({ error: "Failed to send message" }, 500);
    }
}

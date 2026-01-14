import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../utils/auth";
import Feedback from "../../../../models/feedback.mjs";
import { connectToDatabase } from "../../../../../../src/db.mjs";

/**
 * DELETE /api/admin/feedback/[feedbackId]/delete
 * Delete feedback entry (admin only)
 */
export async function DELETE(req, { params }) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== "admin") {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 },
            );
        }

        const { feedbackId } = params;
        if (!feedbackId) {
            return NextResponse.json(
                { error: "Feedback ID required" },
                { status: 400 },
            );
        }

        await connectToDatabase();

        const result = await Feedback.findByIdAndDelete(feedbackId);
        if (!result) {
            return NextResponse.json(
                { error: "Feedback not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting feedback:", error);
        return NextResponse.json(
            { error: "Failed to delete feedback" },
            { status: 500 },
        );
    }
}

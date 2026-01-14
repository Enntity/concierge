import Feedback from "../../api/models/feedback.mjs";
import { connectToDatabase } from "../../../src/db.mjs";
import { escapeRegex } from "../../api/utils/regex-utils";
import FeedbackManagementClient from "./FeedbackManagementClient";

export default async function FeedbackPage({ searchParams }) {
    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 20;
    const search = searchParams.search || "";

    const skip = (page - 1) * limit;
    const safeSearch = search ? escapeRegex(search) : "";
    const searchQuery = safeSearch
        ? {
              $or: [
                  { message: { $regex: safeSearch, $options: "i" } },
                  { username: { $regex: safeSearch, $options: "i" } },
                  { name: { $regex: safeSearch, $options: "i" } },
              ],
          }
        : {};

    await connectToDatabase();

    const totalFeedback = await Feedback.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalFeedback / limit);

    const feedback = await Feedback.find(searchQuery, "-__v")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const feedbackData = feedback.map((entry) => ({
        _id: entry._id.toString(),
        message: entry.message,
        screenshot: entry.screenshot || null,
        username: entry.username || "Unknown",
        name: entry.name || "Unknown",
        createdAt: entry.createdAt?.toISOString() || new Date().toISOString(),
    }));

    return (
        <FeedbackManagementClient
            initialFeedback={feedbackData}
            totalPages={totalPages}
            currentPage={page}
            search={search}
        />
    );
}

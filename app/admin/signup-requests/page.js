import UserSignupRequest from "../../api/models/user-signup-request.mjs";
import { connectToDatabase } from "../../../src/db.mjs";
import { escapeRegex } from "../../api/utils/regex-utils";
import SignupRequestsClient from "./SignupRequestsClient";

export default async function SignupRequestsPage({ searchParams }) {
    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 20;
    const search = searchParams.search || "";

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Create search query with escaped regex to prevent ReDoS
    const safeSearch = search ? escapeRegex(search) : "";
    const searchQuery = safeSearch
        ? {
              $or: [
                  { email: { $regex: safeSearch, $options: "i" } },
                  { name: { $regex: safeSearch, $options: "i" } },
                  { domain: { $regex: safeSearch, $options: "i" } },
              ],
          }
        : {};

    await connectToDatabase();

    // Get total count for pagination
    const totalRequests = await UserSignupRequest.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalRequests / limit);

    // Fetch paginated requests, sorted by most recent first
    const requests = await UserSignupRequest.find(searchQuery, "-__v")
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    // Convert to plain objects for client component
    const requestsData = requests.map((req) => ({
        _id: req._id.toString(),
        email: req.email,
        name: req.name || "N/A",
        domain: req.domain || "N/A",
        requestedAt: req.requestedAt.toISOString(),
    }));

    return (
        <SignupRequestsClient
            initialRequests={requestsData}
            totalPages={totalPages}
            currentPage={page}
            search={search}
        />
    );
}

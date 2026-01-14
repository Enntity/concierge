import { getCurrentUser } from "../../../app/api/utils/auth";
import User from "../../../app/api/models/user";
import { escapeRegex } from "../../api/utils/regex-utils";
import UserManagementClient from "./UserManagementClient";

export default async function UsersPage({ searchParams }) {
    const page = parseInt(searchParams.page) || 1;
    const limit = parseInt(searchParams.limit) || 10;
    const search = searchParams.search || "";

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Create search query with escaped regex to prevent ReDoS
    const safeSearch = search ? escapeRegex(search) : "";
    const searchQuery = safeSearch
        ? {
              $or: [
                  { name: { $regex: safeSearch, $options: "i" } },
                  { username: { $regex: safeSearch, $options: "i" } },
              ],
          }
        : {};

    // Get total count for pagination
    const totalUsers = await User.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalUsers / limit);

    // Fetch paginated users
    const users = await User.find(searchQuery, "-__v")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(); // Convert to plain objects to avoid serialization issues

    const currentUser = await getCurrentUser();

    // Convert to plain objects for client component
    const usersData = users.map((user) => ({
        _id: user._id.toString(),
        name: user.name,
        username: user.username,
        role: user.role || "user",
        blocked: user.blocked === true,
        createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
        lastActiveAt: user.lastActiveAt
            ? user.lastActiveAt.toISOString()
            : null,
    }));

    return (
        <UserManagementClient
            initialUsers={usersData}
            currentUser={currentUser}
            totalPages={totalPages}
            currentPage={page}
            search={search}
        />
    );
}

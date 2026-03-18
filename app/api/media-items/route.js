import { getCurrentUser } from "../utils/auth.js";
import MediaItem from "../models/media-item.mjs";
import { parseSearchQuery } from "../utils/search-parser.js";
import { escapeRegex } from "../utils/regex-utils.js";
import {
    findMediaServiceFile,
    listFilesFromMediaService,
} from "../utils/media-service-utils.js";
import {
    extractBlobPathFromUrl,
    getFilenameFromBlobPath,
} from "../../../src/utils/storageTargets.js";

function normalizeMediaItemPayload(body = {}) {
    const url = body.url || null;
    const blobPath = body.blobPath || extractBlobPathFromUrl(url);
    const filename = body.filename || getFilenameFromBlobPath(blobPath);

    return {
        ...body,
        ...(url ? { url } : {}),
        ...(blobPath ? { blobPath } : {}),
        ...(filename ? { filename } : {}),
    };
}

function hydrateMediaItem(record, files = []) {
    const blobPath = record.blobPath || extractBlobPathFromUrl(record.url);
    const filename = record.filename || getFilenameFromBlobPath(blobPath);
    const liveFile = findMediaServiceFile(files, { blobPath, filename });
    return {
        ...record,
        url: liveFile?.url || record.url,
        blobPath: liveFile?.blobPath || blobPath || null,
        filename: liveFile?.filename || filename || null,
    };
}

export async function GET(req) {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);

    // Pagination parameters
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 50; // Default 50 items per page
    const skip = (page - 1) * limit;

    // Filter parameters
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const search = searchParams.get("search"); // For searching tags and prompts
    const tags = searchParams.get("tags"); // Comma-separated tags

    try {
        // Validate user._id exists (prevents issues when DB is disconnected)
        if (!user._id) {
            console.error("User _id is missing, cannot fetch media items");
            return Response.json(
                { error: "User authentication invalid" },
                { status: 401 },
            );
        }

        // Build query
        const query = { user: user._id };
        if (status) query.status = status;
        if (type) query.type = type;

        // Handle search functionality
        // Note: Cannot search prompt field due to MongoDB encryption - only search tags
        // Support space-separated search terms with AND logic and "quoted phrases"
        if (search) {
            // Parse search query (handles spaces and quotes)
            const searchTerms = parseSearchQuery(search);

            if (searchTerms.length === 1) {
                // Single term - use regex search with escaped pattern to prevent ReDoS
                const term = searchTerms[0];
                const isQuoted =
                    (term.startsWith('"') && term.endsWith('"')) ||
                    (term.startsWith("'") && term.endsWith("'"));
                const searchPattern = escapeRegex(
                    isQuoted ? term.slice(1, -1) : term,
                );

                query.$or = [
                    { tags: { $regex: searchPattern, $options: "i" } },
                    { status: "pending" },
                ];
            } else if (searchTerms.length > 1) {
                // Multiple terms - use AND logic (all terms must match)
                query.$and = [];

                for (const term of searchTerms) {
                    const isQuoted =
                        (term.startsWith('"') && term.endsWith('"')) ||
                        (term.startsWith("'") && term.endsWith("'"));
                    const searchPattern = escapeRegex(
                        isQuoted ? term.slice(1, -1) : term,
                    );

                    query.$and.push({
                        $or: [
                            { tags: { $regex: searchPattern, $options: "i" } },
                            { status: "pending" },
                        ],
                    });
                }
            }
        }

        // Handle tag filtering
        if (tags) {
            const tagArray = tags
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag);
            if (tagArray.length > 0) {
                query.tags = { $in: tagArray };
            }
        }

        // Get total count for pagination
        const total = await MediaItem.countDocuments(query);

        // Get paginated results
        const mediaItems = await MediaItem.find(query)
            .sort({ created: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        let mediaFiles = [];
        try {
            mediaFiles = await listFilesFromMediaService({
                contextId: user.contextId,
                fileScope: "all",
            });
        } catch (error) {
            console.warn("Failed to refresh media item URLs:", error.message);
        }

        return Response.json({
            mediaItems: mediaItems.map((item) =>
                hydrateMediaItem(item, mediaFiles),
            ),
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1,
            },
        });
    } catch (error) {
        console.error("Error fetching media items:", error);
        return Response.json(
            { error: "Failed to fetch media items" },
            { status: 500 },
        );
    }
}

async function getInheritedTags(userId, inputImageUrls, inputTags = []) {
    // Use tags passed from the frontend instead of querying encrypted URL fields
    if (inputTags && inputTags.length > 0) {
        return inputTags;
    }

    // Fallback: return empty array if no tags provided
    return [];
}

export async function POST(req) {
    const user = await getCurrentUser();
    const body = await req.json();

    try {
        const normalizedBody = normalizeMediaItemPayload(body);
        // Get inherited tags from input images if this is a derivative work
        const inputImageUrls = [
            normalizedBody.inputImageUrl,
            normalizedBody.inputImageUrl2,
            normalizedBody.inputImageUrl3,
        ].filter(Boolean);

        const inheritedTags = await getInheritedTags(
            user._id,
            inputImageUrls,
            normalizedBody.inputTags,
        );

        const mediaItem = new MediaItem({
            ...normalizedBody,
            user: user._id,
            // Inherit tags from input images (only if no tags are explicitly provided)
            tags:
                normalizedBody.tags && normalizedBody.tags.length > 0
                    ? normalizedBody.tags
                    : inheritedTags,
        });

        await mediaItem.save();

        return Response.json(mediaItem);
    } catch (error) {
        console.error("Error creating media item:", error);
        return Response.json(
            { error: "Failed to create media item" },
            { status: 500 },
        );
    }
}

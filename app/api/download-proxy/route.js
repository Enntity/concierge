import { getCurrentUser } from "../utils/auth.js";

/**
 * Proxy endpoint for downloading files from blob storage
 * Bypasses CORS and sets Content-Disposition to force download
 */
export async function GET(req) {
    const user = await getCurrentUser();

    if (!user) {
        return Response.json(
            { error: "Authentication required" },
            { status: 401 },
        );
    }

    try {
        const { searchParams } = new URL(req.url);
        const url = searchParams.get("url");
        const filename = searchParams.get("filename") || "download";

        if (!url) {
            return Response.json(
                { error: "URL parameter is required" },
                { status: 400 },
            );
        }

        // Validate URL is from allowed domains
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        const isAzureBlobStorage = hostname.endsWith(".blob.core.windows.net");
        const isGoogleStorage =
            hostname.includes("storage.googleapis.com") ||
            hostname.includes("storage.cloud.google.com");

        if (!isAzureBlobStorage && !isGoogleStorage) {
            return Response.json(
                { error: "URL is not from an allowed domain" },
                { status: 403 },
            );
        }

        // Fetch the file
        const response = await fetch(url);

        if (!response.ok) {
            return Response.json(
                { error: `Failed to fetch file: ${response.status}` },
                { status: response.status },
            );
        }

        // Get the file content as arraybuffer
        const content = await response.arrayBuffer();
        const contentType =
            response.headers.get("content-type") || "application/octet-stream";

        // Return with Content-Disposition to force download
        return new Response(content, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
                "Cache-Control": "private, no-cache",
            },
        });
    } catch (error) {
        console.error("Error in download proxy:", error);
        return Response.json(
            { error: "Failed to download file" },
            { status: 500 },
        );
    }
}

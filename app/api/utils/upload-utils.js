import { NextResponse } from "next/server";
import Busboy from "busboy";
import { Readable } from "stream";
import {
    analyzeFileContent,
    FILE_VALIDATION_CONFIG,
    scanForMalware,
} from "./fileValidation.js";
import { uploadBufferToMediaService } from "./media-service-utils.js";

/**
 * Parse multipart form data with streaming validation.
 * Returns the uploaded file buffer plus normalized metadata for downstream upload handlers.
 */
export async function parseStreamingMultipart(request) {
    return new Promise((resolve) => {
        try {
            const contentType = request.headers.get("content-type");
            if (!contentType || !contentType.includes("multipart/form-data")) {
                resolve({
                    error: NextResponse.json(
                        { error: "Content-Type must be multipart/form-data" },
                        { status: 400 },
                    ),
                });
                return;
            }

            const busboy = Busboy({
                headers: {
                    "content-type": contentType,
                },
                limits: {
                    fileSize: FILE_VALIDATION_CONFIG.MAX_FILE_SIZE * 2,
                    files: 1,
                    fields: 5,
                    fieldSize: 1024 * 100,
                },
            });

            let fileData = null;
            let chunks = [];
            let totalSize = 0;
            let metadata = {};
            let validationError = null;

            busboy.on("file", (fieldname, file, fileInfo) => {
                const { filename, encoding, mimeType } = fileInfo;

                metadata = {
                    fieldname,
                    filename,
                    encoding,
                    mimeType,
                    size: 0,
                };

                const fileExtension = filename
                    .toLowerCase()
                    .substring(filename.lastIndexOf("."));

                if (
                    FILE_VALIDATION_CONFIG.BLOCKED_EXTENSIONS.includes(
                        fileExtension,
                    )
                ) {
                    validationError = NextResponse.json(
                        {
                            error: "File validation failed",
                            details: [
                                `File extension '${fileExtension}' is not allowed for security reasons`,
                            ],
                        },
                        { status: 400 },
                    );
                    file.resume();
                    return;
                }

                if (
                    !FILE_VALIDATION_CONFIG.ALLOWED_MIME_TYPES.includes(
                        mimeType,
                    )
                ) {
                    validationError = NextResponse.json(
                        {
                            error: "File validation failed",
                            details: [`File type '${mimeType}' is not allowed`],
                        },
                        { status: 400 },
                    );
                    file.resume();
                    return;
                }

                file.on("data", (chunk) => {
                    if (validationError) return;

                    totalSize += chunk.length;
                    metadata.size = totalSize;

                    if (totalSize > FILE_VALIDATION_CONFIG.MAX_FILE_SIZE) {
                        validationError = NextResponse.json(
                            {
                                error: "File validation failed",
                                details: [
                                    `File size exceeds maximum limit of ${(FILE_VALIDATION_CONFIG.MAX_FILE_SIZE / (1024 * 1024)).toFixed(1)}MB`,
                                ],
                            },
                            { status: 400 },
                        );
                        file.resume();
                        return;
                    }

                    chunks.push(chunk);
                });

                file.on("end", () => {
                    if (!validationError) {
                        fileData = Buffer.concat(chunks);
                    }
                });

                file.on("error", (error) => {
                    console.error("File stream error:", error);
                    validationError = NextResponse.json(
                        { error: "File upload stream error" },
                        { status: 500 },
                    );
                });
            });

            busboy.on("field", (fieldname, value) => {
                metadata[fieldname] = value;
            });

            busboy.on("finish", async () => {
                if (validationError) {
                    resolve({ error: validationError });
                    return;
                }

                if (!fileData) {
                    resolve({
                        error: NextResponse.json(
                            { error: "No file provided in request" },
                            { status: 400 },
                        ),
                    });
                    return;
                }

                if (metadata.size === 0) {
                    resolve({
                        error: NextResponse.json(
                            { error: "File cannot be empty" },
                            { status: 400 },
                        ),
                    });
                    return;
                }

                const mockFile = {
                    name: metadata.filename,
                    type: metadata.mimeType,
                    size: metadata.size,
                };

                const contentAnalysis = analyzeFileContent(mockFile);
                const malwareScan = await scanForMalware(mockFile);
                if (!malwareScan.clean) {
                    resolve({
                        error: NextResponse.json(
                            {
                                error: "Security threat detected",
                                details: "File failed malware scan",
                            },
                            { status: 400 },
                        ),
                    });
                    return;
                }

                resolve({
                    success: true,
                    data: {
                        file: mockFile,
                        fileBuffer: fileData,
                        metadata,
                        contentAnalysis,
                    },
                });
            });

            busboy.on("error", (error) => {
                console.error("Busboy error:", error);
                resolve({
                    error: NextResponse.json(
                        { error: "Failed to parse multipart data" },
                        { status: 400 },
                    ),
                });
            });

            const stream = Readable.fromWeb(request.body);
            stream.pipe(busboy);
        } catch (error) {
            console.error("Error setting up streaming parser:", error);
            resolve({
                error: NextResponse.json(
                    { error: "Failed to initialize streaming upload" },
                    { status: 500 },
                ),
            });
        }
    });
}

export { uploadBufferToMediaService } from "./media-service-utils.js";

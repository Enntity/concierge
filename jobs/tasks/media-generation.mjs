import { BaseTask } from "./base-task.mjs";
import {
    IMAGE_FLUX,
    IMAGE_GEMINI_25,
    IMAGE_GEMINI_3,
    IMAGE_QWEN,
    IMAGE_SEEDREAM4,
    IMAGE_XAI,
    SYS_MODEL_METADATA,
    VIDEO_KLING,
    VIDEO_VEO,
    VIDEO_SEEDANCE,
    VIDEO_XAI,
} from "../graphql.mjs";
import MediaItem from "../../app/api/models/media-item.mjs";
import {
    buildMediaHelperFileParams,
    createMediaStorageTarget,
    extractBlobPathFromUrl,
    getFilenameFromBlobPath,
} from "../../src/utils/storageTargets.js";

// User model for getting contextId
let User;
async function initializeUserModel() {
    if (!User) {
        const userModule = await import("../../app/api/models/user.mjs");
        User = userModule.default;
    }
    return User;
}

const QUERY_BY_PATHWAY = {
    image_flux: IMAGE_FLUX,
    image_gemini_25: IMAGE_GEMINI_25,
    image_gemini_3: IMAGE_GEMINI_3,
    image_qwen: IMAGE_QWEN,
    image_seedream4: IMAGE_SEEDREAM4,
    image_xai: IMAGE_XAI,
    video_kling: VIDEO_KLING,
    video_veo: VIDEO_VEO,
    video_seedance: VIDEO_SEEDANCE,
    video_xai: VIDEO_XAI,
};

let modelMetadataCache = null;

const getMergedModelSettings = (modelMetadata, settings = {}) => ({
    ...(modelMetadata?.mediaDefaults || {}),
    ...(settings?.models?.[modelMetadata?.modelId] || {}),
});

const normalizeAspectRatio = (aspectRatio, inputImages = []) => {
    if (aspectRatio === "match_input_image" && !inputImages[0]) {
        return "1:1";
    }
    return aspectRatio;
};

async function getModelMetadataStore(client) {
    if (modelMetadataCache) return modelMetadataCache;

    const result = await client.query({
        query: SYS_MODEL_METADATA,
        fetchPolicy: "no-cache",
    });
    modelMetadataCache = JSON.parse(result.data.sys_model_metadata.result);
    return modelMetadataCache;
}

function resolveModelMetadata(store, modelId, outputType) {
    const models = store?.models || [];
    const redirects = store?.redirects || {};
    const resolvedModelId = redirects[modelId] || modelId;

    const direct = models.find((model) => model.modelId === resolvedModelId);
    if (direct) {
        return direct;
    }

    const fallback = models.find(
        (model) => model.category === outputType && model.isDefault,
    );
    return fallback || models.find((model) => model.category === outputType);
}

function buildModelVariables(modelMetadata, prompt, settings, inputImages) {
    const modelSettings = getMergedModelSettings(modelMetadata, settings);
    const pathwayName = modelMetadata.pathwayName;

    switch (pathwayName) {
        case "image_gemini_25": {
            const variables = {
                text: prompt,
                async: true,
                optimizePrompt: modelSettings.optimizePrompt !== false,
            };
            if (inputImages[0]) variables.input_image = inputImages[0];
            if (inputImages[1]) variables.input_image_2 = inputImages[1];
            if (inputImages[2]) variables.input_image_3 = inputImages[2];
            return variables;
        }
        case "image_gemini_3": {
            const variables = {
                text: prompt,
                async: true,
                optimizePrompt: modelSettings.optimizePrompt !== false,
            };
            if (modelSettings.aspectRatio) {
                variables.aspectRatio = modelSettings.aspectRatio;
            }
            if (modelSettings.image_size) {
                variables.image_size = modelSettings.image_size;
            }
            inputImages.slice(0, 14).forEach((image, index) => {
                const key =
                    index === 0 ? "input_image" : `input_image_${index + 1}`;
                variables[key] = image;
            });
            return variables;
        }
        case "image_qwen": {
            return {
                text: prompt,
                model: modelMetadata.modelId,
                async: true,
                negativePrompt: modelSettings.negativePrompt,
                width: modelSettings.width,
                height: modelSettings.height,
                aspectRatio: normalizeAspectRatio(
                    modelSettings.aspectRatio,
                    inputImages,
                ),
                numberResults: modelSettings.numberResults,
                output_format: modelSettings.output_format,
                output_quality: modelSettings.output_quality,
                input_image: inputImages[0] || "",
                input_image_2: inputImages[1] || "",
                input_image_3: inputImages[2] || "",
                go_fast: modelSettings.go_fast,
                guidance: modelSettings.guidance,
                strength: modelSettings.strength,
                image_size: modelSettings.image_size,
                lora_scale: modelSettings.lora_scale,
                enhance_prompt: modelSettings.enhance_prompt,
                num_inference_steps: modelSettings.num_inference_steps,
                disable_safety_checker: modelSettings.disable_safety_checker,
            };
        }
        case "image_seedream4": {
            return {
                text: prompt,
                model: modelMetadata.modelId,
                async: true,
                size: modelSettings.size,
                width: modelSettings.width,
                height: modelSettings.height,
                aspectRatio: modelSettings.aspectRatio,
                maxImages:
                    modelSettings.maxImages || modelSettings.numberResults || 1,
                numberResults:
                    modelSettings.numberResults || modelSettings.maxImages || 1,
                input_image: inputImages[0] || "",
                input_image_1: inputImages[0] || "",
                input_image_2: inputImages[1] || "",
                input_image_3: inputImages[2] || "",
                sequentialImageGeneration:
                    modelSettings.sequentialImageGeneration || "disabled",
                seed: modelSettings.seed || 0,
            };
        }
        case "image_xai": {
            const variables = {
                text: prompt,
                async: true,
                model: modelMetadata.modelId,
                aspectRatio: normalizeAspectRatio(
                    modelSettings.aspectRatio,
                    inputImages,
                ),
                resolution:
                    modelSettings.resolution || modelSettings.image_size,
                numberResults:
                    modelSettings.numberResults || modelSettings.maxImages || 1,
                input_image: inputImages[0] || "",
                input_image_2: inputImages[1] || "",
                input_image_3: inputImages[2] || "",
            };
            return variables;
        }
        case "image_flux": {
            const variables = {
                text: prompt,
                async: true,
                model: modelMetadata.modelId,
                aspectRatio: normalizeAspectRatio(
                    modelSettings.aspectRatio,
                    inputImages,
                ),
                resolution: modelSettings.resolution,
                output_format: modelSettings.output_format,
                output_quality: modelSettings.output_quality,
                safety_tolerance: modelSettings.safety_tolerance,
            };
            const maxInputs = modelSettings.inputImages?.[1] || 0;
            if (maxInputs > 3) {
                if (inputImages.length > 0) {
                    variables.input_images = inputImages.slice(0, maxInputs);
                }
            } else {
                variables.input_image = inputImages[0] || "";
                variables.input_image_2 = inputImages[1] || "";
                variables.input_image_3 = inputImages[2] || "";
            }
            return variables;
        }
        case "video_seedance": {
            return {
                text: prompt,
                async: true,
                model: modelMetadata.modelId,
                resolution: modelSettings.resolution,
                aspectRatio: modelSettings.aspectRatio,
                duration: modelSettings.duration,
                camera_fixed: modelSettings.cameraFixed,
                generate_audio: modelSettings.generateAudio,
                image: inputImages[0] || "",
                seed: -1,
            };
        }
        case "video_kling": {
            return {
                text: prompt,
                async: true,
                model: modelMetadata.modelId,
                aspectRatio: modelSettings.aspectRatio,
                duration: modelSettings.duration,
                start_image: inputImages[0] || "",
                end_image: inputImages[1] || "",
                image: inputImages[0] || "",
                negativePrompt: modelSettings.negativePrompt || "",
            };
        }
        case "video_veo": {
            return {
                text: prompt,
                async: true,
                image: formatImageForVeo(inputImages[0]),
                video: "",
                lastFrame: "",
                model: modelMetadata.modelId,
                aspectRatio: modelSettings.aspectRatio,
                durationSeconds: modelSettings.duration,
                enhancePrompt: true,
                generateAudio: modelSettings.generateAudio,
                negativePrompt: "",
                personGeneration: "allow_all",
                sampleCount: 1,
                storageUri: "",
                location: "us-central1",
                seed: -1,
            };
        }
        case "video_xai": {
            return {
                text: prompt,
                async: true,
                model: modelMetadata.modelId,
                reference_images: inputImages.slice(0, 3),
                video: "",
                aspectRatio: modelSettings.aspectRatio,
                duration: modelSettings.duration,
                resolution: modelSettings.resolution,
            };
        }
        default:
            throw new Error(
                `No media-generation dispatcher for pathway ${pathwayName}`,
            );
    }
}

// Utility functions
const formatImageForVeo = (imageUrl) => {
    if (!imageUrl) return "";

    // Check if it's already in gs:// format
    if (imageUrl.startsWith("gs://")) {
        const extension = imageUrl.split(".").pop().toLowerCase();
        const mimeType =
            {
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                png: "image/png",
                webp: "image/webp",
                gif: "image/gif",
            }[extension] || "image/jpeg";

        return JSON.stringify({ gcsUri: imageUrl, mimeType });
    }

    try {
        const url = new URL(imageUrl);
        if (url.hostname === "storage.googleapis.com") {
            const gcsUri = `gs://${url.pathname.substring(1)}`;
            const extension = url.pathname.split(".").pop().toLowerCase();
            const mimeType =
                {
                    jpg: "image/jpeg",
                    jpeg: "image/jpeg",
                    png: "image/png",
                    webp: "image/webp",
                    gif: "image/gif",
                }[extension] || "image/jpeg";

            return JSON.stringify({ gcsUri, mimeType });
        }
    } catch (error) {
        console.warn("Error parsing image URL for Veo format:", error);
    }

    return imageUrl;
};

const convertGcsToHttp = (gcsUri) => {
    return gcsUri.replace("gs://", "https://storage.googleapis.com/");
};

const extractVideoUrl = (video) => {
    if (video.bytesBase64Encoded) {
        return `data:video/mp4;base64,${video.bytesBase64Encoded}`;
    } else if (video.gcsUri) {
        return convertGcsToHttp(video.gcsUri);
    }
    return null;
};

class MediaGenerationHandler extends BaseTask {
    get displayName() {
        return "Media generation";
    }

    get isRetryable() {
        return true;
    }

    async getResolvedModel(jobClient, modelId, outputType) {
        const store = await getModelMetadataStore(jobClient);
        const modelMetadata = resolveModelMetadata(store, modelId, outputType);

        if (!modelMetadata) {
            throw new Error(`No Cortex model metadata found for ${outputType}`);
        }

        const query = QUERY_BY_PATHWAY[modelMetadata.pathwayName];
        if (!query) {
            throw new Error(
                `No GraphQL query mapping for pathway ${modelMetadata.pathwayName}`,
            );
        }

        return { modelMetadata, query };
    }

    async startRequest(job) {
        const { taskId, metadata, userId } = job.data;
        const {
            prompt,
            outputType,
            model,
            inputImageUrl,
            inputImageUrl2,
            inputImageUrl3,
            inputImageUrl4,
            inputImageUrl5,
            inputImageUrl6,
            inputImageUrl7,
            inputImageUrl8,
            inputImageUrl9,
            inputImageUrl10,
            inputImageUrl11,
            inputImageUrl12,
            inputImageUrl13,
            inputImageUrl14,
            settings,
        } = metadata;

        metadata.taskId = taskId;
        metadata.userId = userId;

        if (!prompt) {
            const error = new Error("Prompt is required for media generation");
            await this.updateMediaItemOnError(
                metadata,
                error,
                "VALIDATION_ERROR",
            );
            throw error;
        }

        const { modelMetadata, query } = await this.getResolvedModel(
            job.client,
            model,
            outputType,
        );
        metadata.model = modelMetadata.modelId;
        metadata.pathwayName = modelMetadata.pathwayName;
        metadata.resultKey = modelMetadata.resultKey;

        const inputImages = [
            inputImageUrl,
            inputImageUrl2,
            inputImageUrl3,
            inputImageUrl4,
            inputImageUrl5,
            inputImageUrl6,
            inputImageUrl7,
            inputImageUrl8,
            inputImageUrl9,
            inputImageUrl10,
            inputImageUrl11,
            inputImageUrl12,
            inputImageUrl13,
            inputImageUrl14,
        ].filter(Boolean);

        const variables = buildModelVariables(
            modelMetadata,
            prompt,
            settings,
            inputImages,
        );

        let data;
        try {
            const result = await job.client.query({
                query,
                variables,
                fetchPolicy: "no-cache",
            });
            data = result.data;

            if (result.errors) {
                console.debug(
                    `[MediaGenerationHandler] GraphQL errors encountered`,
                    result.errors,
                );
                const error = new Error(
                    `GraphQL errors: ${JSON.stringify(result.errors)}`,
                );
                await this.updateMediaItemOnError(
                    metadata,
                    error,
                    "GRAPHQL_ERROR",
                );
                throw error;
            }
        } catch (error) {
            console.error(
                `[MediaGenerationHandler] GraphQL error:`,
                error.message,
                metadata,
            );
            // Update MediaItem if not already updated
            await this.updateMediaItemOnError(
                metadata,
                error,
                "REQUEST_FAILED",
            );
            throw error;
        }

        const result = data?.[metadata.resultKey]?.result;

        if (!result) {
            console.debug(
                `[MediaGenerationHandler] No result returned from service`,
            );
            const error = new Error(
                "No result returned from media generation service",
            );
            await this.updateMediaItemOnError(metadata, error, "NO_RESULT");
            throw error;
        }

        return result;
    }

    async updateOrCreateMediaItemWithError(
        userId,
        metadata,
        errorCode,
        errorMessage,
    ) {
        if (!userId || !metadata?.taskId) {
            return;
        }

        try {
            const error = {
                code: errorCode,
                message: errorMessage || "Media generation failed",
            };

            const mediaItem = await MediaItem.findOneAndUpdate(
                { user: userId, taskId: metadata.taskId },
                {
                    status: "failed",
                    error,
                },
                { new: true, runValidators: true },
            );

            // Create media item if it doesn't exist yet
            if (!mediaItem) {
                const newMediaItem = new MediaItem({
                    user: userId,
                    taskId: metadata.taskId,
                    cortexRequestId: metadata.taskId,
                    prompt: metadata.prompt || "",
                    type: metadata.outputType || "image",
                    model: metadata.model || "",
                    status: "failed",
                    error,
                    settings: metadata.settings,
                    // Only include encrypted inputImageUrl fields if they have values (CSFLE can't encrypt null)
                    ...(metadata.inputImageUrl && {
                        inputImageUrl: metadata.inputImageUrl,
                    }),
                    ...(metadata.inputImageUrl2 && {
                        inputImageUrl2: metadata.inputImageUrl2,
                    }),
                    ...(metadata.inputImageUrl3 && {
                        inputImageUrl3: metadata.inputImageUrl3,
                    }),
                });
                await newMediaItem.save();
            }
        } catch (updateError) {
            console.error(
                "Error updating/creating media item with error status:",
                updateError,
            );
        }
    }

    async updateMediaItemOnError(metadata, error, errorCode) {
        console.log("Updating media item with error status:", metadata);
        const userId = metadata.userId;
        if (!userId) {
            return;
        }

        const errorMessage =
            error?.message || error?.toString() || "Media generation failed";
        console.log(
            "Updating media item with error status:",
            errorCode,
            errorMessage,
        );
        await this.updateOrCreateMediaItemWithError(
            userId,
            metadata,
            errorCode,
            errorMessage,
        );
    }

    async retryGeminiRequest(job, retryCount = 0) {
        const { metadata } = job.data;
        const {
            prompt,
            outputType,
            model,
            inputImageUrl,
            inputImageUrl2,
            inputImageUrl3,
            inputImageUrl4,
            inputImageUrl5,
            inputImageUrl6,
            inputImageUrl7,
            inputImageUrl8,
            inputImageUrl9,
            inputImageUrl10,
            inputImageUrl11,
            inputImageUrl12,
            inputImageUrl13,
            inputImageUrl14,
            settings,
        } = metadata;

        const { modelMetadata, query } = await this.getResolvedModel(
            job.client,
            model,
            outputType,
        );

        const inputImages = [
            inputImageUrl,
            inputImageUrl2,
            inputImageUrl3,
            inputImageUrl4,
            inputImageUrl5,
            inputImageUrl6,
            inputImageUrl7,
            inputImageUrl8,
            inputImageUrl9,
            inputImageUrl10,
            inputImageUrl11,
            inputImageUrl12,
            inputImageUrl13,
            inputImageUrl14,
        ].filter(Boolean);
        const variables = buildModelVariables(
            modelMetadata,
            prompt,
            settings,
            inputImages,
        );

        try {
            const result = await job.client.query({
                query,
                variables,
                fetchPolicy: "no-cache",
            });

            if (result.errors) {
                console.debug(
                    `[MediaGenerationHandler] GraphQL errors in retry ${retryCount + 1}:`,
                    result.errors,
                );
                throw new Error(
                    `GraphQL errors: ${JSON.stringify(result.errors)}`,
                );
            }

            return result.data;
        } catch (error) {
            console.error(
                `[MediaGenerationHandler] Gemini retry ${retryCount + 1} failed:`,
                error.message,
            );
            throw error;
        }
    }

    async handleCompletion(taskId, dataObject, infoObject, metadata, client) {
        const userId = metadata.userId;

        // Check if this is a Gemini model that needs retry due to missing artifacts
        if (
            (metadata.pathwayName === "image_gemini_25" ||
                metadata.pathwayName === "image_gemini_3") &&
            !infoObject?.artifacts
        ) {
            const retryCount = metadata.geminiRetryCount || 0;
            const maxRetries = 3;

            if (retryCount < maxRetries) {
                // Update retry count in metadata
                metadata.geminiRetryCount = retryCount + 1;

                // Create a new job for retry
                const retryJob = {
                    data: {
                        taskId,
                        metadata: {
                            ...metadata,
                            geminiRetryCount: retryCount + 1,
                        },
                    },
                    client,
                };

                try {
                    // Wait a bit before retrying (exponential backoff)
                    const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                    await new Promise((resolve) => setTimeout(resolve, delay));

                    const retryData = await this.retryGeminiRequest(
                        retryJob,
                        retryCount,
                    );

                    // Process the retry response
                    if (userId) {
                        const processedData = await this.processMediaData(
                            retryData,
                            infoObject,
                            metadata,
                        );

                        // Check if the retry also failed to produce artifacts
                        if (!processedData?.url) {
                            throw new Error(
                                "Retry failed to produce artifacts",
                            );
                        }

                        await this.handleMediaGenerationCompletion(
                            userId,
                            processedData,
                            metadata,
                        );

                        const result = {
                            message: "Media generation completed successfully",
                            type: metadata.outputType,
                            model: metadata.model,
                            prompt: metadata.prompt,
                            url: processedData?.url,
                            blobPath: processedData?.blobPath,
                            filename: processedData?.filename,
                        };

                        return result;
                    }
                } catch (retryError) {
                    console.error(
                        `[MediaGenerationHandler] Gemini retry ${retryCount + 1} failed:`,
                        retryError.message,
                    );

                    // If this was the last retry, fall through to error handling
                    if (retryCount + 1 >= maxRetries) {
                        if (userId) {
                            await this.updateOrCreateMediaItemWithError(
                                userId,
                                metadata,
                                "GEMINI_RETRY_FAILED",
                                "Gemini failed to generate image after 3 retries",
                            );
                        }

                        return {
                            error: "Gemini failed to generate image after 3 retries",
                            type: metadata.outputType,
                            model: metadata.model,
                            prompt: metadata.prompt,
                        };
                    }
                }
            } else {
                if (userId) {
                    await this.updateOrCreateMediaItemWithError(
                        userId,
                        metadata,
                        "GEMINI_RETRY_FAILED",
                        "Gemini failed to generate image after 3 retries",
                    );
                }

                return {
                    error: "Gemini failed to generate image after 3 retries",
                    type: metadata.outputType,
                    model: metadata.model,
                    prompt: metadata.prompt,
                };
            }
        }

        let processedData = null;
        if (userId) {
            processedData = await this.processMediaData(
                dataObject,
                infoObject,
                metadata,
            );
            await this.handleMediaGenerationCompletion(
                userId,
                processedData,
                metadata,
            );
        }

        const result = {
            message: "Media generation completed successfully",
            type: metadata.outputType,
            model: metadata.model,
            prompt: metadata.prompt,
            url: processedData?.url,
            blobPath: processedData?.blobPath,
            filename: processedData?.filename,
        };

        return result;
    }

    async handleError(taskId, error, metadata, client) {
        const userId = metadata.userId;

        // Extract the actual error message from Veo error responses
        let actualErrorMessage =
            error?.message || error?.toString() || "Media generation failed";
        let errorCode = error?.code || "TASK_FAILED";

        // Handle Veo error format: "Veo operation completed but no videos returned: {...}"
        const errorString =
            typeof error === "string" ? error : error?.message || "";
        if (
            errorString.includes(
                "Veo operation completed but no videos returned:",
            )
        ) {
            try {
                // Extract the JSON part after the colon
                const jsonStart = errorString.indexOf("{");
                if (jsonStart !== -1) {
                    const jsonString = errorString.substring(jsonStart);
                    const veoError = JSON.parse(jsonString);

                    // Extract the nested error message
                    if (veoError.error && veoError.error.message) {
                        actualErrorMessage = veoError.error.message;
                        errorCode = veoError.error.code || "VEO_ERROR";
                    }
                }
            } catch (parseError) {
                console.error("Error parsing Veo error:", parseError);
                // Fall back to the original error message
            }
        }

        if (userId) {
            await this.updateOrCreateMediaItemWithError(
                userId,
                metadata,
                errorCode,
                actualErrorMessage,
            );
        }

        return { error: actualErrorMessage };
    }

    async cancelRequest(taskId, client) {
        // Update MediaItem when task is cancelled
        try {
            const Task = (await import("../../app/api/models/task.mjs"))
                .default;
            const task = await Task.findOne({ _id: taskId });

            if (!task || !task.owner) {
                return;
            }

            await this.updateOrCreateMediaItemWithError(
                task.owner.toString(),
                { taskId },
                "TASK_CANCELLED",
                "Task was cancelled",
            );
        } catch (error) {
            console.error("Error updating MediaItem on cancellation:", error);
            // Don't throw - cancellation should succeed even if MediaItem update fails
        }
    }

    async processMediaData(dataObject, infoObject, metadata) {
        try {
            let mediaUrl = null;

            // Handle Gemini special case first - returns cloudUrls object directly
            let cloudUrls = null;
            const isGeminiModel =
                metadata.pathwayName === "image_gemini_25" ||
                metadata.pathwayName === "image_gemini_3";

            if (isGeminiModel && infoObject?.artifacts) {
                const geminiResult = await this.processGeminiArtifacts(
                    infoObject.artifacts,
                    metadata.userId,
                );
                // processGeminiArtifacts returns:
                // - { url, blobPath, filename } object on success
                // - data URL string on upload failure (fallback)
                // - null if no artifacts
                if (geminiResult && typeof geminiResult === "object") {
                    cloudUrls = geminiResult;
                    mediaUrl = cloudUrls.url;
                } else if (typeof geminiResult === "string") {
                    // Fallback data URL - will be uploaded below
                    mediaUrl = geminiResult;
                }
            }

            // Handle Veo video responses
            if (
                !mediaUrl &&
                metadata.outputType === "video" &&
                metadata.model?.includes("veo")
            ) {
                mediaUrl = this.processVeoVideoResponse(dataObject);
            }

            // Handle standard image/video responses
            if (!mediaUrl) {
                mediaUrl = this.processStandardResponse(dataObject);
            }

            // Upload to cloud storage if we have a valid URL (skip if Gemini already uploaded)
            if (!cloudUrls && mediaUrl && typeof mediaUrl === "string") {
                // Get user's contextId for file scoping
                let contextId = null;
                if (metadata.userId) {
                    try {
                        await initializeUserModel();
                        const user = await User.findById(metadata.userId);
                        if (user?.contextId) {
                            contextId = user.contextId;
                        }
                    } catch (error) {
                        console.error(
                            "Error getting user contextId for media upload:",
                            error,
                        );
                        // Continue without contextId if lookup fails
                    }
                }

                try {
                    cloudUrls = await this.uploadMediaToCloud(
                        mediaUrl,
                        contextId,
                    );
                } catch (error) {
                    console.error("Failed to upload media to cloud:", error);
                }
            }

            const finalUrl =
                cloudUrls?.url ||
                (mediaUrl && !mediaUrl.startsWith("data:")
                    ? mediaUrl
                    : undefined);

            return {
                ...(finalUrl && { url: finalUrl }),
                ...(cloudUrls?.blobPath && { blobPath: cloudUrls.blobPath }),
                ...(cloudUrls?.filename && { filename: cloudUrls.filename }),
                ...(dataObject?.id && { id: dataObject.id }),
                ...(dataObject?.model && { model: dataObject.model }),
                ...(dataObject?.version && { version: dataObject.version }),
            };
        } catch (error) {
            console.error("Error processing media data:", error);
            return dataObject;
        }
    }

    async processGeminiArtifacts(artifacts, userId = null) {
        try {
            if (Array.isArray(artifacts)) {
                const imageArtifact = artifacts.find(
                    (artifact) => artifact.type === "image",
                );

                if (imageArtifact) {
                    if (imageArtifact.data) {
                        try {
                            const dataUrl = `data:${imageArtifact.mimeType || "image/png"};base64,${imageArtifact.data}`;

                            // Get user's contextId for file scoping
                            let contextId = null;
                            if (userId) {
                                try {
                                    await initializeUserModel();
                                    const user = await User.findById(userId);
                                    if (user?.contextId) {
                                        contextId = user.contextId;
                                    }
                                } catch (error) {
                                    console.error(
                                        "Error getting user contextId for Gemini upload:",
                                        error,
                                    );
                                    // Continue without contextId if lookup fails
                                }
                            }

                            const cloudUrls = await this.uploadMediaToCloud(
                                dataUrl,
                                contextId,
                            );

                            if (cloudUrls) {
                                return cloudUrls;
                            }
                        } catch (uploadError) {
                            console.error(
                                "Failed to upload Gemini image to cloud:",
                                uploadError,
                            );

                            const fallbackUrl = `data:${imageArtifact.mimeType};base64,${imageArtifact.data}`;
                            return fallbackUrl;
                        }
                    } else {
                        console.warn(`Image artifact has no data field`);
                    }
                } else {
                    console.warn(`No image artifact found in artifacts array`);
                }
            } else {
                console.warn(`Artifacts is not an array:`, typeof artifacts);
            }
        } catch (e) {
            console.error("Error parsing Gemini infoObject artifacts:", e);
        }
        return null;
    }

    processVeoVideoResponse(dataObject) {
        // Check for direct Veo response structure
        if (
            dataObject?.response?.videos &&
            Array.isArray(dataObject.response.videos) &&
            dataObject.response.videos.length > 0
        ) {
            return extractVideoUrl(dataObject.response.videos[0]);
        }

        // Check for result wrapper structure
        if (
            dataObject?.result?.response?.videos &&
            Array.isArray(dataObject.result.response.videos) &&
            dataObject.result.response.videos.length > 0
        ) {
            return extractVideoUrl(dataObject.result.response.videos[0]);
        }

        // Fallback: check if data.result.output is a string that needs parsing
        if (
            dataObject?.result?.output &&
            typeof dataObject.result.output === "string"
        ) {
            try {
                const parsed = JSON.parse(dataObject.result.output);

                // Try different possible response structures
                const structures = [
                    parsed.response?.videos?.[0],
                    parsed.videos?.[0],
                    parsed.gcsUri ? { gcsUri: parsed.gcsUri } : null,
                    parsed.url ? { url: parsed.url } : null,
                ].filter(Boolean);

                for (const structure of structures) {
                    const url = extractVideoUrl(structure) || structure.url;
                    if (url) return url;
                }
            } catch (e) {
                console.error("Error parsing Veo video response:", e);
            }
        }

        return null;
    }

    processStandardResponse(dataObject) {
        // Try different possible structures
        if (dataObject?.output) {
            return Array.isArray(dataObject.output)
                ? dataObject.output[0]
                : dataObject.output;
        }
        if (dataObject?.result?.output) {
            return Array.isArray(dataObject.result.output)
                ? dataObject.result.output[0]
                : dataObject.result.output;
        }
        return null;
    }

    async uploadMediaToCloud(mediaUrl, contextId = null) {
        try {
            if (!process.env.CORTEX_MEDIA_API_URL) {
                throw new Error(
                    "CORTEX_MEDIA_API_URL environment variable is not set",
                );
            }

            const serverUrl = process.env.CORTEX_MEDIA_API_URL;

            if (mediaUrl.startsWith("data:")) {
                return await this.uploadBase64Data(
                    mediaUrl,
                    serverUrl,
                    contextId,
                );
            } else {
                return await this.uploadRegularUrl(
                    mediaUrl,
                    serverUrl,
                    contextId,
                );
            }
        } catch (error) {
            console.error("Error uploading media to cloud:", error);
            throw error;
        }
    }

    buildMediaUploadRouting(contextId = null) {
        return buildMediaHelperFileParams({
            storageTarget: contextId
                ? createMediaStorageTarget(contextId)
                : undefined,
            contextId,
        });
    }

    normalizeCloudUpload(data) {
        const url = data?.shortLivedUrl || data?.url || null;
        const blobPath =
            data?.blobPath ||
            data?.name ||
            extractBlobPathFromUrl(data?.url) ||
            null;
        const filename =
            data?.filename || getFilenameFromBlobPath(blobPath) || null;

        if (!url) {
            throw new Error("Media file upload failed: Missing file URL");
        }

        return {
            url,
            ...(blobPath ? { blobPath } : {}),
            ...(filename ? { filename } : {}),
        };
    }

    async uploadBase64Data(mediaUrl, serverUrl, contextId = null) {
        const response = await fetch(mediaUrl);
        const blob = await response.blob();

        const formData = new FormData();
        const mimeType = mediaUrl.split(";")[0].split(":")[1];
        const extension = mimeType.split("/")[1] || "bin";
        const filename = `media.${extension}`;
        formData.append("file", blob, filename);

        const routingParams = this.buildMediaUploadRouting(contextId);
        for (const [key, value] of Object.entries(routingParams)) {
            formData.append(key, value);
        }

        const uploadUrl = new URL(serverUrl);
        for (const [key, value] of Object.entries(routingParams)) {
            uploadUrl.searchParams.set(key, value);
        }

        const uploadResponse = await fetch(uploadUrl.toString(), {
            method: "POST",
            body: formData,
        });

        if (!uploadResponse.ok) {
            const errorBody = await uploadResponse.text();
            console.error(
                `Upload failed with status ${uploadResponse.status}: ${errorBody}`,
            );
            throw new Error(
                `Upload failed: ${uploadResponse.statusText}. Response body: ${errorBody}`,
            );
        }

        const data = await uploadResponse.json();
        return this.normalizeCloudUpload(data);
    }

    async uploadRegularUrl(mediaUrl, serverUrl, contextId = null) {
        const url = new URL(serverUrl);
        url.searchParams.set("fetch", mediaUrl);
        const routingParams = this.buildMediaUploadRouting(contextId);
        for (const [key, value] of Object.entries(routingParams)) {
            url.searchParams.set(key, value);
        }

        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
                `Upload failed: ${response.statusText}. Response body: ${errorBody}`,
            );
        }

        const data = await response.json();
        return this.normalizeCloudUpload(data);
    }

    async getInheritedTags(userId, inputImageUrls, inputTags = []) {
        // Use tags passed from the frontend instead of querying encrypted URL fields
        if (inputTags && inputTags.length > 0) {
            return inputTags;
        }

        // Fallback: return empty array if no tags provided
        return [];
    }

    async handleMediaGenerationCompletion(userId, dataObject, metadata) {
        try {
            // Get inherited tags from input images
            const inputImageUrls = [
                metadata.inputImageUrl,
                metadata.inputImageUrl2,
                metadata.inputImageUrl3,
                metadata.inputImageUrl4,
                metadata.inputImageUrl5,
                metadata.inputImageUrl6,
                metadata.inputImageUrl7,
                metadata.inputImageUrl8,
                metadata.inputImageUrl9,
                metadata.inputImageUrl10,
                metadata.inputImageUrl11,
                metadata.inputImageUrl12,
                metadata.inputImageUrl13,
                metadata.inputImageUrl14,
            ].filter(Boolean);

            const inheritedTags = await this.getInheritedTags(
                userId,
                inputImageUrls,
                metadata.inputTags,
            );

            // Build update data from the canonical media file contract.
            const updateData = {
                status: "completed",
                completed: Math.floor(Date.now() / 1000),
                // Inherit tags from input images
                tags: inheritedTags,
                ...(dataObject.url && { url: dataObject.url }),
                ...(dataObject.blobPath && { blobPath: dataObject.blobPath }),
                ...(dataObject.filename && { filename: dataObject.filename }),
                // Video-specific fields (not encrypted, so undefined is OK but be explicit)
                ...(dataObject.duration !== undefined && {
                    duration: dataObject.duration,
                }),
                ...(dataObject.generateAudio !== undefined && {
                    generateAudio: dataObject.generateAudio,
                }),
                ...(dataObject.resolution && {
                    resolution: dataObject.resolution,
                }),
                ...(dataObject.cameraFixed !== undefined && {
                    cameraFixed: dataObject.cameraFixed,
                }),
            };

            const mediaItem = await MediaItem.findOneAndUpdate(
                { user: userId, taskId: metadata.taskId },
                updateData,
                { new: true, runValidators: true },
            );

            if (!mediaItem) {
                // Create a new media item if it doesn't exist (fallback)
                const newMediaItem = new MediaItem({
                    user: userId,
                    taskId: metadata.taskId,
                    cortexRequestId: metadata.taskId,
                    prompt: metadata.prompt || "",
                    type: metadata.outputType || "image",
                    model: metadata.model || "",
                    ...updateData,
                    settings: metadata.settings,
                    // Only include encrypted inputImageUrl fields if they have values (CSFLE can't encrypt null)
                    ...(metadata.inputImageUrl && {
                        inputImageUrl: metadata.inputImageUrl,
                    }),
                    ...(metadata.inputImageUrl2 && {
                        inputImageUrl2: metadata.inputImageUrl2,
                    }),
                    ...(metadata.inputImageUrl3 && {
                        inputImageUrl3: metadata.inputImageUrl3,
                    }),
                });
                await newMediaItem.save();
            }
        } catch (error) {
            console.error("Error updating media item:", error);
            throw error;
        }
    }
}

const mediaGenerationHandler = new MediaGenerationHandler();
export default mediaGenerationHandler;

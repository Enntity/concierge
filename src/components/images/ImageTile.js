"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import ProgressUpdate from "../editor/ProgressUpdate";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { MediaPreview } from "../common/media";

/**
 * ImageTile - Media gallery tile with generation state handling
 *
 * Uses shared MediaPreview for rendering, but keeps:
 * - Generation state logic (pending, regenerating, uploading)
 * - Error handling with retry
 * - Selection/multi-select
 */
function ImageTile({
    image,
    onClick,
    onDelete,
    onRegenerate,
    onGenerationComplete,
    selectedImages,
    setSelectedImages,
    selectedImagesObjects,
    setSelectedImagesObjects,
    lastSelectedImage,
    setLastSelectedImage,
    images,
    setShowDeleteSelectedConfirm,
}) {
    const [loadError, setLoadError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const url = image?.azureUrl || image?.url;
    const hasValidUrl = url && url !== "null" && url !== "undefined";
    const { t } = useTranslation();
    const expired = image?.expires ? image.expires < Date.now() / 1000 : false;
    const { cortexRequestId, prompt, result, regenerating, uploading, error } =
        image || {};
    const { code, message } = error || result?.error || {};
    const isSelected = selectedImages.has(cortexRequestId);

    const handleSelection = (e) => {
        e.stopPropagation();
        const newSelectedImages = new Set(selectedImages);
        const newSelectedImagesObjects = [...selectedImagesObjects];

        if (e.shiftKey && lastSelectedImage) {
            const lastIndex = images.findIndex(
                (img) => img.cortexRequestId === lastSelectedImage,
            );
            const currentIndex = images.findIndex(
                (img) => img.cortexRequestId === cortexRequestId,
            );

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);

                for (let i = start; i <= end; i++) {
                    if (i >= 0 && i < images.length && images[i]) {
                        const imageId = images[i].cortexRequestId;
                        if (imageId && !newSelectedImages.has(imageId)) {
                            newSelectedImages.add(imageId);
                            newSelectedImagesObjects.push(images[i]);
                        }
                    }
                }
            }
        } else {
            if (isSelected) {
                newSelectedImages.delete(cortexRequestId);
                const index = newSelectedImagesObjects.findIndex(
                    (img) => img.cortexRequestId === cortexRequestId,
                );
                if (index !== -1) {
                    newSelectedImagesObjects.splice(index, 1);
                }
            } else {
                newSelectedImages.add(cortexRequestId);
                newSelectedImagesObjects.push(image);
            }
        }

        setSelectedImages(newSelectedImages);
        setSelectedImagesObjects(newSelectedImagesObjects);
        setLastSelectedImage(cortexRequestId);
    };

    // Create media item for shared preview component
    const mediaItem = hasValidUrl
        ? {
              type: image.type || "image",
              url,
              label: prompt,
          }
        : null;

    const handleMediaError = () => {
        if (retryCount < 2) {
            setRetryCount((prev) => prev + 1);
            setLoadError(false);
        } else {
            setLoadError(true);
        }
    };

    const handleMediaLoad = () => {
        setLoadError(false);
        setRetryCount(0);
    };

    // Determine what to render based on state
    const isLoading =
        regenerating ||
        (image?.status === "pending" && image?.taskId) ||
        (!url &&
            !error &&
            !result?.error &&
            image?.status !== "completed" &&
            image?.status !== "failed");

    const showError =
        expired || loadError || (cortexRequestId && !hasValidUrl) || code;

    return (
        <div className="media-tile select-none">
            {/* Selection checkbox */}
            <div
                className={`selection-checkbox ${isSelected ? "selected" : ""}`}
                onClick={handleSelection}
            >
                <Check
                    className={`text-sm ${isSelected ? "opacity-100" : "opacity-0"}`}
                />
            </div>

            <div className="media-wrapper relative" onClick={onClick}>
                {isLoading ? (
                    <div className="h-full bg-gray-50 dark:bg-gray-700 p-4 text-sm flex items-center justify-center">
                        <ProgressComponent
                            cortexRequestId={cortexRequestId}
                            prompt={prompt}
                            onGenerationComplete={onGenerationComplete}
                            outputType={image?.type || "image"}
                        />
                    </div>
                ) : uploading ? (
                    <div className="h-full bg-gray-50 dark:bg-gray-700 p-4 text-sm flex items-center justify-center">
                        <UploadComponent t={t} />
                    </div>
                ) : !showError && mediaItem ? (
                    <MediaPreview
                        item={mediaItem}
                        className="w-full h-full"
                        mediaClassName="object-cover object-center"
                        onLoad={handleMediaLoad}
                        onError={handleMediaError}
                        showPlayButton
                        t={t}
                    />
                ) : (
                    <div className="h-full bg-gray-50 dark:bg-gray-700 p-4 text-sm flex items-center justify-center">
                        {cortexRequestId &&
                            !hasValidUrl &&
                            !code &&
                            image?.status !== "failed" && (
                                <NoImageError
                                    t={t}
                                    image={image}
                                    message={message}
                                    error={error}
                                    result={result}
                                    onRegenerate={onRegenerate}
                                    setShowErrorDialog={setShowErrorDialog}
                                />
                            )}
                        {cortexRequestId &&
                            !hasValidUrl &&
                            !code &&
                            !image?.taskId &&
                            image?.status !== "failed" &&
                            !result && (
                                <ProgressComponent
                                    cortexRequestId={cortexRequestId}
                                    prompt={prompt}
                                    onGenerationComplete={onGenerationComplete}
                                    outputType={image?.type || "image"}
                                />
                            )}
                        {code === "ERR_BAD_REQUEST" && (
                            <BadRequestError
                                t={t}
                                setShowErrorDialog={setShowErrorDialog}
                            />
                        )}
                        {code && code !== "ERR_BAD_REQUEST" && (
                            <OtherError
                                t={t}
                                message={message}
                                error={error}
                                result={result}
                                image={image}
                                onRegenerate={onRegenerate}
                                setShowErrorDialog={setShowErrorDialog}
                            />
                        )}
                        {(expired || loadError) && hasValidUrl && (
                            <ExpiredImageComponent
                                t={t}
                                image={image}
                                onRegenerate={onRegenerate}
                            />
                        )}
                    </div>
                )}
            </div>

            <div className="media-prompt" title={prompt}>
                {prompt}
            </div>

            {/* Error Dialog */}
            <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 dark:text-red-400">
                            {code === "ERR_BAD_REQUEST"
                                ? t("Content blocked by safety system")
                                : t("Media generation failed")}
                        </DialogTitle>
                        <DialogDescription>
                            {t("An error occurred while generating media")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-3 overflow-auto">
                        <div>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {t("Error Details")}:
                            </span>
                            <pre className="mt-2 text-xs p-2 bg-gray-50 text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
                                {message ||
                                    error?.message ||
                                    result?.error?.message ||
                                    t("Unknown error occurred")}
                            </pre>
                        </div>
                        {code && (
                            <div>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {t("Error Code")}:
                                </span>
                                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 font-mono">
                                    {code}
                                </p>
                            </div>
                        )}
                        {prompt && (
                            <div>
                                <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {t("Prompt")}:
                                </span>
                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap break-words">
                                    {prompt}
                                </p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Helper components extracted for clarity

function ProgressComponent({
    cortexRequestId,
    prompt,
    onGenerationComplete,
    outputType,
}) {
    const [, setData] = useState(null);

    return (
        <div className="flex flex-col items-center gap-2 text-gray-500">
            <ProgressUpdate
                requestId={cortexRequestId}
                mode="spinner"
                setFinalData={(finalData) => {
                    setData(finalData);

                    if (finalData?.result?.error) {
                        onGenerationComplete(cortexRequestId, {
                            result: finalData.result,
                            prompt,
                        });
                        return;
                    }

                    try {
                        const parsedData = JSON.parse(finalData);
                        onGenerationComplete(cortexRequestId, {
                            result: { ...parsedData },
                            prompt,
                        });
                    } catch (e) {
                        console.error("Error parsing data", e);
                        onGenerationComplete(cortexRequestId, {
                            result: {
                                error: {
                                    code: "PARSE_ERROR",
                                    message: `Failed to generate ${outputType || "media"}`,
                                },
                            },
                            prompt,
                        });
                    }
                }}
            />
        </div>
    );
}

function UploadComponent({ t }) {
    return (
        <div className="flex flex-col items-center gap-2 text-gray-500">
            <ProgressUpdate
                initialText={t("Uploading to cloud...")}
                mode="spinner"
            />
        </div>
    );
}

function BadRequestError({ t, setShowErrorDialog }) {
    return (
        <div
            className="flex flex-col items-center justify-center h-full p-4 overflow-hidden cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            onClick={(e) => {
                e.stopPropagation();
                setShowErrorDialog(true);
            }}
        >
            <div className="text-center overflow-hidden w-full">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                        <svg
                            className="w-4 h-4 text-red-600 dark:text-red-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path
                                fillRule="evenodd"
                                d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 break-words overflow-hidden px-2">
                        {t("Content blocked by safety system")}
                    </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 break-words overflow-hidden px-2">
                    {t("Please try a different prompt")}
                </div>
                <div className="text-xs text-sky-600 dark:text-sky-400 mt-2">
                    {t("Click for details")}
                </div>
            </div>
        </div>
    );
}

function OtherError({
    t,
    message,
    error,
    result,
    image,
    onRegenerate,
    setShowErrorDialog,
}) {
    const actualErrorMessage =
        message ||
        error?.message ||
        result?.error?.message ||
        "Unknown error occurred";

    return (
        <div className="flex flex-col items-center justify-center h-full overflow-hidden">
            <div
                className="text-center w-full overflow-hidden cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors rounded"
                onClick={(e) => {
                    e.stopPropagation();
                    setShowErrorDialog(true);
                }}
            >
                <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                        <svg
                            className="w-4 h-4 text-red-600 dark:text-red-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">
                        {t("Media generation failed")}
                    </div>
                </div>
                <div
                    className="text-xs text-gray-500 dark:text-gray-500 px-2 line-clamp-4 break-words overflow-hidden"
                    title={actualErrorMessage}
                >
                    {actualErrorMessage}
                </div>
            </div>

            <div className="mt-4 flex-shrink-0">
                {image.type === "video" ? null : !image.model ? null : (
                    <button
                        className="lb-primary text-sm px-3 py-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRegenerate();
                        }}
                    >
                        {t("Regenerate")}
                    </button>
                )}
            </div>
        </div>
    );
}

function ExpiredImageComponent({ t, image, onRegenerate }) {
    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="mb-4 text-center">
                {t(
                    `${image.type === "video" ? "Video" : "Image"} expired or not available.`,
                )}
            </div>
            <div>
                {image.type === "video" ? (
                    <button
                        className="lb-primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            window.location.reload();
                        }}
                    >
                        {t("Reload")}
                    </button>
                ) : !image.model ? null : (
                    <button
                        className="lb-primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRegenerate();
                        }}
                    >
                        {t("Regenerate")}
                    </button>
                )}
            </div>
        </div>
    );
}

function NoImageError({
    t,
    image,
    message,
    error,
    result,
    onRegenerate,
    setShowErrorDialog,
}) {
    const actualErrorMessage =
        message ||
        error?.message ||
        result?.error?.message ||
        "No media was generated";

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 overflow-hidden">
            <div
                className="text-center w-full overflow-hidden cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors rounded p-2"
                onClick={(e) => {
                    e.stopPropagation();
                    setShowErrorDialog(true);
                }}
            >
                <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center flex-shrink-0">
                        <svg
                            className="w-4 h-4 text-red-600 dark:text-red-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path
                                fillRule="evenodd"
                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">
                        {t("Media generation failed")}
                    </div>
                </div>
                <div
                    className="text-xs text-gray-500 dark:text-gray-500 px-2 line-clamp-4 break-words overflow-hidden"
                    title={actualErrorMessage}
                >
                    {actualErrorMessage}
                </div>
                <div className="text-xs text-sky-600 dark:text-sky-400 mt-2">
                    {t("Click for details")}
                </div>
            </div>

            <div className="mt-4 flex-shrink-0">
                {image.type === "video" ? (
                    <div className="text-xs text-gray-500 dark:text-gray-500 text-center break-words overflow-hidden px-2">
                        {t(
                            "Please try a different prompt or contact support if the issue persists.",
                        )}
                    </div>
                ) : !image.model ? null : (
                    <button
                        className="lb-primary text-sm px-3 py-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRegenerate();
                        }}
                    >
                        {t("Regenerate")}
                    </button>
                )}
            </div>
        </div>
    );
}

export default ImageTile;

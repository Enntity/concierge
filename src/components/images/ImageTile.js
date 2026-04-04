"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ShieldAlert } from "lucide-react";
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
    const url = image?.url;
    const hasValidUrl = url && url !== "null" && url !== "undefined";
    const { t } = useTranslation();
    const expired = image?.expires ? image.expires < Date.now() / 1000 : false;
    const { cortexRequestId, prompt, result, regenerating, uploading, error } =
        image || {};
    const { code, message } = error || result?.error || {};
    const actualErrorMessage =
        message || error?.message || result?.error?.message || "";
    const isFailed = image?.status === "failed";
    const isSafetyBlocked =
        code === "ERR_BAD_REQUEST" ||
        /flagged as sensitive|blocked by safety|safety system/i.test(
            actualErrorMessage,
        );
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
              blobPath: image?.blobPath || null,
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
            !actualErrorMessage &&
            image?.status !== "completed" &&
            image?.status !== "failed");

    const showError =
        expired ||
        loadError ||
        (cortexRequestId && !hasValidUrl) ||
        isFailed ||
        code ||
        actualErrorMessage;

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
                            !actualErrorMessage &&
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
                        {isSafetyBlocked && (
                            <BadRequestError
                                t={t}
                                setShowErrorDialog={setShowErrorDialog}
                            />
                        )}
                        {!isSafetyBlocked &&
                            (code || actualErrorMessage || isFailed) && (
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
                            {isSafetyBlocked
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

function ErrorTileCard({
    icon,
    eyebrow,
    title,
    description,
    hint,
    onClick,
    action,
    detailsLabel = "Details",
}) {
    return (
        <div
            className="flex h-full w-full cursor-pointer flex-col justify-between bg-gray-100 p-4 text-left transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
            onClick={onClick}
        >
            <div>
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                    {icon}
                    <span>{eyebrow}</span>
                </div>
                <div className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                </div>
                <div className="mt-2 line-clamp-4 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {description}
                </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                        {hint}
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {action}
                    <span className="text-xs font-medium text-sky-600 dark:text-sky-400">
                        {detailsLabel}
                    </span>
                </div>
            </div>
        </div>
    );
}

function BadRequestError({ t, setShowErrorDialog }) {
    return (
        <ErrorTileCard
            icon={
                <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            }
            eyebrow={t("Safety")}
            title={t("Blocked by model safety")}
            description={t(
                "This prompt was blocked by the model safety filter.",
            )}
            hint={t("Try a less explicit prompt or adjust the request.")}
            onClick={(e) => {
                e.stopPropagation();
                setShowErrorDialog(true);
            }}
        />
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

    const action =
        image.type === "video" || !image.model ? null : (
            <button
                className="lb-primary text-sm px-3 py-1"
                onClick={(e) => {
                    e.stopPropagation();
                    onRegenerate();
                }}
            >
                {t("Regenerate")}
            </button>
        );

    return (
        <ErrorTileCard
            icon={
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            }
            eyebrow={t("Error")}
            title={t("Generation failed")}
            description={actualErrorMessage}
            hint={t("Open details for the full provider error.")}
            onClick={(e) => {
                e.stopPropagation();
                setShowErrorDialog(true);
            }}
            action={action}
        />
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

    const action =
        image.type === "video" ? null : !image.model ? null : (
            <button
                className="lb-primary text-sm px-3 py-1"
                onClick={(e) => {
                    e.stopPropagation();
                    onRegenerate();
                }}
            >
                {t("Regenerate")}
            </button>
        );

    return (
        <ErrorTileCard
            icon={
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            }
            eyebrow={t("Error")}
            title={t("No media returned")}
            description={actualErrorMessage}
            hint={
                image.type === "video"
                    ? t(
                          "Try a different prompt if the provider returned no output.",
                      )
                    : t("Try regenerating or open details for the full error.")
            }
            onClick={(e) => {
                e.stopPropagation();
                setShowErrorDialog(true);
            }}
            action={action}
        />
    );
}

export default ImageTile;

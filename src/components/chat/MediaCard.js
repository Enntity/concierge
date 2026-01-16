"use client";

import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { X, FileX } from "lucide-react";
import { getFileIcon, getExtension } from "../../utils/mediaUtils";
import { useFilePreview } from "./useFilePreview";
import { getYoutubeEmbedUrl } from "../../utils/urlUtils";
import { LanguageContext } from "../../contexts/LanguageProvider";
import {
    useMediaGallery,
    MediaPreview,
    MediaZoomDialog,
    MediaLabelOverlay,
} from "../common/media";
import { cn } from "@/lib/utils";

/**
 * MediaCard - Single media item card for chat messages
 *
 * Uses shared media components for preview/zoom/label functionality
 */
const MediaCard = React.memo(function MediaCard({
    type, // 'image' | 'video' | 'youtube' | 'file'
    src,
    filename,
    youtubeEmbedUrl,
    mimeType,
    onLoad,
    onDeleteFile,
    t,
    className = "",
    isDeleted = false,
}) {
    const { t: tHook } = useTranslation();
    const { direction } = useContext(LanguageContext);
    const isRTL = direction === "rtl";
    const translationFn = typeof t === "function" ? t : tHook;

    // File type detection for file types
    const fileType = useFilePreview(
        type === "file" ? src : null,
        filename,
        mimeType,
    );

    // Can this file type be previewed?
    const hasFilePreview = type === "file" && fileType.isPreviewable;

    // Normalize to media gallery item format
    const item = {
        type,
        url: src,
        label: filename,
        mimeType,
        youtubeEmbedUrl:
            youtubeEmbedUrl ||
            (type === "youtube" ? getYoutubeEmbedUrl(src) : null),
    };

    // Use shared gallery hook for zoom state
    const { zoomOpen, openZoom, setZoomOpen } = useMediaGallery({
        items: [item],
    });

    // Card sizing
    const cardWidth = "w-[200px] [.docked_&]:w-[160px]";
    const isSquareCard = type === "image";
    const previewHeight = isSquareCard ? "" : "h-[150px] [.docked_&]:h-[120px]";

    const handleClick = () => {
        if (type !== "file" || hasFilePreview) {
            openZoom();
        }
    };

    // Render icon view for files without previews or deleted state
    const renderIconView = ({
        iconColor = "text-gray-500 dark:text-gray-400",
        extensionColor = "text-gray-600 dark:text-gray-400",
        bgColor = "bg-neutral-100 dark:bg-gray-700",
        showDeletedText = false,
    }) => {
        const Icon = getFileIcon(filename);
        const fileExtension = filename
            ? getExtension(filename).replace(".", "").toUpperCase() || ""
            : "";
        return (
            <div
                className={`w-full ${previewHeight} ${bgColor} rounded-lg flex flex-col items-center justify-center gap-2`}
            >
                <Icon className={`w-16 h-16 ${iconColor}`} />
                {fileExtension && (
                    <span
                        className={`text-xs font-medium ${extensionColor} uppercase tracking-wide`}
                    >
                        {fileExtension}
                    </span>
                )}
                {showDeletedText && (
                    <span className="text-xs text-red-500 dark:text-red-400 italic">
                        {translationFn("File deleted")}
                    </span>
                )}
            </div>
        );
    };

    // Deleted state - simplified ghost card
    if (isDeleted) {
        const Icon = type === "file" ? getFileIcon(filename) : null;
        const deletedCardClass = isSquareCard
            ? `${cardWidth} aspect-square`
            : `${cardWidth} ${previewHeight}`;
        return (
            <div
                className={`${deletedCardClass} rounded-lg border border-red-200 dark:border-red-800/50 shadow-md overflow-hidden pointer-events-none bg-red-50/50 dark:bg-red-900/10 relative group/media`}
            >
                {Icon ? (
                    <div className="w-full h-full rounded-lg bg-red-50/50 dark:bg-red-900/10 relative">
                        {renderIconView({
                            iconColor: "text-red-300 dark:text-red-600",
                            extensionColor: "text-red-500 dark:text-red-400",
                            bgColor: "bg-transparent",
                            showDeletedText: true,
                        })}
                    </div>
                ) : (
                    <div className="w-full h-full rounded-lg flex flex-col items-center justify-center gap-2 bg-red-50/50 dark:bg-red-900/10 relative">
                        <FileX className="w-16 h-16 text-red-300 dark:text-red-600" />
                        <span className="text-xs text-red-500 dark:text-red-400 italic">
                            {translationFn("File deleted")}
                        </span>
                    </div>
                )}
                <MediaLabelOverlay
                    label={filename}
                    isRTL={isRTL}
                    scrollOnTruncate
                />
            </div>
        );
    }

    // Check if we should use MediaPreview or custom file icon
    const canPreview = type !== "file" || hasFilePreview;

    // Delete button for the label overlay
    const deleteAction = onDeleteFile ? (
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteFile();
            }}
            className="hover:bg-white/20 rounded p-1 transition-colors"
            title={translationFn("Remove file from chat")}
            aria-label={translationFn("Remove file from chat")}
        >
            <X className="w-4 h-4 text-white" />
        </button>
    ) : null;

    return (
        <>
            <div
                className={cn(
                    cardWidth,
                    isSquareCard ? "aspect-square" : "",
                    className,
                    "bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden relative group/media",
                    canPreview
                        ? "cursor-pointer hover:shadow-lg transition-shadow"
                        : "",
                )}
                onClick={handleClick}
            >
                {/* Preview content */}
                {canPreview ? (
                    <MediaPreview
                        item={item}
                        className={isSquareCard ? "" : previewHeight}
                        mediaClassName={isSquareCard ? "" : "rounded-lg"}
                        onLoad={onLoad}
                        t={translationFn}
                    />
                ) : (
                    renderIconView({})
                )}

                {/* Label overlay */}
                <MediaLabelOverlay
                    label={filename}
                    actions={deleteAction}
                    isRTL={isRTL}
                    scrollOnTruncate
                />
            </div>

            {/* Zoom dialog */}
            {canPreview && (
                <MediaZoomDialog
                    open={zoomOpen}
                    onOpenChange={setZoomOpen}
                    item={item}
                    items={[item]}
                    currentIndex={0}
                    showDownload={type !== "youtube"}
                    t={translationFn}
                />
            )}
        </>
    );
});

export default MediaCard;

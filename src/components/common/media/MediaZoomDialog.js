"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useFilePreview, renderFilePreview } from "../../chat/useFilePreview";
import { downloadSingleFile } from "../../../utils/fileDownloadUtils";
import { cn } from "@/lib/utils";

/**
 * MediaZoomDialog - Fullscreen dialog for viewing media
 *
 * Features:
 * - Fullscreen view of any media type
 * - Gallery navigation for multiple items
 * - Optional download button
 * - Keyboard navigation (when open)
 *
 * @param {object} props
 * @param {boolean} props.open - Dialog open state
 * @param {function} props.onOpenChange - Dialog state change handler
 * @param {object} props.item - Current media item to display
 * @param {array} props.items - All items (for navigation)
 * @param {number} props.currentIndex - Current index in items
 * @param {function} props.onNavigate - Navigation handler (receives new index)
 * @param {function} props.onPrevious - Previous item handler
 * @param {function} props.onNext - Next item handler
 * @param {boolean} props.showDownload - Show download button (default: true for non-youtube)
 * @param {function} props.onDownload - Download handler
 * @param {boolean} props.showNavigation - Show prev/next buttons (default: items.length > 1)
 * @param {function} props.t - Translation function
 * @param {React.ReactNode} props.textRenderer - Custom renderer for text content
 * @param {string} props.className - Additional classes for DialogContent
 * @param {React.ReactNode} props.children - Custom content (overrides default rendering)
 */
function MediaZoomDialog({
    open,
    onOpenChange,
    item,
    items = [],
    currentIndex = 0,
    onNavigate,
    onPrevious,
    onNext,
    showDownload = true,
    onDownload,
    showNavigation,
    t = (s) => s,
    textRenderer,
    className = "",
    children,
}) {
    // File type detection for file items
    const fileType = useFilePreview(
        item?.type === "file" ? item?.url : null,
        item?.label,
        item?.mimeType,
    );

    const hasMultiple = items.length > 1;
    const shouldShowNav = showNavigation ?? hasMultiple;

    const handlePrevious = (e) => {
        e?.stopPropagation?.();
        if (onPrevious) {
            onPrevious();
        } else if (onNavigate && currentIndex > 0) {
            onNavigate(currentIndex - 1);
        } else if (onNavigate && hasMultiple) {
            onNavigate(items.length - 1); // Loop
        }
    };

    const handleNext = (e) => {
        e?.stopPropagation?.();
        if (onNext) {
            onNext();
        } else if (onNavigate && currentIndex < items.length - 1) {
            onNavigate(currentIndex + 1);
        } else if (onNavigate && hasMultiple) {
            onNavigate(0); // Loop
        }
    };

    const handleDownload = async (e) => {
        e?.stopPropagation?.();
        if (onDownload) {
            onDownload(item);
        } else if (item?.url) {
            // Use display filename, falling back through various property names
            const filename =
                item.displayFilename ||
                item.originalFilename ||
                item.label ||
                item.filename ||
                item.name ||
                "download";
            await downloadSingleFile(item.url, filename);
        }
    };

    // Determine dialog title for accessibility
    const getTitle = () => {
        if (!item) return t("Media viewer");
        switch (item.type) {
            case "image":
                return t("Image viewer");
            case "video":
                return t("Video player");
            case "youtube":
                return t("YouTube video player");
            case "text":
                return t("Text viewer");
            default:
                return t("File preview");
        }
    };

    // Render zoom content based on type
    const renderContent = () => {
        if (children) return children;
        if (!item) return null;

        const { type, url, content, youtubeEmbedUrl, label } = item;

        // Text
        if (type === "text") {
            if (textRenderer) {
                return textRenderer(content, item);
            }
            return (
                <div className="max-w-[80vw] max-h-[80vh] overflow-auto p-8 bg-white dark:bg-gray-900 rounded-lg">
                    <p className="text-lg text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {content}
                    </p>
                </div>
            );
        }

        // Image
        if (type === "image") {
            return (
                <img
                    src={url}
                    alt={label || t("Image")}
                    className="max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg"
                />
            );
        }

        // Video
        if (type === "video") {
            return (
                <video
                    src={url}
                    controls
                    autoPlay
                    className="max-w-full max-h-[80vh] w-auto h-auto rounded-lg"
                    preload="metadata"
                />
            );
        }

        // YouTube
        if (type === "youtube") {
            const embedUrl = youtubeEmbedUrl || url;
            const autoplayUrl = embedUrl
                ? `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1`
                : embedUrl;
            return (
                <iframe
                    src={autoplayUrl}
                    className="w-full rounded-lg"
                    style={{
                        width: "100%",
                        maxWidth: "900px",
                        aspectRatio: "16/9",
                        backgroundColor: "transparent",
                    }}
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    title={label || "YouTube video player"}
                />
            );
        }

        // File
        if (type === "file" && url) {
            const preview = renderFilePreview({
                src: url,
                filename: label,
                fileType,
                className:
                    fileType.isPdf || fileType.isDoc
                        ? "w-full h-[80vh] max-w-4xl rounded-lg border-none"
                        : "max-w-full max-h-[80vh] w-auto h-auto object-contain rounded-lg",
                t,
            });
            return preview;
        }

        return null;
    };

    // Should show download button?
    const canDownload =
        showDownload &&
        item?.url &&
        item?.type !== "youtube" &&
        item?.type !== "text";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(
                    "max-w-[95vw] max-h-[95vh] p-4 sm:p-6 flex items-center justify-center",
                    className,
                )}
            >
                <DialogTitle className="sr-only">{getTitle()}</DialogTitle>
                <DialogDescription className="sr-only">
                    {item?.label
                        ? t(`Viewing ${item.label} in full screen`)
                        : t("View media in full screen")}
                </DialogDescription>

                <div className="relative w-full flex flex-col items-center justify-center gap-4">
                    {/* Navigation - Previous */}
                    {shouldShowNav && (
                        <button
                            onClick={handlePrevious}
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all"
                            aria-label={t("Previous")}
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}

                    {/* Content */}
                    {renderContent()}

                    {/* Navigation - Next */}
                    {shouldShowNav && (
                        <button
                            onClick={handleNext}
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all"
                            aria-label={t("Next")}
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}

                    {/* Bottom bar: indicator + download */}
                    <div className="flex items-center gap-4">
                        {/* Page indicator */}
                        {hasMultiple && (
                            <div className="bg-black/50 rounded-full px-3 py-1 text-white text-sm">
                                {currentIndex + 1} / {items.length}
                            </div>
                        )}

                        {/* Download button */}
                        {canDownload && (
                            <button
                                onClick={handleDownload}
                                className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                                title={t("Download")}
                                aria-label={t("Download")}
                            >
                                <Download className="w-5 h-5" />
                                <span className="text-sm font-medium">
                                    {t("Download")}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default React.memo(MediaZoomDialog);

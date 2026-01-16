"use client";

import React from "react";
import { Play, FileText } from "lucide-react";
import { useFilePreview, renderFilePreview } from "../../chat/useFilePreview";
import {
    extractYoutubeVideoId,
    getYoutubeThumbnailUrl,
} from "../../../utils/urlUtils";
import { cn } from "@/lib/utils";

/**
 * MediaPreview - Renders a preview/thumbnail for any media type
 *
 * Supports: image, video, youtube, file, text
 *
 * @param {object} props
 * @param {object} props.item - Normalized media item
 * @param {string} props.className - Additional classes for container
 * @param {string} props.mediaClassName - Additional classes for media element
 * @param {function} props.onClick - Click handler
 * @param {function} props.onLoad - Load success handler
 * @param {function} props.onError - Load error handler
 * @param {boolean} props.showPlayButton - Show play overlay for videos (default: true)
 * @param {boolean} props.autoPlay - Auto-play videos (default: false)
 * @param {boolean} props.muted - Mute videos (default: true for autoplay)
 * @param {boolean} props.loop - Loop videos (default: true for autoplay)
 * @param {string} props.objectFit - CSS object-fit value (default: "cover")
 * @param {function} props.t - Translation function
 * @param {React.ReactNode} props.textRenderer - Custom renderer for text content
 */
function MediaPreview({
    item,
    className = "",
    mediaClassName = "",
    onClick,
    onLoad,
    onError,
    showPlayButton = true,
    autoPlay = false,
    muted = true,
    loop = true,
    objectFit = "cover",
    t = (s) => s,
    textRenderer,
}) {
    // Use file preview hook for file type detection
    const fileType = useFilePreview(
        item?.type === "file" ? item?.url : null,
        item?.label,
        item?.mimeType,
    );

    if (!item) return null;

    const { type, url, content, youtubeEmbedUrl, label } = item;

    // Text content
    if (type === "text") {
        if (textRenderer) {
            return (
                <div
                    className={cn(
                        "absolute inset-0 flex items-center justify-center",
                        className,
                    )}
                    onClick={onClick}
                >
                    {textRenderer(content, item)}
                </div>
            );
        }

        return (
            <div
                className={cn(
                    "absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 p-4",
                    className,
                )}
                onClick={onClick}
            >
                <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                        {content}
                    </p>
                </div>
            </div>
        );
    }

    // Image - no wrapper needed, just the img with absolute positioning
    // media-card-image class excludes from .chat-message img styles in tailwind.css
    if (type === "image") {
        return (
            <img
                src={url}
                alt={label || t("Image")}
                className={cn(
                    "absolute inset-0 w-full h-full media-card-image",
                    objectFit === "cover" ? "object-cover" : "object-contain",
                    className,
                    mediaClassName,
                )}
                onClick={onClick}
                onLoad={onLoad}
                onError={onError}
                draggable={false}
            />
        );
    }

    // Video
    if (type === "video") {
        return (
            <div
                className={cn("absolute inset-0", className)}
                onClick={onClick}
            >
                <video
                    src={url}
                    className={cn(
                        "w-full h-full",
                        objectFit === "cover"
                            ? "object-cover"
                            : "object-contain",
                        mediaClassName,
                    )}
                    preload="metadata"
                    autoPlay={autoPlay}
                    muted={autoPlay ? true : muted}
                    loop={autoPlay ? true : loop}
                    playsInline
                    onLoadedData={onLoad}
                    onError={onError}
                />
                {showPlayButton && !autoPlay && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                        <Play
                            className="w-12 h-12 text-white opacity-80"
                            fill="white"
                        />
                    </div>
                )}
            </div>
        );
    }

    // YouTube
    if (type === "youtube") {
        const videoId = youtubeEmbedUrl
            ? extractYoutubeVideoId(youtubeEmbedUrl)
            : url
              ? extractYoutubeVideoId(url)
              : null;
        const thumbnailUrl = videoId
            ? getYoutubeThumbnailUrl(videoId, "maxresdefault")
            : null;

        return (
            <div
                className={cn("absolute inset-0", className)}
                onClick={onClick}
            >
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={label || "YouTube thumbnail"}
                        className={cn(
                            "w-full h-full media-card-image",
                            objectFit === "cover"
                                ? "object-cover"
                                : "object-contain",
                            mediaClassName,
                        )}
                        onLoad={onLoad}
                        onError={(e) => {
                            // Fallback to lower quality thumbnail
                            if (videoId) {
                                e.target.src = getYoutubeThumbnailUrl(
                                    videoId,
                                    "hqdefault",
                                );
                            }
                            onError?.(e);
                        }}
                    />
                ) : (
                    <div className="w-full h-full bg-gray-800" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                    <Play
                        className="w-12 h-12 text-white opacity-90"
                        fill="white"
                    />
                </div>
            </div>
        );
    }

    // File - use shared file preview logic
    // media-card-image on previewClassName excludes image files from chat-message styles
    if (type === "file" && url) {
        const previewClassName = cn(
            "w-full h-full media-card-image",
            mediaClassName,
            fileType.isPdf || fileType.isDoc ? "border-none" : "",
        );

        const preview = renderFilePreview({
            src: url,
            filename: label,
            fileType,
            className: previewClassName,
            onLoad,
            autoPlay,
            t,
            compact: true,
        });

        if (preview) {
            return (
                <div
                    className={cn("absolute inset-0", className)}
                    onClick={onClick}
                >
                    {preview}
                    {fileType.isVideo && showPlayButton && !autoPlay && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                            <Play
                                className="w-12 h-12 text-white opacity-80"
                                fill="white"
                            />
                        </div>
                    )}
                </div>
            );
        }

        // Fallback: show file icon
        return (
            <div
                className={cn(
                    "absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700",
                    className,
                )}
                onClick={onClick}
            >
                <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    {label && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[80%] mx-auto">
                            {label}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return null;
}

export default React.memo(MediaPreview);

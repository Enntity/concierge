"use client";

import React, { useContext, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getYoutubeEmbedUrl } from "../../utils/urlUtils";
import { LanguageContext } from "../../contexts/LanguageProvider";
import {
    MediaPreview,
    MediaZoomDialog,
    MediaLabelOverlay,
    normalizeMediaItem,
} from "../common/media";
import { cn } from "@/lib/utils";

/**
 * MediaGalleryCard - Displays multiple media items as a stack of cards
 */
const MediaGalleryCard = React.memo(function MediaGalleryCard({
    items: rawItems,
    onDeleteFile,
    t,
    className = "",
}) {
    const { t: tHook } = useTranslation();
    const { direction } = useContext(LanguageContext);
    const isRTL = direction === "rtl";
    const translationFn = typeof t === "function" ? t : tHook;

    // Normalize items
    const items = useMemo(() => {
        if (!rawItems || !Array.isArray(rawItems)) return [];
        return rawItems.map((item) => {
            const normalized = normalizeMediaItem(item);
            return {
                ...normalized,
                type: item.type || normalized.type || "file",
                url: item.url || item.src || normalized.url,
                label:
                    item.displayFilename ||
                    item.originalFilename ||
                    item.label ||
                    item.filename ||
                    normalized.label,
                mimeType: item.mimeType || normalized.mimeType,
                youtubeEmbedUrl:
                    item.youtubeEmbedUrl ||
                    normalized.youtubeEmbedUrl ||
                    (item.type === "youtube"
                        ? getYoutubeEmbedUrl(item.url || item.src)
                        : null),
                messageId: item.messageId,
                payloadIndex: item.payloadIndex,
            };
        });
    }, [rawItems]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [zoomOpen, setZoomOpen] = useState(false);

    const safeIndex =
        items.length > 0 ? Math.min(currentIndex, items.length - 1) : 0;
    const currentItem = items[safeIndex] || null;
    const hasMultiple = items.length > 1;

    const nextItem = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % items.length);
    }, [items.length]);

    const previousItem = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    }, [items.length]);

    const handleClick = (e) => {
        if (e.target.closest("button")) return;
        setZoomOpen(true);
    };

    const deleteAction =
        onDeleteFile && currentItem?.messageId !== undefined ? (
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDeleteFile(
                        currentItem.messageId,
                        currentItem.payloadIndex,
                    );
                }}
                className="hover:bg-white/20 rounded p-1 transition-colors"
                title={translationFn("Remove file from chat")}
            >
                <X className="w-4 h-4 text-white" />
            </button>
        ) : null;

    if (!items || items.length === 0) return null;

    // Build visible stack (up to 3 cards)
    const maxVisible = Math.min(items.length, 3);
    const stackOffset = 6;

    const stackIndices = [];
    for (let i = 0; i < maxVisible; i++) {
        stackIndices.push((safeIndex + i) % items.length);
    }

    return (
        <>
            <div
                className={cn("relative cursor-pointer group/media", className)}
                onClick={handleClick}
            >
                {/* Render back cards first, then front card last */}
                {[...stackIndices].reverse().map((itemIndex, i) => {
                    const stackPos = maxVisible - 1 - i; // 0 = front
                    const item = items[itemIndex];
                    const isFront = stackPos === 0;
                    const offset = stackPos * stackOffset;

                    return (
                        <div
                            key={`stack-${itemIndex}`}
                            className={cn(
                                "w-[200px] h-[150px] [.docked_&]:w-[160px] [.docked_&]:h-[120px]",
                                "rounded-lg border shadow-md overflow-hidden bg-white dark:bg-gray-800",
                                isFront
                                    ? "relative border-gray-200 dark:border-gray-700"
                                    : "absolute border-gray-300 dark:border-gray-600",
                            )}
                            style={
                                isFront
                                    ? {}
                                    : {
                                          top: `-${offset}px`,
                                          right: `-${offset}px`,
                                          opacity: 0.85 - stackPos * 0.1,
                                          transform: `scale(${1 - stackPos * 0.02})`,
                                      }
                            }
                        >
                            <MediaPreview
                                item={item}
                                className=""
                                mediaClassName="rounded-lg"
                                t={translationFn}
                            />
                            {isFront && (
                                <MediaLabelOverlay
                                    label={item?.label}
                                    actions={deleteAction}
                                    isRTL={isRTL}
                                    scrollOnTruncate
                                />
                            )}
                        </div>
                    );
                })}

                {/* Navigation */}
                {hasMultiple && (
                    <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                previousItem();
                            }}
                            className={cn(
                                "absolute top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover/media:opacity-100 transition-opacity",
                                isRTL ? "right-1" : "left-1",
                            )}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                nextItem();
                            }}
                            className={cn(
                                "absolute top-1/2 -translate-y-1/2 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 opacity-0 group-hover/media:opacity-100 transition-opacity",
                                isRTL ? "left-1" : "right-1",
                            )}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="absolute top-1 left-1 z-20 bg-black/60 rounded-full px-2 py-0.5 text-white text-xs font-medium">
                            {safeIndex + 1} / {items.length}
                        </div>
                    </>
                )}
            </div>

            <MediaZoomDialog
                open={zoomOpen}
                onOpenChange={setZoomOpen}
                item={currentItem}
                items={items}
                currentIndex={safeIndex}
                onPrevious={previousItem}
                onNext={nextItem}
                showDownload={currentItem?.type !== "youtube"}
                t={translationFn}
            />
        </>
    );
});

export default MediaGalleryCard;

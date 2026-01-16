"use client";

import { useState, useCallback, useMemo, useEffect } from "react";

/**
 * Normalize a single media item to consistent structure
 * @param {object|string} item - Raw item (can be object or URL string)
 * @returns {object} Normalized item
 */
export function normalizeMediaItem(item) {
    if (!item) return null;

    // If it's just a string URL, convert to object
    if (typeof item === "string") {
        const isVideo = /\.(mp4|webm|mov|avi)$/i.test(item);
        return {
            type: isVideo ? "video" : "image",
            url: item,
            label: null,
        };
    }

    // Already an object - normalize type
    const url = item.url || item.src || item.image_url?.url;
    let type = item.type;

    if (!type && url) {
        if (/\.(mp4|webm|mov|avi)$/i.test(url)) {
            type = "video";
        } else if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
            type = "image";
        } else if (
            item.youtubeEmbedUrl ||
            /youtube\.com|youtu\.be/i.test(url)
        ) {
            type = "youtube";
        } else {
            type = "file";
        }
    }

    // Text content
    if (item.content && !url) {
        type = "text";
    }

    return {
        type: type || "file",
        url,
        content: item.content || item.text,
        label: item.label || item.filename || item.name,
        mimeType: item.mimeType,
        youtubeEmbedUrl: item.youtubeEmbedUrl,
        duration: item.duration,
        // Pass through any extra properties
        ...item,
    };
}

/**
 * Normalize items array from various input formats
 * @param {array|object|string} input - Items in various formats
 * @returns {array} Normalized items array
 */
export function normalizeMediaItems(input) {
    if (!input) return [];

    // Already an array
    if (Array.isArray(input)) {
        return input.map(normalizeMediaItem).filter(Boolean);
    }

    // Object with items array
    if (input.items && Array.isArray(input.items)) {
        return input.items.map(normalizeMediaItem).filter(Boolean);
    }

    // Object with files array
    if (input.files && Array.isArray(input.files)) {
        return input.files.map(normalizeMediaItem).filter(Boolean);
    }

    // Single item (object or string)
    const normalized = normalizeMediaItem(input);
    return normalized ? [normalized] : [];
}

/**
 * Hook for managing gallery state and navigation
 * @param {object} options
 * @param {array|object} options.items - Items to display (will be normalized)
 * @param {number} options.initialIndex - Starting index
 * @param {function} options.onIndexChange - Callback when index changes
 * @param {boolean} options.loop - Whether to loop at ends (default: true)
 * @returns {object} Gallery state and controls
 */
export function useMediaGallery({
    items: rawItems,
    initialIndex = 0,
    onIndexChange,
    loop = true,
} = {}) {
    // Normalize items
    const items = useMemo(() => normalizeMediaItems(rawItems), [rawItems]);

    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoomOpen, setZoomOpen] = useState(false);

    // Keep index in bounds when items change
    useEffect(() => {
        if (items.length > 0 && currentIndex >= items.length) {
            setCurrentIndex(items.length - 1);
        }
    }, [items.length, currentIndex]);

    // Reset index when items change completely
    useEffect(() => {
        setCurrentIndex(initialIndex);
    }, [rawItems, initialIndex]);

    const currentItem = items[currentIndex] || null;
    const hasMultiple = items.length > 1;

    const goToItem = useCallback(
        (index) => {
            if (index < 0 || index >= items.length) return;
            setCurrentIndex(index);
            onIndexChange?.(index, items[index]);
        },
        [items, onIndexChange],
    );

    const nextItem = useCallback(() => {
        if (!hasMultiple) return;
        const nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
            if (loop) goToItem(0);
        } else {
            goToItem(nextIndex);
        }
    }, [currentIndex, items.length, hasMultiple, loop, goToItem]);

    const previousItem = useCallback(() => {
        if (!hasMultiple) return;
        const prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
            if (loop) goToItem(items.length - 1);
        } else {
            goToItem(prevIndex);
        }
    }, [currentIndex, items.length, hasMultiple, loop, goToItem]);

    const openZoom = useCallback(
        (index) => {
            if (typeof index === "number") {
                goToItem(index);
            }
            setZoomOpen(true);
        },
        [goToItem],
    );

    const closeZoom = useCallback(() => {
        setZoomOpen(false);
    }, []);

    // Keyboard navigation when zoom is open
    useEffect(() => {
        if (!zoomOpen || !hasMultiple) return;

        const handleKeyDown = (e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                nextItem();
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                previousItem();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [zoomOpen, hasMultiple, nextItem, previousItem]);

    return {
        // State
        items,
        currentIndex,
        currentItem,
        hasMultiple,
        zoomOpen,

        // Navigation
        goToItem,
        nextItem,
        previousItem,

        // Zoom control
        openZoom,
        closeZoom,
        setZoomOpen,
    };
}

export default useMediaGallery;

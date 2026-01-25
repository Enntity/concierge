"use client";

import React, {
    createContext,
    useState,
    useCallback,
    useContext,
    useRef,
    useEffect,
} from "react";

/**
 * EntityOverlayContext - Manages floating overlay display for entity responses
 *
 * Supports playlist of items: images, videos, and text blocks
 * Each item can have its own duration and label
 */

const EntityOverlayContext = createContext({
    // Current display state
    visible: false,
    items: [],
    currentIndex: 0,
    currentItem: null,
    entityId: null,

    // Actions
    showOverlay: () => {},
    hideOverlay: () => {},
    replayLast: () => {},
    hasLastOverlay: () => false,
    nextItem: () => {},
    previousItem: () => {},
    pauseAutoAdvance: () => {},
    resumeAutoAdvance: () => {},
});

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".ogg", ".m4v"];
const DEFAULT_DURATION = 24000; // 24 seconds default per item

function isVideoUrl(url) {
    if (!url) return false;
    const urlLower = url.toLowerCase().split("?")[0];
    return VIDEO_EXTENSIONS.some((ext) => urlLower.endsWith(ext));
}

/**
 * Normalize incoming overlay data to a consistent items array
 * Accepts various formats for backward compatibility and flexibility
 */
function normalizeOverlayData(data) {
    if (!data) return { items: [], entityId: null };

    let items = [];
    let entityId = data.entityId || null;

    // Format 1: Already has items array
    if (Array.isArray(data.items) && data.items.length > 0) {
        items = data.items.map(normalizeItem);
    }
    // Format 2: files array (legacy media format)
    else if (Array.isArray(data.files) && data.files.length > 0) {
        items = data.files.map((file) =>
            normalizeItem({
                type: isVideoUrl(file.url || file.gcs) ? "video" : "image",
                url: file.url || file.gcs,
                label: file.label || file.filename,
                duration: file.duration,
            }),
        );
    }
    // Format 3: Single URL
    else if (data.url) {
        items = [
            normalizeItem({
                type: isVideoUrl(data.url) ? "video" : "image",
                url: data.url,
                label: data.label,
                duration: data.duration,
            }),
        ];
    }
    // Format 4: Text content
    else if (data.text || data.content || data.message) {
        items = [
            normalizeItem({
                type: "text",
                content: data.text || data.content || data.message,
                label: data.label,
                duration: data.duration,
            }),
        ];
    }
    // Format 5: Plain string
    else if (typeof data === "string") {
        items = [
            normalizeItem({
                type: "text",
                content: data,
            }),
        ];
    }

    return { items, entityId };
}

function normalizeItem(item) {
    const type =
        item.type ||
        (item.url ? (isVideoUrl(item.url) ? "video" : "image") : "text");

    return {
        type,
        url: item.url || null,
        content: item.content || item.text || item.message || null,
        duration: normalizeDuration(item.duration),
        label: item.label || null,
    };
}

function normalizeDuration(duration) {
    if (duration === undefined || duration === null) return DEFAULT_DURATION;
    // If less than 1000, assume seconds and convert to ms
    return duration < 1000 ? duration * 1000 : duration;
}

export function EntityOverlayProvider({ children }) {
    const [visible, setVisible] = useState(false);
    const [items, setItems] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [entityId, setEntityId] = useState(null);

    const autoAdvanceTimerRef = useRef(null);
    const timerStartRef = useRef(null);
    const remainingTimeRef = useRef(0);
    const lastOverlayRef = useRef(null);
    const isPausedRef = useRef(false); // Track if user is hovering/interacting

    const currentItem = items[currentIndex] || null;

    // Clear all timers
    const clearTimers = useCallback(() => {
        if (autoAdvanceTimerRef.current) {
            clearTimeout(autoAdvanceTimerRef.current);
            autoAdvanceTimerRef.current = null;
        }
        timerStartRef.current = null;
        remainingTimeRef.current = 0;
    }, []);

    // Hide overlay with fade-out delay
    const hideOverlay = useCallback(() => {
        clearTimers();
        isPausedRef.current = false;
        setVisible(false);
        // Clear state after fade animation
        setTimeout(() => {
            setItems([]);
            setCurrentIndex(0);
            setEntityId(null);
        }, 500);
    }, [clearTimers]);

    // Start timer for current item
    const startItemTimer = useCallback(
        (duration) => {
            clearTimers();
            timerStartRef.current = Date.now();
            remainingTimeRef.current = duration;

            autoAdvanceTimerRef.current = setTimeout(() => {
                // Advance to next item or hide
                setCurrentIndex((prev) => {
                    const next = prev + 1;
                    if (next >= items.length) {
                        // End of playlist
                        hideOverlay();
                        return prev;
                    }
                    return next;
                });
            }, duration);
        },
        [clearTimers, items.length, hideOverlay],
    );

    // Start timer when current item changes (but not if paused/hovering)
    useEffect(() => {
        if (visible && currentItem && !isPausedRef.current) {
            startItemTimer(currentItem.duration || DEFAULT_DURATION);
        }
        return () => clearTimers();
    }, [visible, currentIndex, currentItem, startItemTimer, clearTimers]);

    // Show overlay with new data
    const showOverlay = useCallback(
        (data) => {
            const { items: newItems, entityId: newEntityId } =
                normalizeOverlayData(data);

            if (newItems.length === 0) return;

            clearTimers();
            isPausedRef.current = false; // Reset pause state for new overlay

            // Store for replay
            lastOverlayRef.current = { items: newItems, entityId: newEntityId };

            setItems(newItems);
            setCurrentIndex(0);
            setEntityId(newEntityId);

            // Small delay then show
            setTimeout(() => setVisible(true), 50);
        },
        [clearTimers],
    );

    // Replay last overlay
    const replayLast = useCallback(
        (forEntityId) => {
            const last = lastOverlayRef.current;
            if (!last) return;

            // If entityId specified, only replay if it matches
            if (forEntityId && last.entityId && last.entityId !== forEntityId)
                return;

            showOverlay(last);
        },
        [showOverlay],
    );

    // Check if there's a last overlay to replay
    const hasLastOverlay = useCallback((forEntityId) => {
        const last = lastOverlayRef.current;
        if (!last || last.items.length === 0) return false;
        if (!forEntityId || !last.entityId) return true;
        return last.entityId === forEntityId;
    }, []);

    // Manual navigation
    const nextItem = useCallback(() => {
        if (items.length <= 1) return;
        setCurrentIndex((prev) => (prev + 1) % items.length);
    }, [items.length]);

    const previousItem = useCallback(() => {
        if (items.length <= 1) return;
        setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    }, [items.length]);

    // Pause/resume for user interactions (e.g., hover, zoom dialog)
    const pauseAutoAdvance = useCallback(() => {
        isPausedRef.current = true;
        if (autoAdvanceTimerRef.current && timerStartRef.current) {
            clearTimeout(autoAdvanceTimerRef.current);
            autoAdvanceTimerRef.current = null;
            const elapsed = Date.now() - timerStartRef.current;
            remainingTimeRef.current = Math.max(
                0,
                remainingTimeRef.current - elapsed,
            );
            timerStartRef.current = null;
        }
    }, []);

    const resumeAutoAdvance = useCallback(() => {
        isPausedRef.current = false;
        if (
            visible &&
            currentItem &&
            remainingTimeRef.current > 0 &&
            !autoAdvanceTimerRef.current
        ) {
            startItemTimer(remainingTimeRef.current);
        }
    }, [visible, currentItem, startItemTimer]);

    return (
        <EntityOverlayContext.Provider
            value={{
                visible,
                items,
                currentIndex,
                currentItem,
                entityId,
                showOverlay,
                hideOverlay,
                replayLast,
                hasLastOverlay,
                nextItem,
                previousItem,
                pauseAutoAdvance,
                resumeAutoAdvance,
            }}
        >
            {children}
        </EntityOverlayContext.Provider>
    );
}

export function useEntityOverlay() {
    return useContext(EntityOverlayContext);
}

export default EntityOverlayContext;

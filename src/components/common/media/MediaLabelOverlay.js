"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

/**
 * MediaLabelOverlay - Gradient label overlay at bottom of media
 *
 * Features:
 * - Gradient from transparent to black
 * - Show on hover (or always visible)
 * - Auto-scroll for truncated text
 * - Optional action buttons (delete, etc.)
 *
 * @param {object} props
 * @param {string} props.label - Label text to display
 * @param {boolean} props.visible - Force visibility (otherwise hover-controlled)
 * @param {boolean} props.alwaysVisible - Always show (no hover required)
 * @param {React.ReactNode} props.actions - Action buttons to show on right
 * @param {boolean} props.scrollOnTruncate - Auto-scroll when text is truncated (default: true)
 * @param {boolean} props.isRTL - Right-to-left text direction
 * @param {string} props.className - Additional classes
 */
function MediaLabelOverlay({
    label,
    visible,
    alwaysVisible = false,
    actions,
    scrollOnTruncate = true,
    isRTL = false,
    className = "",
}) {
    const [isTextTruncated, setIsTextTruncated] = useState(false);
    const [scrollDistance, setScrollDistance] = useState(0);
    const textRef = useRef(null);

    // Check if text is truncated
    const checkTruncation = useCallback(() => {
        if (!textRef.current || !label) return;

        const element = textRef.current;
        const container = element.parentElement;
        if (!container) return;

        // Measure full text width
        const tempElement = document.createElement("span");
        tempElement.style.cssText =
            "position: absolute; visibility: hidden; white-space: nowrap; font-size: inherit;";
        tempElement.textContent = label;
        document.body.appendChild(tempElement);
        const fullWidth = tempElement.offsetWidth;
        document.body.removeChild(tempElement);

        // Get available width
        const containerPadding = 24; // Approximate padding
        const actionsWidth = actions ? 40 : 0;
        const gap = actions ? 8 : 0;
        const availableWidth =
            container.clientWidth - containerPadding - actionsWidth - gap;

        const isTruncated = fullWidth > availableWidth;
        if (isTruncated && scrollOnTruncate) {
            setIsTextTruncated(true);
            setScrollDistance(Math.max(0, fullWidth - availableWidth));
        } else {
            setIsTextTruncated(false);
            setScrollDistance(0);
        }
    }, [label, actions, scrollOnTruncate]);

    useEffect(() => {
        const rafId = requestAnimationFrame(checkTruncation);
        return () => cancelAnimationFrame(rafId);
    }, [checkTruncation]);

    if (!label) return null;

    const isVisible = alwaysVisible || visible;

    return (
        <div
            className={cn(
                "absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent transition-opacity pointer-events-none",
                isVisible ? "opacity-100" : "opacity-0",
                "group-hover/media:opacity-100",
                className,
            )}
        >
            <div
                className={cn(
                    "flex items-center gap-2",
                    isRTL ? "flex-row-reverse" : "",
                )}
                dir="auto"
            >
                <div className="flex-1 min-w-0 overflow-hidden">
                    <span
                        ref={textRef}
                        className={cn(
                            "text-xs text-white",
                            isRTL ? "text-right" : "text-left",
                            isTextTruncated
                                ? "whitespace-nowrap inline-block group-hover/media:animate-scroll-text"
                                : "truncate block",
                        )}
                        style={
                            isTextTruncated
                                ? {
                                      "--scroll-distance": isRTL
                                          ? `${scrollDistance}px`
                                          : `-${scrollDistance}px`,
                                  }
                                : {}
                        }
                    >
                        {label}
                    </span>
                </div>
                {actions && (
                    <div
                        className={cn(
                            "flex-shrink-0 pointer-events-auto",
                            isRTL ? "order-first" : "order-last",
                        )}
                    >
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}

export default React.memo(MediaLabelOverlay);

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useEntityOverlay } from "../contexts/EntityOverlayContext";
import { cn } from "@/lib/utils";
import { convertMessageToMarkdown } from "./chat/ChatMessage";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

/**
 * EntityOverlay - Floating overlay for entity responses
 * Displays images, videos, or text blocks with playlist support
 */
export default function EntityOverlay() {
    const {
        visible,
        items,
        currentIndex,
        currentItem,
        hideOverlay,
        nextItem,
        previousItem,
        pauseAutoAdvance,
        resumeAutoAdvance,
    } = useEntityOverlay();

    const [zoomOpen, setZoomOpen] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const mediaRef = useRef(null);

    // Reset zoom when item changes
    useEffect(() => {
        setZoomLevel(0);
    }, [currentIndex]);

    // Scroll wheel zoom for media
    useEffect(() => {
        const el = mediaRef.current;
        if (!el || currentItem?.type === "text") return;

        const handleWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = -e.deltaY * 0.005;
            setZoomLevel((prev) => Math.max(0, Math.min(3, prev + delta)));
        };

        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, [currentItem?.type]);

    // Auto-advance only when NOT hovering AND NOT in fullscreen
    // Pause in all other cases
    useEffect(() => {
        if (zoomOpen || isHovering) {
            pauseAutoAdvance();
        } else {
            resumeAutoAdvance();
        }
    }, [zoomOpen, isHovering, pauseAutoAdvance, resumeAutoAdvance]);

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);

    const handleBackdropClick = () => {
        hideOverlay();
    };

    // Reset state when overlay closes
    useEffect(() => {
        if (!visible) {
            setZoomOpen(false);
            setIsHovering(false);
        }
    }, [visible]);

    if (!visible || !currentItem) return null;

    const isVideo = currentItem.type === "video";
    const isText = currentItem.type === "text";
    const hasMultiple = items.length > 1;

    return (
        <>
            {/* Backdrop for click-outside-to-close */}
            <div
                onClick={handleBackdropClick}
                className="fixed inset-0 z-50 bg-transparent"
                aria-hidden="true"
            />

            {/* Overlay container */}
            <div
                className={cn(
                    "fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 pointer-events-none",
                    "transition-opacity duration-500",
                    visible ? "opacity-100" : "opacity-0",
                )}
            >
                <div
                    className={cn(
                        "relative pointer-events-auto",
                        "transform transition-all duration-700 ease-out",
                        visible
                            ? "translate-y-0 scale-100"
                            : "-translate-y-8 scale-95",
                    )}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="relative group/overlay">
                        {/* Outer glow - larger for 2x overlay */}
                        <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 blur-2xl opacity-75" />

                        {/* Unified container - same size for media and text */}
                        <div
                            ref={mediaRef}
                            className={cn(
                                "relative overflow-hidden shadow-2xl cursor-pointer select-none",
                                "w-80 h-60 sm:w-[28rem] sm:h-[21rem] md:w-[56vw] md:h-[42vw] lg:w-[48vw] lg:h-[36vw]",
                                "md:max-w-[800px] md:max-h-[600px] lg:max-w-[960px] lg:max-h-[720px]",
                                "ring-2 ring-cyan-400/50 hover:ring-cyan-300/70 transition-all duration-200",
                                "focus:outline-none rounded-3xl",
                                isText
                                    ? "bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95 entity-overlay-text"
                                    : "bg-black/50 entity-overlay-media",
                            )}
                            onClick={() => setZoomOpen(true)}
                        >
                            {isText ? (
                                // Text content - centered in the unified container
                                <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-8 md:p-10">
                                    <div className="text-center max-h-full overflow-auto">
                                        <div className="entity-overlay-message text-xl sm:text-2xl md:text-3xl lg:text-4xl font-light leading-relaxed text-slate-200">
                                            {convertMessageToMarkdown({
                                                payload: currentItem.content,
                                            })}
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 pointer-events-none entity-overlay-text-glow" />
                                </div>
                            ) : isVideo ? (
                                <video
                                    src={currentItem.url}
                                    className="w-full h-full object-cover pointer-events-none"
                                    style={{
                                        transform: `scale(${1 + zoomLevel * 0.5})`,
                                        transition: "transform 0.15s ease-out",
                                    }}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    onError={hideOverlay}
                                />
                            ) : (
                                <img
                                    src={currentItem.url}
                                    alt={currentItem.label || "Entity response"}
                                    className="w-full h-full object-cover pointer-events-none"
                                    style={{
                                        transform: `scale(${1 + zoomLevel * 0.5})`,
                                        transition: "transform 0.15s ease-out",
                                    }}
                                    onError={hideOverlay}
                                    draggable={false}
                                />
                            )}
                            {/* Label overlay - only show when paused (same treatment for all types) */}
                            {currentItem.label && (isHovering || zoomOpen) && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                                    <div className="text-sm sm:text-base md:text-lg text-white/90 truncate">
                                        {currentItem.label}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Navigation for multiple items */}
                        {hasMultiple && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        previousItem();
                                    }}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-all opacity-0 group-hover/overlay:opacity-100"
                                    aria-label="Previous"
                                >
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 19l-7-7 7-7"
                                        />
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        nextItem();
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-2.5 transition-all opacity-0 group-hover/overlay:opacity-100"
                                    aria-label="Next"
                                >
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </button>
                                {/* Indicator dots */}
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-2 opacity-0 group-hover/overlay:opacity-100 transition-opacity">
                                    {items.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "h-2 rounded-full transition-all",
                                                idx === currentIndex
                                                    ? "bg-cyan-400 w-6"
                                                    : "bg-white/50 w-2",
                                            )}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Corner decorations - show for all types */}
                        <>
                            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-3xl">
                                <div className="entity-overlay-scanline" />
                            </div>
                            <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-l-2 border-t-2 border-cyan-400/60 rounded-tl" />
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-r-2 border-t-2 border-cyan-400/60 rounded-tr" />
                            <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-l-2 border-b-2 border-cyan-400/60 rounded-bl" />
                            <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-r-2 border-b-2 border-cyan-400/60 rounded-br" />
                        </>

                        {/* Close hint */}
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-sm text-gray-400 dark:text-gray-500 opacity-0 group-hover/overlay:opacity-100 transition-opacity whitespace-nowrap">
                            Click outside to close
                        </div>
                    </div>
                </div>
            </div>

            {/* Fullscreen Dialog - works for all item types */}
            <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
                <DialogContent
                    className="max-w-[90vw] max-h-[90vh] p-0 bg-transparent border-0 shadow-none flex items-center justify-center"
                    aria-describedby="overlay-zoom-description"
                >
                    <DialogTitle className="sr-only">
                        Entity Response
                    </DialogTitle>
                    <DialogDescription
                        id="overlay-zoom-description"
                        className="sr-only"
                    >
                        Viewing entity response in full screen
                    </DialogDescription>
                    <div className="relative">
                        <div className="absolute -inset-8 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 blur-2xl animate-pulse" />
                        <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-cyan-400/30 via-blue-500/30 to-purple-400/30 blur-xl" />

                        {/* Fixed-size container so gallery buttons don't jump */}
                        <div
                            className={cn(
                                "relative w-[80vw] h-[70vh] max-w-[1000px] max-h-[700px]",
                                "rounded-2xl ring-4 ring-cyan-400/60",
                                "shadow-[0_0_60px_rgba(34,211,238,0.4),0_0_100px_rgba(139,92,246,0.3)]",
                                "overflow-hidden",
                                isText
                                    ? "bg-gradient-to-br from-slate-950/98 via-slate-900/95 to-slate-950/98"
                                    : "bg-black",
                            )}
                        >
                            {isText ? (
                                // Text content in fullscreen - centered in fixed container
                                <div className="absolute inset-0 flex items-center justify-center p-8 sm:p-12 md:p-16 overflow-auto">
                                    <div className="text-center">
                                        <div className="entity-overlay-message text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light leading-relaxed text-slate-200">
                                            {convertMessageToMarkdown({
                                                payload: currentItem.content,
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : isVideo ? (
                                <video
                                    src={currentItem.url}
                                    className="w-full h-full object-contain"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                            ) : (
                                <img
                                    src={currentItem.url}
                                    alt={currentItem.label || "Entity response"}
                                    className="w-full h-full object-contain"
                                />
                            )}

                            {/* Label overlay in fullscreen (same treatment for all types) */}
                            {currentItem.label && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 py-4">
                                    <div className="text-base sm:text-lg md:text-xl text-white/90 truncate">
                                        {currentItem.label}
                                    </div>
                                </div>
                            )}

                            {/* Corner accents */}
                            <div className="absolute -top-4 -left-4 w-8 h-8 border-l-2 border-t-2 border-cyan-400/60 rounded-tl-lg" />
                            <div className="absolute -top-4 -right-4 w-8 h-8 border-r-2 border-t-2 border-cyan-400/60 rounded-tr-lg" />
                            <div className="absolute -bottom-4 -left-4 w-8 h-8 border-l-2 border-b-2 border-cyan-400/60 rounded-bl-lg" />
                            <div className="absolute -bottom-4 -right-4 w-8 h-8 border-r-2 border-b-2 border-cyan-400/60 rounded-br-lg" />
                        </div>

                        {/* Fullscreen navigation for multiple items */}
                        {hasMultiple && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        previousItem();
                                    }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-black/70 hover:bg-black/90 text-white rounded-full p-3 transition-all"
                                    aria-label="Previous"
                                >
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 19l-7-7 7-7"
                                        />
                                    </svg>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        nextItem();
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-black/70 hover:bg-black/90 text-white rounded-full p-3 transition-all"
                                    aria-label="Next"
                                >
                                    <svg
                                        className="w-6 h-6"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 5l7 7-7 7"
                                        />
                                    </svg>
                                </button>
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-black/70 rounded-full px-4 py-2 text-white text-sm">
                                    {currentIndex + 1} / {items.length}
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <style jsx global>{`
                .entity-overlay-text {
                    box-shadow:
                        0 0 30px rgba(34, 211, 238, 0.2),
                        0 0 60px rgba(139, 92, 246, 0.15);
                    animation: entity-overlay-fade-in 0.9s ease-out forwards;
                }
                .entity-overlay-text-glow::before {
                    content: "";
                    position: absolute;
                    inset: -20%;
                    background: radial-gradient(
                        circle,
                        rgba(34, 211, 238, 0.12),
                        transparent 60%
                    );
                    filter: blur(20px);
                }
                .entity-overlay-message .chat-message {
                    font-size: inherit !important;
                    line-height: inherit !important;
                    text-shadow:
                        0 0 12px rgba(34, 211, 238, 0.4),
                        0 0 24px rgba(139, 92, 246, 0.2);
                }
                .entity-overlay-message .chat-message p,
                .entity-overlay-message .chat-message div,
                .entity-overlay-message .chat-message span,
                .entity-overlay-message .chat-message li,
                .entity-overlay-message .chat-message h1,
                .entity-overlay-message .chat-message h2,
                .entity-overlay-message .chat-message h3 {
                    font-size: inherit !important;
                    line-height: inherit !important;
                    color: #e2e8f0;
                    margin: 0;
                }
                .entity-overlay-media {
                    box-shadow:
                        0 0 30px rgba(34, 211, 238, 0.3),
                        0 0 60px rgba(139, 92, 246, 0.2);
                }
                .entity-overlay-scanline {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: linear-gradient(
                        90deg,
                        transparent,
                        rgba(34, 211, 238, 0.4),
                        transparent
                    );
                    animation: entity-overlay-scan 2s ease-in-out infinite;
                }
                @keyframes entity-overlay-scan {
                    0%,
                    100% {
                        top: 0;
                        opacity: 0.5;
                    }
                    50% {
                        top: 100%;
                        opacity: 0.8;
                    }
                }
                @keyframes entity-overlay-fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(12px) scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </>
    );
}

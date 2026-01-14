"use client";

import React, { useState, useEffect, useRef } from "react";
import { useStreamingAvatar } from "../contexts/StreamingAvatarContext";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

/**
 * StreamingAvatarOverlay - Displays AI-generated avatars as an overlay on the chat
 * Works on both desktop and mobile by floating over the main content area
 */
export default function StreamingAvatarOverlay() {
    const {
        avatarFiles,
        currentFileIndex,
        avatarUrl,
        avatarVisible,
        isVideo,
        clearStreamingAvatar,
        pauseAutoFade,
        resumeAutoFade,
        nextFile,
        previousFile,
    } = useStreamingAvatar();

    const [avatarZoomOpen, setAvatarZoomOpen] = useState(false);
    const [avatarZoomLevel, setAvatarZoomLevel] = useState(0);
    const avatarRef = useRef(null);

    // Reset zoom when avatar changes
    useEffect(() => {
        setAvatarZoomLevel(0);
    }, [avatarUrl]);

    // Scroll wheel zoom - use native listener to allow preventDefault
    useEffect(() => {
        const el = avatarRef.current;
        if (!el) return;

        const handleWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = -e.deltaY * 0.005;
            setAvatarZoomLevel((prev) =>
                Math.max(0, Math.min(3, prev + delta)),
            );
        };

        el.addEventListener("wheel", handleWheel, { passive: false });
        return () => el.removeEventListener("wheel", handleWheel);
    }, [avatarUrl]);

    // Pause auto-fade timer when zoom dialog is open
    useEffect(() => {
        if (avatarZoomOpen) {
            pauseAutoFade();
        } else {
            resumeAutoFade();
        }
    }, [avatarZoomOpen, pauseAutoFade, resumeAutoFade]);

    // Click outside to close (on the overlay backdrop)
    const handleBackdropClick = () => {
        clearStreamingAvatar();
    };

    if (!avatarUrl) return null;

    return (
        <>
            {/* Clickable backdrop for close-on-outside-click */}
            {avatarVisible && (
                <div
                    onClick={handleBackdropClick}
                    className="fixed inset-0 z-50 bg-transparent"
                    aria-hidden="true"
                />
            )}

            {/* Overlay container */}
            <div
                className={cn(
                    "fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 pointer-events-none",
                    "transition-opacity duration-500",
                    avatarVisible ? "opacity-100" : "opacity-0",
                )}
            >
                {/* Avatar card */}
                <div
                    className={cn(
                        "relative pointer-events-auto",
                        "transform transition-all duration-700 ease-out",
                        avatarVisible
                            ? "translate-y-0 scale-100"
                            : "-translate-y-8 scale-95",
                    )}
                >
                    <div className="relative group/avatar">
                        {/* Outer glow effect */}
                        <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 blur-xl opacity-75" />

                        {/* TV-screen media container - responsive sizing */}
                        <button
                            ref={avatarRef}
                            className={cn(
                                "relative overflow-hidden shadow-2xl streaming-avatar-glow cursor-pointer select-none",
                                // Mobile: fixed size, Tablet: medium, Desktop: large (viewport-relative)
                                "w-48 h-36 sm:w-64 sm:h-48 md:w-[28vw] md:h-[21vw] lg:w-[24vw] lg:h-[18vw]",
                                // Cap max size on very large screens
                                "md:max-w-[400px] md:max-h-[300px] lg:max-w-[480px] lg:max-h-[360px]",
                                "ring-2 ring-cyan-400/50 hover:ring-cyan-300/70 transition-all duration-200",
                                "focus:outline-none rounded-2xl",
                                "bg-black/50",
                            )}
                            onClick={() => setAvatarZoomOpen(true)}
                        >
                            {isVideo ? (
                                <video
                                    src={avatarUrl}
                                    className="w-full h-full object-cover pointer-events-none"
                                    style={{
                                        transform: `scale(${1 + avatarZoomLevel * 0.5})`,
                                        transition: "transform 0.15s ease-out",
                                    }}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    onError={clearStreamingAvatar}
                                />
                            ) : (
                                <img
                                    src={avatarUrl}
                                    alt="AI Avatar"
                                    className="w-full h-full object-cover pointer-events-none"
                                    style={{
                                        transform: `scale(${1 + avatarZoomLevel * 0.5})`,
                                        transition: "transform 0.15s ease-out",
                                    }}
                                    onError={clearStreamingAvatar}
                                    draggable={false}
                                />
                            )}
                        </button>

                        {/* Navigation controls for multiple files */}
                        {avatarFiles && avatarFiles.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        previousFile();
                                    }}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-all opacity-0 group-hover/avatar:opacity-100"
                                    aria-label="Previous image"
                                >
                                    <svg
                                        className="w-4 h-4"
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
                                        nextFile();
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-all opacity-0 group-hover/avatar:opacity-100"
                                    aria-label="Next image"
                                >
                                    <svg
                                        className="w-4 h-4"
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
                                {/* File indicator dots */}
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 flex gap-1.5 opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                                    {avatarFiles.map((_, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "w-1.5 h-1.5 rounded-full transition-all",
                                                index === currentFileIndex
                                                    ? "bg-cyan-400 w-4"
                                                    : "bg-white/50",
                                            )}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Futuristic scan line effect */}
                        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
                            <div className="streaming-avatar-scanline" />
                        </div>

                        {/* Corner accents for TV effect */}
                        <div className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 border-cyan-400/60 rounded-tl" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2 border-cyan-400/60 rounded-tr" />
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 border-cyan-400/60 rounded-bl" />
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 border-cyan-400/60 rounded-br" />

                        {/* Close hint - visible on hover */}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-gray-400 dark:text-gray-500 opacity-0 group-hover/avatar:opacity-100 transition-opacity whitespace-nowrap">
                            Click outside to close
                        </div>
                    </div>
                </div>
            </div>

            {/* Avatar Zoom Dialog - TV Screen Style */}
            <Dialog open={avatarZoomOpen} onOpenChange={setAvatarZoomOpen}>
                <DialogContent
                    className="max-w-[90vw] max-h-[90vh] p-0 bg-transparent border-0 shadow-none flex items-center justify-center"
                    aria-describedby="avatar-zoom-description"
                >
                    <DialogTitle className="sr-only">AI Avatar</DialogTitle>
                    <DialogDescription
                        id="avatar-zoom-description"
                        className="sr-only"
                    >
                        Viewing AI avatar in full screen
                    </DialogDescription>
                    <div className="relative">
                        {/* Outer glow */}
                        <div className="absolute -inset-8 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-cyan-500/20 blur-2xl animate-pulse" />
                        <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-cyan-400/30 via-blue-500/30 to-purple-400/30 blur-xl" />

                        {/* Main media container */}
                        <div className="relative">
                            {isVideo ? (
                                <video
                                    src={avatarUrl}
                                    className={cn(
                                        "max-w-[80vw] max-h-[70vh] rounded-2xl object-contain",
                                        "ring-4 ring-cyan-400/60",
                                        "shadow-[0_0_60px_rgba(34,211,238,0.4),0_0_100px_rgba(139,92,246,0.3)]",
                                    )}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                            ) : (
                                <img
                                    src={avatarUrl}
                                    alt="AI Avatar"
                                    className={cn(
                                        "max-w-[80vw] max-h-[70vh] rounded-2xl object-contain",
                                        "ring-4 ring-cyan-400/60",
                                        "shadow-[0_0_60px_rgba(34,211,238,0.4),0_0_100px_rgba(139,92,246,0.3)]",
                                    )}
                                />
                            )}

                            {/* Corner accents */}
                            <div className="absolute -top-4 -left-4 w-8 h-8 border-l-2 border-t-2 border-cyan-400/60 rounded-tl-lg" />
                            <div className="absolute -top-4 -right-4 w-8 h-8 border-r-2 border-t-2 border-cyan-400/60 rounded-tr-lg" />
                            <div className="absolute -bottom-4 -left-4 w-8 h-8 border-l-2 border-b-2 border-cyan-400/60 rounded-bl-lg" />
                            <div className="absolute -bottom-4 -right-4 w-8 h-8 border-r-2 border-b-2 border-cyan-400/60 rounded-br-lg" />

                            {/* Scan line effect */}
                            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent h-[200%] animate-[avatar-scan-zoom_3s_ease-in-out_infinite]" />
                            </div>
                        </div>

                        {/* Navigation controls for multiple files in zoom dialog */}
                        {avatarFiles && avatarFiles.length > 1 && (
                            <>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        previousFile();
                                    }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-black/70 hover:bg-black/90 text-white rounded-full p-3 transition-all"
                                    aria-label="Previous image"
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
                                        nextFile();
                                    }}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-black/70 hover:bg-black/90 text-white rounded-full p-3 transition-all"
                                    aria-label="Next image"
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
                                {/* File indicator */}
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 bg-black/70 rounded-full px-4 py-2 text-white text-sm">
                                    {currentFileIndex + 1} /{" "}
                                    {avatarFiles.length}
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

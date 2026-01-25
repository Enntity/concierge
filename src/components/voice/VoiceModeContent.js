"use client";

import React from "react";
import { useVoice } from "../../contexts/VoiceContext";
import { useEntityOverlay } from "../../contexts/EntityOverlayContext";
import { useVoiceSession } from "../../hooks/useVoiceSession";
import { AudioVisualizer } from "./AudioVisualizer";
import { VoiceControls } from "./VoiceControls";
import { FloatingTranscript } from "./FloatingTranscript";
import EntityOverlay from "../EntityOverlay";

/**
 * VoiceModeContent - Voice mode UI that replaces chat content
 *
 * Renders inside the normal chat layout (keeps the app header visible).
 * Features:
 * - Audio visualizer in center (or EntityOverlay when media is shown)
 * - Floating ethereal transcripts below visualizer
 * - Controls at bottom
 * - Smooth crossfade between visualizer and overlay content
 */
export function VoiceModeContent() {
    const { isConnected, currentTool, audioContext, analyserNode } = useVoice();

    const { visible: overlayVisible } = useEntityOverlay();

    // Initialize the voice session
    useVoiceSession();

    // Show overlay content (without backdrop) when EntityOverlay is visible
    const showOverlayContent = overlayVisible;

    return (
        <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
            {/* Main content area - flex-1 to fill space */}
            <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
                {/* Shared animation container for visualizer/overlay crossfade */}
                <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
                    {/* Audio Visualizer - fades when overlay shows */}
                    <div
                        className={`
                            absolute inset-0 flex items-center justify-center
                            transition-all duration-300 ease-out
                            ${
                                showOverlayContent
                                    ? "opacity-0 scale-95 pointer-events-none"
                                    : "opacity-100 scale-100"
                            }
                        `}
                    >
                        {audioContext && analyserNode ? (
                            <AudioVisualizer
                                audioContext={audioContext}
                                analyserNode={analyserNode}
                                width={400}
                                height={400}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-800 rounded-lg">
                                <div className="text-gray-500">
                                    {isConnected
                                        ? "Initializing audio..."
                                        : "Connecting..."}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* EntityOverlay content - fades in when visible */}
                    <div
                        className={`
                            absolute inset-0 flex items-center justify-center
                            transition-all duration-300 ease-out
                            ${
                                showOverlayContent
                                    ? "opacity-100 scale-100"
                                    : "opacity-0 scale-95 pointer-events-none"
                            }
                        `}
                    >
                        {showOverlayContent && <EntityOverlay inVoiceMode />}
                    </div>
                </div>

                {/* Floating transcript - below visualizer/overlay */}
                <div className="mt-6 w-full max-w-2xl">
                    <FloatingTranscript />
                </div>

                {/* Tool status - fixed height region */}
                <div className="h-8 mt-2 flex items-center justify-center">
                    {currentTool && currentTool.status === "running" && (
                        <div className="flex items-center gap-2 px-4 py-1 bg-gray-800/60 rounded-full transition-opacity duration-300">
                            <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-gray-400 truncate max-w-xs">
                                {currentTool.message}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom controls */}
            <div className="px-6 pb-6 pt-4">
                <div className="flex justify-center">
                    <VoiceControls />
                </div>
            </div>
        </div>
    );
}

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
 * Layered layout matching VoiceModeOverlay:
 *  - Layer 1: Visualizer fills entire content area as background
 *  - Layer 2: Bottom panel with gradient scrim holds transcript, tool status, controls
 */
export function VoiceModeContent() {
    const { isConnected, currentTool, audioContext, analyserNode } = useVoice();

    const { visible: overlayVisible } = useEntityOverlay();

    // Initialize the voice session
    useVoiceSession();

    const showOverlayContent = overlayVisible;

    return (
        <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
            {/* Main content area */}
            <div className="flex-1 relative overflow-hidden">
                {/* Layer 1: Visualizer fills entire content area */}
                <div
                    className={`
                        absolute inset-0 flex items-center justify-center
                        transition-all duration-300 ease-out
                        ${showOverlayContent ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100"}
                    `}
                >
                    {audioContext && analyserNode ? (
                        <AudioVisualizer
                            audioContext={audioContext}
                            analyserNode={analyserNode}
                            width={800}
                            height={800}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="text-gray-500">
                                {isConnected
                                    ? "Initializing audio..."
                                    : "Connecting..."}
                            </div>
                        </div>
                    )}
                </div>

                {/* EntityOverlay — crossfades with visualizer */}
                <div
                    className={`
                        absolute inset-0 flex items-center justify-center
                        transition-all duration-300 ease-out
                        ${showOverlayContent ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"}
                    `}
                >
                    {showOverlayContent && <EntityOverlay inVoiceMode />}
                </div>

                {/* Layer 2: Bottom overlay panel with gradient scrim */}
                <div
                    className="absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none"
                    style={{
                        background:
                            "linear-gradient(to bottom, transparent 0%, rgba(17,24,39,0.85) 100%)",
                    }}
                >
                    {/* Transcript */}
                    <div className="w-full max-w-2xl pointer-events-auto">
                        <FloatingTranscript />
                    </div>

                    {/* Tool status */}
                    <div className="h-8 mt-2 flex items-center justify-center pointer-events-auto">
                        {currentTool && currentTool.status === "running" && (
                            <div className="flex items-center gap-2 px-4 py-1 bg-gray-800/60 rounded-full transition-opacity duration-300">
                                <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-xs text-gray-400 truncate max-w-xs">
                                    {currentTool.message}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="pb-6 pt-4 pointer-events-auto">
                        <VoiceControls />
                    </div>
                </div>
            </div>
        </div>
    );
}

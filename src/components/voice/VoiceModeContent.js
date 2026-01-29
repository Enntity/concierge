"use client";

import React, { useState, useCallback } from "react";
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

    const [showTranscript, setShowTranscript] = useState(true);
    const toggleTranscript = useCallback(() => setShowTranscript(prev => !prev), []);

    const showOverlayContent = overlayVisible;

    return (
        <div className="flex flex-col h-full bg-gray-900 rounded-lg overflow-hidden">
            {/* Main content area */}
            <div className="flex-1 flex flex-col sm:relative overflow-hidden">
                {/* Visualizer + EntityOverlay wrapper */}
                <div className="relative flex-1 min-h-0 sm:absolute sm:inset-0 overflow-hidden">
                    {/* Visualizer */}
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
                </div>

                {/* Bottom panel */}
                <div className="relative flex flex-col items-center pointer-events-none sm:absolute sm:inset-x-0 sm:bottom-0">
                    {/* Gradient scrim — desktop only */}
                    <div
                        className="hidden sm:block absolute inset-0"
                        style={{
                            background:
                                "linear-gradient(to bottom, transparent 0%, rgba(17,24,39,0.85) 100%)",
                        }}
                    />

                    {/* Bottom panel content */}
                    <div className="relative w-full flex flex-col items-center">
                        {/* Transcript — fixed height on mobile prevents visualizer from jumping */}
                        <div className={`w-full max-w-2xl overflow-hidden transition-all duration-300 ease-out ${
                            showTranscript
                                ? 'h-44 sm:h-auto opacity-100 pointer-events-auto'
                                : 'h-0 opacity-0 pointer-events-none'
                        }`}>
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
                            <VoiceControls
                                showTranscript={showTranscript}
                                onToggleTranscript={toggleTranscript}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

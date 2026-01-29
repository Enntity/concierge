"use client";

import React, { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { useVoice } from "../../contexts/VoiceContext";
import { useEntityOverlay } from "../../contexts/EntityOverlayContext";
import { useChatEntity } from "../../contexts/ChatEntityContext";
import { useVoiceSession } from "../../hooks/useVoiceSession";
import { AudioVisualizer } from "./AudioVisualizer";
import { VoiceControls } from "./VoiceControls";
import { FloatingTranscript } from "./FloatingTranscript";
import EntityOverlay from "../EntityOverlay";
import EntityIcon from "../chat/EntityIcon";

/**
 * VoiceModeOverlay - Fullscreen overlay for voice mode
 *
 * Layered layout:
 *  - Layer 1: Visualizer fills entire content area as background
 *  - Layer 2: Bottom panel with gradient scrim holds transcript, tool status, controls
 *  - EntityOverlay crossfades with visualizer when media is shown
 */
export function VoiceModeOverlay() {
    const {
        isActive,
        isConnected,
        state,
        entityId,
        currentTool,
        endSession,
        audioContext,
        analyserNode,
    } = useVoice();

    const { visible: overlayVisible } = useEntityOverlay();
    const { entityName, entity } = useChatEntity();

    // Initialize the voice session when active
    useVoiceSession();

    const [isVisible, setIsVisible] = useState(false);
    const [showTranscript, setShowTranscript] = useState(true);
    const toggleTranscript = useCallback(() => setShowTranscript(prev => !prev), []);

    // Handle visibility with animation
    useEffect(() => {
        if (isActive) {
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        } else {
            setIsVisible(false);
        }
    }, [isActive]);

    // Get state display text
    const getStateText = () => {
        switch (state) {
            case "userSpeaking":
                return "Listening...";
            case "aiResponding":
                return "Thinking...";
            case "audioPlaying":
                return "Speaking...";
            default:
                return isConnected ? "Ready" : "Connecting...";
        }
    };

    if (!isActive) {
        return null;
    }

    const showOverlayContent = overlayVisible;

    return (
        <div
            className={`
                fixed inset-0 z-[60]
                flex flex-col
                bg-gray-900
                transition-opacity duration-300
                ${isVisible ? "opacity-100" : "opacity-0"}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="rounded-full bg-gray-800 p-0.5">
                            {entity ? (
                                <EntityIcon entity={entity} size="md" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                                    <span className="text-gray-400 text-sm">
                                        ?
                                    </span>
                                </div>
                            )}
                        </div>
                        <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${
                                isConnected
                                    ? "bg-green-500"
                                    : "bg-yellow-500 animate-pulse"
                            }`}
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-base font-medium text-white leading-tight">
                            {entityName || entity?.name || "Voice Mode"}
                        </span>
                        <span className="text-xs text-gray-400">
                            {getStateText()}
                        </span>
                    </div>
                </div>
                <button
                    onClick={endSession}
                    className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    title="Close voice mode"
                >
                    <X className="w-5 h-5 text-gray-400" />
                </button>
            </div>

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
                            <div className="text-gray-500">
                                {isConnected
                                    ? "Initializing audio..."
                                    : "Connecting..."}
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

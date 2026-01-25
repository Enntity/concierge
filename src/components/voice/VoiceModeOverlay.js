"use client";

import React, { useEffect, useState } from "react";
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
 * Features:
 * - Audio visualizer in center (or EntityOverlay when media is shown)
 * - Floating ethereal transcripts below visualizer
 * - Fixed controls at bottom
 * - Smooth crossfade between visualizer and overlay content
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

    // Handle visibility with animation
    useEffect(() => {
        if (isActive) {
            // Small delay to trigger CSS transition
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

    // Don't render if not active
    if (!isActive) {
        return null;
    }

    // Show overlay content (without backdrop) when EntityOverlay is visible
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
                    {/* Entity avatar */}
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
                        {/* Connection indicator */}
                        <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${
                                isConnected
                                    ? "bg-green-500"
                                    : "bg-yellow-500 animate-pulse"
                            }`}
                        />
                    </div>
                    {/* Entity name and status */}
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

            {/* Main content area - flex-1 to fill space, flex-col for layout */}
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

                {/* Tool status - fixed height region, doesn't push layout */}
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

            {/* Fixed bottom controls */}
            <div className="px-6 pb-6 pt-4">
                <div className="flex justify-center">
                    <VoiceControls />
                </div>
            </div>
        </div>
    );
}

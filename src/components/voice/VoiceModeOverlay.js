"use client";

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useVoice } from '../../contexts/VoiceContext';
import { useVoiceSession } from '../../hooks/useVoiceSession';
import { AudioVisualizer } from './AudioVisualizer';
import { VoiceControls } from './VoiceControls';
import { TranscriptPanel } from './TranscriptPanel';

/**
 * VoiceModeOverlay - Fullscreen overlay for voice mode
 * Contains the audio visualizer, controls, and transcript panel
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

    // Initialize the voice session when active
    useVoiceSession();

    const [isVisible, setIsVisible] = useState(false);
    const [entityName, setEntityName] = useState('');

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

    // Fetch entity name (simplified - in real implementation, use entity context)
    useEffect(() => {
        if (entityId) {
            // For now, just use entityId as name
            // In real implementation, fetch from entity context or API
            setEntityName(entityId);
        }
    }, [entityId]);

    // Get state display text
    const getStateText = () => {
        switch (state) {
            case 'userSpeaking':
                return 'Listening...';
            case 'aiResponding':
                return 'Thinking...';
            case 'audioPlaying':
                return 'Speaking...';
            default:
                return isConnected ? 'Ready' : 'Connecting...';
        }
    };

    // Don't render if not active
    if (!isActive) {
        return null;
    }

    return (
        <div
            className={`
                fixed inset-0 z-[60]
                flex flex-col
                bg-gray-900
                transition-opacity duration-300
                ${isVisible ? 'opacity-100' : 'opacity-0'}
            `}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                            isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                        }`} />
                        <span className="text-lg font-medium text-white">
                            {entityName || 'Voice Mode'}
                        </span>
                    </div>
                    <span className="text-sm text-gray-400">
                        {getStateText()}
                    </span>
                </div>
                <button
                    onClick={endSession}
                    className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                    title="Close voice mode"
                >
                    <X className="w-6 h-6 text-gray-400" />
                </button>
            </div>

            {/* Main content area */}
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                {/* Audio Visualizer */}
                <div className="w-full max-w-md aspect-square mb-8">
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
                                {isConnected ? 'Initializing audio...' : 'Connecting...'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tool status */}
                {currentTool && (
                    <div className="mb-6 px-4 py-2 bg-gray-800/80 rounded-lg">
                        <div className="flex items-center gap-2">
                            {currentTool.status === 'running' && (
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            )}
                            {currentTool.status === 'error' && (
                                <div className="w-4 h-4 bg-red-500 rounded-full" />
                            )}
                            <span className="text-sm text-gray-300">
                                {currentTool.message}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom section */}
            <div className="px-6 pb-6 space-y-4">
                {/* Transcript panel */}
                <TranscriptPanel />

                {/* Controls */}
                <div className="flex justify-center py-4">
                    <VoiceControls />
                </div>
            </div>
        </div>
    );
}

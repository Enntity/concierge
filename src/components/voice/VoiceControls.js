"use client";

import React from 'react';
import { Mic, Square, Minus, VolumeX, Volume2 } from 'lucide-react';
import { useVoice } from '../../contexts/VoiceContext';
import { MicrophoneVisualizer } from './MicrophoneVisualizer';

/**
 * VoiceControls - Control buttons for voice mode (mute, stop, minimize)
 */
export function VoiceControls({ onMinimize }) {
    const {
        isMuted,
        toggleMute,
        endSession,
        state,
        audioContext,
        sourceNode,
    } = useVoice();

    return (
        <div className="flex items-center justify-center gap-4">
            {/* Microphone visualizer / Mute button */}
            <button
                onClick={toggleMute}
                className={`relative flex items-center justify-center w-16 h-16 rounded-full transition-all ${
                    isMuted
                        ? 'bg-red-500/20 hover:bg-red-500/30 ring-2 ring-red-500'
                        : 'bg-gray-700/50 hover:bg-gray-700/70'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
            >
                {!isMuted && audioContext && sourceNode ? (
                    <MicrophoneVisualizer
                        audioContext={audioContext}
                        sourceNode={sourceNode}
                        size="large"
                    />
                ) : isMuted ? (
                    <VolumeX className="w-8 h-8 text-red-400" />
                ) : (
                    <Mic className="w-8 h-8 text-gray-400" />
                )}
            </button>

            {/* Stop button */}
            <button
                onClick={endSession}
                className="flex items-center justify-center w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 transition-colors shadow-lg"
                title="End voice session"
            >
                <Square className="w-6 h-6 text-white" />
            </button>

            {/* Minimize button (optional) */}
            {onMinimize && (
                <button
                    onClick={onMinimize}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-700/50 hover:bg-gray-700/70 transition-colors"
                    title="Minimize"
                >
                    <Minus className="w-5 h-5 text-gray-300" />
                </button>
            )}
        </div>
    );
}

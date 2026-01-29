"use client";

import React, { useRef, useEffect } from "react";
import { Mic, MicOff, Square, Minus } from "lucide-react";
import { useVoice } from "../../contexts/VoiceContext";

/**
 * VoiceControls - Compact glass pill with mute, stop, and optional minimize
 *
 * Mic button uses a CSS box-shadow ring that scales with inputLevel
 * (replaces the canvas-based MicrophoneVisualizer).
 */
export function VoiceControls({ onMinimize }) {
    const { isMuted, toggleMute, endSession, inputLevel } = useVoice();
    const smoothedRef = useRef(0);
    const frameRef = useRef(null);
    const micBtnRef = useRef(null);

    // Animate mic glow ring via box-shadow driven by inputLevel
    useEffect(() => {
        const animate = () => {
            const target = inputLevel || 0;
            smoothedRef.current += (target - smoothedRef.current) * 0.3;
            const level = smoothedRef.current;

            const btn = micBtnRef.current;
            if (btn) {
                if (isMuted) {
                    btn.style.boxShadow = "none";
                } else if (level > 0.01) {
                    const spread = 2 + level * 14;
                    const alpha = 0.15 + level * 0.45;
                    btn.style.boxShadow = `0 0 ${spread}px ${spread / 2}px rgba(74, 222, 128, ${alpha})`;
                } else {
                    btn.style.boxShadow = "0 0 2px 1px rgba(74, 222, 128, 0.15)";
                }
            }

            frameRef.current = requestAnimationFrame(animate);
        };
        frameRef.current = requestAnimationFrame(animate);
        return () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        };
    }, [inputLevel, isMuted]);

    return (
        <div className="inline-flex items-center gap-2 px-2 py-1.5 rounded-full backdrop-blur-xl bg-white/5 border border-white/10">
            {/* Mute/Unmute button */}
            <button
                ref={micBtnRef}
                onClick={toggleMute}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                    isMuted
                        ? "bg-red-500/20 ring-1 ring-red-500"
                        : "bg-white/10 hover:bg-white/15"
                }`}
                title={isMuted ? "Unmute" : "Mute"}
            >
                {isMuted ? (
                    <MicOff className="w-5 h-5 text-red-400" />
                ) : (
                    <Mic className="w-5 h-5 text-green-400" />
                )}
            </button>

            {/* Stop button */}
            <button
                onClick={endSession}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/80 hover:bg-red-600/90 transition-colors"
                title="End voice session"
            >
                <Square className="w-4 h-4 text-white" />
            </button>

            {/* Minimize button (optional) */}
            {onMinimize && (
                <button
                    onClick={onMinimize}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 transition-colors"
                    title="Minimize"
                >
                    <Minus className="w-4 h-4 text-gray-300" />
                </button>
            )}
        </div>
    );
}

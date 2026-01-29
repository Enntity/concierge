"use client";

import { useEffect, useRef } from "react";
import { Mic } from "lucide-react";
import { useVoice } from "../../contexts/VoiceContext";

/**
 * MicrophoneVisualizer - Mic button with animated ring based on input level
 *
 * Uses inputLevel from VoiceContext (set by VAD) for visualization.
 * No Web Audio API complexity - just reads the level and animates.
 */
export function MicrophoneVisualizer() {
    const { inputLevel } = useVoice();
    const canvasRef = useRef(null);
    const animationRef = useRef(null);
    const smoothedLevelRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const size = 64;
        const cx = size / 2;
        const cy = size / 2;
        const ringRadius = 28;

        const draw = () => {
            // Smooth the level for nicer animation
            const target = inputLevel || 0;
            smoothedLevelRef.current +=
                (target - smoothedLevelRef.current) * 0.3;
            const level = smoothedLevelRef.current;

            // Clear
            ctx.clearRect(0, 0, size, size);

            // Background ring (always visible)
            ctx.beginPath();
            ctx.strokeStyle = "rgba(74, 222, 128, 0.3)";
            ctx.lineWidth = 4;
            ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
            ctx.stroke();

            // Active ring (grows with level)
            if (level > 0.01) {
                const hue = 140 + level * 20;

                // Glow
                ctx.shadowBlur = 8 + level * 12;
                ctx.shadowColor = `hsla(${hue}, 80%, 50%, 0.6)`;

                ctx.beginPath();
                ctx.strokeStyle = `hsla(${hue}, 80%, 55%, ${0.6 + level * 0.4})`;
                ctx.lineWidth = 4 + level * 2;
                ctx.arc(
                    cx,
                    cy,
                    ringRadius,
                    -Math.PI / 2,
                    -Math.PI / 2 + Math.PI * 2 * level,
                );
                ctx.stroke();

                ctx.shadowBlur = 0;
            }

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [inputLevel]);

    return (
        <div className="relative w-16 h-16 flex items-center justify-center">
            {/* Canvas for ring animation */}
            <canvas
                ref={canvasRef}
                width={64}
                height={64}
                className="absolute inset-0"
            />
            {/* Mic icon in center */}
            <Mic className="w-7 h-7 text-green-400 relative z-10" />
        </div>
    );
}

"use client";

import { useEffect, useRef } from "react";

/**
 * AudioVisualizer - Renders a radial/circular real-time audio visualization
 * Uses frequency data from an AnalyserNode to create animated waveforms
 * Canvas is transparent — waveform trails fade to transparent, not opaque.
 *
 * @param {Object} props
 * @param {AudioContext|null} props.audioContext - Audio context reference
 * @param {AnalyserNode|null} props.analyserNode - AnalyserNode for frequency data extraction
 * @param {number} props.width - Canvas width (default 300px)
 * @param {number} props.height - Canvas height (default 300px)
 */
export function AudioVisualizer({
    audioContext,
    analyserNode,
    width = 300,
    height = 300,
}) {
    const canvasRef = useRef(null);
    const rotationRef = useRef(0);
    const colorShiftRef = useRef(0);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        if (!audioContext || !analyserNode || !canvasRef.current) return;

        // Update canvas size when width/height props change
        if (canvasRef.current) {
            canvasRef.current.width = width;
            canvasRef.current.height = height;
        }

        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas || !analyserNode) return;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const bufferLength = analyserNode.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyserNode.getByteFrequencyData(dataArray);

            // Clear with fade effect — fade existing pixels toward transparent
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = "source-over";

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            // Outer waveform at full amplitude reaches maxRadius * 1.2,
            // plus ~20px for stroke width and shadow blur (15px).
            // Divide available space by 1.2 so the peak fits inside the canvas.
            const maxRadius = (Math.min(centerX, centerY) - 20) / 1.2;

            // Hue oscillates through cyan → blue → purple range
            const sin = Math.sin(colorShiftRef.current);
            const baseHue = 185 + sin * 40;
            const waveforms = [
                {
                    baseRadius: maxRadius * 0.4,
                    color: `hsl(${baseHue}, 90%, 70%)`,
                    gradientColors: [
                        `hsla(${baseHue}, 90%, 70%, 0.3)`,
                        `hsla(${baseHue}, 90%, 50%, 0)`,
                    ],
                    rotation: rotationRef.current,
                },
                {
                    baseRadius: maxRadius * 0.6,
                    color: `hsl(${baseHue + 10}, 85%, 60%)`,
                    gradientColors: [
                        `hsla(${baseHue + 10}, 85%, 60%, 0.3)`,
                        `hsla(${baseHue + 10}, 85%, 40%, 0)`,
                    ],
                    rotation: rotationRef.current + (Math.PI * 2) / 3,
                },
                {
                    baseRadius: maxRadius * 0.8,
                    color: `hsl(${baseHue + 20}, 80%, 50%)`,
                    gradientColors: [
                        `hsla(${baseHue + 20}, 80%, 50%, 0.3)`,
                        `hsla(${baseHue + 20}, 80%, 30%, 0)`,
                    ],
                    rotation: rotationRef.current + (Math.PI * 4) / 3,
                },
            ];

            waveforms.forEach(
                ({ baseRadius, color, gradientColors, rotation }) => {
                    const points = [];

                    for (let i = 0; i <= bufferLength; i++) {
                        const amplitude = dataArray[i % bufferLength] / 255.0;
                        const angle =
                            (i * 2 * Math.PI) / bufferLength + rotation;

                        const radius = baseRadius + maxRadius * 0.4 * amplitude;
                        const x = centerX + Math.cos(angle) * radius;
                        const y = centerY + Math.sin(angle) * radius;

                        points.push([x, y]);
                    }

                    // Create gradient for fill
                    const gradient = ctx.createRadialGradient(
                        centerX,
                        centerY,
                        baseRadius * 0.8,
                        centerX,
                        centerY,
                        baseRadius * 1.2,
                    );
                    gradient.addColorStop(0, gradientColors[0]);
                    gradient.addColorStop(1, gradientColors[1]);

                    ctx.beginPath();
                    ctx.moveTo(centerX, centerY);
                    points.forEach(([x, y]) => {
                        ctx.lineTo(x, y);
                    });
                    ctx.closePath();
                    ctx.fillStyle = gradient;
                    ctx.fill();

                    ctx.beginPath();
                    points.forEach(([x, y], i) => {
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    });
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.closePath();
                    ctx.stroke();

                    ctx.shadowBlur = 15;
                    ctx.shadowColor = color;
                },
            );

            rotationRef.current += 0.002;
            colorShiftRef.current += 0.005;

            animationFrameRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [audioContext, analyserNode, width, height]);

    return (
        <div className="w-full h-full flex items-center justify-center pointer-events-none">
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="w-full h-full object-contain pointer-events-none"
            />
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Animated Enntity Logo
 * A cyberpunk-inspired but professional animated logo with gentle glow effects
 */
export default function AnimatedLogo({
    size = 120,
    className = "",
    showText = true,
    animate = true,
}) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div
            className={`flex flex-col items-center gap-4 ${className}`}
            style={{ "--logo-size": `${size}px` }}
        >
            {/* Logo container with glow */}
            <div className="relative">
                {/* Outer glow layers */}
                {animate && (
                    <>
                        <div
                            className="absolute inset-0 rounded-full blur-3xl opacity-20 animate-pulse-slow"
                            style={{
                                background:
                                    "radial-gradient(circle, rgba(6, 182, 212, 0.5) 0%, transparent 70%)",
                                transform: "scale(2)",
                            }}
                        />
                        <div
                            className="absolute inset-0 rounded-full blur-xl opacity-30 animate-pulse-slower"
                            style={{
                                background:
                                    "radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, transparent 70%)",
                                transform: "scale(1.8)",
                            }}
                        />
                    </>
                )}

                {/* SVG Logo */}
                <svg
                    width={size}
                    height={size}
                    viewBox="0 0 200 200"
                    className={`relative z-10 ${mounted && animate ? "animate-float" : ""}`}
                    style={{ filter: animate ? "drop-shadow(0 0 20px rgba(6, 182, 212, 0.3))" : "none" }}
                >
                    <defs>
                        {/* Gradient for main elements */}
                        <linearGradient
                            id="logoGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                        >
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="50%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>

                        {/* Animated gradient */}
                        <linearGradient
                            id="animatedGradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                        >
                            <stop offset="0%" stopColor="#22d3ee">
                                {animate && (
                                    <animate
                                        attributeName="stop-color"
                                        values="#22d3ee;#a78bfa;#22d3ee"
                                        dur="4s"
                                        repeatCount="indefinite"
                                    />
                                )}
                            </stop>
                            <stop offset="100%" stopColor="#a78bfa">
                                {animate && (
                                    <animate
                                        attributeName="stop-color"
                                        values="#a78bfa;#22d3ee;#a78bfa"
                                        dur="4s"
                                        repeatCount="indefinite"
                                    />
                                )}
                            </stop>
                        </linearGradient>

                        {/* Glow filter */}
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                            <feMerge>
                                <feMergeNode in="coloredBlur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    {/* Outer ring - main circle */}
                    <circle
                        cx="100"
                        cy="85"
                        r="58"
                        fill="none"
                        stroke="url(#animatedGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        filter="url(#glow)"
                        className={animate ? "animate-draw-circle" : ""}
                        style={{
                            strokeDasharray: animate ? "365" : "none",
                            strokeDashoffset: mounted && animate ? "0" : animate ? "365" : "0",
                            transition: "stroke-dashoffset 1.5s ease-out",
                        }}
                    />

                    {/* Swoosh/tail element */}
                    <path
                        d="M 42 85 Q 42 140, 100 140 Q 130 140, 145 120"
                        fill="none"
                        stroke="url(#animatedGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        filter="url(#glow)"
                        className={animate ? "animate-draw-path" : ""}
                        style={{
                            strokeDasharray: animate ? "180" : "none",
                            strokeDashoffset: mounted && animate ? "0" : animate ? "180" : "0",
                            transition: "stroke-dashoffset 1.5s ease-out 0.3s",
                        }}
                    />

                    {/* Inner figure - head circle */}
                    <circle
                        cx="100"
                        cy="65"
                        r="18"
                        fill="none"
                        stroke="url(#animatedGradient)"
                        strokeWidth="6"
                        filter="url(#glow)"
                        style={{
                            opacity: mounted || !animate ? 1 : 0,
                            transition: "opacity 0.5s ease-out 0.8s",
                        }}
                    />

                    {/* Inner figure - body arc */}
                    <path
                        d="M 72 100 Q 72 130, 100 130 Q 128 130, 128 100"
                        fill="none"
                        stroke="url(#animatedGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        filter="url(#glow)"
                        style={{
                            opacity: mounted || !animate ? 1 : 0,
                            transition: "opacity 0.5s ease-out 1s",
                        }}
                    />

                    {/* Decorative tech elements - small dots */}
                    {animate && (
                        <>
                            <circle
                                cx="160"
                                cy="45"
                                r="3"
                                fill="#22d3ee"
                                className="animate-ping-slow"
                                style={{ opacity: 0.6 }}
                            />
                            <circle
                                cx="40"
                                cy="130"
                                r="2"
                                fill="#a78bfa"
                                className="animate-ping-slower"
                                style={{ opacity: 0.5 }}
                            />
                        </>
                    )}
                </svg>
            </div>

            {/* Text logo */}
            {showText && (
                <div
                    className={`text-center ${mounted && animate ? "animate-fade-up" : ""}`}
                    style={{
                        opacity: mounted || !animate ? 1 : 0,
                        transform:
                            mounted || !animate
                                ? "translateY(0)"
                                : "translateY(10px)",
                        transition: "all 0.8s ease-out 1.2s",
                    }}
                >
                    <h1
                        className="font-bold tracking-[0.2em] text-transparent bg-clip-text"
                        style={{
                            fontSize: `${size * 0.25}px`,
                            backgroundImage:
                                "linear-gradient(135deg, #22d3ee 0%, #a78bfa 50%, #22d3ee 100%)",
                            backgroundSize: animate ? "200% 100%" : "100% 100%",
                            animation: animate
                                ? "gradient-shift 3s ease-in-out infinite"
                                : "none",
                        }}
                    >
                        ENNTITY
                    </h1>
                </div>
            )}

            <style jsx>{`
                @keyframes gradient-shift {
                    0%,
                    100% {
                        background-position: 0% 50%;
                    }
                    50% {
                        background-position: 100% 50%;
                    }
                }
            `}</style>
        </div>
    );
}


"use client";

import { useEffect, useState } from "react";

/**
 * Animated Enntity Logo
 * Uses the actual enntity_logo.svg with beautiful cyberpunk glow effects
 */
export default function AnimatedLogo({
    size = 120,
    className = "",
    animate = true,
}) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Calculate text size based on logo size
    const textWidth = size * 1.2;

    return (
        <div
            className={`flex flex-col items-center ${className}`}
            style={{ "--logo-size": `${size}px` }}
        >
            {/* Logo container with glow effects */}
            <div className="relative">
                {/* Outer glow layers - cyan to purple (matches button hover) */}
                {animate && (
                    <>
                        <div
                            className="absolute rounded-full blur-3xl animate-pulse-slow"
                            style={{
                                width: size * 2,
                                height: size * 2,
                                left: "50%",
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                                background:
                                    "radial-gradient(circle, rgba(34, 211, 238, 0.4) 0%, rgba(167, 139, 250, 0.25) 50%, transparent 70%)",
                            }}
                        />
                        <div
                            className="absolute rounded-full blur-2xl animate-pulse-slower"
                            style={{
                                width: size * 1.7,
                                height: size * 1.7,
                                left: "50%",
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                                background:
                                    "radial-gradient(circle, rgba(6, 182, 212, 0.35) 0%, rgba(147, 51, 234, 0.2) 50%, transparent 70%)",
                            }}
                        />
                    </>
                )}

                {/* The actual SVG logo with color-shifting glow */}
                <div
                    className={`relative z-10 ${mounted && animate ? "animate-float" : ""}`}
                    style={{
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? "translateY(0)" : "translateY(20px)",
                        transition: "opacity 0.8s ease-out, transform 0.8s ease-out",
                    }}
                >
                    <img
                        src="/app/assets/enntity_logo_dark.svg"
                        alt="Enntity"
                        width={textWidth}
                        className={animate ? "logo-color-shift" : ""}
                    />
                </div>

                {/* Decorative tech elements - small dots */}
                {animate && mounted && (
                    <>
                        <div
                            className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping-slow"
                            style={{
                                top: "10%",
                                right: "-10%",
                                opacity: 0.6,
                            }}
                        />
                        <div
                            className="absolute w-1 h-1 rounded-full bg-purple-400 animate-ping-slower"
                            style={{
                                bottom: "20%",
                                left: "-5%",
                                opacity: 0.5,
                            }}
                        />
                    </>
                )}
            </div>

            {/* Keyframes for color shift animation */}
            <style jsx>{`
                .logo-color-shift {
                    animation: color-shift 8s ease-in-out infinite;
                }
                @keyframes color-shift {
                    0%, 100% {
                        filter: 
                            drop-shadow(0 0 2px rgba(255, 255, 255, 0.9))
                            drop-shadow(0 0 8px rgba(34, 211, 238, 0.7))
                            drop-shadow(0 0 20px rgba(34, 211, 238, 0.5))
                            drop-shadow(0 0 40px rgba(6, 182, 212, 0.4))
                            drop-shadow(0 0 60px rgba(167, 139, 250, 0.3));
                    }
                    50% {
                        filter: 
                            drop-shadow(0 0 2px rgba(255, 255, 255, 0.9))
                            drop-shadow(0 0 8px rgba(167, 139, 250, 0.7))
                            drop-shadow(0 0 20px rgba(167, 139, 250, 0.5))
                            drop-shadow(0 0 40px rgba(147, 51, 234, 0.4))
                            drop-shadow(0 0 60px rgba(34, 211, 238, 0.3));
                    }
                }
            `}</style>
        </div>
    );
}

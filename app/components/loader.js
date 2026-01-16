"use client";

import { useState, useEffect, useRef } from "react";

export default function Loader({
    size = "default",
    delay = 500,
    wander = false,
}) {
    const [showLoader, setShowLoader] = useState(false);
    const [sparkles, setSparkles] = useState([]);
    const [wanderPos, setWanderPos] = useState({ x: 0, y: 0, scale: 1 });
    const targetRef = useRef({ x: 0, y: 0, scale: 1 });
    const currentRef = useRef({ x: 0, y: 0, scale: 1 });
    const animationFrameRef = useRef(null);

    // Calculate size-dependent values first
    let sizeClass = "w-5 h-5";
    let sparkleCount = 8;
    let sparkleDistance = 12;

    if (size === "small") {
        sizeClass = "w-3 h-3";
        sparkleCount = 6;
        sparkleDistance = 12;
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowLoader(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [delay]);

    useEffect(() => {
        if (!showLoader) return;

        // Generate sparkles with random positions and animations
        const newSparkles = Array.from({ length: sparkleCount }, (_, i) => ({
            id: i,
            angle: (i * 360) / sparkleCount + Math.random() * 30,
            distance: sparkleDistance + Math.random() * (sparkleDistance * 0.5),
            delay: Math.random() * 2,
            duration: 1.5 + Math.random() * 1,
            size:
                size === "small"
                    ? 1 + Math.random() * 1.5
                    : 2 + Math.random() * 3,
            opacity: 0.6 + Math.random() * 0.4,
        }));
        setSparkles(newSparkles);
    }, [showLoader, sparkleCount, sparkleDistance, size]);

    // Random wandering motion effect
    useEffect(() => {
        if (!wander || !showLoader) return;

        const wanderRange = { x: 60, y: 40, scaleMin: 0.7, scaleMax: 1.3 };
        const easing = 0.03; // Lower = smoother/slower movement

        // Pick a new random target periodically
        const pickNewTarget = () => {
            targetRef.current = {
                x: (Math.random() - 0.5) * 2 * wanderRange.x,
                y: (Math.random() - 0.5) * 2 * wanderRange.y,
                scale:
                    wanderRange.scaleMin +
                    Math.random() *
                        (wanderRange.scaleMax - wanderRange.scaleMin),
            };
        };

        // Initial target
        pickNewTarget();

        // Change target every 1-4 seconds
        const targetInterval = setInterval(
            () => {
                pickNewTarget();
            },
            1000 + Math.random() * 3000,
        );

        // Smooth animation loop
        const animate = () => {
            const current = currentRef.current;
            const target = targetRef.current;

            // Ease toward target
            current.x += (target.x - current.x) * easing;
            current.y += (target.y - current.y) * easing;
            current.scale += (target.scale - current.scale) * easing;

            setWanderPos({ ...current });
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            clearInterval(targetInterval);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [wander, showLoader]);

    if (!showLoader) {
        return null;
    }

    const wanderStyle = wander
        ? {
              transform: `translate(${wanderPos.x}px, ${wanderPos.y}px) scale(${wanderPos.scale})`,
              transition: "none", // We handle smoothing in JS
          }
        : {};

    return (
        <div
            className="relative inline-flex items-center justify-center animate-fade-in"
            style={wanderStyle}
        >
            {/* Central pulsing orb with glow */}
            <div className="relative">
                {/* Outer glow layers */}
                <div
                    className={`absolute inset-0 rounded-full blur-xl animate-pulse-slow ${sizeClass}`}
                    style={{
                        background:
                            "radial-gradient(circle, rgba(34, 211, 238, 0.6) 0%, rgba(167, 139, 250, 0.4) 50%, transparent 70%)",
                    }}
                />
                <div
                    className={`absolute inset-0 rounded-full blur-lg animate-pulse-slower ${sizeClass}`}
                    style={{
                        background:
                            "radial-gradient(circle, rgba(6, 182, 212, 0.5) 0%, rgba(147, 51, 234, 0.3) 50%, transparent 70%)",
                    }}
                />

                {/* Central orb */}
                <div
                    className={`relative ${sizeClass} rounded-full`}
                    style={{
                        background:
                            "radial-gradient(circle at 30% 30%, rgba(34, 211, 238, 0.9), rgba(167, 139, 250, 0.7))",
                        boxShadow:
                            "0 0 20px rgba(34, 211, 238, 0.6), 0 0 40px rgba(167, 139, 250, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.2)",
                        animation: "pulse-glow 2s ease-in-out infinite",
                    }}
                >
                    {/* Inner highlight */}
                    <div
                        className="absolute inset-2 rounded-full"
                        style={{
                            background:
                                "radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4), transparent 70%)",
                        }}
                    />
                </div>
            </div>

            {/* Sparkles around the orb */}
            {sparkles.map((sparkle) => {
                const radian = (sparkle.angle * Math.PI) / 180;
                const x = Math.cos(radian) * sparkle.distance;
                const y = Math.sin(radian) * sparkle.distance;

                return (
                    <div
                        key={sparkle.id}
                        className="absolute rounded-full"
                        style={{
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            width: `${sparkle.size}px`,
                            height: `${sparkle.size}px`,
                            background: `radial-gradient(circle, rgba(34, 211, 238, ${sparkle.opacity}) 0%, rgba(167, 139, 250, ${sparkle.opacity * 0.6}) 50%, transparent 100%)`,
                            boxShadow: `0 0 ${sparkle.size * 2}px rgba(34, 211, 238, ${sparkle.opacity * 0.8}), 0 0 ${sparkle.size * 4}px rgba(167, 139, 250, ${sparkle.opacity * 0.4})`,
                            transform: "translate(-50%, -50%)",
                            animation: `sparkle-twinkle ${sparkle.duration}s ease-in-out infinite`,
                            animationDelay: `${sparkle.delay}s`,
                        }}
                    />
                );
            })}

            {/* CSS animations */}
            <style jsx>{`
                @keyframes pulse-glow {
                    0%,
                    100% {
                        box-shadow:
                            0 0 20px rgba(34, 211, 238, 0.6),
                            0 0 40px rgba(167, 139, 250, 0.4),
                            inset 0 0 20px rgba(255, 255, 255, 0.2);
                        transform: scale(1);
                    }
                    50% {
                        box-shadow:
                            0 0 30px rgba(34, 211, 238, 0.8),
                            0 0 60px rgba(167, 139, 250, 0.6),
                            inset 0 0 30px rgba(255, 255, 255, 0.3);
                        transform: scale(1.05);
                    }
                }

                @keyframes sparkle-twinkle {
                    0%,
                    100% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0) rotate(0deg);
                    }
                    50% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1.5)
                            rotate(180deg);
                    }
                }
            `}</style>
        </div>
    );
}

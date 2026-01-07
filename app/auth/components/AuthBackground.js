"use client";

import { useEffect, useState } from "react";

// Floating particles for atmospheric depth
export function Particles() {
    const [particles, setParticles] = useState([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setParticles(
            Array.from({ length: 20 }, (_, i) => ({
                id: i,
                left: `${Math.random() * 100}%`,
                delay: `${Math.random() * 15}s`,
                duration: `${15 + Math.random() * 10}s`,
                size: Math.random() * 3 + 1,
                opacity: Math.random() * 0.5 + 0.2,
            })),
        );
    }, []);

    if (!mounted) {
        return null;
    }

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute rounded-full"
                    style={{
                        left: particle.left,
                        bottom: "-20px",
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        background: `linear-gradient(135deg, rgba(34, 211, 238, ${particle.opacity}), rgba(167, 139, 250, ${particle.opacity}))`,
                        animation: `particle-float ${particle.duration} linear infinite`,
                        animationDelay: particle.delay,
                    }}
                />
            ))}
        </div>
    );
}

// Subtle grid background
export function GridBackground() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Base gradient */}
            <div
                className="absolute inset-0"
                style={{
                    background: `
                        radial-gradient(ellipse at 50% 0%, rgba(15, 23, 42, 0.5) 0%, transparent 50%),
                        radial-gradient(ellipse at 80% 20%, rgba(6, 182, 212, 0.08) 0%, transparent 40%),
                        radial-gradient(ellipse at 20% 80%, rgba(147, 51, 234, 0.06) 0%, transparent 40%),
                        linear-gradient(180deg, #0a0f1a 0%, #0f172a 50%, #0a0f1a 100%)
                    `,
                }}
            />

            {/* Grid pattern */}
            <div
                className="absolute inset-0 animate-grid-pulse"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(34, 211, 238, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(34, 211, 238, 0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: "60px 60px",
                }}
            />

            {/* Vignette */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse at center, transparent 0%, rgba(10, 15, 26, 0.8) 100%)",
                }}
            />
        </div>
    );
}

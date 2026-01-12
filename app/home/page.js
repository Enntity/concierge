"use client";

import { useEffect, useState } from "react";
import DigestBlockList from "./components/DigestBlockList";

// Floating sparkles component for ambiance
function FloatingSparkles() {
    const [sparkles, setSparkles] = useState([]);

    useEffect(() => {
        setSparkles(
            Array.from({ length: 8 }, (_, i) => ({
                id: i,
                left: `${15 + Math.random() * 70}%`,
                top: `${10 + Math.random() * 80}%`,
                size: Math.random() * 4 + 2,
                delay: Math.random() * 5,
                duration: 6 + Math.random() * 8,
                opacity: Math.random() * 0.4 + 0.2,
            })),
        );
    }, []);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {sparkles.map((sparkle) => (
                <div
                    key={sparkle.id}
                    className="absolute rounded-full animate-float-gentle"
                    style={{
                        left: sparkle.left,
                        top: sparkle.top,
                        width: `${sparkle.size}px`,
                        height: `${sparkle.size}px`,
                        background: `radial-gradient(circle, rgba(34, 211, 238, ${sparkle.opacity}) 0%, rgba(167, 139, 250, ${sparkle.opacity * 0.6}) 50%, transparent 100%)`,
                        boxShadow: `0 0 ${sparkle.size * 3}px rgba(34, 211, 238, ${sparkle.opacity * 0.5})`,
                        animationDuration: `${sparkle.duration}s`,
                        animationDelay: `${sparkle.delay}s`,
                    }}
                />
            ))}
        </div>
    );
}

export default function HomePage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className="min-h-screen relative">
            {/* Ambient background - subtle version for main app context */}
            <div className="fixed inset-0 -z-10">
                <div
                    className="absolute inset-0"
                    style={{
                        background: `
                            radial-gradient(ellipse at 30% 20%, rgba(6, 182, 212, 0.04) 0%, transparent 50%),
                            radial-gradient(ellipse at 70% 80%, rgba(147, 51, 234, 0.03) 0%, transparent 50%)
                        `,
                    }}
                />
            </div>

            <FloatingSparkles />

            {/* Main content */}
            <div
                className={`
                    relative z-10 px-2 py-4 sm:p-6 lg:p-8 max-w-7xl mx-auto
                    transition-all duration-700 ease-out
                    ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
                `}
            >
                <DigestBlockList />
            </div>

            {/* Animation styles */}
            <style jsx global>{`
                @keyframes float-gentle {
                    0%,
                    100% {
                        transform: translateY(0) translateX(0);
                        opacity: 0.3;
                    }
                    25% {
                        transform: translateY(-20px) translateX(10px);
                        opacity: 0.6;
                    }
                    50% {
                        transform: translateY(-10px) translateX(-5px);
                        opacity: 0.4;
                    }
                    75% {
                        transform: translateY(-25px) translateX(5px);
                        opacity: 0.5;
                    }
                }
                .animate-float-gentle {
                    animation: float-gentle ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

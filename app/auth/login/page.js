"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import AnimatedLogo from "../../../src/components/common/AnimatedLogo";

// Floating particles for atmospheric depth
function Particles() {
    const [particles, setParticles] = useState([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Generate particles only on client side to avoid hydration mismatch
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
function GridBackground() {
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

// Google icon component
function GoogleIcon() {
    return (
        <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
        </svg>
    );
}

// Error display component with smooth animations
function ErrorMessage({ error, onDismiss }) {
    const [visible, setVisible] = useState(false);
    const [shaking, setShaking] = useState(false);

    useEffect(() => {
        if (error) {
            // Small delay for mount animation
            const timer = setTimeout(() => {
                setVisible(true);
                setShaking(true);
                setTimeout(() => setShaking(false), 500);
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [error]);

    if (!error) return null;

    const errorMessages = {
        AccessDenied: {
            title: "Access Not Authorized",
            message:
                "It looks like your email domain isn't on our guest list yet. If you believe this is a mistake, please reach out to your administrator.",
            icon: (
                <svg
                    className="w-6 h-6 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                </svg>
            ),
        },
        OAuthSignin: {
            title: "Connection Issue",
            message:
                "We couldn't connect to the sign-in service. Please try again in a moment.",
            icon: (
                <svg
                    className="w-6 h-6 text-cyan-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                    />
                </svg>
            ),
        },
        OAuthCallback: {
            title: "Authentication Interrupted",
            message:
                "The sign-in process was interrupted. Let's try that again.",
            icon: (
                <svg
                    className="w-6 h-6 text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                </svg>
            ),
        },
        default: {
            title: "Something Went Wrong",
            message:
                "We encountered an unexpected issue. Please try signing in again.",
            icon: (
                <svg
                    className="w-6 h-6 text-rose-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                </svg>
            ),
        },
    };

    const errorInfo = errorMessages[error] || errorMessages.default;

    return (
        <div
            className={`
                mt-6 overflow-hidden rounded-xl
                transition-all duration-500 ease-out
                ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}
                ${shaking ? "animate-shake-gentle" : ""}
            `}
            style={{
                background:
                    "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(148, 163, 184, 0.1)",
            }}
        >
            <div className="p-5">
                <div className="flex items-start gap-4">
                    <div
                        className="flex-shrink-0 p-2 rounded-lg"
                        style={{
                            background:
                                "linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.8) 100%)",
                        }}
                    >
                        {errorInfo.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-slate-100 mb-1">
                            {errorInfo.title}
                        </h3>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            {errorInfo.message}
                        </p>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="flex-shrink-0 p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                        aria-label="Dismiss"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Subtle gradient accent bar */}
            <div
                className="h-1"
                style={{
                    background:
                        "linear-gradient(90deg, rgba(34, 211, 238, 0.5) 0%, rgba(167, 139, 250, 0.5) 50%, rgba(251, 146, 60, 0.5) 100%)",
                }}
            />
        </div>
    );
}

// Main login form
function LoginForm() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/";
    const errorParam = searchParams.get("error");
    const [error, setError] = useState(errorParam);
    const [isLoading, setIsLoading] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        setError(errorParam);
    }, [errorParam]);

    const handleSignIn = () => {
        setIsLoading(true);
        setError(null);
        signIn("google", { callbackUrl });
    };

    const dismissError = () => {
        setError(null);
        // Also remove from URL without navigation
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        window.history.replaceState({}, "", url);
    };

    return (
        <div className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden">
            {/* Animated background */}
            <GridBackground />
            <Particles />

            {/* Main content */}
            <div className="relative z-10 w-full max-w-md px-6">
                {/* Logo section */}
                <div
                    className={`
                        flex flex-col items-center mb-10
                        transition-all duration-1000 ease-out
                        ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
                    `}
                >
                    <AnimatedLogo size={140} animate={true} />
                </div>

                {/* Welcome text */}
                <div
                    className={`
                        text-center mb-8
                        transition-all duration-1000 ease-out delay-300
                        ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
                    `}
                >
                    <p className="text-slate-400 text-lg font-light tracking-wide">
                        Where minds meet, understanding begins.
                    </p>
                </div>

                {/* Sign in card */}
                <div
                    className={`
                        relative rounded-2xl overflow-hidden
                        transition-all duration-1000 ease-out delay-500
                        ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}
                    `}
                    style={{
                        background:
                            "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)",
                        backdropFilter: "blur(20px)",
                        border: "1px solid rgba(148, 163, 184, 0.1)",
                        boxShadow: isHovering
                            ? "0 25px 50px -12px rgba(6, 182, 212, 0.15), 0 0 0 1px rgba(34, 211, 238, 0.1)"
                            : "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                        transition: "box-shadow 0.3s ease",
                    }}
                >
                    {/* Top accent gradient */}
                    <div
                        className="absolute top-0 left-0 right-0 h-px"
                        style={{
                            background:
                                "linear-gradient(90deg, transparent 0%, rgba(34, 211, 238, 0.5) 50%, transparent 100%)",
                        }}
                    />

                    <div className="p-8">
                        <button
                            onClick={handleSignIn}
                            disabled={isLoading}
                            onMouseEnter={() => setIsHovering(true)}
                            onMouseLeave={() => setIsHovering(false)}
                            className={`
                                group
                                w-full flex items-center justify-center gap-3
                                py-4 px-6 rounded-xl
                                font-medium
                                transition-all duration-300 ease-out
                                disabled:opacity-50 disabled:cursor-not-allowed
                                ${isLoading ? "" : "hover:scale-[1.02] active:scale-[0.98]"}
                            `}
                            style={{
                                background: isLoading
                                    ? "rgba(30, 41, 59, 0.8)"
                                    : isHovering
                                      ? "linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(167, 139, 250, 0.15) 100%)"
                                      : "linear-gradient(135deg, rgba(148, 163, 184, 0.2) 0%, rgba(100, 116, 139, 0.15) 100%)",
                                backdropFilter: "blur(8px)",
                                color: isLoading ? "#64748b" : "#f1f5f9",
                                boxShadow: isLoading
                                    ? "none"
                                    : isHovering
                                      ? "0 8px 30px -4px rgba(6, 182, 212, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.15), 0 0 0 1px rgba(34, 211, 238, 0.2)"
                                      : "0 4px 20px -4px rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 0 0 1px rgba(148, 163, 184, 0.1)",
                            }}
                        >
                            {isLoading ? (
                                <div className="relative w-5 h-5">
                                    <div
                                        className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                                        style={{
                                            borderTopColor: "#06b6d4",
                                            borderRightColor: "#8b5cf6",
                                        }}
                                    />
                                </div>
                            ) : (
                                <GoogleIcon />
                            )}
                            <span className="text-[15px]">
                                {isLoading
                                    ? "Connecting..."
                                    : "Continue with Google"}
                            </span>
                        </button>

                        {/* Subtle helper text */}
                        <p className="mt-5 text-center text-xs text-slate-500">
                            Secure authentication powered by Google
                        </p>
                    </div>
                </div>

                {/* Error message */}
                <ErrorMessage error={error} onDismiss={dismissError} />

                {/* Footer */}
                <div
                    className={`
                        mt-10 text-center
                        transition-all duration-1000 ease-out delay-700
                        ${mounted ? "opacity-100" : "opacity-0"}
                    `}
                >
                    <p className="text-slate-600 text-xs">
                        By signing in, you agree to our{" "}
                        <a
                            href="/privacy"
                            className="text-cyan-500/80 hover:text-cyan-400 transition-colors"
                        >
                            Privacy Policy
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}

// Loading fallback with matching aesthetic
function LoadingFallback() {
    return (
        <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
            <GridBackground />
            <div className="relative z-10">
                <div className="flex flex-col items-center gap-6">
                    <div
                        className="w-16 h-16 rounded-full animate-spin"
                        style={{
                            background:
                                "conic-gradient(from 0deg, transparent, rgba(34, 211, 238, 0.8))",
                        }}
                    >
                        <div className="absolute inset-1 rounded-full bg-slate-900" />
                    </div>
                    <p className="text-slate-500 text-sm animate-pulse">
                        Preparing your experience...
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <LoginForm />
        </Suspense>
    );
}

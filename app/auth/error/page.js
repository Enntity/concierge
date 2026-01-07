"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import AnimatedLogo from "../../../src/components/common/AnimatedLogo";
import Link from "next/link";
import { Particles, GridBackground } from "../components/AuthBackground";

function ErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get("error");

    // Clear auth-related session data when this page loads
    useEffect(() => {
        // Only clear auth-related keys to preserve user preferences and app state
        const authKeys = [
            "next-auth.session-token",
            "next-auth.callback-url",
            "next-auth.csrf-token",
            "__Secure-next-auth.session-token",
            "__Host-next-auth.csrf-token",
        ];
        authKeys.forEach((key) => {
            localStorage.removeItem(key);
            sessionStorage.removeItem(key);
        });
    }, []);

    // Only show for AccessDenied errors
    if (error !== "AccessDenied") {
        // Redirect to login for other errors
        return (
            <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">
                <div className="text-center">
                    <p className="text-slate-400 mb-4">
                        Redirecting to login...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">
            <GridBackground />
            <Particles />

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl p-8 animate-fade-in-scale">
                    {/* Logo */}
                    <div className="flex justify-center mb-6">
                        <AnimatedLogo size={120} animate={true} />
                    </div>

                    {/* Main message */}
                    <div className="text-center space-y-4 mb-8">
                        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                            Almost there...
                        </h1>
                        <p className="text-slate-300 text-lg leading-relaxed">
                            We're crafting something special, and you're on the
                            list.
                        </p>
                        <p className="text-slate-400 text-sm">
                            Your invitation is being prepared. We'll be in touch
                            soon.
                        </p>
                    </div>

                    {/* Decorative element */}
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
                                <svg
                                    className="w-8 h-8 text-cyan-400 animate-pulse"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                            </div>
                            {/* Glow effect */}
                            <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl animate-pulse-slow" />
                        </div>
                    </div>

                    {/* Playful message */}
                    <div className="text-center mb-8">
                        <p className="text-slate-400 text-sm italic">
                            "The best things come to those who wait... and those
                            who are invited."
                        </p>
                    </div>

                    {/* Action button */}
                    <div className="flex flex-col gap-3">
                        <Link
                            href="/"
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-all duration-300 ease-in-out bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-300 hover:from-cyan-500/30 hover:to-purple-500/30 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/20 transform hover:scale-[1.02]"
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
                                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                                />
                            </svg>
                            Return Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ErrorPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-900">
                    <div className="animate-pulse text-slate-400">
                        Loading...
                    </div>
                </div>
            }
        >
            <ErrorContent />
        </Suspense>
    );
}

"use client";

import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
    useContext,
} from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import Loader from "../../../app/components/loader";
import { convertMessageToMarkdown } from "../chat/ChatMessage";
import { AuthContext } from "../../App";
import { useEntityOnboarding } from "../../hooks/useEntityOnboarding";
import { useEntities } from "../../hooks/useEntities";
import { useOnboarding } from "../../contexts/OnboardingContext";
import { useStreamingMessages } from "../../hooks/useStreamingMessages";
import {
    useAddChat,
    useUpdateChat,
    useDeleteChat,
    useGetChatById,
} from "../../../app/queries/chats";
import { useQueryClient } from "@tanstack/react-query";
import axios from "../../../app/utils/axios-client";
import {
    Particles,
    GridBackground,
} from "../../../app/auth/components/AuthBackground";
import AnimatedLogo from "../common/AnimatedLogo";
import { composeUserDateTimeInfo } from "../../utils/datetimeUtils";

/**
 * Generate avatar image via server endpoint
 * Handles Gemini generation + cloud upload
 * Returns the image URL or null on failure
 */
const generateAvatarImage = async (avatarText) => {
    try {
        console.log("[Onboarding] Starting parallel avatar generation...");
        const response = await axios.post("/api/entities/generate-avatar", {
            avatarText,
        });

        const imageUrl = response.data?.url;
        if (imageUrl) {
            console.log(
                "[Onboarding] Avatar generation complete:",
                imageUrl.substring(0, 50) + "...",
            );
        }
        return imageUrl || null;
    } catch (error) {
        console.error("[Onboarding] Avatar generation failed:", error.message);
        return null;
    }
};

// Drifting sparkles around the logo (adapted from sidebar)
const OnboardingSparkles = React.memo(({ size = 120 }) => {
    const sparkles = React.useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const driftRadius = 8 + Math.random() * 10;
            return {
                id: i,
                angle: (i * 360) / 12,
                distance: size / 2 + 10 + Math.random() * 15,
                driftDuration: 8 + Math.random() * 6,
                delay: Math.random() * 4,
                sparkleSize: Math.random() * 3 + 2,
                opacity: Math.random() * 0.5 + 0.4,
                driftX1: (Math.random() - 0.5) * driftRadius * 2,
                driftY1: (Math.random() - 0.5) * driftRadius * 2,
                driftX2: (Math.random() - 0.5) * driftRadius * 2,
                driftY2: (Math.random() - 0.5) * driftRadius * 2,
                driftX3: (Math.random() - 0.5) * driftRadius * 2,
                driftY3: (Math.random() - 0.5) * driftRadius * 2,
            };
        });
    }, [size]);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-visible">
            {sparkles.map((sparkle) => {
                const radian = (sparkle.angle * Math.PI) / 180;
                const x = Math.cos(radian) * sparkle.distance;
                const y = Math.sin(radian) * sparkle.distance;

                return (
                    <div
                        key={sparkle.id}
                        className="absolute rounded-full onboarding-sparkle-drift"
                        style={{
                            left: `calc(50% + ${x}px)`,
                            top: `calc(50% + ${y}px)`,
                            width: `${sparkle.sparkleSize}px`,
                            height: `${sparkle.sparkleSize}px`,
                            background: `radial-gradient(circle, rgba(34, 211, 238, ${sparkle.opacity}) 0%, rgba(167, 139, 250, ${sparkle.opacity * 0.6}) 50%, transparent 100%)`,
                            boxShadow: `0 0 ${sparkle.sparkleSize * 2}px rgba(34, 211, 238, ${sparkle.opacity * 0.7})`,
                            "--drift-x1": `${sparkle.driftX1}px`,
                            "--drift-y1": `${sparkle.driftY1}px`,
                            "--drift-x2": `${sparkle.driftX2}px`,
                            "--drift-y2": `${sparkle.driftY2}px`,
                            "--drift-x3": `${sparkle.driftX3}px`,
                            "--drift-y3": `${sparkle.driftY3}px`,
                            animationDuration: `${sparkle.driftDuration}s`,
                            animationDelay: `${sparkle.delay}s`,
                        }}
                    />
                );
            })}
        </div>
    );
});

// Floating text component for entity messages with full markdown support
const FloatingEntityMessage = React.memo(
    ({ content, isVisible, isStreaming }) => {
        const textContent = content?.trim() || "";

        return (
            <div
                className={`
                transition-all ease-out
                ${isVisible ? "opacity-100 translate-y-0 onboarding-fade-in" : "opacity-0 translate-y-4"}
            `}
                style={{ transitionDuration: isVisible ? "1000ms" : "300ms" }}
            >
                <div className="onboarding-message-content text-base sm:text-lg md:text-2xl font-light text-center leading-relaxed text-slate-200">
                    {convertMessageToMarkdown({ payload: textContent })}
                    {isStreaming && (
                        <span className="inline-block w-0.5 h-5 ml-1 bg-cyan-400 animate-pulse align-middle" />
                    )}
                </div>
            </div>
        );
    },
);

// User input component with glow
const EtherealInput = React.memo(
    ({ value, onChange, onSubmit, isVisible, isDisabled, placeholder }) => {
        const inputRef = useRef(null);

        useEffect(() => {
            if (isVisible && !isDisabled) {
                inputRef.current?.focus();
            }
        }, [isVisible, isDisabled]);

        const handleKeyDown = (e) => {
            if (e.key === "Enter" && !e.shiftKey && value.trim()) {
                e.preventDefault();
                onSubmit();
            }
        };

        return (
            <div
                className={`
                transition-all ease-out
                ${isVisible ? "opacity-100 translate-y-0 onboarding-fade-in" : "opacity-0 translate-y-2 pointer-events-none"}
            `}
                style={{
                    transitionDuration: isVisible ? "800ms" : "200ms",
                    transitionDelay: isVisible ? "200ms" : "0ms",
                }}
            >
                <div className="relative flex items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isDisabled}
                        placeholder={placeholder}
                        className="
                        w-full px-0 py-3
                        text-base sm:text-lg md:text-xl font-light text-center
                        bg-transparent border-none outline-none
                        text-cyan-100 placeholder-slate-600
                        disabled:opacity-50
                    "
                        style={{
                            textShadow: value
                                ? "0 0 10px rgba(34, 211, 238, 0.5), 0 0 20px rgba(34, 211, 238, 0.3), 0 0 30px rgba(167, 139, 250, 0.2)"
                                : "none",
                        }}
                    />

                    {value.trim() && (
                        <button
                            onClick={onSubmit}
                            disabled={isDisabled}
                            className="
                            absolute right-0 top-1/2 -translate-y-1/2
                            px-3 py-1.5 rounded-full text-xs
                            text-cyan-400/80 border border-cyan-500/30 bg-cyan-500/10
                            hover:bg-cyan-500/20 transition-colors
                        "
                        >
                            Enter ↵
                        </button>
                    )}
                </div>

                {/* Glowing underline */}
                <div
                    className="h-px w-full transition-all duration-300"
                    style={{
                        background: value
                            ? "linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.6), transparent)"
                            : "linear-gradient(90deg, transparent, rgba(100, 116, 139, 0.4), transparent)",
                        boxShadow: value
                            ? "0 0 10px rgba(34, 211, 238, 0.4)"
                            : "none",
                    }}
                />
            </div>
        );
    },
);

// Orbiting particles around the avatar portal
const OrbitingParticles = React.memo(
    ({ count = 12, radius = 100, speed = 1, isConnected }) => {
        const particles = React.useMemo(() => {
            return Array.from({ length: count }, (_, i) => ({
                id: i,
                startAngle: (i * 360) / count,
                size: 2 + Math.random() * 3,
                opacity: 0.4 + Math.random() * 0.4,
                orbitSpeed: (0.8 + Math.random() * 0.4) * speed,
                wobble: Math.random() * 8,
                wobbleSpeed: 2 + Math.random() * 2,
                color: Math.random() > 0.5 ? "cyan" : "purple",
            }));
        }, [count, speed]);

        return (
            <div className="absolute inset-0 pointer-events-none">
                {particles.map((p) => (
                    <div
                        key={p.id}
                        className="absolute rounded-full orbit-particle"
                        style={{
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            left: "50%",
                            top: "50%",
                            background:
                                p.color === "cyan"
                                    ? `radial-gradient(circle, rgba(34, 211, 238, ${p.opacity}) 0%, rgba(34, 211, 238, 0) 70%)`
                                    : `radial-gradient(circle, rgba(167, 139, 250, ${p.opacity}) 0%, rgba(167, 139, 250, 0) 70%)`,
                            boxShadow:
                                p.color === "cyan"
                                    ? `0 0 ${p.size * 3}px rgba(34, 211, 238, ${p.opacity})`
                                    : `0 0 ${p.size * 3}px rgba(167, 139, 250, ${p.opacity})`,
                            "--orbit-radius": `${radius}px`,
                            "--start-angle": `${p.startAngle}deg`,
                            "--orbit-duration": `${8 / p.orbitSpeed}s`,
                            "--wobble": `${p.wobble}px`,
                            "--wobble-duration": `${p.wobbleSpeed}s`,
                            animation: isConnected
                                ? `orbit-scatter 1s ease-out forwards`
                                : `orbit-spin var(--orbit-duration) linear infinite, orbit-wobble var(--wobble-duration) ease-in-out infinite`,
                        }}
                    />
                ))}
            </div>
        );
    },
);

// Energy rings that pulse outward
const EnergyRings = React.memo(({ isConnected }) => {
    const rings = [
        { delay: 0, scale: 1, opacity: 0.3 },
        { delay: 0.5, scale: 1.3, opacity: 0.2 },
        { delay: 1, scale: 1.6, opacity: 0.15 },
        { delay: 1.5, scale: 1.9, opacity: 0.1 },
    ];

    return (
        <div className="absolute inset-0 pointer-events-none">
            {rings.map((ring, i) => (
                <div
                    key={i}
                    className="absolute inset-0 rounded-full energy-ring"
                    style={{
                        border: "1px solid",
                        borderColor: `rgba(34, 211, 238, ${ring.opacity})`,
                        transform: `scale(${ring.scale})`,
                        animationName: isConnected
                            ? "ring-burst"
                            : "ring-pulse",
                        animationDuration: isConnected ? "0.8s" : "3s",
                        animationTimingFunction: "ease-out",
                        animationIterationCount: isConnected ? 1 : "infinite",
                        animationFillMode: isConnected ? "forwards" : "none",
                        animationDelay: `${ring.delay}s`,
                        boxShadow: `inset 0 0 20px rgba(34, 211, 238, ${ring.opacity * 0.5}), 0 0 20px rgba(34, 211, 238, ${ring.opacity * 0.3})`,
                    }}
                />
            ))}
        </div>
    );
});

// Floating ambient particles in background
const AmbientParticles = React.memo(({ count = 30 }) => {
    const particles = React.useMemo(() => {
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: 1 + Math.random() * 2,
            duration: 10 + Math.random() * 20,
            delay: Math.random() * 10,
            opacity: 0.1 + Math.random() * 0.3,
        }));
    }, [count]);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute rounded-full"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        background: `radial-gradient(circle, rgba(34, 211, 238, ${p.opacity}) 0%, transparent 70%)`,
                        animationName: "ambient-float",
                        animationDuration: `${p.duration}s`,
                        animationTimingFunction: "ease-in-out",
                        animationIterationCount: "infinite",
                        animationDelay: `${p.delay}s`,
                    }}
                />
            ))}
        </div>
    );
});

// Portal/summoning effect around avatar - magic mirror / wormhole / stargate
const PortalEffect = React.memo(({ isConnected, hasAvatar }) => {
    return (
        <div className="absolute inset-0 pointer-events-none">
            {/* Deep space void center */}
            <div
                className="absolute inset-2 rounded-full"
                style={{
                    background: hasAvatar
                        ? "transparent"
                        : `radial-gradient(circle, rgba(0, 0, 20, 0.95) 0%, rgba(15, 23, 42, 0.9) 50%, transparent 70%)`,
                    transition: "background 0.8s ease-out",
                }}
            />

            {/* Inner event horizon glow */}
            <div
                className="absolute inset-0 rounded-full"
                style={{
                    background: `radial-gradient(circle, transparent 30%, rgba(34, 211, 238, ${isConnected ? 0.4 : 0.2}) 60%, transparent 70%)`,
                    animation: isConnected
                        ? "none"
                        : "portal-pulse 2s ease-in-out infinite",
                }}
            />

            {/* Swirling energy layer 1 - fast inner */}
            <div
                className="absolute -inset-2 rounded-full"
                style={{
                    background: `conic-gradient(from 0deg, transparent 0%, rgba(34, 211, 238, 0.5) 10%, transparent 20%, rgba(167, 139, 250, 0.4) 30%, transparent 40%, rgba(34, 211, 238, 0.3) 50%, transparent 60%, rgba(167, 139, 250, 0.5) 70%, transparent 80%, rgba(34, 211, 238, 0.4) 90%, transparent 100%)`,
                    animation: isConnected
                        ? "none"
                        : "portal-spin 3s linear infinite",
                    opacity: isConnected ? 0 : 1,
                    transition: "opacity 0.8s ease-out",
                }}
            />

            {/* Swirling energy layer 2 - medium */}
            <div
                className="absolute -inset-6 rounded-full"
                style={{
                    background: `conic-gradient(from 120deg, transparent 0%, rgba(167, 139, 250, 0.3) 15%, transparent 30%, rgba(34, 211, 238, 0.25) 45%, transparent 60%, rgba(167, 139, 250, 0.35) 75%, transparent 90%)`,
                    animation: isConnected
                        ? "none"
                        : "portal-spin-reverse 5s linear infinite",
                    opacity: isConnected ? 0 : 0.8,
                    transition: "opacity 0.8s ease-out",
                }}
            />

            {/* Swirling energy layer 3 - slow outer */}
            <div
                className="absolute -inset-10 rounded-full"
                style={{
                    background: `conic-gradient(from 240deg, transparent 0%, rgba(34, 211, 238, 0.15) 20%, transparent 40%, rgba(167, 139, 250, 0.2) 60%, transparent 80%)`,
                    animation: isConnected
                        ? "none"
                        : "portal-spin 8s linear infinite",
                    opacity: isConnected ? 0 : 0.6,
                    transition: "opacity 0.8s ease-out",
                }}
            />

            {/* Starfield/particle layer */}
            <div
                className="absolute -inset-4 rounded-full overflow-hidden"
                style={{
                    background: isConnected
                        ? "transparent"
                        : `
                        radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.8) 0%, transparent 100%),
                        radial-gradient(1px 1px at 40% 70%, rgba(34, 211, 238, 0.9) 0%, transparent 100%),
                        radial-gradient(1px 1px at 60% 20%, rgba(167, 139, 250, 0.8) 0%, transparent 100%),
                        radial-gradient(1px 1px at 80% 60%, rgba(255,255,255,0.7) 0%, transparent 100%),
                        radial-gradient(1px 1px at 10% 80%, rgba(34, 211, 238, 0.8) 0%, transparent 100%),
                        radial-gradient(1px 1px at 70% 40%, rgba(167, 139, 250, 0.9) 0%, transparent 100%),
                        radial-gradient(1px 1px at 30% 50%, rgba(255,255,255,0.6) 0%, transparent 100%),
                        radial-gradient(1px 1px at 90% 10%, rgba(34, 211, 238, 0.7) 0%, transparent 100%)
                    `,
                    animation: isConnected
                        ? "none"
                        : "portal-spin-reverse 20s linear infinite",
                    opacity: isConnected ? 0 : 0.7,
                    transition: "opacity 0.8s ease-out",
                }}
            />

            {/* Success burst effect */}
            {isConnected && (
                <div
                    className="absolute -inset-8 rounded-full"
                    style={{
                        background: `radial-gradient(circle, rgba(34, 211, 238, 0.6) 0%, rgba(167, 139, 250, 0.4) 30%, transparent 70%)`,
                        animation: "success-burst 1.2s ease-out forwards",
                    }}
                />
            )}
        </div>
    );
});

// Contacting Screen - immersive portal summoning experience
const ContactingScreen = ({
    entityName,
    avatarIcon,
    avatarImageUrl,
    isConnected,
}) => {
    const { t } = useTranslation();
    const [showAvatar, setShowAvatar] = useState(false);
    const [avatarRevealed, setAvatarRevealed] = useState(false);
    const prevAvatarUrl = useRef(null);

    // Track when avatar image arrives for dramatic reveal
    useEffect(() => {
        if (avatarImageUrl && avatarImageUrl !== prevAvatarUrl.current) {
            prevAvatarUrl.current = avatarImageUrl;
            // Dramatic delay before reveal
            setShowAvatar(false);
            const timer1 = setTimeout(() => setShowAvatar(true), 100);
            const timer2 = setTimeout(() => setAvatarRevealed(true), 600);
            return () => {
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        }
    }, [avatarImageUrl]);

    return (
        <div className="relative flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
            {/* Ambient background particles */}
            <AmbientParticles count={40} />

            {/* Main portal container */}
            <div className="relative mb-12">
                {/* Outer energy rings */}
                <div className="absolute -inset-16">
                    <EnergyRings isConnected={isConnected} />
                </div>

                {/* Orbiting particles */}
                <div className="absolute -inset-8">
                    <OrbitingParticles
                        count={16}
                        radius={90}
                        speed={1}
                        isConnected={isConnected}
                    />
                </div>
                <div className="absolute -inset-4">
                    <OrbitingParticles
                        count={10}
                        radius={70}
                        speed={1.5}
                        isConnected={isConnected}
                    />
                </div>

                {/* Portal effect */}
                <div className="relative w-40 h-40">
                    <PortalEffect
                        isConnected={isConnected}
                        hasAvatar={!!avatarImageUrl}
                    />

                    {/* Avatar container */}
                    <div
                        className={`relative w-40 h-40 rounded-full flex items-center justify-center text-7xl overflow-hidden transition-all duration-700
                            ${isConnected ? "avatar-connected" : "avatar-summoning"}
                            ${avatarRevealed ? "avatar-revealed" : ""}
                        `}
                        style={{
                            background:
                                avatarImageUrl && showAvatar
                                    ? "transparent"
                                    : "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%)",
                            border: `2px solid rgba(34, 211, 238, ${isConnected ? 0.8 : 0.4})`,
                            boxShadow: isConnected
                                ? `0 0 60px rgba(34, 211, 238, 0.6), 0 0 120px rgba(167, 139, 250, 0.3), inset 0 0 40px rgba(34, 211, 238, 0.2)`
                                : `0 0 30px rgba(34, 211, 238, 0.3), inset 0 0 20px rgba(34, 211, 238, 0.1)`,
                        }}
                    >
                        {avatarImageUrl && showAvatar ? (
                            <img
                                src={avatarImageUrl}
                                alt={entityName}
                                className={`w-full h-full object-cover transition-all duration-700 ${avatarRevealed ? "avatar-image-reveal" : "opacity-0 scale-110 blur-sm"}`}
                            />
                        ) : (
                            <span
                                className="select-none transition-all duration-500"
                                style={{
                                    filter: "drop-shadow(0 0 20px rgba(34, 211, 238, 0.5))",
                                    animation:
                                        "emoji-float 3s ease-in-out infinite",
                                }}
                            >
                                {avatarIcon || "✨"}
                            </span>
                        )}

                        {/* Inner glow overlay */}
                        <div
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                                background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.1) 0%, transparent 60%)`,
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Name with dramatic reveal */}
            <h1
                className={`text-4xl md:text-5xl font-light mb-4 transition-all duration-700 ${isConnected ? "name-connected" : "name-summoning"}`}
                style={{
                    color: isConnected ? "#67e8f9" : "#e2e8f0",
                    textShadow: isConnected
                        ? "0 0 30px rgba(103, 232, 249, 0.8), 0 0 60px rgba(167, 139, 250, 0.5)"
                        : "0 0 20px rgba(34, 211, 238, 0.3)",
                }}
            >
                {entityName}
            </h1>

            {/* Status - simple connecting message */}
            <div className="h-8 flex items-center justify-center">
                {isConnected ? (
                    <p
                        className="text-lg font-light tracking-wide connecting-status-appear"
                        style={{
                            color: "#34d399",
                            textShadow: "0 0 20px rgba(52, 211, 153, 0.5)",
                        }}
                    >
                        ✓ {t("Connected")}
                    </p>
                ) : (
                    <p className="text-lg text-slate-400 font-light tracking-wide">
                        {t("Connecting")}
                        <span className="inline-flex ml-1 items-center">
                            <span
                                className="w-1 h-1 rounded-full bg-cyan-400/70 mx-0.5"
                                style={{
                                    animationName: "pulse",
                                    animationDuration: "1.5s",
                                    animationTimingFunction: "ease-in-out",
                                    animationIterationCount: "infinite",
                                    animationDelay: "0ms",
                                }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-cyan-400/70 mx-0.5"
                                style={{
                                    animationName: "pulse",
                                    animationDuration: "1.5s",
                                    animationTimingFunction: "ease-in-out",
                                    animationIterationCount: "infinite",
                                    animationDelay: "300ms",
                                }}
                            />
                            <span
                                className="w-1 h-1 rounded-full bg-cyan-400/70 mx-0.5"
                                style={{
                                    animationName: "pulse",
                                    animationDuration: "1.5s",
                                    animationTimingFunction: "ease-in-out",
                                    animationIterationCount: "infinite",
                                    animationDelay: "600ms",
                                }}
                            />
                        </span>
                    </p>
                )}
            </div>
        </div>
    );
};

// Main Onboarding Component
export default function EntityOnboarding({
    isOpen,
    onClose,
    onComplete,
    isFirstRun = false,
}) {
    const { t } = useTranslation();
    const { user } = useContext(AuthContext);
    const { onboardingChatReady, finalizeOnboarding } = useOnboarding();

    const {
        isLoading,
        error,
        onboardingEntity,
        createdEntity,
        startOnboarding,
        cancelOnboarding,
        completeOnboarding,
        handleEntityCreated,
    } = useEntityOnboarding();

    // Local state
    const [inputValue, setInputValue] = useState("");
    const [showContacting, setShowContacting] = useState(false);
    const [isEntityReady, setIsEntityReady] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [onboardingChatId, setOnboardingChatId] = useState(null); // Store ID, not object
    const [prefetchedChatId, setPrefetchedChatId] = useState(null);
    const [actualEntityId, setActualEntityId] = useState(null);
    const [avatarImageUrl, setAvatarImageUrl] = useState(null);
    const [isFading, setIsFading] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null); // For error display

    // Simple refs for tracking
    const conversationRef = useRef([]);
    const hasStartedRef = useRef(false);
    const prefetchStartedRef = useRef(false);

    // Refs for parallel avatar generation
    const avatarGenerationStartedRef = useRef(false);
    const generatedAvatarUrlRef = useRef(null);

    // State to track when avatar generation completes (success or failure)
    // Using state so effects can react to it
    const [avatarGenerationDone, setAvatarGenerationDone] = useState(false);

    const addChat = useAddChat();
    const updateChat = useUpdateChat();
    const deleteChat = useDeleteChat();
    const { refetch: refetchEntities } = useEntities(user?.contextId);
    const queryClient = useQueryClient();

    // Monitor onboarding chat for messages - same pattern as regular chat
    // This ensures we get persisted messages even if SSE stream is interrupted
    const { data: onboardingChat } = useGetChatById(onboardingChatId);

    // Monitor prefetched chat for messages and streaming state
    const { data: prefetchedChat, refetch: refetchPrefetchedChat } =
        useGetChatById(prefetchedChatId);

    // Check if the prefetched chat has entity content ready
    // Just need at least one incoming message from the entity
    // We have a 10s failover anyway, so don't be too strict here
    const isChatReady = prefetchedChat?.messages?.some(
        (m) => m.direction === "incoming" && m.payload,
    );

    // Ref to track if we've already updated the entity with our generated avatar
    const avatarUpdateSentRef = useRef(false);

    // Update entity with our generated avatar once we have both entityId and generated URL
    useEffect(() => {
        // Only proceed if:
        // - We have an actual entity ID
        // - We have a generated avatar URL from our parallel generation
        // - We haven't already sent the update
        // - We don't already have an avatar from Cortex (first-wins)
        const generatedUrl = generatedAvatarUrlRef.current;
        if (!actualEntityId || !generatedUrl || avatarUpdateSentRef.current) {
            return;
        }

        // Mark as sent to prevent duplicate updates
        avatarUpdateSentRef.current = true;

        console.log("[Onboarding] Updating entity with generated avatar...");
        axios
            .patch(`/api/entities/${actualEntityId}/avatar`, {
                imageUrl: generatedUrl,
            })
            .then((response) => {
                if (response.data?.success) {
                    console.log(
                        "[Onboarding] Entity avatar updated successfully",
                    );
                    // Ensure we're showing the generated avatar
                    setAvatarImageUrl(generatedUrl);
                    // Refresh entities list so sidebar shows new avatar
                    refetchEntities();
                }
            })
            .catch((err) => {
                console.error(
                    "[Onboarding] Failed to update entity avatar:",
                    err.message,
                );
                // Non-fatal - the entity still works, just might not have the avatar persisted
            });
        // avatarGenerationDone triggers re-run when ref is populated
    }, [actualEntityId, refetchEntities, avatarGenerationDone]);

    // Poll for chat content during connecting phase (avatar is generated in parallel)
    const pollRef = useRef(null);
    useEffect(() => {
        // Stop polling when chat is ready or not in connecting phase
        if (!isOpen || !showContacting || isChatReady || !prefetchedChatId) {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            return;
        }

        // Poll for chat content every 1.5s
        pollRef.current = setInterval(() => {
            refetchPrefetchedChat?.().catch(() => {});
        }, 1500);

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
    }, [
        isOpen,
        showContacting,
        prefetchedChatId,
        refetchPrefetchedChat,
        isChatReady,
    ]);

    // Track entity creation state
    const entityCreatedRef = useRef(false);
    const pendingEntityRef = useRef(null); // Store entity details from start message
    const transitionStartedRef = useRef(false); // Prevent multiple transitions

    const handleToolMessage = useCallback(
        (toolMessage) => {
            // Check both toolName and tool fields (Cortex may use either)
            const toolNameLower = (
                toolMessage?.toolName ||
                toolMessage?.tool ||
                ""
            ).toLowerCase();
            const isCreateEntity = toolNameLower === "createentity";
            if (!isCreateEntity) return;

            if (toolMessage.type === "start" && toolMessage.params) {
                // Build avatar prompt from avatarText (physical description) + identity
                // avatarText is the primary description, identity adds personality context
                const avatarParts = [];
                if (toolMessage.params.avatarText) {
                    avatarParts.push(toolMessage.params.avatarText);
                }
                if (toolMessage.params.identity) {
                    avatarParts.push(
                        `Personality: ${toolMessage.params.identity}`,
                    );
                }
                const avatarDescription =
                    avatarParts.join("\n\n") || toolMessage.params.name;

                // Store entity details from start message
                pendingEntityRef.current = {
                    name: toolMessage.params.name,
                    avatarText: avatarDescription,
                    avatarIcon: toolMessage.params.avatarIcon,
                };
                // Show the contacting screen immediately
                setShowContacting(true);

                // Fire off parallel avatar generation (don't await)
                if (avatarDescription && !avatarGenerationStartedRef.current) {
                    avatarGenerationStartedRef.current = true;
                    console.log(
                        "[Onboarding] Firing parallel avatar generation for:",
                        avatarDescription.substring(0, 100),
                    );

                    generateAvatarImage(avatarDescription)
                        .then((url) => {
                            setAvatarGenerationDone(true);
                            if (url) {
                                console.log(
                                    "[Onboarding] Parallel avatar ready, storing URL",
                                );
                                generatedAvatarUrlRef.current = url;
                                // If we don't have an avatar yet from Cortex, use ours
                                setAvatarImageUrl((current) => current || url);
                            } else {
                                console.log(
                                    "[Onboarding] Avatar generation returned no URL",
                                );
                            }
                        })
                        .catch((err) => {
                            setAvatarGenerationDone(true);
                            console.error(
                                "[Onboarding] Parallel avatar generation failed:",
                                err,
                            );
                        });
                }
            } else if (toolMessage.type === "finish") {
                entityCreatedRef.current = true;

                // Trigger entity created handler
                handleEntityCreated({
                    entityId: "pending",
                    name:
                        pendingEntityRef.current?.name || "Your new companion",
                    avatarText: pendingEntityRef.current?.avatarText,
                    success: toolMessage.success !== false,
                });
            }
        },
        [handleEntityCreated],
    );

    const handleStreamComplete = useCallback((content) => {
        // Add to conversation history for context (message is persisted in DB by server)
        // We no longer rely on this for display - we get it from the persisted chat
        if (content && !entityCreatedRef.current) {
            conversationRef.current.push({ role: "assistant", content });
        }
    }, []);

    const {
        isStreaming,
        streamingContent,
        setIsStreaming,
        setSubscriptionId,
        clearStreamingState,
    } = useStreamingMessages({
        chat: onboardingChat,
        updateChatHook: updateChat,
        currentEntityId: onboardingEntity?.id,
        onToolMessage: handleToolMessage,
        onStreamComplete: handleStreamComplete,
    });

    // Reset all state when closing - this ensures clean state for next open
    useEffect(() => {
        if (!isOpen) {
            // Reset everything when closing so next open starts fresh
            setShowContacting(false);
            setIsEntityReady(false);
            setOnboardingChatId(null);
            setPrefetchedChatId(null);
            setActualEntityId(null);
            setAvatarImageUrl(null);
            setIsFading(false);
            setInputValue("");
            setErrorMessage(null);
            conversationRef.current = [];
            hasStartedRef.current = false;
            prefetchStartedRef.current = false;
            entityCreatedRef.current = false;
            transitionStartedRef.current = false;
            pendingEntityRef.current = null;
            // Reset parallel avatar generation state
            avatarGenerationStartedRef.current = false;
            generatedAvatarUrlRef.current = null;
            avatarUpdateSentRef.current = false;
            setAvatarGenerationDone(false);
            // Reset failover timer
            if (failoverTimerRef.current) {
                clearTimeout(failoverTimerRef.current);
                failoverTimerRef.current = null;
            }
            clearStreamingState();
            setMounted(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Initialize when opened - state is already clean from close reset
    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            startOnboarding();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]); // Only trigger on isOpen change, not on function reference changes

    // Poll for onboarding chat completion - same pattern as regular chat (ChatContent.js)
    // This ensures we get persisted messages even if SSE stream is interrupted on mobile
    useEffect(() => {
        if (!onboardingChatId || !isStreaming) return;

        const pollInterval = setInterval(() => {
            queryClient.refetchQueries({
                queryKey: ["chat", String(onboardingChatId)],
            });
        }, 2000);

        return () => clearInterval(pollInterval);
    }, [onboardingChatId, isStreaming, queryClient]);

    // Create chat and start conversation when entity is ready
    useEffect(() => {
        if (!onboardingEntity || hasStartedRef.current || isStreaming) return;
        hasStartedRef.current = true;

        const startConversation = async () => {
            try {
                // First, cleanup any stale onboarding chats (best effort, don't block on failures)
                try {
                    const response = await axios.get(
                        "/api/chats/active/detail",
                    );
                    const activeChats = response.data || [];
                    const staleChats = activeChats.filter(
                        (c) => c.selectedEntityId === onboardingEntity.id,
                    );
                    // Delete in parallel, ignore individual failures
                    await Promise.allSettled(
                        staleChats.map((chat) =>
                            deleteChat
                                .mutateAsync({ chatId: chat._id })
                                .catch(() => {}),
                        ),
                    );
                } catch (e) {
                    // Non-fatal - continue with onboarding
                }

                // Create a fresh chat
                const chat = await addChat.mutateAsync({
                    title: "Entity Onboarding",
                    messages: [],
                    selectedEntityId: onboardingEntity.id,
                    selectedEntityName: onboardingEntity.name,
                    forceNew: true,
                });
                setOnboardingChatId(chat._id);

                // Build and send the priming message
                const userName = user?.name || "the user";
                const primingMessage = isFirstRun
                    ? `A user with the following username:${userName} is here to meet a new AI - please start the conversation and get to know them.`
                    : `A user with the following username:${userName} wants to meet another AI companion. This is not their first time - they have spoken with you before. Please help them find a new one.`;

                conversationRef.current = [
                    { role: "user", content: primingMessage },
                ];

                // Clear first, THEN set streaming to true (clearStreamingState sets it to false)
                clearStreamingState();
                setIsStreaming(true);

                const streamResponse = await fetch(
                    `/api/chats/${chat._id}/stream`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            conversation: conversationRef.current,
                            agentContext: user.contextId
                                ? [
                                      {
                                          contextId: user.contextId,
                                          contextKey: user.contextKey || "",
                                          default: true,
                                      },
                                  ]
                                : [],
                            aiName: onboardingEntity.name,
                            aiMemorySelfModify: false,
                            title: "Entity Onboarding",
                            entityId: onboardingEntity.id,
                            researchMode: false,
                            model: user.agentModel || "gemini-flash-3-vision",
                            userInfo: composeUserDateTimeInfo(),
                        }),
                    },
                );

                if (!streamResponse.ok)
                    throw new Error(
                        `Stream failed: ${streamResponse.statusText}`,
                    );
                setSubscriptionId(streamResponse);
            } catch (error) {
                console.error("[Onboarding] Start error:", error);
                setErrorMessage(t("I encountered an issue. Let's try again."));
            }
        };

        startConversation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onboardingEntity]); // Only trigger when entity loads

    // Mark entity as ready when created
    useEffect(() => {
        if (createdEntity && !isEntityReady) {
            setIsEntityReady(true);
        }
    }, [createdEntity, isEntityReady]);

    // Prefetch and prepare chat
    useEffect(() => {
        if (!showContacting || !createdEntity || prefetchStartedRef.current)
            return;
        prefetchStartedRef.current = true;

        const prefetch = async () => {
            try {
                const result = await refetchEntities();
                let entityId = createdEntity.id;

                if (!entityId || entityId === "pending") {
                    // React Query refetch returns { data, ... } where data is the entities array
                    const entities = result?.data;
                    if (entities && Array.isArray(entities)) {
                        const match = entities
                            .filter(
                                (e) =>
                                    e.name === createdEntity.name &&
                                    !e.isSystem,
                            )
                            .sort(
                                (a, b) =>
                                    new Date(b.createdAt || 0) -
                                    new Date(a.createdAt || 0),
                            )[0];
                        if (match) {
                            entityId = match.id;
                            setActualEntityId(entityId);
                            // Capture avatar image URL if available
                            if (match.avatar?.image?.url) {
                                setAvatarImageUrl(match.avatar.image.url);
                            }
                        }
                    }
                } else {
                    setActualEntityId(entityId);
                }

                if (entityId && entityId !== "pending") {
                    const newChat = await addChat.mutateAsync({
                        title: createdEntity.name,
                        messages: [],
                        selectedEntityId: entityId,
                        selectedEntityName: createdEntity.name,
                        forceNew: true,
                    });

                    if (newChat?._id) {
                        setPrefetchedChatId(newChat._id);
                        fetch(`/api/chats/${newChat._id}/stream`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                conversation: [
                                    {
                                        role: "user",
                                        content:
                                            "Please introduce yourself warmly to your new friend. This is your first conversation together! Don't create an avatar - one is being created in the background for you.",
                                    },
                                ],
                                agentContext: user.contextId
                                    ? [
                                          {
                                              contextId: user.contextId,
                                              contextKey: user.contextKey || "",
                                              default: true,
                                          },
                                      ]
                                    : [],
                                aiName: createdEntity.name,
                                aiMemorySelfModify: true,
                                title: createdEntity.name,
                                entityId,
                                researchMode: false,
                                model:
                                    user.agentModel || "gemini-flash-3-vision",
                                userInfo: composeUserDateTimeInfo(),
                            }),
                        }).catch(console.error);
                    }
                }
            } catch (error) {
                console.error("[Onboarding] Prefetch error:", error);
            }
        };
        prefetch();
    }, [showContacting, createdEntity, refetchEntities, addChat, user]);

    // Ref to hold failover timer so it survives effect re-runs
    const failoverTimerRef = useRef(null);

    // Trigger navigation when entity and prefetched chat are ready
    // Modal stays open showing "Connecting" until chat page confirms ready
    useEffect(() => {
        if (!isOpen || !showContacting || !isEntityReady || !prefetchedChatId)
            return;
        if (transitionStartedRef.current) return;

        // Determine readiness: avatar is "ready" if we have it OR generation failed
        const avatarReady = !!avatarImageUrl || avatarGenerationDone;
        const allReady = isChatReady && avatarReady;

        const triggerNavigation = () => {
            if (transitionStartedRef.current) return;
            transitionStartedRef.current = true;

            const newEntityId = actualEntityId || createdEntity?.id;
            completeOnboarding();

            // Delete onboarding chat (best effort)
            if (onboardingChat?._id) {
                deleteChat.mutate(
                    { chatId: onboardingChat._id },
                    { onError: () => {} },
                );
            }

            console.log("[Onboarding] Triggering navigation to new chat");
            onComplete?.(newEntityId, createdEntity, prefetchedChatId);
        };

        if (allReady) {
            // Everything ready - trigger navigation immediately
            triggerNavigation();
        } else if (!failoverTimerRef.current) {
            // Not all ready yet - set up failover timeout
            failoverTimerRef.current = setTimeout(() => {
                console.log(
                    "[Onboarding] Failover: proceeding without full readiness",
                );
                triggerNavigation();
            }, 8000);
        }
    }, [
        isOpen,
        showContacting,
        isEntityReady,
        prefetchedChatId,
        isChatReady,
        avatarImageUrl,
        avatarGenerationDone,
        actualEntityId,
        createdEntity,
        onComplete,
        completeOnboarding,
        deleteChat,
        onboardingChat,
    ]);

    // When chat confirms ready, show "Connected" for 1 second then finalize
    useEffect(() => {
        if (!onboardingChatReady) return;

        console.log(
            "[Onboarding] Chat ready, showing Connected for 1 second...",
        );
        const timer = setTimeout(() => {
            console.log("[Onboarding] Finalizing onboarding");
            finalizeOnboarding();
        }, 1000);

        return () => clearTimeout(timer);
    }, [onboardingChatReady, finalizeOnboarding]);

    // Cleanup failover timer on unmount
    useEffect(() => {
        return () => {
            if (failoverTimerRef.current)
                clearTimeout(failoverTimerRef.current);
        };
    }, []);

    // Handle user sending a message
    const handleSendMessage = useCallback(
        async (messageText) => {
            if (
                !messageText?.trim() ||
                !onboardingChat ||
                !onboardingEntity ||
                isStreaming
            )
                return;

            const userMessage = messageText.trim();

            // Quick fade transition
            setIsFading(true);
            await new Promise((resolve) => setTimeout(resolve, 250));

            // Add to conversation and clear UI
            conversationRef.current.push({
                role: "user",
                content: userMessage,
            });
            setErrorMessage(null); // Clear any previous error
            setInputValue("");

            try {
                // Clear first, THEN set streaming to true (clearStreamingState sets it to false)
                clearStreamingState();
                setIsStreaming(true);
                setIsFading(false);

                const response = await fetch(
                    `/api/chats/${onboardingChat._id}/stream`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            conversation: conversationRef.current,
                            agentContext: user.contextId
                                ? [
                                      {
                                          contextId: user.contextId,
                                          contextKey: user.contextKey || "",
                                          default: true,
                                      },
                                  ]
                                : [],
                            aiName: onboardingEntity.name,
                            aiMemorySelfModify: false,
                            title: "Entity Onboarding",
                            entityId: onboardingEntity.id,
                            researchMode: false,
                            model: user.agentModel || "gemini-flash-3-vision",
                            userInfo: composeUserDateTimeInfo(),
                        }),
                    },
                );

                if (!response.ok)
                    throw new Error(`Stream failed: ${response.statusText}`);
                setSubscriptionId(response);
            } catch (error) {
                console.error("Error sending message:", error);
                setIsStreaming(false);
                setIsFading(false);
                setErrorMessage(t("I encountered an issue. Let's try again."));
            }
        },
        [
            onboardingChat,
            onboardingEntity,
            isStreaming,
            user,
            setIsStreaming,
            setSubscriptionId,
            clearStreamingState,
            t,
        ],
    );

    const handleClose = useCallback(() => {
        // Delete the onboarding chat (Vesper conversation) if one was created
        if (onboardingChat?._id) {
            deleteChat.mutate({ chatId: onboardingChat._id });
        }

        // Also delete the prefetched chat for the new entity if one was created
        // This prevents orphaned chats if user cancels during "Contacting" phase
        if (prefetchedChatId) {
            deleteChat.mutate({ chatId: prefetchedChatId });
        }

        clearStreamingState();
        cancelOnboarding();
        onClose();
    }, [
        clearStreamingState,
        cancelOnboarding,
        onClose,
        onboardingChat,
        prefetchedChatId,
        deleteChat,
    ]);

    if (!isOpen) return null;

    // Derive the current message from persisted chat - same pattern as regular chat
    // This ensures we show the message even if the SSE stream was interrupted on mobile
    const lastIncomingMessage = onboardingChat?.messages
        ?.filter((m) => m.direction === "incoming")
        ?.slice(-1)?.[0]?.payload;

    // Priority: error > streaming > persisted message
    const displayMessage = errorMessage
        ? errorMessage
        : isStreaming
          ? streamingContent
          : lastIncomingMessage || "";

    const showInput =
        !isStreaming && !showContacting && displayMessage && !isLoading;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Background */}
            <div className="absolute inset-0">
                <GridBackground />
                <Particles />
            </div>

            {/* Close button */}
            {!isFirstRun && (
                <button
                    onClick={handleClose}
                    className={`
                        absolute top-5 right-5 z-50 p-2.5 rounded-full
                        text-slate-500 hover:text-slate-300
                        bg-slate-800/40 hover:bg-slate-800/60
                        border border-slate-700/50
                        transition-all duration-200
                        ${mounted ? "opacity-100" : "opacity-0"}
                    `}
                >
                    <X className="w-5 h-5" />
                </button>
            )}

            {/* Main content */}
            <div
                className={`relative w-full max-w-2xl px-6 transition-opacity duration-500 ${mounted ? "opacity-100" : "opacity-0"}`}
            >
                {showContacting ? (
                    <ContactingScreen
                        entityName={
                            pendingEntityRef.current?.name ||
                            createdEntity?.name ||
                            "..."
                        }
                        avatarIcon={
                            pendingEntityRef.current?.avatarIcon ||
                            createdEntity?.avatarIcon ||
                            "✨"
                        }
                        avatarImageUrl={avatarImageUrl}
                        isConnected={onboardingChatReady}
                    />
                ) : (
                    <div className="relative min-h-[60vh]">
                        {/* Logo with sparkles - absolutely positioned, animates independently */}
                        <div
                            className={`absolute left-1/2 transition-all duration-1000 ease-out ${mounted ? "opacity-100" : "opacity-0"} ${isStreaming || (onboardingEntity && !displayMessage) ? "logo-heartbeat" : ""}`}
                            style={{
                                transform: `translateX(-50%) translateY(${onboardingEntity ? "0" : "12vh"})`,
                                top: "0",
                            }}
                        >
                            <OnboardingSparkles size={120} />
                            <AnimatedLogo size={120} animate={true} />
                        </div>

                        {/* Content area - below logo */}
                        <div className="flex flex-col items-center pt-44">
                            {/* Loading */}
                            {isLoading && !onboardingEntity ? (
                                <div className="flex flex-col items-center gap-4 mt-12">
                                    {/* Logo pulsing is enough, no spinner text needed */}
                                </div>
                            ) : error ? (
                                <div className="text-center">
                                    <p className="text-red-400 mb-4">{error}</p>
                                    <button
                                        onClick={startOnboarding}
                                        className="px-4 py-2 rounded-lg bg-slate-800/50 text-slate-200 hover:bg-slate-700/50 border border-slate-700/50"
                                    >
                                        {t("Try Again")}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Entity message OR sparkle loader */}
                                    <div
                                        className={`max-w-xl mx-auto mb-10 transition-opacity duration-300 ${isFading ? "opacity-0" : "opacity-100"}`}
                                    >
                                        {isStreaming && !streamingContent ? (
                                            /* Sparkle loader while waiting for content */
                                            <div className="flex flex-col items-center justify-center min-h-[60px]">
                                                <Loader
                                                    size="small"
                                                    delay={0}
                                                />
                                            </div>
                                        ) : (
                                            <FloatingEntityMessage
                                                content={displayMessage}
                                                isVisible={!!displayMessage}
                                                isStreaming={isStreaming}
                                            />
                                        )}
                                    </div>

                                    {/* User input */}
                                    <div
                                        className={`w-full max-w-md mx-auto transition-opacity duration-300 ${isFading ? "opacity-0" : "opacity-100"}`}
                                    >
                                        <EtherealInput
                                            value={inputValue}
                                            onChange={setInputValue}
                                            onSubmit={() =>
                                                handleSendMessage(inputValue)
                                            }
                                            isVisible={showInput}
                                            isDisabled={
                                                isStreaming || !onboardingEntity
                                            }
                                            placeholder={t(
                                                "Type your response...",
                                            )}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Animations */}
            <style jsx global>{`
                @keyframes onboarding-fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .onboarding-fade-in {
                    animation: onboarding-fade-in 1s ease-out forwards;
                }
                @keyframes celebration-float {
                    0% {
                        opacity: 0;
                        transform: translateY(100px);
                    }
                    20% {
                        opacity: 1;
                    }
                    80% {
                        opacity: 1;
                    }
                    100% {
                        opacity: 0;
                        transform: translateY(-100vh);
                    }
                }
                .animate-celebration-float {
                    animation: celebration-float 4s ease-out forwards;
                }
                @keyframes sparkle-drift {
                    0%,
                    100% {
                        transform: translate(-50%, -50%) translate(0, 0);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    25% {
                        transform: translate(-50%, -50%)
                            translate(var(--drift-x1), var(--drift-y1));
                        opacity: 0.8;
                    }
                    40% {
                        opacity: 0;
                    }
                    50% {
                        transform: translate(-50%, -50%)
                            translate(var(--drift-x2), var(--drift-y2));
                        opacity: 0;
                    }
                    60% {
                        opacity: 1;
                    }
                    75% {
                        transform: translate(-50%, -50%)
                            translate(var(--drift-x3), var(--drift-y3));
                        opacity: 0.6;
                    }
                    90% {
                        opacity: 0;
                    }
                }
                .onboarding-sparkle-drift {
                    animation: sparkle-drift ease-in-out infinite;
                }
                @keyframes celebration-text-appear {
                    from {
                        opacity: 0;
                        transform: translateY(20px) scale(0.95);
                        filter: blur(4px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                        filter: blur(0);
                    }
                }
                .celebration-text-appear {
                    animation: celebration-text-appear 1.2s ease-out forwards;
                }
                @keyframes logo-heartbeat {
                    0%,
                    100% {
                        filter: drop-shadow(0 0 8px rgba(103, 232, 249, 0.3));
                    }
                    50% {
                        filter: drop-shadow(0 0 24px rgba(103, 232, 249, 0.8))
                            drop-shadow(0 0 48px rgba(103, 232, 249, 0.5));
                    }
                }
                .logo-heartbeat {
                    animation: logo-heartbeat 3s ease-in-out infinite;
                }

                /* Connecting screen animations */
                @keyframes orbit-spin {
                    from {
                        transform: translate(-50%, -50%)
                            rotate(var(--start-angle))
                            translateX(var(--orbit-radius))
                            rotate(calc(-1 * var(--start-angle)));
                    }
                    to {
                        transform: translate(-50%, -50%)
                            rotate(calc(var(--start-angle) + 360deg))
                            translateX(var(--orbit-radius))
                            rotate(calc(-1 * var(--start-angle) - 360deg));
                    }
                }
                @keyframes orbit-wobble {
                    0%,
                    100% {
                        margin-top: 0;
                    }
                    50% {
                        margin-top: var(--wobble);
                    }
                }
                @keyframes orbit-scatter {
                    to {
                        transform: translate(-50%, -50%)
                            rotate(var(--start-angle))
                            translateX(calc(var(--orbit-radius) * 3));
                        opacity: 0;
                    }
                }
                @keyframes ring-pulse {
                    0%,
                    100% {
                        transform: scale(1);
                        opacity: 0.3;
                    }
                    50% {
                        transform: scale(1.1);
                        opacity: 0.5;
                    }
                }
                @keyframes ring-burst {
                    to {
                        transform: scale(3);
                        opacity: 0;
                    }
                }
                @keyframes portal-breathe {
                    0%,
                    100% {
                        transform: scale(1);
                        opacity: 0.8;
                    }
                    50% {
                        transform: scale(1.05);
                        opacity: 1;
                    }
                }
                @keyframes portal-pulse {
                    0%,
                    100% {
                        opacity: 0.6;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.02);
                    }
                }
                @keyframes portal-spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
                @keyframes portal-spin-reverse {
                    from {
                        transform: rotate(360deg);
                    }
                    to {
                        transform: rotate(0deg);
                    }
                }
                @keyframes success-burst {
                    0% {
                        transform: scale(1);
                        opacity: 0.8;
                    }
                    100% {
                        transform: scale(2.5);
                        opacity: 0;
                    }
                }
                @keyframes emoji-float {
                    0%,
                    100% {
                        transform: translateY(0) scale(1);
                    }
                    50% {
                        transform: translateY(-5px) scale(1.05);
                    }
                }
                @keyframes gradient-shift {
                    0%,
                    100% {
                        background-position: 0% center;
                    }
                    50% {
                        background-position: 100% center;
                    }
                }
                @keyframes ambient-float {
                    0%,
                    100% {
                        transform: translateY(0) translateX(0);
                        opacity: 0;
                    }
                    25% {
                        opacity: 1;
                    }
                    50% {
                        transform: translateY(-30px) translateX(10px);
                        opacity: 0.5;
                    }
                    75% {
                        opacity: 1;
                    }
                }
                .avatar-summoning {
                    animation: avatar-pulse 2s ease-in-out infinite;
                }
                @keyframes avatar-pulse {
                    0%,
                    100% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.02);
                    }
                }
                .avatar-connected {
                    animation: avatar-success 0.6s ease-out forwards;
                }
                @keyframes avatar-success {
                    0% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.1);
                    }
                    100% {
                        transform: scale(1.05);
                    }
                }
                .avatar-image-reveal {
                    animation: avatar-emerge 1s ease-out forwards;
                }
                @keyframes avatar-emerge {
                    0% {
                        opacity: 0;
                        transform: scale(1.2);
                        filter: blur(10px) brightness(2);
                    }
                    50% {
                        opacity: 0.8;
                        filter: blur(2px) brightness(1.3);
                    }
                    100% {
                        opacity: 1;
                        transform: scale(1);
                        filter: blur(0) brightness(1);
                    }
                }
                .name-connected {
                    animation: name-glow 0.6s ease-out forwards;
                }
                @keyframes name-glow {
                    0% {
                        transform: scale(1);
                    }
                    50% {
                        transform: scale(1.05);
                    }
                    100% {
                        transform: scale(1);
                    }
                }
                .connecting-status-appear {
                    animation: connecting-status-appear 0.5s ease-out forwards;
                }
                @keyframes connecting-status-appear {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                /* Ethereal styling for onboarding message markdown */
                .onboarding-message-content {
                    text-shadow:
                        0 0 10px rgba(34, 211, 238, 0.5),
                        0 0 20px rgba(34, 211, 238, 0.4),
                        0 0 40px rgba(34, 211, 238, 0.25),
                        0 0 60px rgba(167, 139, 250, 0.2);
                }
                .onboarding-message-content .chat-message {
                    min-height: auto;
                    font-size: inherit;
                    line-height: inherit;
                }
                .onboarding-message-content .chat-message p,
                .onboarding-message-content .chat-message div,
                .onboarding-message-content .chat-message span,
                .onboarding-message-content .chat-message li {
                    font-size: inherit;
                    line-height: inherit;
                }
                .onboarding-message-content p,
                .onboarding-message-content div {
                    margin-bottom: 0.5rem;
                }
                .onboarding-message-content p:last-child,
                .onboarding-message-content div:last-child {
                    margin-bottom: 0;
                }
                .onboarding-message-content strong {
                    font-weight: 600;
                    color: #67e8f9;
                    text-shadow: 0 0 12px rgba(103, 232, 249, 0.6);
                }
                .onboarding-message-content em {
                    font-style: italic;
                    color: #c4b5fd;
                    text-shadow: 0 0 12px rgba(196, 181, 253, 0.5);
                }
                .onboarding-message-content ul,
                .onboarding-message-content ol {
                    text-align: left;
                    margin: 0.75rem 0;
                    padding-left: 1.5rem;
                }
                .onboarding-message-content li {
                    margin-bottom: 0.25rem;
                }
                .onboarding-message-content a {
                    color: #67e8f9;
                    text-decoration: underline;
                    text-underline-offset: 2px;
                    transition: color 0.2s;
                }
                .onboarding-message-content a:hover {
                    color: #a5f3fc;
                }
                .onboarding-message-content code {
                    padding: 0.125rem 0.375rem;
                    border-radius: 0.25rem;
                    background: rgba(51, 65, 85, 0.5);
                    color: #67e8f9;
                    font-family: monospace;
                    font-size: 0.875em;
                }
                .onboarding-message-content pre {
                    background: rgba(15, 23, 42, 0.6);
                    border-radius: 0.5rem;
                    padding: 1rem;
                    margin: 0.75rem 0;
                    overflow-x: auto;
                }
                .onboarding-message-content pre code {
                    background: none;
                    padding: 0;
                }
                /* Emotion display in onboarding */
                .onboarding-message-content .inline-emotion-display {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.125rem 0.5rem;
                    border-radius: 9999px;
                    background: rgba(103, 232, 249, 0.15);
                    border: 1px solid rgba(103, 232, 249, 0.3);
                    font-size: 0.875em;
                }
            `}</style>
        </div>
    );
}

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVoice } from '../../contexts/VoiceContext';

// Estimated characters per second for TTS speech
const CHARS_PER_SECOND = 14;

/**
 * FloatingTranscript - Ethereal floating transcript for voice mode
 *
 * Shows only entity/assistant transcripts (not user speech).
 * Features:
 * - Fixed height region with timed scroll synced to audio
 * - Ethereal glow styling
 * - Auto-hides after conversation goes quiet
 */
export function FloatingTranscript() {
    const { liveAssistantTranscript } = useVoice();

    const [buffer, setBuffer] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const [isFading, setIsFading] = useState(false);

    const scrollRef = useRef(null);
    const hideTimerRef = useRef(null);
    const animationRef = useRef(null);

    // Cancel any running scroll animation
    const cancelScrollAnimation = useCallback(() => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }
    }, []);

    // Animate scroll over estimated speaking duration
    const animateScroll = useCallback((text) => {
        cancelScrollAnimation();

        // Wait a frame for DOM to update with new text
        requestAnimationFrame(() => {
            const container = scrollRef.current;
            if (!container) return;

            const scrollHeight = container.scrollHeight;
            const clientHeight = container.clientHeight;
            const maxScroll = scrollHeight - clientHeight;

            // No need to scroll if content fits
            if (maxScroll <= 0) return;

            // Reset to top
            container.scrollTop = 0;

            // Estimate duration based on text length
            const durationMs = (text.length / CHARS_PER_SECOND) * 1000;
            // Don't start scrolling immediately - wait for first ~20% of speech
            const delayMs = durationMs * 0.2;
            // Scroll over remaining 70% (leave 10% buffer at end)
            const scrollDurationMs = durationMs * 0.7;

            const startTime = performance.now() + delayMs;

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;

                if (elapsed < 0) {
                    // Still in delay period
                    animationRef.current = requestAnimationFrame(animate);
                    return;
                }

                const progress = Math.min(elapsed / scrollDurationMs, 1);
                // Ease-in-out for natural feel
                const eased = progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;

                container.scrollTop = eased * maxScroll;

                if (progress < 1) {
                    animationRef.current = requestAnimationFrame(animate);
                }
            };

            animationRef.current = requestAnimationFrame(animate);
        });
    }, [cancelScrollAnimation]);

    // Clear hide timer
    const clearHideTimer = useCallback(() => {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }, []);

    // Schedule hide with fade
    const scheduleHide = useCallback((delay = 3000) => {
        clearHideTimer();
        hideTimerRef.current = setTimeout(() => {
            setIsFading(true);
            setTimeout(() => {
                setIsVisible(false);
                setIsFading(false);
                setBuffer('');
            }, 400);
        }, delay);
    }, [clearHideTimer]);

    // Handle live assistant transcript
    useEffect(() => {
        if (liveAssistantTranscript?.trim()) {
            clearHideTimer();
            cancelScrollAnimation();
            const text = liveAssistantTranscript.trim();
            setBuffer(text);
            setIsVisible(true);
            setIsFading(false);
            // Reset scroll to top and start timed animation
            if (scrollRef.current) {
                scrollRef.current.scrollTop = 0;
            }
            animateScroll(text);
        } else if (buffer && !liveAssistantTranscript) {
            // Transcript cleared - cancel scroll and schedule hide
            // Use longer delay for short texts that don't scroll (give time to read)
            cancelScrollAnimation();
            const estimatedReadTime = (buffer.length / CHARS_PER_SECOND) * 1000;
            const hideDelay = Math.max(estimatedReadTime, 3000);
            scheduleHide(hideDelay);
        }
    }, [liveAssistantTranscript, buffer, clearHideTimer, scheduleHide, cancelScrollAnimation, animateScroll]);

    // Cleanup
    useEffect(() => {
        return () => {
            clearHideTimer();
            cancelScrollAnimation();
        };
    }, [clearHideTimer, cancelScrollAnimation]);

    return (
        <div className="h-32 sm:h-20 md:h-20 w-full flex items-end justify-center px-4 overflow-hidden">
            <div
                className={`
                    floating-transcript-wrapper
                    w-full max-w-2xl
                    transition-all duration-300 ease-out
                    ${!isVisible ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
                    ${isFading ? 'opacity-0 scale-98' : ''}
                `}
            >
                {/* Content area - scrolls in sync with audio */}
                <div
                    ref={scrollRef}
                    className="relative max-h-28 sm:max-h-16 md:max-h-16 overflow-y-auto overflow-x-hidden scrollbar-hide text-center px-2 floating-transcript-assistant"
                    style={{
                        maskImage: 'linear-gradient(to bottom, black 0%, black 85%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 85%, transparent 100%)'
                    }}
                >
                    <p
                        className="text-base sm:text-lg md:text-xl font-light leading-relaxed text-slate-200 py-4"
                        style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}
                    >
                        {buffer}
                    </p>
                </div>
            </div>

            <style jsx global>{`
                .floating-transcript-wrapper {
                    position: relative;
                }

                .floating-transcript-assistant {
                    text-shadow:
                        0 0 10px rgba(34, 211, 238, 0.5),
                        0 0 20px rgba(34, 211, 238, 0.4),
                        0 0 40px rgba(34, 211, 238, 0.25),
                        0 0 60px rgba(167, 139, 250, 0.2);
                }

                .scale-98 {
                    transform: scale(0.98);
                }

                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}

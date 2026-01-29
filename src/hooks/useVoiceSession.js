"use client";

import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useVoice } from "../contexts/VoiceContext";
import { useEntityOverlay } from "../contexts/EntityOverlayContext";
import { useChatEntity } from "../contexts/ChatEntityContext";
import { WavStreamPlayer } from "../lib/audio";
import { SoundEffects } from "../lib/audio/SoundEffects";
import { composeUserDateTimeInfo } from "../utils/datetimeUtils";

const VOICE_SAMPLE_RATE = 24000; // Voice providers output 24kHz PCM

/**
 * Hook that manages the voice session connection and audio handling
 * Uses Silero VAD for accurate voice activity detection
 */
export function useVoiceSession() {
    const voice = useVoice();
    const { showOverlay } = useEntityOverlay();
    const { entity } = useChatEntity();

    // Use ref to access entity in callbacks without causing re-renders
    const entityRef = useRef(entity);
    entityRef.current = entity;

    const socketRef = useRef(null);
    const vadRef = useRef(null);
    const playerRef = useRef(null);
    const streamRef = useRef(null);
    const isInitializedRef = useRef(false);
    const wasConnectedRef = useRef(false); // Track if we ever successfully connected (for disconnect sound)

    // Transcript queue for syncing display with audio playback
    const transcriptQueueRef = useRef([]); // Array of { trackId, text }
    const currentDisplayedTrackRef = useRef(null);

    // === Interrupt State Machine ===
    // We track two things:
    // 1. Is the user currently speaking? (gates audio while speaking)
    // 2. Did we interrupt and are waiting for a new response? (gates stale audio)
    const userIsSpeakingRef = useRef(false); // true between speechStart and speechEnd/misfire
    const awaitingNewResponseRef = useRef(false); // true after interrupt until new response starts
    const awaitingTimeoutRef = useRef(null); // safety timeout to clear awaitingNewResponse
    const lastAiActivityRef = useRef(0); // timestamp for grace period during state bounces
    const shouldInterruptOnConfirmRef = useRef(false); // true if we should interrupt when speech is confirmed
    const serverConfirmedSpeechRef = useRef(false); // true when server detected speech (audio:stop) but VAD hasn't confirmed yet
    const clientAudioPlayingRef = useRef(false); // true when client is playing audio (for filler suppression)
    const speechTimeoutRef = useRef(null); // fallback timeout when VAD fails to detect speech end
    const speechEndDelayRef = useRef(null); // the 150ms delay before processing speech end
    const lastAudioFrameTimeRef = useRef(0); // track when we last sent audio
    const micAudioContextRef = useRef(null);
    const isMutedRef = useRef(false);

    const {
        isActive,
        entityId,
        chatId,
        sessionContext,
        isMuted,
        endSession,
        _setIsConnected,
        _setState,
        _setLiveUserTranscript,
        _setLiveAssistantTranscript,
        _addToHistory,
        _setCurrentTool,
        _setInputLevel,
        _setOutputLevel,
        _setAudioContext,
        _setSourceNode,
        _setAnalyserNode,
        _setSessionId,
        _registerCleanup,
    } = voice;

    useEffect(() => {
        isMutedRef.current = isMuted;
    }, [isMuted]);

    /**
     * Set awaitingNewResponse with a safety timeout.
     * If the flag isn't cleared by normal means (trackStart, state:change)
     * within the timeout, force-clear it to prevent permanent audio block.
     */
    const setAwaitingNewResponse = useCallback((value) => {
        awaitingNewResponseRef.current = value;
        if (awaitingTimeoutRef.current) {
            clearTimeout(awaitingTimeoutRef.current);
            awaitingTimeoutRef.current = null;
        }
        if (value) {
            awaitingTimeoutRef.current = setTimeout(() => {
                if (awaitingNewResponseRef.current) {
                    console.warn(
                        "[useVoiceSession] awaitingNewResponse safety timeout - force clearing",
                    );
                    awaitingNewResponseRef.current = false;
                    if (playerRef.current) {
                        playerRef.current.interruptedTrackIds = {};
                    }
                }
                awaitingTimeoutRef.current = null;
            }, 5000);
        }
    }, []);

    /**
     * Convert Float32Array to base64 PCM16 string
     */
    const float32ToBase64PCM16 = useCallback((float32Array) => {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        const bytes = new Uint8Array(int16Array.buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }, []);

    /**
     * Convert base64 string to Int16Array
     */
    const base64ToInt16Array = useCallback((base64) => {
        const binary = atob(base64);
        const length = binary.length - (binary.length % 2);
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Int16Array(bytes.buffer);
    }, []);

    /**
     * Initialize audio components with Silero VAD
     */
    const initializeAudio = useCallback(async () => {
        console.log("[useVoiceSession] Initializing audio with Silero VAD...");

        // Create player for AI audio output
        const player = new WavStreamPlayer({
            sampleRate: VOICE_SAMPLE_RATE,
            minBufferSize: 10,
        });
        playerRef.current = player;
        await player.connect();

        if (player.analyser) {
            _setAnalyserNode(player.analyser);
        }

        // Set up track complete callback
        // Update lastAiActivity when local audio finishes (server state may already be idle)
        player.setTrackCompleteCallback((trackId) => {
            console.log("[useVoiceSession] Track complete:", trackId);
            lastAiActivityRef.current = Date.now();

            // Notify server that this track finished playing
            // This allows proper pacing between audio chunks
            socketRef.current?.emit("audio:trackPlaybackComplete", { trackId });

            // Advance transcript to next queued item when current track finishes
            if (transcriptQueueRef.current.length > 0) {
                const next = transcriptQueueRef.current.shift();
                currentDisplayedTrackRef.current = next.trackId;
                _setLiveAssistantTranscript(next.text);
                console.log(
                    "[useVoiceSession] Advanced transcript to:",
                    next.trackId,
                );
            } else {
                // No more queued - clear the current track marker
                currentDisplayedTrackRef.current = null;
            }

            // Notify server that client audio stopped (for filler suppression)
            if (clientAudioPlayingRef.current) {
                clientAudioPlayingRef.current = false;
                socketRef.current?.emit("audio:clientStopped");
            }
        });

        // Load ONNX runtime first (required by vad-bundle which uses window.ort)
        if (!window.ort) {
            console.log("[useVoiceSession] Loading ONNX runtime...");
            await new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "/vad/ort.min.js";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            console.log(
                "[useVoiceSession] ONNX runtime loaded, window.ort:",
                !!window.ort,
            );
        }

        // Load vad-web bundle (uses window.ort from above)
        if (!window.vad) {
            console.log("[useVoiceSession] Loading vad-web bundle...");
            await new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "/vad/vad-bundle.min.js";
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            console.log("[useVoiceSession] vad-web bundle loaded");
        }

        const MicVAD = window.vad?.MicVAD;
        if (!MicVAD) {
            throw new Error("MicVAD not found on window.vad after bundle load");
        }

        // Get user media stream with echo cancellation
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 16000, // VAD expects 16kHz
            },
        });

        console.log("[useVoiceSession] Creating Silero VAD...");

        // Helper to handle speech end (called by VAD or fallback timeout)
        const handleSpeechEnd = (source) => {
            // Clear all pending timeouts
            if (speechTimeoutRef.current) {
                clearTimeout(speechTimeoutRef.current);
                speechTimeoutRef.current = null;
            }
            if (speechEndDelayRef.current) {
                clearTimeout(speechEndDelayRef.current);
                speechEndDelayRef.current = null;
            }

            // Skip if not currently speaking (prevents duplicate processing)
            if (!userIsSpeakingRef.current) return;

            console.log(`[VAD] Speech ended (${source})`);
            userIsSpeakingRef.current = false;
            serverConfirmedSpeechRef.current = false;

            // If we were waiting to interrupt, do it now - this is confirmed real speech
            if (shouldInterruptOnConfirmRef.current) {
                console.log("[VAD] Confirmed speech - executing interrupt");
                shouldInterruptOnConfirmRef.current = false;
                // Stop local audio
                if (playerRef.current) {
                    playerRef.current.interrupt();
                }
                // Notify server that client audio stopped
                if (clientAudioPlayingRef.current) {
                    clientAudioPlayingRef.current = false;
                    socketRef.current?.emit("audio:clientStopped");
                }
                // Block all audio until we get a fresh response
                setAwaitingNewResponse(true);
            } else {
                // Wasn't an interrupt situation, make sure volume is normal
                playerRef.current?.unduck();
            }

            // Notify server to finalize transcript and process
            socketRef.current?.emit("audio:speechEnd");
            socketRef.current?.emit("audio:commit"); // Explicit signal to finalize STT and send to AI
            _setState("idle");
        };

        // Start fallback timeout for speech end detection
        const startSpeechTimeout = () => {
            if (speechTimeoutRef.current) {
                clearTimeout(speechTimeoutRef.current);
            }
            // 3 second timeout - if VAD doesn't detect end, force it
            speechTimeoutRef.current = setTimeout(() => {
                if (userIsSpeakingRef.current) {
                    console.log("[VAD] Fallback timeout - forcing speech end");
                    handleSpeechEnd("timeout");
                }
            }, 3000);
        };

        // Create Silero VAD for microphone with echo cancellation
        const vad = await MicVAD.new({
            // Path to asset files - library constructs full paths from these
            baseAssetPath: "/vad/",
            onnxWASMBasePath: "/vad/",

            // Use v5 model (or 'legacy' for older model)
            model: "v5",

            // Configure ONNX runtime
            ortConfig: (ort) => {
                ort.env.wasm.numThreads = 1;
                console.log("[useVoiceSession] ONNX configured: numThreads=1");
            },

            // Don't start automatically - we'll start after socket connection
            startOnLoad: false,

            // VAD parameters
            positiveSpeechThreshold: 0.5, // Confidence threshold for speech
            negativeSpeechThreshold: 0.35, // Confidence threshold for silence
            minSpeechFrames: 3, // Min frames before speech is confirmed
            redemptionFrames: 8, // Frames of silence before speech ends
            preSpeechPadFrames: 3, // Frames to include before speech start

            // Custom stream getter with echo cancellation
            getStream: async () => stream,

            // Callbacks
            onSpeechStart: () => {
                // Ignore if no active session
                if (!socketRef.current?.connected) return;

                console.log("[VAD] Speech started");
                _setState("userSpeaking");
                userIsSpeakingRef.current = true;
                lastAudioFrameTimeRef.current = Date.now();

                // Notify server that speech started
                socketRef.current?.emit("audio:speechStart");

                // Clear assistant transcript when user starts speaking
                _setLiveAssistantTranscript("");
                transcriptQueueRef.current = [];
                currentDisplayedTrackRef.current = null;

                // Start fallback timeout
                startSpeechTimeout();

                // Should we interrupt? Check if:
                // 1. AI was recently active (within grace period), OR
                // 2. Player is actively streaming audio
                const timeSinceAi = Date.now() - lastAiActivityRef.current;
                const aiRecentlyActive =
                    lastAiActivityRef.current > 0 && timeSinceAi < 3000; // 3 second grace
                const playerIsStreaming = playerRef.current?.stream != null;

                console.log("[VAD] Interrupt check:", {
                    timeSinceAi,
                    aiRecentlyActive,
                    playerIsStreaming,
                });

                if (aiRecentlyActive || playerIsStreaming) {
                    // Don't interrupt yet - wait for confirmed speech (speechEnd)
                    // This prevents echo-triggered false interrupts
                    console.log(
                        "[VAD] Marking for interrupt on confirmation, ducking audio",
                    );
                    shouldInterruptOnConfirmRef.current = true;
                    // Duck the audio so user's voice is easier to pick up
                    playerRef.current?.duck();
                } else {
                    shouldInterruptOnConfirmRef.current = false;
                }
            },

            onSpeechEnd: () => {
                // Ignore if no active session
                if (!socketRef.current?.connected) return;

                // Clear fallback timeout immediately when VAD detects speech end
                if (speechTimeoutRef.current) {
                    clearTimeout(speechTimeoutRef.current);
                    speechTimeoutRef.current = null;
                }

                // Clear any pending speech end delay to prevent duplicates
                if (speechEndDelayRef.current) {
                    clearTimeout(speechEndDelayRef.current);
                }

                // Small delay to ensure all pending audio frames are sent before signaling end
                speechEndDelayRef.current = setTimeout(() => {
                    speechEndDelayRef.current = null;
                    handleSpeechEnd("VAD");
                }, 150);
            },

            onFrameProcessed: (probabilities, audioFrame) => {
                // Ignore if no active session
                if (!socketRef.current?.connected) return;

                // Update input level for visualizer
                const level = probabilities.isSpeech;
                _setInputLevel(level);

                // Stream audio to server (unless muted)
                if (!isMutedRef.current) {
                    const base64Audio = float32ToBase64PCM16(audioFrame);
                    socketRef.current.emit("audio:input", {
                        data: base64Audio,
                        sampleRate: 16000,
                    });

                    // Reset speech timeout while actively sending audio with speech detected
                    if (
                        userIsSpeakingRef.current &&
                        probabilities.isSpeech > 0.3
                    ) {
                        lastAudioFrameTimeRef.current = Date.now();
                        startSpeechTimeout();
                    }
                }
            },

            onVADMisfire: () => {
                // Ignore if no active session
                if (!socketRef.current?.connected) return;

                console.log("[VAD] Misfire");

                // If the server already confirmed speech (via audio:stop),
                // the VAD is wrong — user IS speaking. Keep userIsSpeaking
                // true and restart the speech timeout so speechEnd fires later.
                if (serverConfirmedSpeechRef.current) {
                    console.log(
                        "[VAD] Misfire ignored - server confirmed speech, keeping userIsSpeaking",
                    );
                    serverConfirmedSpeechRef.current = false;
                    // Restart speech timeout as fallback for detecting end of speech
                    startSpeechTimeout();
                    return;
                }

                // Clear fallback timeout
                if (speechTimeoutRef.current) {
                    clearTimeout(speechTimeoutRef.current);
                    speechTimeoutRef.current = null;
                }
                userIsSpeakingRef.current = false;
                // Cancel pending interrupt - this was a false positive (likely echo)
                if (shouldInterruptOnConfirmRef.current) {
                    console.log(
                        "[VAD] Misfire - cancelling pending interrupt, restoring volume",
                    );
                    shouldInterruptOnConfirmRef.current = false;
                    playerRef.current?.unduck();
                }
                // If we set awaitingNewResponse, clear it
                if (awaitingNewResponseRef.current) {
                    console.log("[VAD] Misfire - clearing await flag");
                    setAwaitingNewResponse(false);
                }
                _setState("idle");
            },
        });

        vadRef.current = vad;
        streamRef.current = stream;

        // Set audio context for visualizers using our stream
        const audioContext = new AudioContext();
        micAudioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        _setAudioContext(audioContext);
        _setSourceNode(source);

        console.log("[useVoiceSession] Silero VAD initialized");
        return { vad, player };
    }, [
        _setAudioContext,
        _setSourceNode,
        _setAnalyserNode,
        _setState,
        _setInputLevel,
        _setLiveAssistantTranscript,
        float32ToBase64PCM16,
    ]);

    /**
     * Connect to voice server
     */
    const connectToServer = useCallback(
        async (voiceServerUrl, authToken) => {
            console.log(
                "[useVoiceSession] Connecting to voice server:",
                voiceServerUrl,
            );

            const socket = io(voiceServerUrl, {
                transports: ["websocket"],
                query: {
                    entityId,
                    chatId,
                },
                auth: {
                    token: authToken,
                },
                // Disable auto-reconnection - we manage connection lifecycle explicitly
                reconnection: false,
            });

            socketRef.current = socket;

            // Connection events
            socket.on("connect", () => {
                console.log("[useVoiceSession] Connected to voice server");
                const currentEntity = entityRef.current;
                console.log(
                    "[useVoiceSession] Entity voice config:",
                    currentEntity?.voice,
                );

                // Build voice settings from entity's voice configuration
                const voiceSettings = currentEntity?.voice?.settings
                    ? {
                          stability: currentEntity.voice.settings.stability,
                          similarity: currentEntity.voice.settings.similarity,
                          style: currentEntity.voice.settings.style,
                          speakerBoost:
                              currentEntity.voice.settings.speakerBoost,
                      }
                    : undefined;

                socket.emit("session:start", {
                    entityId,
                    chatId,
                    // Use entity's voice configuration if available, otherwise default
                    voiceId:
                        currentEntity?.voice?.voiceId || "tnSpp4vdxKPjI9w0GnoV",
                    voiceSettings,
                    userId: sessionContext?.userId,
                    contextId: sessionContext?.contextId || entityId,
                    contextKey: sessionContext?.contextKey,
                    aiName: sessionContext?.aiName,
                    userName: sessionContext?.userName,
                    model: sessionContext?.model,
                    userInfo: composeUserDateTimeInfo(),
                });
            });

            socket.on("disconnect", (reason) => {
                console.log(
                    "[useVoiceSession] Disconnected from voice server:",
                    reason,
                );
                _setIsConnected(false);
                _setState("idle");
            });

            socket.on("connect_error", (error) => {
                console.error("[useVoiceSession] Connection error:", error);
                _setIsConnected(false);
            });

            // Session events
            socket.on("session:started", (data) => {
                console.log("[useVoiceSession] Session started:", data);
                _setSessionId(data.sessionId);
                _setIsConnected(true);
                // Start the VAD
                vadRef.current?.start();
                // Mark as connected and play sound only after VAD is ready
                wasConnectedRef.current = true;
                SoundEffects.playConnect();
            });

            socket.on("session:error", (data) => {
                console.error("[useVoiceSession] Session error:", data);
                _setIsConnected(false);
            });

            socket.on("session:ended", (data) => {
                console.log("[useVoiceSession] Session ended:", data);
                _setIsConnected(false);
            });

            socket.on("provider:connected", () => {
                console.log("[useVoiceSession] Provider connected");
            });

            // State events
            socket.on("state:change", (data) => {
                if (!data || typeof data.state !== "string") return;
                const state = data.state;
                console.log("[useVoiceSession] State change:", state);
                const stateMap = {
                    idle: "idle",
                    listening: "userSpeaking",
                    processing: "aiResponding",
                    speaking: "audioPlaying",
                };
                const newState = stateMap[state] || state;
                _setState(newState);

                // Track AI activity for interrupt grace period
                if (state === "speaking" || state === "processing") {
                    lastAiActivityRef.current = Date.now();
                }

                // When server starts speaking and user is done, allow audio
                if (
                    state === "speaking" &&
                    awaitingNewResponseRef.current &&
                    !userIsSpeakingRef.current
                ) {
                    console.log(
                        "[state:change] New response starting, clearing await flag",
                    );
                    setAwaitingNewResponse(false);
                    // Ensure volume is restored for new response
                    playerRef.current?.unduck();
                    // Clear interrupted track states
                    if (playerRef.current) {
                        playerRef.current.interruptedTrackIds = {};
                    }
                }

                // Don't reset lastAiActivity on idle - let it age naturally
                // Server may say idle before local audio finishes playing
            });

            // Transcript events
            socket.on("transcript", (data) => {
                if (!data || typeof data.content !== "string") return;
                console.log("[useVoiceSession] Transcript:", data);
                if (data.type === "user") {
                    _setLiveUserTranscript(data.content || "");
                    if (data.isFinal && data.content) {
                        _addToHistory("user", data.content);
                        _setLiveUserTranscript("");
                    }
                } else if (data.type === "assistant") {
                    _setLiveAssistantTranscript(data.content || "");
                    if (data.isFinal && data.content) {
                        _addToHistory("assistant", data.content);
                        _setLiveAssistantTranscript("");
                    }
                }
            });

            // Audio events
            socket.on("audio:output", (data) => {
                if (!data || typeof data.data !== "string") return;
                if (data.data && playerRef.current) {
                    // Block audio if:
                    // 1. User is currently speaking, OR
                    // 2. We're awaiting a new response after an interrupt
                    if (
                        userIsSpeakingRef.current ||
                        awaitingNewResponseRef.current
                    ) {
                        return;
                    }

                    const trackId = data.trackId || "default";

                    // Don't play if this track was interrupted
                    if (playerRef.current.interruptedTrackIds?.[trackId]) {
                        return;
                    }

                    // Ensure volume is normal when playing audio
                    playerRef.current.unduck();

                    // Track AI activity
                    lastAiActivityRef.current = Date.now();

                    // Notify server that client is playing audio (for filler suppression)
                    if (!clientAudioPlayingRef.current) {
                        clientAudioPlayingRef.current = true;
                        socketRef.current?.emit("audio:clientPlaying");
                    }

                    const pcmData = base64ToInt16Array(data.data);
                    playerRef.current.add16BitPCM(pcmData, trackId);
                    _setState("audioPlaying");
                }
            });

            socket.on("audio:muted", (muted) => {
                console.log("[useVoiceSession] Mute state:", muted);
            });

            // Track start - queue transcript for display when audio plays
            socket.on("audio:trackStart", (data) => {
                // A new track means fresh audio - clear interrupt gate
                if (awaitingNewResponseRef.current) {
                    setAwaitingNewResponse(false);
                    if (playerRef.current) {
                        playerRef.current.unduck();
                        playerRef.current.interruptedTrackIds = {};
                    }
                }

                if (data.text && data.trackId) {
                    // If nothing is currently playing, display immediately (first chunk)
                    if (
                        !currentDisplayedTrackRef.current &&
                        transcriptQueueRef.current.length === 0
                    ) {
                        currentDisplayedTrackRef.current = data.trackId;
                        _setLiveAssistantTranscript(data.text);
                        console.log(
                            "[useVoiceSession] Displaying first transcript:",
                            data.trackId,
                        );
                    } else {
                        // Queue for display when current track finishes
                        transcriptQueueRef.current.push({
                            trackId: data.trackId,
                            text: data.text,
                        });
                        console.log(
                            "[useVoiceSession] Queued transcript:",
                            data.trackId,
                            "queue length:",
                            transcriptQueueRef.current.length,
                        );
                    }
                }
            });

            // Track complete - flush any remaining audio buffer
            socket.on("audio:trackComplete", (data) => {
                if (data.trackId && playerRef.current) {
                    playerRef.current.flushTrack(data.trackId);
                }
            });

            // Stop audio playback (server-initiated interruption)
            socket.on("audio:stop", async () => {
                console.log("[useVoiceSession] Server requested audio stop");
                if (playerRef.current) {
                    await playerRef.current.interrupt();
                }
                // If interrupt was pending VAD confirmation, the server's STT
                // has already confirmed real speech. Mark this so the misfire
                // handler doesn't incorrectly reset userIsSpeaking.
                if (shouldInterruptOnConfirmRef.current) {
                    console.log(
                        "[useVoiceSession] Server confirmed speech - overriding VAD",
                    );
                    shouldInterruptOnConfirmRef.current = false;
                    serverConfirmedSpeechRef.current = true;
                    setAwaitingNewResponse(true);
                }
                _setState("idle");
            });

            // Tool events
            socket.on("tool:status", (data) => {
                console.log("[useVoiceSession] Tool status:", data);
                if (data.status === "completed") {
                    _setCurrentTool(null);
                } else if (data.status === "error") {
                    _setCurrentTool({
                        name: data.name,
                        status: "error",
                        message: data.message || "Tool execution failed",
                    });
                    setTimeout(() => _setCurrentTool(null), 3000);
                } else {
                    _setCurrentTool({
                        name: data.name,
                        status: data.status,
                        message: data.message || `Running ${data.name}...`,
                    });
                }
            });

            // Media events (for EntityOverlay integration)
            socket.on("media", (data) => {
                if (!data || !Array.isArray(data.items)) return;
                console.log("[useVoiceSession] Media event:", data);
                showOverlay({
                    items: data.items || data.files,
                    entityId: entityId,
                });
            });

            // Error events
            socket.on("error", (data) => {
                console.error("[useVoiceSession] Server error:", data);
            });

            return socket;
        },
        [
            entityId,
            chatId,
            sessionContext,
            base64ToInt16Array,
            _setIsConnected,
            _setState,
            _setSessionId,
            _setLiveUserTranscript,
            _setLiveAssistantTranscript,
            _addToHistory,
            _setCurrentTool,
            showOverlay,
        ],
    );

    /**
     * Cleanup function
     */
    const cleanup = useCallback(async () => {
        console.log("[useVoiceSession] Cleaning up...");

        // Stop VAD
        if (vadRef.current) {
            try {
                vadRef.current.pause();
                vadRef.current.destroy();
            } catch (e) {
                console.warn("[useVoiceSession] Error stopping VAD:", e);
            }
            vadRef.current = null;
        }

        // Stop media stream tracks
        if (streamRef.current) {
            try {
                streamRef.current.getTracks().forEach((track) => track.stop());
            } catch (e) {
                console.warn(
                    "[useVoiceSession] Error stopping media tracks:",
                    e,
                );
            }
            streamRef.current = null;
        }

        // Close AudioContexts
        if (micAudioContextRef.current) {
            try {
                micAudioContextRef.current.close();
            } catch (e) {
                // Ignore close errors
            }
            micAudioContextRef.current = null;
        }
        if (playerRef.current?.context) {
            try {
                playerRef.current.context.close();
            } catch (e) {
                // Ignore close errors
            }
        }

        // Stop player
        if (playerRef.current) {
            try {
                await playerRef.current.interrupt();
            } catch (e) {
                console.warn("[useVoiceSession] Error stopping player:", e);
            }
            playerRef.current = null;
        }

        // Disconnect socket
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        // Clear speech timeouts
        if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current);
            speechTimeoutRef.current = null;
        }
        if (speechEndDelayRef.current) {
            clearTimeout(speechEndDelayRef.current);
            speechEndDelayRef.current = null;
        }

        isInitializedRef.current = false;
        userIsSpeakingRef.current = false;
        setAwaitingNewResponse(false);
        shouldInterruptOnConfirmRef.current = false;
        serverConfirmedSpeechRef.current = false;
        clientAudioPlayingRef.current = false;
        lastAiActivityRef.current = 0;
        lastAudioFrameTimeRef.current = 0;
        transcriptQueueRef.current = [];
        currentDisplayedTrackRef.current = null;
        // Only play disconnect sound if we actually connected
        if (wasConnectedRef.current) {
            SoundEffects.playDisconnect();
            wasConnectedRef.current = false;
        }
        console.log("[useVoiceSession] Cleanup complete");
    }, []);

    /**
     * Initialize session when voice becomes active, cleanup when inactive
     */
    useEffect(() => {
        // Clean up when session becomes inactive
        if (!isActive) {
            if (isInitializedRef.current) {
                cleanup();
            }
            return;
        }

        // Already initialized, skip
        if (isInitializedRef.current) return;

        const init = async () => {
            try {
                isInitializedRef.current = true;

                // Get voice server URL from config
                const configResponse = await fetch("/api/voice/config");
                if (!configResponse.ok) {
                    throw new Error("Failed to fetch voice config");
                }
                const config = await configResponse.json();

                // Sanitize URL - trim whitespace that can cause socket.io namespace issues
                const voiceServerUrl = config.voiceServerUrl?.trim();

                if (!voiceServerUrl) {
                    throw new Error("Voice server URL not configured");
                }

                // Validate URL format
                try {
                    new URL(voiceServerUrl);
                } catch {
                    throw new Error(
                        `Invalid voice server URL: "${voiceServerUrl}"`,
                    );
                }

                // Get auth token for voice server
                const tokenResponse = await fetch("/api/voice/token", {
                    method: "POST",
                });
                if (!tokenResponse.ok) {
                    throw new Error("Failed to get voice auth token");
                }
                const { token: voiceToken } = await tokenResponse.json();

                // Initialize audio with VAD
                await initializeAudio();

                // Connect to server
                await connectToServer(voiceServerUrl, voiceToken);

                // Register cleanup
                _registerCleanup(cleanup);
            } catch (error) {
                console.error("[useVoiceSession] Initialization error:", error);
                isInitializedRef.current = false;
                endSession();
            }
        };

        init();
    }, [
        isActive,
        initializeAudio,
        connectToServer,
        cleanup,
        _registerCleanup,
        endSession,
    ]);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    /**
     * Handle mute state changes
     */
    useEffect(() => {
        if (!isActive || !vadRef.current) return;

        if (isMuted) {
            vadRef.current.pause();
        } else {
            vadRef.current.start();
        }
    }, [isActive, isMuted]);

    /**
     * Update output level from player
     */
    useEffect(() => {
        if (!isActive || !playerRef.current?.analyser) return;

        const updateOutputLevel = () => {
            if (!playerRef.current?.analyser) return;

            try {
                const frequencies = playerRef.current.getFrequencies("voice");
                const avgLevel =
                    frequencies.values.reduce((a, b) => a + b, 0) /
                    frequencies.values.length;
                _setOutputLevel(avgLevel);
            } catch (e) {
                // Ignore errors when session is ending
            }
        };

        const intervalId = setInterval(updateOutputLevel, 50);
        return () => clearInterval(intervalId);
    }, [isActive, _setOutputLevel]);

    return {
        // Expose refs for direct access if needed
        socket: socketRef.current,
        vad: vadRef.current,
        player: playerRef.current,

        // Manual controls
        sendMessage: useCallback((text) => {
            socketRef.current?.emit("text:input", text);
        }, []),

        cancelResponse: useCallback(() => {
            socketRef.current?.emit("audio:interrupt");
            if (playerRef.current) {
                playerRef.current.interrupt();
            }
        }, []),
    };
}

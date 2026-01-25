"use client";

import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useVoice } from '../contexts/VoiceContext';
import { useEntityOverlay } from '../contexts/EntityOverlayContext';
import { WavStreamPlayer } from '../lib/audio';
import { composeUserDateTimeInfo } from '../utils/datetimeUtils';

const VOICE_SAMPLE_RATE = 24000; // Voice providers output 24kHz PCM

/**
 * Hook that manages the voice session connection and audio handling
 * Uses Silero VAD for accurate voice activity detection
 */
export function useVoiceSession() {
    const voice = useVoice();
    const { showOverlay } = useEntityOverlay();

    const socketRef = useRef(null);
    const vadRef = useRef(null);
    const playerRef = useRef(null);
    const streamRef = useRef(null);
    const isInitializedRef = useRef(false);
    const isAiSpeakingRef = useRef(false);

    const {
        isActive,
        entityId,
        chatId,
        sessionContext,
        isMuted,
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

    /**
     * Convert Float32Array to base64 PCM16 string
     */
    const float32ToBase64PCM16 = useCallback((float32Array) => {
        const int16Array = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const bytes = new Uint8Array(int16Array.buffer);
        let binary = '';
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
        console.log('[useVoiceSession] Initializing audio with Silero VAD...');

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
        player.setTrackCompleteCallback((trackId) => {
            console.log('[useVoiceSession] Track complete:', trackId);
            isAiSpeakingRef.current = false;
            _setState('idle');
        });

        // Load ONNX runtime first (required by vad-bundle which uses window.ort)
        if (!window.ort) {
            console.log('[useVoiceSession] Loading ONNX runtime...');
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = '/vad/ort.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            console.log('[useVoiceSession] ONNX runtime loaded, window.ort:', !!window.ort);
        }

        // Load vad-web bundle (uses window.ort from above)
        if (!window.vad) {
            console.log('[useVoiceSession] Loading vad-web bundle...');
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = '/vad/vad-bundle.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
            console.log('[useVoiceSession] vad-web bundle loaded');
        }

        const MicVAD = window.vad?.MicVAD;
        if (!MicVAD) {
            throw new Error('MicVAD not found on window.vad after bundle load');
        }

        // Get user media stream with echo cancellation
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 16000, // VAD expects 16kHz
            }
        });

        console.log('[useVoiceSession] Creating Silero VAD...');
        // Create Silero VAD for microphone with echo cancellation
        const vad = await MicVAD.new({
            // Path to asset files - library constructs full paths from these
            baseAssetPath: '/vad/',
            onnxWASMBasePath: '/vad/',

            // Use v5 model (or 'legacy' for older model)
            model: 'v5',

            // Configure ONNX runtime
            ortConfig: (ort) => {
                ort.env.wasm.numThreads = 1;
                console.log('[useVoiceSession] ONNX configured: numThreads=1');
            },

            // Don't start automatically - we'll start after socket connection
            startOnLoad: false,

            // VAD parameters
            positiveSpeechThreshold: 0.5,  // Confidence threshold for speech
            negativeSpeechThreshold: 0.35, // Confidence threshold for silence
            minSpeechFrames: 3,            // Min frames before speech is confirmed
            redemptionFrames: 8,           // Frames of silence before speech ends
            preSpeechPadFrames: 3,         // Frames to include before speech start

            // Custom stream getter with echo cancellation
            getStream: async () => stream,

            // Callbacks
            onSpeechStart: () => {
                console.log('[VAD] Speech started');
                _setState('userSpeaking');
                // Notify server - will trigger interrupt if AI is speaking
                socketRef.current?.emit('audio:speechStart');
            },

            onSpeechEnd: (audio) => {
                console.log('[VAD] Speech ended, audio length:', audio.length);
                // Signal server to process the buffered audio
                socketRef.current?.emit('audio:speechEnd');
            },

            onFrameProcessed: (probabilities, audioFrame) => {
                // Update input level for visualizer
                const level = probabilities.isSpeech;
                _setInputLevel(level);

                // Stream audio to server (unless muted or AI is speaking)
                if (!isMuted && !isAiSpeakingRef.current && socketRef.current) {
                    const base64Audio = float32ToBase64PCM16(audioFrame);
                    socketRef.current.emit('audio:input', {
                        data: base64Audio,
                        sampleRate: 16000, // VAD uses 16kHz internally
                    });
                }
            },

            onVADMisfire: () => {
                console.log('[VAD] Misfire (speech too short)');
            },
        });

        vadRef.current = vad;
        streamRef.current = stream;

        // Set audio context for visualizers using our stream
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        _setAudioContext(audioContext);
        _setSourceNode(source);

        console.log('[useVoiceSession] Silero VAD initialized');
        return { vad, player };
    }, [_setAudioContext, _setSourceNode, _setAnalyserNode, _setState, _setInputLevel, isMuted, float32ToBase64PCM16]);

    /**
     * Connect to voice server
     */
    const connectToServer = useCallback(async (voiceServerUrl) => {
        console.log('[useVoiceSession] Connecting to voice server:', voiceServerUrl);

        const socket = io(voiceServerUrl, {
            transports: ['websocket'],
            query: {
                entityId,
                chatId,
            },
        });

        socketRef.current = socket;

        // Connection events
        socket.on('connect', () => {
            console.log('[useVoiceSession] Connected to voice server');
            socket.emit('session:start', {
                entityId,
                chatId,
                // Don't specify provider - let server use DEFAULT_VOICE_PROVIDER
                voiceId: 'tnSpp4vdxKPjI9w0GnoV',
                userId: sessionContext?.userId,
                contextId: sessionContext?.contextId || entityId,
                contextKey: sessionContext?.contextKey,
                aiName: sessionContext?.aiName,
                userName: sessionContext?.userName,
                model: sessionContext?.model,
                userInfo: composeUserDateTimeInfo(),
            });
        });

        socket.on('disconnect', (reason) => {
            console.log('[useVoiceSession] Disconnected from voice server:', reason);
            _setIsConnected(false);
            _setState('idle');
        });

        socket.on('connect_error', (error) => {
            console.error('[useVoiceSession] Connection error:', error);
            _setIsConnected(false);
        });

        // Session events
        socket.on('session:started', (data) => {
            console.log('[useVoiceSession] Session started:', data);
            _setSessionId(data.sessionId);
            _setIsConnected(true);
            // Start the VAD
            vadRef.current?.start();
        });

        socket.on('session:error', (data) => {
            console.error('[useVoiceSession] Session error:', data);
            _setIsConnected(false);
        });

        socket.on('session:ended', (data) => {
            console.log('[useVoiceSession] Session ended:', data);
            _setIsConnected(false);
        });

        socket.on('provider:connected', () => {
            console.log('[useVoiceSession] Provider connected');
        });

        // State events
        socket.on('state:change', (state) => {
            console.log('[useVoiceSession] State change:', state);
            const stateMap = {
                'idle': 'idle',
                'listening': 'userSpeaking',
                'processing': 'aiResponding',
                'speaking': 'audioPlaying',
            };
            const newState = stateMap[state] || state;
            _setState(newState);

            // Track when AI is speaking for echo gating
            isAiSpeakingRef.current = (state === 'speaking' || state === 'processing');
        });

        // Transcript events
        socket.on('transcript', (data) => {
            console.log('[useVoiceSession] Transcript:', data);
            if (data.type === 'user') {
                _setLiveUserTranscript(data.content || '');
                if (data.isFinal && data.content) {
                    _addToHistory('user', data.content);
                    _setLiveUserTranscript('');
                }
            } else if (data.type === 'assistant') {
                _setLiveAssistantTranscript(data.content || '');
                if (data.isFinal && data.content) {
                    _addToHistory('assistant', data.content);
                    _setLiveAssistantTranscript('');
                }
            }
        });

        // Audio events
        socket.on('audio:output', (data) => {
            if (data.data && playerRef.current) {
                isAiSpeakingRef.current = true;
                const pcmData = base64ToInt16Array(data.data);
                playerRef.current.add16BitPCM(pcmData, data.trackId || 'default');
                _setState('audioPlaying');
            }
        });

        socket.on('audio:muted', (muted) => {
            console.log('[useVoiceSession] Mute state:', muted);
        });

        // Track complete - flush any remaining audio buffer
        socket.on('audio:trackComplete', (data) => {
            if (data.trackId && playerRef.current) {
                playerRef.current.flushTrack(data.trackId);
            }
        });

        // Stop audio playback (interruption)
        socket.on('audio:stop', async () => {
            console.log('[useVoiceSession] Stopping audio playback (interrupted)');
            if (playerRef.current) {
                await playerRef.current.interrupt();
            }
            isAiSpeakingRef.current = false;
            _setState('idle');
        });

        // Tool events
        socket.on('tool:status', (data) => {
            console.log('[useVoiceSession] Tool status:', data);
            if (data.status === 'completed') {
                _setCurrentTool(null);
            } else if (data.status === 'error') {
                _setCurrentTool({
                    name: data.name,
                    status: 'error',
                    message: data.message || 'Tool execution failed',
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
        socket.on('media', (data) => {
            console.log('[useVoiceSession] Media event:', data);
            showOverlay({
                items: data.items || data.files,
                entityId: entityId,
            });
        });

        // Error events
        socket.on('error', (data) => {
            console.error('[useVoiceSession] Server error:', data);
        });

        return socket;
    }, [
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
    ]);

    /**
     * Cleanup function
     */
    const cleanup = useCallback(async () => {
        console.log('[useVoiceSession] Cleaning up...');

        // Stop VAD
        if (vadRef.current) {
            try {
                vadRef.current.pause();
                vadRef.current.destroy();
            } catch (e) {
                console.warn('[useVoiceSession] Error stopping VAD:', e);
            }
            vadRef.current = null;
        }

        // Stop media stream tracks
        if (streamRef.current) {
            try {
                streamRef.current.getTracks().forEach(track => track.stop());
            } catch (e) {
                console.warn('[useVoiceSession] Error stopping media tracks:', e);
            }
            streamRef.current = null;
        }

        // Stop player
        if (playerRef.current) {
            try {
                await playerRef.current.interrupt();
            } catch (e) {
                console.warn('[useVoiceSession] Error stopping player:', e);
            }
            playerRef.current = null;
        }

        // Disconnect socket
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        isInitializedRef.current = false;
        isAiSpeakingRef.current = false;
        console.log('[useVoiceSession] Cleanup complete');
    }, []);

    /**
     * Initialize session when voice becomes active
     */
    useEffect(() => {
        if (!isActive || isInitializedRef.current) return;

        const init = async () => {
            try {
                isInitializedRef.current = true;

                // Get voice server URL from config
                const configResponse = await fetch('/api/voice/config');
                if (!configResponse.ok) {
                    throw new Error('Failed to fetch voice config');
                }
                const config = await configResponse.json();

                // Sanitize URL - trim whitespace that can cause socket.io namespace issues
                const voiceServerUrl = config.voiceServerUrl?.trim();

                if (!voiceServerUrl) {
                    throw new Error('Voice server URL not configured');
                }

                // Validate URL format
                try {
                    new URL(voiceServerUrl);
                } catch {
                    throw new Error(`Invalid voice server URL: "${voiceServerUrl}"`);
                }

                // Initialize audio with VAD
                await initializeAudio();

                // Connect to server
                await connectToServer(voiceServerUrl);

                // Register cleanup
                _registerCleanup(cleanup);

            } catch (error) {
                console.error('[useVoiceSession] Initialization error:', error);
                isInitializedRef.current = false;
                voice.endSession();
            }
        };

        init();
    }, [isActive, initializeAudio, connectToServer, cleanup, _registerCleanup, voice]);

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
                const frequencies = playerRef.current.getFrequencies('voice');
                const avgLevel = frequencies.values.reduce((a, b) => a + b, 0) / frequencies.values.length;
                _setOutputLevel(avgLevel);
            } catch (e) {
                // Ignore errors when session is ending
            }
        };

        const intervalId = setInterval(updateOutputLevel, 50);
        return () => clearInterval(intervalId);
    }, [isActive, _setOutputLevel]);

    /**
     * Cleanup on unmount
     */
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return {
        // Expose refs for direct access if needed
        socket: socketRef.current,
        vad: vadRef.current,
        player: playerRef.current,

        // Manual controls
        sendMessage: useCallback((text) => {
            socketRef.current?.emit('text:input', text);
        }, []),

        cancelResponse: useCallback(() => {
            socketRef.current?.emit('audio:interrupt');
            isAiSpeakingRef.current = false;
        }, []),
    };
}

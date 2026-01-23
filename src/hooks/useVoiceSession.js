"use client";

import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useVoice } from '../contexts/VoiceContext';
import { useEntityOverlay } from '../contexts/EntityOverlayContext';
import { WavRecorder, WavStreamPlayer } from '../lib/audio';

const VOICE_SAMPLE_RATE = 24000; // OpenAI Realtime API uses 24kHz

/**
 * Hook that manages the voice session connection and audio handling
 * Should be used inside a component that renders when voice mode is active
 */
export function useVoiceSession() {
    const voice = useVoice();
    const { showOverlay } = useEntityOverlay();

    const socketRef = useRef(null);
    const recorderRef = useRef(null);
    const playerRef = useRef(null);
    const isInitializedRef = useRef(false);

    // VAD (Voice Activity Detection) state
    const vadRef = useRef({
        isSpeaking: false,
        silenceStart: null,
        silenceThreshold: 0.01,      // Audio level below this = silence
        silenceDuration: 600,        // ms of silence before triggering speechEnd
        speechStartThreshold: 0.02,  // Audio level above this = speech
    });

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
     * Convert ArrayBuffer to base64 string
     */
    const arrayBufferToBase64 = useCallback((buffer) => {
        const bytes = new Uint8Array(buffer);
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
        // Ensure even byte length for Int16Array (2 bytes per sample)
        const length = binary.length - (binary.length % 2);
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Int16Array(bytes.buffer);
    }, []);

    /**
     * Initialize audio components
     */
    const initializeAudio = useCallback(async () => {
        console.log('[useVoiceSession] Initializing audio...');

        // Create recorder
        const recorder = new WavRecorder({ sampleRate: VOICE_SAMPLE_RATE });
        recorderRef.current = recorder;

        // Create player
        const player = new WavStreamPlayer({
            sampleRate: VOICE_SAMPLE_RATE,
            minBufferSize: 10,
        });
        playerRef.current = player;

        // Connect player
        await player.connect();

        // Begin recording (requests microphone permission)
        await recorder.begin();

        // Set audio nodes for visualizers
        if (recorder.source) {
            const audioContext = recorder.source.context;
            _setAudioContext(audioContext);
            _setSourceNode(recorder.source);
        }

        if (player.analyser) {
            _setAnalyserNode(player.analyser);
        }

        // Set up track complete callback
        player.setTrackCompleteCallback((trackId) => {
            console.log('[useVoiceSession] Track complete:', trackId);
            _setState('idle');
        });

        console.log('[useVoiceSession] Audio initialized');
        return { recorder, player };
    }, [_setAudioContext, _setSourceNode, _setAnalyserNode, _setState]);

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
            // Start the session
            // Voice options: alloy, ash, ballad, coral, sage, shimmer, verse, echo
            // verse and coral are more expressive/natural
            socket.emit('session:start', {
                entityId,
                chatId,
                provider: 'elevenlabs',
                // voiceId: 'cgSgspJ2msm6clMCkdW9', // Previous voice
                voiceId: 'tnSpp4vdxKPjI9w0GnoV',
                // Pass full context for sys_entity_agent
                userId: sessionContext?.userId,
                contextId: sessionContext?.contextId || entityId,
                contextKey: sessionContext?.contextKey,
                aiName: sessionContext?.aiName,
                userName: sessionContext?.userName,
                model: sessionContext?.model,
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
            // Map server states to client states
            const stateMap = {
                'idle': 'idle',
                'listening': 'userSpeaking',
                'processing': 'aiResponding',
                'speaking': 'audioPlaying',
            };
            _setState(stateMap[state] || state);
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
     * Start recording and sending audio
     */
    const startRecording = useCallback(async () => {
        if (!recorderRef.current || !socketRef.current) return;

        console.log('[useVoiceSession] Starting recording...');

        await recorderRef.current.record((data) => {
            if (isMuted) return;

            // Send audio chunk to server
            const base64Audio = arrayBufferToBase64(data.mono);
            socketRef.current?.emit('audio:input', { data: base64Audio, sampleRate: VOICE_SAMPLE_RATE });

            // Update input level for visualizer and VAD
            if (recorderRef.current?.analyser) {
                try {
                    const frequencies = recorderRef.current.getFrequencies('voice');
                    const avgLevel = frequencies.values.reduce((a, b) => a + b, 0) / frequencies.values.length;
                    _setInputLevel(avgLevel);

                    // VAD: Voice Activity Detection
                    const vad = vadRef.current;
                    const now = Date.now();

                    if (avgLevel > vad.speechStartThreshold) {
                        // Speech detected
                        if (!vad.isSpeaking) {
                            console.log('[VAD] Speech started');
                            vad.isSpeaking = true;
                        }
                        vad.silenceStart = null;
                    } else if (avgLevel < vad.silenceThreshold && vad.isSpeaking) {
                        // Silence detected while speaking
                        if (!vad.silenceStart) {
                            vad.silenceStart = now;
                        } else if (now - vad.silenceStart > vad.silenceDuration) {
                            // Silence duration exceeded - speech ended
                            console.log('[VAD] Speech ended, triggering processing');
                            vad.isSpeaking = false;
                            vad.silenceStart = null;
                            socketRef.current?.emit('audio:speechEnd');
                        }
                    }
                } catch (e) {
                    // Ignore errors when session is ending
                }
            }
        });

        console.log('[useVoiceSession] Recording started');
    }, [isMuted, arrayBufferToBase64, _setInputLevel]);

    /**
     * Cleanup function
     */
    const cleanup = useCallback(async () => {
        console.log('[useVoiceSession] Cleaning up...');

        // Stop recording
        if (recorderRef.current) {
            try {
                await recorderRef.current.quit();
            } catch (e) {
                console.warn('[useVoiceSession] Error stopping recorder:', e);
            }
            recorderRef.current = null;
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
                const voiceServerUrl = config.voiceServerUrl;

                if (!voiceServerUrl) {
                    throw new Error('Voice server URL not configured');
                }

                // Initialize audio
                await initializeAudio();

                // Connect to server
                await connectToServer(voiceServerUrl);

                // Start recording
                await startRecording();

                // Register cleanup
                _registerCleanup(cleanup);

            } catch (error) {
                console.error('[useVoiceSession] Initialization error:', error);
                isInitializedRef.current = false;
                voice.endSession();
            }
        };

        init();
    }, [isActive, initializeAudio, connectToServer, startRecording, cleanup, _registerCleanup, voice]);

    /**
     * Handle mute state changes
     */
    useEffect(() => {
        if (!isActive || !recorderRef.current) return;

        if (isMuted) {
            // Pause recording when muted
            if (recorderRef.current.getStatus() === 'recording') {
                recorderRef.current.pause().catch(console.warn);
            }
        } else {
            // Resume recording when unmuted
            if (recorderRef.current.getStatus() === 'paused') {
                startRecording().catch(console.warn);
            }
        }
    }, [isActive, isMuted, startRecording]);

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
        recorder: recorderRef.current,
        player: playerRef.current,

        // Manual controls
        sendMessage: useCallback((text) => {
            socketRef.current?.emit('text:input', text);
        }, []),

        cancelResponse: useCallback(() => {
            socketRef.current?.emit('audio:interrupt');
        }, []),
    };
}

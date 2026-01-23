"use client";

import React, {
    createContext,
    useState,
    useCallback,
    useContext,
    useRef,
    useEffect,
} from "react";

/**
 * VoiceContext - Manages voice mode session state
 *
 * Handles connection to voice server, audio recording/playback state,
 * transcripts, and tool execution status.
 */

const VoiceContext = createContext({
    // Session state
    isActive: false,
    isConnected: false,
    state: 'idle', // 'idle' | 'userSpeaking' | 'aiResponding' | 'audioPlaying'
    isMuted: false,

    // Transcripts
    liveUserTranscript: '',
    liveAssistantTranscript: '',
    conversationHistory: [],

    // Tool execution
    currentTool: null,

    // Session info
    sessionId: null,
    entityId: null,
    chatId: null,

    // Audio levels (0-1 normalized)
    inputLevel: 0,
    outputLevel: 0,

    // Audio nodes for visualizers
    audioContext: null,
    sourceNode: null,
    analyserNode: null,

    // Actions
    startSession: () => {},
    endSession: () => {},
    toggleMute: () => {},
    setMuted: () => {},

    // Internal setters for useVoiceSession hook
    _setIsConnected: () => {},
    _setState: () => {},
    _setLiveUserTranscript: () => {},
    _setLiveAssistantTranscript: () => {},
    _addToHistory: () => {},
    _setCurrentTool: () => {},
    _setInputLevel: () => {},
    _setOutputLevel: () => {},
    _setAudioContext: () => {},
    _setSourceNode: () => {},
    _setAnalyserNode: () => {},
    _setSessionId: () => {},
});

export function VoiceProvider({ children }) {
    // Session state
    const [isActive, setIsActive] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [state, setState] = useState('idle');
    const [isMuted, setIsMuted] = useState(false);

    // Transcripts
    const [liveUserTranscript, setLiveUserTranscript] = useState('');
    const [liveAssistantTranscript, setLiveAssistantTranscript] = useState('');
    const [conversationHistory, setConversationHistory] = useState([]);

    // Tool execution
    const [currentTool, setCurrentTool] = useState(null);

    // Session info
    const [sessionId, setSessionId] = useState(null);
    const [entityId, setEntityId] = useState(null);
    const [chatId, setChatId] = useState(null);

    // Audio levels
    const [inputLevel, setInputLevel] = useState(0);
    const [outputLevel, setOutputLevel] = useState(0);

    // Audio nodes
    const [audioContext, setAudioContext] = useState(null);
    const [sourceNode, setSourceNode] = useState(null);
    const [analyserNode, setAnalyserNode] = useState(null);

    // Refs for cleanup
    const cleanupRef = useRef(null);

    /**
     * Start a new voice session
     * @param {string} newEntityId - The entity to converse with
     * @param {string} newChatId - The chat to store messages in
     */
    const startSession = useCallback((newEntityId, newChatId) => {
        if (isActive) {
            console.warn('Voice session already active');
            return;
        }

        // Reset state
        setLiveUserTranscript('');
        setLiveAssistantTranscript('');
        setConversationHistory([]);
        setCurrentTool(null);
        setState('idle');
        setIsMuted(false);
        setInputLevel(0);
        setOutputLevel(0);

        // Set session info
        setEntityId(newEntityId);
        setChatId(newChatId);
        setIsActive(true);

        console.log('[VoiceContext] Starting voice session', { entityId: newEntityId, chatId: newChatId });
    }, [isActive]);

    /**
     * End the current voice session
     */
    const endSession = useCallback(() => {
        if (!isActive) return;

        console.log('[VoiceContext] Ending voice session');

        // Run cleanup if registered
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        // Reset all state
        setIsActive(false);
        setIsConnected(false);
        setState('idle');
        setIsMuted(false);
        setLiveUserTranscript('');
        setLiveAssistantTranscript('');
        setConversationHistory([]);
        setCurrentTool(null);
        setSessionId(null);
        setEntityId(null);
        setChatId(null);
        setInputLevel(0);
        setOutputLevel(0);
        setAudioContext(null);
        setSourceNode(null);
        setAnalyserNode(null);
    }, [isActive]);

    /**
     * Toggle mute state
     */
    const toggleMute = useCallback(() => {
        setIsMuted(prev => !prev);
    }, []);

    /**
     * Add a message to conversation history
     */
    const addToHistory = useCallback((role, content) => {
        setConversationHistory(prev => [
            ...prev,
            {
                role,
                content,
                timestamp: Date.now(),
            }
        ]);
    }, []);

    /**
     * Register cleanup function for session end
     */
    const registerCleanup = useCallback((cleanup) => {
        cleanupRef.current = cleanup;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, []);

    return (
        <VoiceContext.Provider
            value={{
                // Session state
                isActive,
                isConnected,
                state,
                isMuted,

                // Transcripts
                liveUserTranscript,
                liveAssistantTranscript,
                conversationHistory,

                // Tool execution
                currentTool,

                // Session info
                sessionId,
                entityId,
                chatId,

                // Audio levels
                inputLevel,
                outputLevel,

                // Audio nodes
                audioContext,
                sourceNode,
                analyserNode,

                // Actions
                startSession,
                endSession,
                toggleMute,
                setMuted: setIsMuted,

                // Internal setters for useVoiceSession hook
                _setIsConnected: setIsConnected,
                _setState: setState,
                _setLiveUserTranscript: setLiveUserTranscript,
                _setLiveAssistantTranscript: setLiveAssistantTranscript,
                _addToHistory: addToHistory,
                _setCurrentTool: setCurrentTool,
                _setInputLevel: setInputLevel,
                _setOutputLevel: setOutputLevel,
                _setAudioContext: setAudioContext,
                _setSourceNode: setSourceNode,
                _setAnalyserNode: setAnalyserNode,
                _setSessionId: setSessionId,
                _registerCleanup: registerCleanup,
            }}
        >
            {children}
        </VoiceContext.Provider>
    );
}

export function useVoice() {
    return useContext(VoiceContext);
}

export default VoiceContext;

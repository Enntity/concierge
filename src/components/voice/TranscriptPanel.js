"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useVoice } from '../../contexts/VoiceContext';

/**
 * TranscriptPanel - Displays live and historical transcripts during voice mode
 * Collapsible panel showing user and assistant messages
 */
export function TranscriptPanel() {
    const {
        liveUserTranscript,
        liveAssistantTranscript,
        conversationHistory,
        state,
    } = useVoice();

    const [isExpanded, setIsExpanded] = useState(true);
    const scrollRef = useRef(null);

    // Auto-scroll to bottom when new content arrives
    useEffect(() => {
        if (scrollRef.current && isExpanded) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [conversationHistory, liveUserTranscript, liveAssistantTranscript, isExpanded]);

    const hasContent = conversationHistory.length > 0 || liveUserTranscript || liveAssistantTranscript;

    if (!hasContent && state === 'idle') {
        return null;
    }

    return (
        <div className="w-full max-w-2xl mx-auto bg-gray-800/80 backdrop-blur-sm rounded-lg overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-2 flex items-center justify-between text-gray-300 hover:bg-gray-700/50 transition-colors"
            >
                <span className="text-sm font-medium">Transcript</span>
                {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                ) : (
                    <ChevronUp className="w-4 h-4" />
                )}
            </button>

            {/* Content */}
            {isExpanded && (
                <div
                    ref={scrollRef}
                    className="px-4 pb-4 max-h-48 overflow-y-auto space-y-3"
                >
                    {/* History */}
                    {conversationHistory.map((message, index) => (
                        <div key={index} className="text-sm">
                            <span className={`font-medium ${
                                message.role === 'user'
                                    ? 'text-blue-400'
                                    : 'text-green-400'
                            }`}>
                                {message.role === 'user' ? 'You' : 'AI'}:
                            </span>{' '}
                            <span className="text-gray-200">
                                {message.content}
                            </span>
                        </div>
                    ))}

                    {/* Live user transcript */}
                    {liveUserTranscript && (
                        <div className="text-sm animate-pulse">
                            <span className="font-medium text-blue-400">You:</span>{' '}
                            <span className="text-gray-300 italic">
                                {liveUserTranscript}
                            </span>
                        </div>
                    )}

                    {/* Live assistant transcript */}
                    {liveAssistantTranscript && (
                        <div className="text-sm animate-pulse">
                            <span className="font-medium text-green-400">AI:</span>{' '}
                            <span className="text-gray-300 italic">
                                {liveAssistantTranscript}
                            </span>
                        </div>
                    )}

                    {/* Empty state */}
                    {!hasContent && (
                        <div className="text-sm text-gray-500 text-center py-2">
                            Start speaking to see the transcript...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

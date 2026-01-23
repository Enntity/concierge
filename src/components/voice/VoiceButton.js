"use client";

import React from 'react';
import { Mic } from 'lucide-react';

/**
 * VoiceButton - Trigger button to start voice mode
 * Placed in MessageInput next to the send button
 *
 * @param {Object} props
 * @param {Function} props.onClick - Called when button is clicked
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {string} props.className - Additional CSS classes
 */
export function VoiceButton({ onClick, disabled = false, className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`
                flex items-center justify-center
                w-10 h-10 rounded-full
                bg-blue-600 hover:bg-blue-700
                disabled:bg-gray-600 disabled:cursor-not-allowed
                transition-colors
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800
                ${className}
            `}
            title="Start voice mode"
            aria-label="Start voice mode"
        >
            <Mic className="w-5 h-5 text-white" />
        </button>
    );
}

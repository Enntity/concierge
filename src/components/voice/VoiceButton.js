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
                transition-all duration-300
                disabled:cursor-not-allowed
                ${disabled
                    ? 'text-gray-400 dark:text-gray-500'
                    : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:scale-110 active:scale-95'
                }
                ${className}
            `}
            title="Start voice mode"
            aria-label="Start voice mode"
        >
            <Mic className="w-5 h-5" />
        </button>
    );
}

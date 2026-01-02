"use client";

import React, { useRef, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { Code2 } from "lucide-react";

// Global registry to track animation start time for each spinner key
// This ensures continuity even when React remounts the component
const spinnerStartTimes = new Map();

const AppletPlaceholder = React.memo(({ spinnerKey }) => {
    const { t } = useTranslation();
    const spinnerRef = useRef(null);

    useLayoutEffect(() => {
        if (!spinnerRef.current || !spinnerKey) return;

        const spinner = spinnerRef.current;
        const now = performance.now();

        // Get or create the start time for this spinner key
        if (!spinnerStartTimes.has(spinnerKey)) {
            // First time we see this spinner - record the start time
            spinnerStartTimes.set(spinnerKey, now);
        }

        const startTime = spinnerStartTimes.get(spinnerKey);
        const animationDuration = 1000; // 1s for spin animation

        // Calculate how much time has elapsed since the spinner started
        const elapsed = (now - startTime) % animationDuration;

        // Use negative animation-delay to start the animation at the correct point
        // This makes it appear to continue seamlessly from where it left off
        const delay = -elapsed;
        spinner.style.animationDelay = `${delay}ms`;

        // Clean up old entries (older than 10 seconds) to prevent memory leaks
        // But only clean up entries that aren't the current one
        const cleanupThreshold = 10000;
        for (const [key, time] of spinnerStartTimes.entries()) {
            if (key !== spinnerKey && now - time > cleanupThreshold) {
                spinnerStartTimes.delete(key);
            }
        }
    }); // Run on every render to resync animation when component remounts

    return (
        <div className="applet-placeholder my-3 w-full max-w-[600px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                <Code2 className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {t("Interactive Applet")}
                </span>
            </div>
            
            {/* Loading content */}
            <div className="h-[200px] flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                <div className="flex flex-col items-center gap-3">
                    <div
                        ref={spinnerRef}
                        className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-sky-500 dark:border-t-sky-400 rounded-full animate-spin"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {t("Building applet...")}
                    </span>
                </div>
            </div>
        </div>
    );
});

AppletPlaceholder.displayName = "AppletPlaceholder";

export default AppletPlaceholder;


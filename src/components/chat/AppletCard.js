"use client";

import React, { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Maximize2, Code2, RefreshCw } from "lucide-react";
import { ThemeContext } from "../../contexts/ThemeProvider";
import OutputSandbox from "../sandbox/OutputSandbox";

/**
 * Check if a URL needs to go through our proxy to bypass CORS
 */
function needsProxy(url) {
    if (!url) return false;
    try {
        const urlObj = new URL(url);
        const proxyDomains = [
            "ajcortexfilestorage.blob.core.windows.net",
            "storage.googleapis.com",
            "storage.cloud.google.com",
        ];
        return proxyDomains.some((domain) => urlObj.hostname.includes(domain));
    } catch {
        return false;
    }
}

/**
 * AppletCard - Renders inline interactive applets in chat
 * 
 * Supports two modes (both use OutputSandbox for consistent behavior):
 * 1. Inline HTML: Renders HTML content directly
 * 2. URL reference: Fetches HTML from URL, then renders via OutputSandbox
 * 
 * Features:
 * - Inline preview in chat with configurable height
 * - Fullscreen route (/applet/view) for expanded view
 * - Theme-aware (light/dark mode signals to iframe)
 * - iOS Safari fetch proxy support
 * - Sandboxed for security
 */
const AppletCard = React.memo(function AppletCard({
    html,           // HTML content to render inline
    src,            // URL to fetch HTML from (alternative to html)
    title,          // Optional title for the applet
    height = 300,   // Default height in pixels
    className = "",
    onLoad,
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fetchedHtml, setFetchedHtml] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const router = useRouter();
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);

    // Fetch HTML from URL if src is provided
    useEffect(() => {
        if (!src) {
            setFetchedHtml(null);
            return;
        }

        const fetchContent = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                // Use proxy for blob storage URLs to bypass CORS
                const fetchUrl = needsProxy(src)
                    ? `/api/text-proxy?url=${encodeURIComponent(src)}`
                    : src;
                
                const response = await fetch(fetchUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
                }
                const content = await response.text();
                setFetchedHtml(content);
                onLoad?.();
            } catch (err) {
                console.error("Error fetching applet content:", err);
                setError(err.message || "Failed to load applet");
            } finally {
                setIsLoading(false);
            }
        };

        fetchContent();
    }, [src, refreshKey, onLoad]);

    // Refresh the applet
    const handleRefresh = (e) => {
        e.stopPropagation();
        // Increment key to force refetch (for URL) or remount (for inline HTML)
        setRefreshKey(k => k + 1);
    };

    // Navigate to fullscreen route
    const handleFullscreen = (e) => {
        e.stopPropagation();
        const params = new URLSearchParams();
        if (html) {
            params.set("html", encodeURIComponent(html));
        } else if (src) {
            params.set("src", src);
        }
        if (title) {
            params.set("title", title);
        }
        router.push(`/applet/view?${params.toString()}`);
    };

    // Determine the display title
    const displayTitle = title || (src ? "Interactive Applet" : "Inline Applet");

    // Card dimensions
    const cardWidth = "w-full max-w-[600px]";

    // Get the content to render (inline HTML or fetched HTML)
    const content = html || fetchedHtml;

    // Render content using OutputSandbox
    const renderContent = () => {
        if (!content) return null;
        
        return (
            <OutputSandbox
                key={`sandbox-${refreshKey}`}
                content={content}
                height={`${height}px`}
                theme={theme}
            />
        );
    };

    // Error state
    if (error) {
        return (
            <div
                className={`${cardWidth} ${className} bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 my-2`}
            >
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Code2 className="w-5 h-5" />
                    <span className="font-medium">{t("Applet Error")}</span>
                </div>
                <p className="text-sm text-red-500 dark:text-red-400 mt-2">
                    {error}
                </p>
                {src && (
                    <button
                        onClick={handleRefresh}
                        className="mt-3 text-sm text-sky-500 hover:text-sky-600 flex items-center gap-1"
                    >
                        <RefreshCw className="w-3 h-3" />
                        {t("Try again")}
                    </button>
                )}
            </div>
        );
    }

    // No content provided
    if (!html && !src) {
        return null;
    }

    return (
        <>
            <div
                className={`${cardWidth} ${className} bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden my-2`}
            >
                {/* Header bar */}
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">
                            {displayTitle}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleRefresh}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title={t("Refresh")}
                        >
                            <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={handleFullscreen}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title={t("Fullscreen")}
                        >
                            <Maximize2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Content container */}
                <div
                    className="relative bg-white dark:bg-gray-900 overflow-auto"
                    style={{ height: `${height}px` }}
                >
                    {/* Loading state */}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 z-10">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {t("Loading applet...")}
                                </span>
                            </div>
                        </div>
                    )}
                    {content && renderContent()}
                </div>
            </div>
        </>
    );
});

export default AppletCard;

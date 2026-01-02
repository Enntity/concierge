"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useContext } from "react";
import OutputSandbox from "@/src/components/sandbox/OutputSandbox";
import { ThemeContext } from "@/src/contexts/ThemeProvider";
import { Code2, RefreshCw, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

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

export default function AppletViewPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { t } = useTranslation();
    const { theme } = useContext(ThemeContext);
    
    const [content, setContent] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    
    // Get applet data from URL params
    const html = searchParams.get("html");
    const src = searchParams.get("src");
    const title = searchParams.get("title") || "Interactive Applet";

    // Fetch or set content
    useEffect(() => {
        if (html) {
            // Decode HTML content from URL
            try {
                const decoded = decodeURIComponent(html);
                setContent(decoded);
                setIsLoading(false);
            } catch (err) {
                console.error("Error decoding HTML:", err);
                setError("Failed to decode applet content");
                setIsLoading(false);
            }
        } else if (src) {
            // Fetch content from URL
            const fetchContent = async () => {
                setIsLoading(true);
                setError(null);
                
                try {
                    const fetchUrl = needsProxy(src)
                        ? `/api/text-proxy?url=${encodeURIComponent(src)}`
                        : src;
                    
                    const response = await fetch(fetchUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
                    }
                    const fetchedContent = await response.text();
                    setContent(fetchedContent);
                } catch (err) {
                    console.error("Error fetching applet content:", err);
                    setError(err.message || "Failed to load applet");
                } finally {
                    setIsLoading(false);
                }
            };

            fetchContent();
        } else {
            setError("No applet content provided");
            setIsLoading(false);
        }
    }, [html, src, refreshKey]);

    const handleRefresh = () => {
        setRefreshKey(k => k + 1);
    };

    const handleBack = () => {
        router.back();
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Compact header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleBack}
                        className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title={t("Back")}
                    >
                        <ArrowLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    </button>
                    <Code2 className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {title}
                    </span>
                </div>
                <button
                    onClick={handleRefresh}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title={t("Refresh")}
                >
                    <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Content area - full height OutputSandbox with scroll */}
            <div className="flex-1 min-h-0 bg-white dark:bg-gray-900 overflow-auto">
                {error ? (
                    <div className="flex items-center justify-center h-full min-h-full">
                        <div className="text-center p-6">
                            <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
                            <button
                                onClick={handleRefresh}
                                className="text-sm text-sky-500 hover:text-sky-600 flex items-center gap-1 mx-auto"
                            >
                                <RefreshCw className="w-3 h-3" />
                                {t("Try again")}
                            </button>
                        </div>
                    </div>
                ) : content ? (
                    <div className="w-full h-full min-h-full">
                        <OutputSandbox
                            key={`sandbox-${refreshKey}`}
                            content={content}
                            height="100%"
                            theme={theme}
                        />
                    </div>
                ) : isLoading ? (
                    <div className="flex items-center justify-center h-full min-h-full">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {t("Loading applet...")}
                            </span>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}


"use client";

import React, {
    createContext,
    useState,
    useCallback,
    useContext,
    useRef,
    useEffect,
} from "react";

const StreamingAvatarContext = createContext({
    avatarFiles: null,
    currentFileIndex: 0,
    avatarVisible: false,
    isVideo: false,
    setStreamingAvatar: () => {},
    clearStreamingAvatar: () => {},
    pauseAutoFade: () => {},
    resumeAutoFade: () => {},
    nextFile: () => {},
    previousFile: () => {},
});

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".ogg", ".m4v"];

const DEFAULT_DURATION = 20000; // 20 seconds default

export function StreamingAvatarProvider({ children }) {
    const [avatarFiles, setAvatarFiles] = useState(null);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [avatarVisible, setAvatarVisible] = useState(false);
    const [isVideo, setIsVideo] = useState(false);
    const autoFadeTimerRef = useRef(null);
    const timerStartRef = useRef(null);
    const remainingTimeRef = useRef(DEFAULT_DURATION);
    const fileTransitionTimerRef = useRef(null);
    const cyclingFileIndexRef = useRef(0);
    const filesLengthRef = useRef(0);

    const clearStreamingAvatar = useCallback(() => {
        if (autoFadeTimerRef.current) {
            clearTimeout(autoFadeTimerRef.current);
            autoFadeTimerRef.current = null;
        }
        if (fileTransitionTimerRef.current) {
            clearTimeout(fileTransitionTimerRef.current);
            fileTransitionTimerRef.current = null;
        }
        timerStartRef.current = null;
        remainingTimeRef.current = DEFAULT_DURATION;
        setAvatarVisible(false);
        // Clear files after fade out
        setTimeout(() => {
            setAvatarFiles(null);
            setCurrentFileIndex(0);
            cyclingFileIndexRef.current = 0;
            setIsVideo(false);
        }, 500);
    }, []);

    const startAutoFadeTimer = useCallback(
        (duration) => {
            if (autoFadeTimerRef.current) {
                clearTimeout(autoFadeTimerRef.current);
            }
            timerStartRef.current = Date.now();
            remainingTimeRef.current = duration;
            autoFadeTimerRef.current = setTimeout(() => {
                clearStreamingAvatar();
            }, duration);
        },
        [clearStreamingAvatar],
    );

    const pauseAutoFade = useCallback(() => {
        if (autoFadeTimerRef.current && timerStartRef.current) {
            clearTimeout(autoFadeTimerRef.current);
            autoFadeTimerRef.current = null;
            // Calculate remaining time
            const elapsed = Date.now() - timerStartRef.current;
            remainingTimeRef.current = Math.max(
                0,
                remainingTimeRef.current - elapsed,
            );
            timerStartRef.current = null;
        }
        // Also pause file cycling
        if (fileTransitionTimerRef.current) {
            clearTimeout(fileTransitionTimerRef.current);
            fileTransitionTimerRef.current = null;
        }
    }, []);

    const resumeAutoFade = useCallback(() => {
        if (
            avatarFiles &&
            remainingTimeRef.current > 0 &&
            !autoFadeTimerRef.current
        ) {
            startAutoFadeTimer(remainingTimeRef.current);
        }
    }, [avatarFiles, startAutoFadeTimer]);

    // Get current file URL
    const getCurrentFileUrl = useCallback(() => {
        if (!avatarFiles || avatarFiles.length === 0) return null;
        const currentFile = avatarFiles[currentFileIndex];
        return currentFile?.url || currentFile?.gcs || null;
    }, [avatarFiles, currentFileIndex]);

    // Check if current file is a video
    const checkIsVideo = useCallback((url) => {
        if (!url) return false;
        const urlLower = url.toLowerCase().split("?")[0];
        return VIDEO_EXTENSIONS.some((ext) => urlLower.endsWith(ext));
    }, []);

    // Update video state based on current file
    useEffect(() => {
        const currentUrl = getCurrentFileUrl();
        if (currentUrl) {
            setIsVideo(checkIsVideo(currentUrl));
        }
    }, [avatarFiles, currentFileIndex, getCurrentFileUrl, checkIsVideo]);

    const nextFile = useCallback(() => {
        if (!avatarFiles || avatarFiles.length <= 1) return;
        setCurrentFileIndex((prev) => {
            const next = (prev + 1) % avatarFiles.length;
            cyclingFileIndexRef.current = next;
            return next;
        });
    }, [avatarFiles]);

    const previousFile = useCallback(() => {
        if (!avatarFiles || avatarFiles.length <= 1) return;
        setCurrentFileIndex((prev) => {
            const next = (prev - 1 + avatarFiles.length) % avatarFiles.length;
            cyclingFileIndexRef.current = next;
            return next;
        });
    }, [avatarFiles]);

    const setStreamingAvatar = useCallback(
        (avatarMessage) => {
            if (!avatarMessage) return;

            // Support both old format (single URL) and new format (files array)
            let files = [];
            let duration = DEFAULT_DURATION;

            if (avatarMessage.files && Array.isArray(avatarMessage.files)) {
                // New format: files array
                files = avatarMessage.files
                    .map((file) => ({
                        url: file.url || file.gcs,
                        gcs: file.gcs,
                        hash: file.hash,
                        filename: file.filename,
                    }))
                    .filter((file) => file.url); // Filter out files without URLs
            } else if (avatarMessage.url) {
                // Old format: single URL (backward compatibility)
                files = [{ url: avatarMessage.url }];
            } else {
                return; // No valid files
            }

            if (files.length === 0) return;

            // Get duration from options, default to 20s
            if (
                avatarMessage.duration !== undefined &&
                avatarMessage.duration !== null
            ) {
                // If duration is less than 1000, assume it's in seconds and convert to milliseconds
                // Otherwise, assume it's already in milliseconds
                duration =
                    avatarMessage.duration < 1000
                        ? avatarMessage.duration * 1000
                        : avatarMessage.duration;
            }


            // Clear any existing timers
            if (autoFadeTimerRef.current) {
                clearTimeout(autoFadeTimerRef.current);
            }
            if (fileTransitionTimerRef.current) {
                clearTimeout(fileTransitionTimerRef.current);
            }

            // Set files and reset to first file
            setAvatarFiles(files);
            setCurrentFileIndex(0);
            cyclingFileIndexRef.current = 0;
            filesLengthRef.current = files.length;

            // Small delay then fade in
            setTimeout(() => setAvatarVisible(true), 100);

            // Calculate total display time: duration per file * number of files
            const totalDisplayTime = duration * files.length;

            // Auto-fade after total display time (duration per file * number of files)
            remainingTimeRef.current = totalDisplayTime;
            startAutoFadeTimer(totalDisplayTime);

            // If multiple files, cycle through them - each file gets the full duration
            if (files.length > 1) {
                const timePerFile = Math.max(500, duration); // Each file displays for the full duration (min 500ms)

                const cycleFiles = () => {
                    cyclingFileIndexRef.current++;
                    const currentLength = filesLengthRef.current;
                    if (cyclingFileIndexRef.current < currentLength) {
                        setCurrentFileIndex(cyclingFileIndexRef.current);
                        // Schedule next transition - only if we haven't been cleared
                        if (fileTransitionTimerRef.current !== null) {
                            fileTransitionTimerRef.current = setTimeout(
                                cycleFiles,
                                timePerFile,
                            );
                        }
                    } else {
                        // Reached the end, stop cycling
                        fileTransitionTimerRef.current = null;
                    }
                };

                // Start cycling after the first file's display time
                fileTransitionTimerRef.current = setTimeout(
                    cycleFiles,
                    timePerFile,
                );
            }
        },
        [startAutoFadeTimer],
    );

    // Get current file URL for backward compatibility
    const avatarUrl = getCurrentFileUrl();

    return (
        <StreamingAvatarContext.Provider
            value={{
                avatarFiles,
                currentFileIndex,
                avatarUrl, // For backward compatibility
                avatarVisible,
                isVideo,
                setStreamingAvatar,
                clearStreamingAvatar,
                pauseAutoFade,
                resumeAutoFade,
                nextFile,
                previousFile,
            }}
        >
            {children}
        </StreamingAvatarContext.Provider>
    );
}

export function useStreamingAvatar() {
    return useContext(StreamingAvatarContext);
}

export default StreamingAvatarContext;

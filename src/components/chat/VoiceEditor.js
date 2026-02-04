"use client";

import React, {
    useState,
    useEffect,
    useMemo,
    useRef,
    useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import {
    Check,
    Play,
    Pause,
    Volume2,
    Loader2,
    GripVertical,
    X,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import FilterInput from "../common/FilterInput";

// Provider display names
const PROVIDER_LABELS = {
    elevenlabs: "ElevenLabs",
    deepgram: "Deepgram",
    "openai-tts": "OpenAI TTS",
    "openai-realtime": "OpenAI Realtime",
    inworld: "InWorld",
};

// Provider tab order
const PROVIDER_ORDER = [
    "elevenlabs",
    "deepgram",
    "openai-tts",
    "openai-realtime",
    "inworld",
];

/**
 * VoiceEditorContent - Content for the voice selection modal
 *
 * Click a voice card to toggle it in/out of the priority list.
 * Drag priority list entries to reorder. Click a priority list entry
 * to edit its provider-specific settings (e.g. ElevenLabs stability).
 */
const VoiceEditorContent = ({
    entityId,
    entityName,
    currentVoice,
    onClose,
    onSave,
}) => {
    const { t } = useTranslation();
    const [providerData, setProviderData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Active provider tab
    const [activeProvider, setActiveProvider] = useState(null);

    // Priority list of selected voice preferences
    const [priorityList, setPriorityList] = useState(() => {
        if (Array.isArray(currentVoice) && currentVoice.length > 0) {
            return currentVoice.map((v) => ({ ...v }));
        }
        return [];
    });

    // Index of the priority list entry selected for settings editing
    const [selectedEntryIndex, setSelectedEntryIndex] = useState(null);

    // Audio preview state
    const [playingVoiceId, setPlayingVoiceId] = useState(null);
    const [loadingPreviewId, setLoadingPreviewId] = useState(null);
    const audioRef = useRef(null);

    // Entity greeting for TTS previews (generated once per dialog session)
    const [greetingText, setGreetingText] = useState(null);
    const [greetingLoading, setGreetingLoading] = useState(true);
    const greetingFetched = useRef(false);

    // Drag state for reordering
    const [dragIndex, setDragIndex] = useState(null);

    // Fetch entity greeting for previews (once only)
    useEffect(() => {
        if (greetingFetched.current) return;
        greetingFetched.current = true;

        if (!entityId) {
            setGreetingText("Hi there! Great to meet you.");
            setGreetingLoading(false);
            return;
        }
        fetch("/api/voices/greeting", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entityId, entityName }),
        })
            .then((res) => res.json())
            .then((data) => {
                setGreetingText(data.text || "Hi there! Great to meet you.");
            })
            .catch(() => {
                setGreetingText("Hi there! Great to meet you.");
            })
            .finally(() => {
                setGreetingLoading(false);
            });
    }, [entityId, entityName]);

    // Fetch available voices on mount
    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch("/api/voices")
            .then((res) => res.json())
            .then((data) => {
                if (data.error) {
                    setError(data.error);
                } else {
                    setProviderData(data);
                    const available = PROVIDER_ORDER.filter(
                        (p) => data.providers?.[p],
                    );
                    if (available.length > 0 && !activeProvider) {
                        setActiveProvider(available[0]);
                    }
                }
            })
            .catch((err) => {
                setError(err.message || "Failed to load voices");
            })
            .finally(() => {
                setLoading(false);
            });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // Available provider tabs
    const availableProviders = useMemo(() => {
        if (!providerData?.providers) return [];
        return PROVIDER_ORDER.filter((p) => providerData.providers[p]);
    }, [providerData]);

    // Current provider's voices
    const currentProviderVoices = useMemo(() => {
        if (!activeProvider || !providerData?.providers?.[activeProvider])
            return [];
        return providerData.providers[activeProvider].voices || [];
    }, [activeProvider, providerData]);

    // Filtered voices
    const filteredVoices = useMemo(() => {
        let voices = [...currentProviderVoices];
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            voices = voices.filter(
                (voice) =>
                    voice.name.toLowerCase().includes(query) ||
                    Object.values(voice.labels || {}).some((label) =>
                        String(label).toLowerCase().includes(query),
                    ),
            );
        }
        return voices;
    }, [currentProviderVoices, searchQuery]);

    // Settings schema for the selected priority list entry's provider
    const selectedEntrySettings = useMemo(() => {
        if (selectedEntryIndex === null || !priorityList[selectedEntryIndex])
            return [];
        const entry = priorityList[selectedEntryIndex];
        return providerData?.providers?.[entry.provider]?.settings || [];
    }, [selectedEntryIndex, priorityList, providerData]);

    // ── Voice toggle (click to add/remove from priority list) ────────

    const handleToggleVoice = useCallback(
        (voice) => {
            const existingIndex = priorityList.findIndex(
                (p) => p.provider === activeProvider && p.voiceId === voice.id,
            );

            if (existingIndex >= 0) {
                // Remove from list
                setPriorityList((prev) =>
                    prev.filter((_, i) => i !== existingIndex),
                );
                // Clear selection if we removed the selected entry
                setSelectedEntryIndex((prev) => {
                    if (prev === existingIndex) return null;
                    if (prev !== null && prev > existingIndex) return prev - 1;
                    return prev;
                });
            } else {
                // Add to list with default settings
                const schema =
                    providerData?.providers?.[activeProvider]?.settings || [];
                const defaults = {};
                for (const field of schema) {
                    defaults[field.key] = field.default;
                }

                const entry = {
                    provider: activeProvider,
                    voiceId: voice.id,
                    name: voice.name,
                    ...(schema.length > 0 ? { settings: defaults } : {}),
                };

                setPriorityList((prev) => [...prev, entry]);
                // Select the newly added entry so settings panel shows
                if (schema.length > 0) {
                    setSelectedEntryIndex(priorityList.length); // new index
                }
            }
        },
        [activeProvider, priorityList, providerData],
    );

    // ── Preview playback ─────────────────────────────────────────────

    const handlePlayPreview = useCallback(
        async (voice) => {
            if (playingVoiceId === voice.id || loadingPreviewId === voice.id) {
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                }
                setPlayingVoiceId(null);
                setLoadingPreviewId(null);
                return;
            }

            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }

            if (!greetingText) return;

            const params = new URLSearchParams({
                provider: voice.provider,
                voiceId: voice.id,
                text: greetingText,
            });
            const previewUrl = `/api/voices/preview?${params.toString()}`;

            setLoadingPreviewId(voice.id);
            setPlayingVoiceId(null);

            const audio = new Audio(previewUrl);
            audioRef.current = audio;

            audio.onended = () => {
                setPlayingVoiceId(null);
                setLoadingPreviewId(null);
                audioRef.current = null;
            };

            audio.onerror = () => {
                setPlayingVoiceId(null);
                setLoadingPreviewId(null);
                audioRef.current = null;
            };

            try {
                await audio.play();
                setLoadingPreviewId(null);
                setPlayingVoiceId(voice.id);
            } catch {
                setPlayingVoiceId(null);
                setLoadingPreviewId(null);
            }
        },
        [playingVoiceId, loadingPreviewId, greetingText],
    );

    // ── Priority list entry settings update ──────────────────────────

    const handleSettingChange = useCallback(
        (key, value) => {
            if (selectedEntryIndex === null) return;
            setPriorityList((prev) =>
                prev.map((entry, i) =>
                    i === selectedEntryIndex
                        ? {
                              ...entry,
                              settings: {
                                  ...(entry.settings || {}),
                                  [key]: value,
                              },
                          }
                        : entry,
                ),
            );
        },
        [selectedEntryIndex],
    );

    // ── Priority list management ─────────────────────────────────────

    const handleRemoveFromPriority = useCallback((index) => {
        setPriorityList((prev) => prev.filter((_, i) => i !== index));
        setSelectedEntryIndex((prev) => {
            if (prev === index) return null;
            if (prev !== null && prev > index) return prev - 1;
            return prev;
        });
    }, []);

    const handleDragStart = useCallback((index) => {
        setDragIndex(index);
    }, []);

    const handleDragOver = useCallback(
        (e, index) => {
            e.preventDefault();
            if (dragIndex === null || dragIndex === index) return;
            setPriorityList((prev) => {
                const updated = [...prev];
                const [moved] = updated.splice(dragIndex, 1);
                updated.splice(index, 0, moved);
                return updated;
            });
            // Update selected index to follow the moved item
            setSelectedEntryIndex((prev) => {
                if (prev === dragIndex) return index;
                if (prev === index) return dragIndex;
                return prev;
            });
            setDragIndex(index);
        },
        [dragIndex],
    );

    const handleDragEnd = useCallback(() => {
        setDragIndex(null);
    }, []);

    // ── Save ─────────────────────────────────────────────────────────

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave({ voice: priorityList });
            onClose();
        } catch (err) {
            setError(err.message || "Failed to save voice settings");
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = useMemo(() => {
        const initial = Array.isArray(currentVoice) ? currentVoice : [];
        if (priorityList.length !== initial.length) return true;
        return priorityList.some(
            (p, i) =>
                p.provider !== initial[i]?.provider ||
                p.voiceId !== initial[i]?.voiceId ||
                JSON.stringify(p.settings) !==
                    JSON.stringify(initial[i]?.settings),
        );
    }, [priorityList, currentVoice]);

    const getVoiceLabels = (voice) => {
        const labels = [];
        if (voice.labels?.category) labels.push(voice.labels.category);
        if (voice.labels?.accent) labels.push(voice.labels.accent);
        if (voice.labels?.gender) labels.push(voice.labels.gender);
        if (voice.labels?.age) labels.push(voice.labels.age);
        if (voice.labels?.description) labels.push(voice.labels.description);
        if (voice.labels?.language) labels.push(voice.labels.language);
        return labels.slice(0, 4);
    };

    // ── Render ───────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-[70vh] min-h-[500px]">
            {error && (
                <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900/20 rounded mb-3">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                        <Spinner size="sm" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                            {t("Loading voices...")}
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Provider Tabs */}
                    <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-700">
                        {availableProviders.map((provider) => (
                            <button
                                key={provider}
                                onClick={() => {
                                    setActiveProvider(provider);
                                    setSearchQuery("");
                                }}
                                className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                                    activeProvider === provider
                                        ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                                        : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                }`}
                            >
                                {PROVIDER_LABELS[provider] || provider}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                        {/* Voice List */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="mb-4">
                                <FilterInput
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    onClear={() => setSearchQuery("")}
                                    placeholder={t("Search voices...")}
                                    className="w-full"
                                />
                            </div>

                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                {filteredVoices.length} {t("voices available")}
                            </div>

                            <div className="flex-1 overflow-y-auto min-h-0">
                                {filteredVoices.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                        {searchQuery
                                            ? t("No voices match your search")
                                            : t("No voices available")}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {filteredVoices.map((voice) => {
                                            const isPlaying =
                                                playingVoiceId === voice.id;
                                            const isLoadingPreview =
                                                loadingPreviewId === voice.id;
                                            const labels =
                                                getVoiceLabels(voice);
                                            const isInList = priorityList.some(
                                                (p) =>
                                                    p.provider ===
                                                        activeProvider &&
                                                    p.voiceId === voice.id,
                                            );

                                            return (
                                                <div
                                                    key={voice.id}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                        isInList
                                                            ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                                                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                    }`}
                                                    onClick={() =>
                                                        handleToggleVoice(voice)
                                                    }
                                                >
                                                    {/* Checkbox indicator */}
                                                    <div
                                                        className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
                                                            isInList
                                                                ? "bg-green-500 border-green-500 text-white"
                                                                : "border-gray-300 dark:border-gray-500"
                                                        }`}
                                                    >
                                                        {isInList && (
                                                            <Check className="w-3 h-3" />
                                                        )}
                                                    </div>

                                                    {/* Voice info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                                            {voice.name}
                                                        </div>
                                                        {labels.length > 0 && (
                                                            <div className="flex gap-1 mt-1 flex-wrap">
                                                                {labels.map(
                                                                    (
                                                                        label,
                                                                        idx,
                                                                    ) => (
                                                                        <span
                                                                            key={
                                                                                idx
                                                                            }
                                                                            className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                                                                        >
                                                                            {
                                                                                label
                                                                            }
                                                                        </span>
                                                                    ),
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Preview button */}
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handlePlayPreview(
                                                                voice,
                                                            );
                                                        }}
                                                        disabled={
                                                            greetingLoading
                                                        }
                                                        className={`flex-shrink-0 p-2 rounded-full transition-colors ${
                                                            isPlaying
                                                                ? "bg-cyan-500 text-white"
                                                                : isLoadingPreview
                                                                  ? "bg-cyan-200 dark:bg-cyan-800 text-cyan-700 dark:text-cyan-300"
                                                                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                                        }`}
                                                        title={
                                                            greetingLoading
                                                                ? t(
                                                                      "Preparing preview...",
                                                                  )
                                                                : isPlaying
                                                                  ? t("Stop")
                                                                  : isLoadingPreview
                                                                    ? t(
                                                                          "Loading...",
                                                                      )
                                                                    : t(
                                                                          "Play preview",
                                                                      )
                                                        }
                                                    >
                                                        {isLoadingPreview ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : isPlaying ? (
                                                            <Pause className="w-4 h-4" />
                                                        ) : (
                                                            <Play className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right panel: Priority List + Settings */}
                        <div className="lg:w-72 flex-shrink-0 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6 overflow-y-auto">
                            {/* Priority List */}
                            <div>
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t("Priority Order")}
                                </div>
                                {priorityList.length === 0 ? (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {t(
                                            "Click voices to add them. The first available provider will be used.",
                                        )}
                                    </p>
                                ) : (
                                    <div className="space-y-1">
                                        {priorityList.map((entry, index) => (
                                            <div
                                                key={`${entry.provider}-${entry.voiceId}-${index}`}
                                                className={`flex items-center gap-2 p-2 rounded border text-sm cursor-pointer ${
                                                    selectedEntryIndex === index
                                                        ? "border-cyan-400 bg-cyan-50 dark:bg-cyan-900/20"
                                                        : dragIndex === index
                                                          ? "border-cyan-300 bg-cyan-50/50 dark:bg-cyan-900/10"
                                                          : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-500"
                                                }`}
                                                draggable
                                                onClick={() =>
                                                    setSelectedEntryIndex(
                                                        selectedEntryIndex ===
                                                            index
                                                            ? null
                                                            : index,
                                                    )
                                                }
                                                onDragStart={() =>
                                                    handleDragStart(index)
                                                }
                                                onDragOver={(e) =>
                                                    handleDragOver(e, index)
                                                }
                                                onDragEnd={handleDragEnd}
                                            >
                                                <GripVertical className="w-3.5 h-3.5 text-gray-400 cursor-grab flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate text-xs">
                                                        {entry.name ||
                                                            entry.voiceId}
                                                    </div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                                        {PROVIDER_LABELS[
                                                            entry.provider
                                                        ] || entry.provider}
                                                    </div>
                                                </div>
                                                <span className="text-xs text-gray-400 flex-shrink-0">
                                                    #{index + 1}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveFromPriority(
                                                            index,
                                                        );
                                                    }}
                                                    className="flex-shrink-0 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                                                    title={t("Remove")}
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Settings for selected priority list entry */}
                            {selectedEntrySettings.length > 0 &&
                                selectedEntryIndex !== null &&
                                priorityList[selectedEntryIndex] && (
                                    <div className="space-y-2 pt-2">
                                        {selectedEntrySettings.map((field) => {
                                            const entrySettings =
                                                priorityList[selectedEntryIndex]
                                                    .settings || {};
                                            if (field.type === "range") {
                                                const value =
                                                    entrySettings[field.key] ??
                                                    field.default;
                                                return (
                                                    <div key={field.key}>
                                                        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                                                            <span>
                                                                {t(field.label)}{" "}
                                                                {(
                                                                    Number(
                                                                        value,
                                                                    ) * 100
                                                                ).toFixed(0)}
                                                                %
                                                            </span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min={field.min ?? 0}
                                                            max={field.max ?? 1}
                                                            step={
                                                                field.step ??
                                                                0.05
                                                            }
                                                            value={value}
                                                            onChange={(e) =>
                                                                handleSettingChange(
                                                                    field.key,
                                                                    parseFloat(
                                                                        e.target
                                                                            .value,
                                                                    ),
                                                                )
                                                            }
                                                            className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                                        />
                                                        {(field.lowLabel ||
                                                            field.highLabel) && (
                                                            <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 -mt-0.5">
                                                                <span>
                                                                    {t(
                                                                        field.lowLabel ||
                                                                            "",
                                                                    )}
                                                                </span>
                                                                <span>
                                                                    {t(
                                                                        field.highLabel ||
                                                                            "",
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            if (field.type === "boolean") {
                                                return (
                                                    <div
                                                        key={field.key}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            id={`setting-${field.key}`}
                                                            checked={
                                                                entrySettings[
                                                                    field.key
                                                                ] ??
                                                                field.default
                                                            }
                                                            onChange={(e) =>
                                                                handleSettingChange(
                                                                    field.key,
                                                                    e.target
                                                                        .checked,
                                                                )
                                                            }
                                                            className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-cyan-500 focus:ring-cyan-500"
                                                        />
                                                        <label
                                                            htmlFor={`setting-${field.key}`}
                                                            className="text-xs text-gray-500 dark:text-gray-400"
                                                        >
                                                            {t(field.label)}
                                                        </label>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })}
                                    </div>
                                )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            {t("Cancel")}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges || isSaving}
                            className="px-4 py-2 text-sm rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[4rem]"
                        >
                            {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                            ) : (
                                t("Save")
                            )}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

/**
 * VoiceEditor - Modal for editing entity voice settings
 */
const VoiceEditor = ({
    show,
    onClose,
    entityId,
    entityName,
    currentVoice,
    onSave,
}) => {
    const { t } = useTranslation();
    return (
        <Modal
            widthClassName="max-w-5xl"
            title={t("Voice Settings") + (entityName ? ` - ${entityName}` : "")}
            show={show}
            onHide={onClose}
        >
            <VoiceEditorContent
                entityId={entityId}
                entityName={entityName}
                currentVoice={currentVoice}
                onClose={onClose}
                onSave={onSave}
            />
        </Modal>
    );
};

export default VoiceEditor;

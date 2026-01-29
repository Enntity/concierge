"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Play, Pause, Volume2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import FilterInput from "../common/FilterInput";

/**
 * VoiceEditorContent - Content for the voice selection modal
 */
const VoiceEditorContent = ({ entityId, currentVoice, onClose, onSave }) => {
    const { t } = useTranslation();
    const [availableVoices, setAvailableVoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Selected voice state
    const [selectedVoiceId, setSelectedVoiceId] = useState(
        currentVoice?.voiceId || null,
    );
    const [selectedVoiceName, setSelectedVoiceName] = useState(
        currentVoice?.voiceName || null,
    );

    // Voice settings state
    const [stability, setStability] = useState(
        currentVoice?.settings?.stability ?? 0.5,
    );
    const [similarity, setSimilarity] = useState(
        currentVoice?.settings?.similarity ?? 0.75,
    );
    const [style, setStyle] = useState(currentVoice?.settings?.style ?? 0.0);
    const [speakerBoost, setSpeakerBoost] = useState(
        currentVoice?.settings?.speakerBoost ?? true,
    );

    // Audio preview state
    const [playingVoiceId, setPlayingVoiceId] = useState(null);
    const audioRef = useRef(null);

    // Fetch available voices on mount
    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch("/api/voices/elevenlabs")
            .then((res) => res.json())
            .then((data) => {
                if (data.error) {
                    setError(data.error);
                } else {
                    setAvailableVoices(data.voices || []);
                }
            })
            .catch((err) => {
                setError(err.message || "Failed to load voices");
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // Sort and filter voices
    const filteredVoices = useMemo(() => {
        let voices = [...availableVoices];

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            voices = voices.filter(
                (voice) =>
                    voice.name.toLowerCase().includes(query) ||
                    voice.category?.toLowerCase().includes(query) ||
                    Object.values(voice.labels || {}).some((label) =>
                        String(label).toLowerCase().includes(query),
                    ),
            );
        }

        return voices;
    }, [availableVoices, searchQuery]);

    const handleSelectVoice = (voice) => {
        setSelectedVoiceId(voice.voice_id);
        setSelectedVoiceName(voice.name);
    };

    const handlePlayPreview = (voice) => {
        if (!voice.preview_url || !voice.preview_url.startsWith("https://")) {
            console.warn("Invalid preview URL");
            return;
        }

        // If already playing this voice, stop it
        if (playingVoiceId === voice.voice_id) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingVoiceId(null);
            return;
        }

        // Stop any currently playing audio
        if (audioRef.current) {
            audioRef.current.pause();
        }

        // Play the preview
        const audio = new Audio(voice.preview_url);
        audioRef.current = audio;
        setPlayingVoiceId(voice.voice_id);

        audio.play().catch((err) => {
            console.error("Failed to play audio:", err);
            setPlayingVoiceId(null);
        });

        audio.onended = () => {
            setPlayingVoiceId(null);
            audioRef.current = null;
        };

        audio.onerror = () => {
            setPlayingVoiceId(null);
            audioRef.current = null;
        };
    };

    const handleSave = async () => {
        if (!selectedVoiceId) return;

        setSaving(true);
        try {
            await onSave({
                voiceProvider: "elevenlabs",
                voiceId: selectedVoiceId,
                voiceName: selectedVoiceName,
                voiceStability: stability,
                voiceSimilarity: similarity,
                voiceStyle: style,
                voiceSpeakerBoost: speakerBoost,
            });
            onClose();
        } catch (err) {
            setError(err.message || "Failed to save voice settings");
        } finally {
            setSaving(false);
        }
    };

    const hasChanges =
        selectedVoiceId !== (currentVoice?.voiceId || null) ||
        stability !== (currentVoice?.settings?.stability ?? 0.5) ||
        similarity !== (currentVoice?.settings?.similarity ?? 0.75) ||
        style !== (currentVoice?.settings?.style ?? 0.0) ||
        speakerBoost !== (currentVoice?.settings?.speakerBoost ?? true);

    // Get label chips for a voice
    const getVoiceLabels = (voice) => {
        const labels = [];
        if (voice.category) labels.push(voice.category);
        if (voice.labels?.accent) labels.push(voice.labels.accent);
        if (voice.labels?.gender) labels.push(voice.labels.gender);
        if (voice.labels?.age) labels.push(voice.labels.age);
        return labels.slice(0, 3); // Show max 3 labels
    };

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
                    <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                        {/* Voice List */}
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Search */}
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

                            {/* Voice grid */}
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
                                            const isSelected =
                                                selectedVoiceId ===
                                                voice.voice_id;
                                            const isPlaying =
                                                playingVoiceId ===
                                                voice.voice_id;
                                            const labels =
                                                getVoiceLabels(voice);

                                            return (
                                                <div
                                                    key={voice.voice_id}
                                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                        isSelected
                                                            ? "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-700"
                                                            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                                                    }`}
                                                    onClick={() =>
                                                        handleSelectVoice(voice)
                                                    }
                                                >
                                                    {/* Selection indicator */}
                                                    <div
                                                        className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
                                                            isSelected
                                                                ? "bg-cyan-500 border-cyan-500 text-white"
                                                                : "border-gray-300 dark:border-gray-500"
                                                        }`}
                                                    >
                                                        {isSelected && (
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
                                                    {voice.preview_url && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handlePlayPreview(
                                                                    voice,
                                                                );
                                                            }}
                                                            className={`flex-shrink-0 p-2 rounded-full transition-colors ${
                                                                isPlaying
                                                                    ? "bg-cyan-500 text-white"
                                                                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                                                            }`}
                                                            title={
                                                                isPlaying
                                                                    ? t("Stop")
                                                                    : t(
                                                                          "Play preview",
                                                                      )
                                                            }
                                                        >
                                                            {isPlaying ? (
                                                                <Pause className="w-4 h-4" />
                                                            ) : (
                                                                <Play className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Voice Settings */}
                        <div className="lg:w-72 flex-shrink-0 space-y-4 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 pt-4 lg:pt-0 lg:pl-6">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                <Volume2 className="w-4 h-4" />
                                {t("Voice Settings")}
                            </div>

                            {/* Stability */}
                            <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                    {t("Stability")}:{" "}
                                    {(stability * 100).toFixed(0)}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={stability}
                                    onChange={(e) =>
                                        setStability(parseFloat(e.target.value))
                                    }
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    <span>{t("Variable")}</span>
                                    <span>{t("Stable")}</span>
                                </div>
                            </div>

                            {/* Similarity */}
                            <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                    {t("Similarity")}:{" "}
                                    {(similarity * 100).toFixed(0)}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={similarity}
                                    onChange={(e) =>
                                        setSimilarity(
                                            parseFloat(e.target.value),
                                        )
                                    }
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    <span>{t("Low")}</span>
                                    <span>{t("High")}</span>
                                </div>
                            </div>

                            {/* Style */}
                            <div>
                                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                    {t("Style")}: {(style * 100).toFixed(0)}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={style}
                                    onChange={(e) =>
                                        setStyle(parseFloat(e.target.value))
                                    }
                                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    <span>{t("None")}</span>
                                    <span>{t("Exaggerated")}</span>
                                </div>
                            </div>

                            {/* Speaker Boost */}
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="speakerBoost"
                                    checked={speakerBoost}
                                    onChange={(e) =>
                                        setSpeakerBoost(e.target.checked)
                                    }
                                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-cyan-500 focus:ring-cyan-500"
                                />
                                <label
                                    htmlFor="speakerBoost"
                                    className="text-sm text-gray-600 dark:text-gray-400"
                                >
                                    {t("Speaker Boost")}
                                </label>
                            </div>

                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t(
                                    "Adjust these settings to fine-tune how the voice sounds.",
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            disabled={saving}
                        >
                            {t("Cancel")}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !selectedVoiceId || !hasChanges}
                            className="px-4 py-2 text-sm rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {saving && (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            {t("Save")}
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
                currentVoice={currentVoice}
                onClose={onClose}
                onSave={onSave}
            />
        </Modal>
    );
};

export default VoiceEditor;

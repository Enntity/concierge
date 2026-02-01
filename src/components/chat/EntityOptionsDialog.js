"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
    Settings,
    Brain,
    Sparkles,
    Lock,
    Unlock,
    Wrench,
    Mic,
    Heart,
    Loader2,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import EntityIcon from "./EntityIcon";
import {
    AGENT_MODEL_OPTIONS,
    DEFAULT_AGENT_MODEL,
} from "../../../app/utils/agent-model-mapping";

const REASONING_EFFORT_OPTIONS = [
    { value: "none", label: "None", description: "No reasoning" },
    { value: "low", label: "Low", description: "Faster responses" },
    { value: "medium", label: "Medium", description: "Balanced" },
    { value: "high", label: "High", description: "More thorough" },
];

export default function EntityOptionsDialog({
    isOpen,
    onClose,
    entity,
    onOpenMemoryEditor,
    onOpenToolsEditor,
    onOpenVoiceEditor,
    onEntityUpdate,
    refetchEntities,
}) {
    const { t } = useTranslation();
    const [preferredModel, setPreferredModel] = useState(
        entity?.preferredModel || DEFAULT_AGENT_MODEL,
    );
    const [forceModel, setForceModel] = useState(!!entity?.modelOverride);
    const [reasoningEffort, setReasoningEffort] = useState(
        entity?.reasoningEffort || "medium",
    );
    const [hasChanges, setHasChanges] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Pulse state
    const [pulseEnabled, setPulseEnabled] = useState(false);
    const [pulseInterval, setPulseInterval] = useState(15);
    const [pulseActiveStart, setPulseActiveStart] = useState("");
    const [pulseActiveEnd, setPulseActiveEnd] = useState("");
    const [pulseTimezone, setPulseTimezone] = useState("UTC");

    // Reset state when entity changes
    useEffect(() => {
        if (entity) {
            // If modelOverride exists, use it and check the force box
            // Otherwise use preferredModel
            const hasOverride = !!entity.modelOverride;
            setPreferredModel(
                entity.modelOverride ||
                    entity.preferredModel ||
                    DEFAULT_AGENT_MODEL,
            );
            setForceModel(hasOverride);
            setReasoningEffort(entity.reasoningEffort || "medium");
            // Pulse
            setPulseEnabled(entity.pulse?.enabled || false);
            setPulseInterval(entity.pulse?.wakeIntervalMinutes || 15);
            setPulseActiveStart(entity.pulse?.activeHours?.start || "");
            setPulseActiveEnd(entity.pulse?.activeHours?.end || "");
            setPulseTimezone(entity.pulse?.activeHours?.tz || "UTC");
            setHasChanges(false);
        }
    }, [entity]);

    // Track changes
    useEffect(() => {
        if (!entity) return;
        const currentModel =
            entity.modelOverride ||
            entity.preferredModel ||
            DEFAULT_AGENT_MODEL;
        const modelChanged = preferredModel !== currentModel;
        const forceChanged = forceModel !== !!entity.modelOverride;
        const effortChanged =
            reasoningEffort !== (entity.reasoningEffort || "medium");
        const pulseEnabledChanged =
            pulseEnabled !== (entity.pulse?.enabled || false);
        const pulseIntervalChanged =
            pulseInterval !== (entity.pulse?.wakeIntervalMinutes || 15);
        const pulseStartChanged =
            pulseActiveStart !== (entity.pulse?.activeHours?.start || "");
        const pulseEndChanged =
            pulseActiveEnd !== (entity.pulse?.activeHours?.end || "");
        const pulseTzChanged =
            pulseTimezone !== (entity.pulse?.activeHours?.tz || "UTC");

        setHasChanges(
            modelChanged ||
                forceChanged ||
                effortChanged ||
                pulseEnabledChanged ||
                pulseIntervalChanged ||
                pulseStartChanged ||
                pulseEndChanged ||
                pulseTzChanged,
        );
    }, [
        preferredModel,
        forceModel,
        reasoningEffort,
        pulseEnabled,
        pulseInterval,
        pulseActiveStart,
        pulseActiveEnd,
        pulseTimezone,
        entity,
    ]);

    const handleSave = async () => {
        if (!entity?.id || !hasChanges) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/entities/${entity.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    preferredModel: forceModel ? null : preferredModel,
                    modelOverride: forceModel ? preferredModel : null,
                    reasoningEffort,
                    pulseEnabled,
                    pulseWakeIntervalMinutes: pulseInterval,
                    pulseActiveHoursStart: pulseActiveStart || null,
                    pulseActiveHoursEnd: pulseActiveEnd || null,
                    pulseActiveHoursTimezone: pulseTimezone,
                }),
            });
            const result = await response.json();
            if (result.success) {
                if (onEntityUpdate) onEntityUpdate(result.entity);
                onClose();
            } else {
                toast.error("Failed to save entity settings");
            }
        } catch (error) {
            console.error("Failed to save entity settings:", error);
            toast.error("Failed to save entity settings");
        } finally {
            setIsSaving(false);
        }
        if (refetchEntities) refetchEntities();
    };

    const handleOpenMemory = () => {
        document.activeElement?.blur();
        onClose();
        if (onOpenMemoryEditor) {
            onOpenMemoryEditor(entity.id, entity.name);
        }
    };

    const handleOpenTools = () => {
        document.activeElement?.blur();
        onClose();
        if (onOpenToolsEditor) {
            onOpenToolsEditor(entity.id, entity.name, entity.tools || []);
        }
    };

    const handleOpenVoice = () => {
        document.activeElement?.blur();
        onClose();
        if (onOpenVoiceEditor) {
            onOpenVoiceEditor(entity.id, entity.name, entity.voice);
        }
    };

    // Get tools count for display
    const toolsCount = entity?.tools?.length || 0;
    const hasAllTools = entity?.tools?.includes("*");

    if (!entity) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="sm:max-w-md max-h-[85vh] flex flex-col"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <EntityIcon entity={entity} size="xl" />
                        <div>
                            <div className="flex items-center gap-2">
                                <Settings className="w-4 h-4 text-gray-400" />
                                <span>{entity.name}</span>
                            </div>
                            <p className="text-sm font-normal text-gray-500 dark:text-gray-400">
                                {t("Entity Settings")}
                            </p>
                        </div>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        {t("Configure settings for this entity")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 mt-3 overflow-y-auto flex-1 min-h-0 pr-1">
                    {/* Preferred Model */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            <Sparkles className="w-3.5 h-3.5 inline mr-1 text-cyan-500" />
                            {t("Preferred Model")}
                        </label>
                        <div className="flex items-center gap-2">
                            <select
                                value={preferredModel}
                                onChange={(e) =>
                                    setPreferredModel(e.target.value)
                                }
                                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                            >
                                {AGENT_MODEL_OPTIONS.map((option) => (
                                    <option
                                        key={option.modelId}
                                        value={option.modelId}
                                    >
                                        {option.displayName}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => setForceModel(!forceModel)}
                                className={`p-1.5 rounded-md transition-colors ${
                                    forceModel
                                        ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/60"
                                        : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                                }`}
                                title={
                                    forceModel
                                        ? t("Entity MUST use this model (click to unlock)")
                                        : t("Entity prefers this model (click to lock)")
                                }
                            >
                                {forceModel ? (
                                    <Lock className="w-4 h-4" />
                                ) : (
                                    <Unlock className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Reasoning Effort */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {t("Reasoning Effort")}
                        </label>
                        <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                            {REASONING_EFFORT_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() =>
                                        setReasoningEffort(option.value)
                                    }
                                    className={`flex-1 px-2 py-1.5 text-xs font-medium transition-colors ${
                                        reasoningEffort === option.value
                                            ? "bg-cyan-500 text-white"
                                            : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                                    }`}
                                    title={t(option.description)}
                                >
                                    {t(option.label)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tools / Voice / Memory links */}
                    <div className="rounded-lg border border-gray-200 dark:border-gray-600 divide-y divide-gray-200 dark:divide-gray-600">
                        <button
                            onClick={handleOpenTools}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors first:rounded-t-lg"
                        >
                            <div className="flex items-center gap-2.5">
                                <Wrench className="w-4 h-4 text-orange-500" />
                                <span className="text-sm text-gray-900 dark:text-gray-100">
                                    {t("Tools")}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {hasAllTools
                                        ? t("All")
                                        : toolsCount > 0
                                          ? toolsCount
                                          : t("None")}
                                </span>
                            </div>
                            <span className="text-gray-400 text-xs">→</span>
                        </button>
                        <button
                            onClick={handleOpenVoice}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                            <div className="flex items-center gap-2.5">
                                <Mic className="w-4 h-4 text-cyan-500" />
                                <span className="text-sm text-gray-900 dark:text-gray-100">
                                    {t("Voice")}
                                </span>
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {entity?.voice?.voiceName ||
                                        t("Default")}
                                </span>
                            </div>
                            <span className="text-gray-400 text-xs">→</span>
                        </button>
                        <button
                            onClick={handleOpenMemory}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors last:rounded-b-lg"
                        >
                            <div className="flex items-center gap-2.5">
                                <Brain className="w-4 h-4 text-purple-500" />
                                <span className="text-sm text-gray-900 dark:text-gray-100">
                                    {t("Memory")}
                                </span>
                            </div>
                            <span className="text-gray-400 text-xs">→</span>
                        </button>
                    </div>

                    {/* Life Loop (Pulse) */}
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                                <Heart className="w-3.5 h-3.5 text-rose-500" />
                                {t("Life Loop")}
                            </label>
                            <button
                                type="button"
                                onClick={() => setPulseEnabled(!pulseEnabled)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                    pulseEnabled
                                        ? "bg-rose-500"
                                        : "bg-gray-300 dark:bg-gray-600"
                                }`}
                            >
                                <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                        pulseEnabled
                                            ? "translate-x-[18px]"
                                            : "translate-x-0.5"
                                    }`}
                                />
                            </button>
                        </div>

                        {pulseEnabled && (
                            <div className="space-y-2 mt-2">
                                <div className="flex items-center gap-2">
                                    <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                        {t("Every")}
                                    </label>
                                    <select
                                        value={pulseInterval}
                                        onChange={(e) =>
                                            setPulseInterval(
                                                parseInt(e.target.value, 10),
                                            )
                                        }
                                        className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                    >
                                        <option value={5}>5 min</option>
                                        <option value={10}>10 min</option>
                                        <option value={15}>15 min</option>
                                        <option value={30}>30 min</option>
                                        <option value={60}>1 hr</option>
                                        <option value={120}>2 hr</option>
                                        <option value={240}>4 hr</option>
                                        <option value={480}>8 hr</option>
                                        <option value={720}>12 hr</option>
                                        <option value={1440}>24 hr</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                                        {t("Active hours (optional)")}
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="time"
                                            value={pulseActiveStart}
                                            onChange={(e) =>
                                                setPulseActiveStart(
                                                    e.target.value,
                                                )
                                            }
                                            className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                        />
                                        <span className="text-xs text-gray-400">
                                            –
                                        </span>
                                        <input
                                            type="time"
                                            value={pulseActiveEnd}
                                            onChange={(e) =>
                                                setPulseActiveEnd(
                                                    e.target.value,
                                                )
                                            }
                                            className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                        />
                                        {(pulseActiveStart ||
                                            pulseActiveEnd) && (
                                            <select
                                                value={pulseTimezone}
                                                onChange={(e) =>
                                                    setPulseTimezone(
                                                        e.target.value,
                                                    )
                                                }
                                                className="w-24 px-1 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                                            >
                                                <option value="UTC">UTC</option>
                                                <option value="America/New_York">
                                                    ET
                                                </option>
                                                <option value="America/Chicago">
                                                    CT
                                                </option>
                                                <option value="America/Denver">
                                                    MT
                                                </option>
                                                <option value="America/Los_Angeles">
                                                    PT
                                                </option>
                                                <option value="Europe/London">
                                                    GMT
                                                </option>
                                                <option value="Europe/Paris">
                                                    CET
                                                </option>
                                                <option value="Asia/Tokyo">
                                                    JST
                                                </option>
                                                <option value="Australia/Sydney">
                                                    AEST
                                                </option>
                                            </select>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 shrink-0">
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
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : t("Save")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Settings,
    Brain,
    Sparkles,
    Loader2,
    Lock,
    Unlock,
    Wrench,
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
    onEntityUpdate,
}) {
    const { t } = useTranslation();
    const [preferredModel, setPreferredModel] = useState(
        entity?.preferredModel || DEFAULT_AGENT_MODEL,
    );
    const [forceModel, setForceModel] = useState(!!entity?.modelOverride);
    const [reasoningEffort, setReasoningEffort] = useState(
        entity?.reasoningEffort || "medium",
    );
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

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

        setHasChanges(modelChanged || forceChanged || effortChanged);
    }, [preferredModel, forceModel, reasoningEffort, entity]);

    const handleSave = async () => {
        if (!entity?.id || !hasChanges) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/entities/${entity.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    // If force is checked, set modelOverride and clear preferredModel
                    // If force is unchecked, set preferredModel and clear modelOverride
                    preferredModel: forceModel ? null : preferredModel,
                    modelOverride: forceModel ? preferredModel : null,
                    reasoningEffort,
                }),
            });

            const result = await response.json();
            if (result.success) {
                if (onEntityUpdate) {
                    onEntityUpdate(result.entity);
                }
                setHasChanges(false);
                onClose();
            }
        } catch (error) {
            console.error("Failed to save entity settings:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenMemory = () => {
        onClose();
        if (onOpenMemoryEditor) {
            onOpenMemoryEditor(entity.id, entity.name);
        }
    };

    const handleOpenTools = () => {
        onClose();
        if (onOpenToolsEditor) {
            onOpenToolsEditor(entity.id, entity.name, entity.tools || []);
        }
    };

    // Get tools count for display
    const toolsCount = entity?.tools?.length || 0;
    const hasAllTools = entity?.tools?.includes("*");

    if (!entity) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                className="sm:max-w-md"
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

                <div className="space-y-6 mt-4">
                    {/* Preferred Model */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <Sparkles className="w-4 h-4 inline mr-1.5 text-cyan-500" />
                            {t("Preferred Model")}
                        </label>
                        <select
                            value={preferredModel}
                            onChange={(e) => setPreferredModel(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
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
                        {/* Force Model Toggle */}
                        <div className="flex items-center gap-2 mt-2">
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
                                        ? t("Click to unlock")
                                        : t("Click to lock")
                                }
                            >
                                {forceModel ? (
                                    <Lock className="w-4 h-4" />
                                ) : (
                                    <Unlock className="w-4 h-4" />
                                )}
                            </button>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                                {forceModel
                                    ? t("Entity MUST use this model")
                                    : t("Entity prefers this model")}
                            </span>
                        </div>
                    </div>

                    {/* Reasoning Effort */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            {t("Reasoning Effort")}
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {REASONING_EFFORT_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() =>
                                        setReasoningEffort(option.value)
                                    }
                                    className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                                        reasoningEffort === option.value
                                            ? "bg-cyan-50 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300"
                                            : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                                    }`}
                                >
                                    <div className="font-medium">
                                        {t(option.label)}
                                    </div>
                                    <div className="text-xs opacity-70">
                                        {t(option.description)}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {t("How much time the entity spends thinking")}
                        </p>
                    </div>

                    {/* Tools Editor Link */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleOpenTools}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Wrench className="w-5 h-5 text-orange-500" />
                                <div className="text-left">
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {t("Tools & Capabilities")}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {hasAllTools
                                            ? t("All tools enabled")
                                            : toolsCount > 0
                                              ? t("{{count}} tools enabled", {
                                                    count: toolsCount,
                                                })
                                              : t("No tools enabled")}
                                    </div>
                                </div>
                            </div>
                            <span className="text-gray-400">→</span>
                        </button>
                    </div>

                    {/* Memory Editor Link */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleOpenMemory}
                            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <Brain className="w-5 h-5 text-purple-500" />
                                <div className="text-left">
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {t("Memory Editor")}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {t(
                                            "View and edit what this entity remembers",
                                        )}
                                    </div>
                                </div>
                            </div>
                            <span className="text-gray-400">→</span>
                        </button>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        {t("Cancel")}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        className="px-4 py-2 text-sm rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                        {isSaving && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        {t("Save")}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

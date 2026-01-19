"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import FilterInput from "../common/FilterInput";

/**
 * ToolsEditorContent - Content for the tools selection modal
 */
const ToolsEditorContent = ({
    entityId,
    entityTools = [],
    onClose,
    onSave,
}) => {
    const { t } = useTranslation();
    const [availableTools, setAvailableTools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTools, setSelectedTools] = useState(new Set());

    // Check if entity has wildcard (legacy "all tools" mode)
    const hasWildcard = entityTools.includes("*");

    // Fetch available tools on mount
    useEffect(() => {
        setLoading(true);
        setError(null);
        fetch("/api/tools")
            .then((res) => res.json())
            .then((data) => {
                if (data.error) {
                    setError(data.error);
                } else {
                    const tools = data.tools || [];
                    setAvailableTools(tools);

                    // Initialize selected tools
                    if (hasWildcard) {
                        // Wildcard means all tools enabled
                        setSelectedTools(
                            new Set(tools.map((t) => t.name.toLowerCase())),
                        );
                    } else {
                        setSelectedTools(
                            new Set(entityTools.map((t) => t.toLowerCase())),
                        );
                    }
                }
            })
            .catch((err) => {
                setError(err.message || "Failed to load tools");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [entityTools, hasWildcard]);

    // Sort and filter tools
    const filteredTools = useMemo(() => {
        let tools = [...availableTools].sort((a, b) =>
            a.name.localeCompare(b.name),
        );

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            tools = tools.filter(
                (tool) =>
                    tool.name.toLowerCase().includes(query) ||
                    tool.description?.toLowerCase().includes(query),
            );
        }

        return tools;
    }, [availableTools, searchQuery]);

    const handleToggle = (toolName) => {
        const lowerName = toolName.toLowerCase();
        setSelectedTools((prev) => {
            const next = new Set(prev);
            if (next.has(lowerName)) {
                next.delete(lowerName);
            } else {
                next.add(lowerName);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedTools(
            new Set(availableTools.map((t) => t.name.toLowerCase())),
        );
    };

    const handleSelectNone = () => {
        setSelectedTools(new Set());
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const toolsArray = Array.from(selectedTools);
            await onSave(toolsArray);
            onClose();
        } catch (err) {
            setError(err.message || "Failed to save tools");
        } finally {
            setSaving(false);
        }
    };

    const enabledCount = selectedTools.size;
    const totalCount = availableTools.length;

    return (
        <div className="flex flex-col h-[60vh] min-h-[400px]">
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
                            {t("Loading tools...")}
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Search and counts */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                        <div className="flex-1">
                            <FilterInput
                                value={searchQuery}
                                onChange={setSearchQuery}
                                onClear={() => setSearchQuery("")}
                                placeholder={t("Search tools...")}
                                className="w-full"
                            />
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                                {enabledCount} / {totalCount}
                            </span>
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-cyan-600 dark:text-cyan-400 hover:underline"
                            >
                                {t("All")}
                            </button>
                            <span className="text-gray-300 dark:text-gray-600">
                                |
                            </span>
                            <button
                                type="button"
                                onClick={handleSelectNone}
                                className="text-cyan-600 dark:text-cyan-400 hover:underline"
                            >
                                {t("None")}
                            </button>
                        </div>
                    </div>

                    {hasWildcard && (
                        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded mb-3">
                            {t(
                                "This entity had all tools enabled. Saving will update to explicit tool selection.",
                            )}
                        </div>
                    )}

                    {/* Tools grid */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                        {filteredTools.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                {searchQuery
                                    ? t("No tools match your search")
                                    : t("No tools available")}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {filteredTools.map((tool) => {
                                    const isEnabled = selectedTools.has(
                                        tool.name.toLowerCase(),
                                    );
                                    return (
                                        <button
                                            key={tool.name}
                                            type="button"
                                            onClick={() =>
                                                handleToggle(tool.name)
                                            }
                                            className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                                                isEnabled
                                                    ? "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-700"
                                                    : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <div
                                                className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${
                                                    isEnabled
                                                        ? "bg-cyan-500 border-cyan-500 text-white"
                                                        : "border-gray-300 dark:border-gray-500"
                                                }`}
                                            >
                                                {isEnabled && (
                                                    <Check className="w-3 h-3" />
                                                )}
                                            </div>

                                            {/* Icon */}
                                            <span className="flex-shrink-0 text-xl">
                                                {tool.icon || "🔧"}
                                            </span>

                                            {/* Name and description */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                                    {tool.name}
                                                </div>
                                                {tool.description && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                                        {tool.description}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
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
                            disabled={saving}
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
 * ToolsEditor - Modal for editing entity tools
 */
const ToolsEditor = ({
    show,
    onClose,
    entityId,
    entityName,
    entityTools,
    onSave,
}) => {
    const { t } = useTranslation();
    return (
        <Modal
            widthClassName="max-w-4xl"
            title={
                t("Tools & Capabilities") +
                (entityName ? ` - ${entityName}` : "")
            }
            show={show}
            onHide={onClose}
        >
            <ToolsEditorContent
                entityId={entityId}
                entityTools={entityTools}
                onClose={onClose}
                onSave={onSave}
            />
        </Modal>
    );
};

export default ToolsEditor;

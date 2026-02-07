"use client";

import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Eye, EyeOff, Loader2, KeyRound } from "lucide-react";
import { toast } from "react-toastify";
import { Modal } from "@/components/ui/modal";

const SECRET_NAME_REGEX = /^[A-Z_][A-Z0-9_]*$/;

/**
 * SecretsEditorContent - Manage entity secrets (API keys, tokens, etc.)
 * Secrets are write-only: only key names are visible, values are never returned.
 */
const SecretsEditorContent = ({
    entityId,
    existingKeys = [],
    onClose,
    onSave,
}) => {
    const { t } = useTranslation();
    const [secrets, setSecrets] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    // Initialize from existing keys (values are never returned from API)
    useEffect(() => {
        setSecrets(
            existingKeys.map((key) => ({
                name: key,
                value: "",
                isExisting: true,
                showValue: false,
                changed: false,
            })),
        );
    }, [existingKeys]);

    const addSecret = () => {
        setSecrets((prev) => [
            ...prev,
            {
                name: "",
                value: "",
                isExisting: false,
                showValue: true,
                changed: true,
            },
        ]);
    };

    const removeSecret = (index) => {
        const secret = secrets[index];
        if (secret.isExisting) {
            // Mark for deletion
            setSecrets((prev) =>
                prev.map((s, i) =>
                    i === index ? { ...s, deleted: true, changed: true } : s,
                ),
            );
        } else {
            // Remove new unsaved entry
            setSecrets((prev) => prev.filter((_, i) => i !== index));
        }
    };

    const undoDelete = (index) => {
        setSecrets((prev) =>
            prev.map((s, i) =>
                i === index ? { ...s, deleted: false, changed: false } : s,
            ),
        );
    };

    const updateSecret = (index, field, value) => {
        setSecrets((prev) =>
            prev.map((s, i) =>
                i === index ? { ...s, [field]: value, changed: true } : s,
            ),
        );
    };

    const hasChanges = secrets.some((s) => s.changed);

    const handleSave = async () => {
        // Validate
        for (const secret of secrets) {
            if (secret.deleted) continue;
            if (!secret.name) {
                toast.error(t("Secret name is required"));
                return;
            }
            if (!SECRET_NAME_REGEX.test(secret.name)) {
                toast.error(
                    t(
                        '"{{name}}" must be UPPER_SNAKE_CASE (e.g. GITHUB_TOKEN)',
                        {
                            name: secret.name,
                        },
                    ),
                );
                return;
            }
            if (!secret.isExisting && !secret.value) {
                toast.error(
                    t('Value is required for new secret "{{name}}"', {
                        name: secret.name,
                    }),
                );
                return;
            }
        }

        // Check for duplicate names
        const names = secrets.filter((s) => !s.deleted).map((s) => s.name);
        const dupes = names.filter((n, i) => names.indexOf(n) !== i);
        if (dupes.length > 0) {
            toast.error(
                t("Duplicate secret name: {{name}}", { name: dupes[0] }),
            );
            return;
        }

        // Build secrets payload: changed values + deletions
        const payload = {};
        for (const secret of secrets) {
            if (secret.deleted) {
                payload[secret.name] = null;
            } else if (secret.changed && secret.value) {
                payload[secret.name] = secret.value;
            }
        }

        if (Object.keys(payload).length === 0) {
            onClose();
            return;
        }

        setIsSaving(true);
        try {
            await onSave(payload);
            toast.success(t("Secrets updated"));
            onClose();
        } catch (error) {
            toast.error(error.message || t("Failed to save secrets"));
        } finally {
            setIsSaving(false);
        }
    };

    const activeSecrets = secrets.filter((s) => !s.deleted);
    const deletedSecrets = secrets.filter((s) => s.deleted);

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
                {t(
                    "Store API keys and tokens securely. Secrets are encrypted and available in the workspace as environment variables.",
                )}
            </p>

            {/* Secret rows */}
            <div className="space-y-2">
                {activeSecrets.map((secret) => {
                    const index = secrets.indexOf(secret);
                    return (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                type="text"
                                value={secret.name}
                                onChange={(e) =>
                                    updateSecret(
                                        index,
                                        "name",
                                        e.target.value
                                            .toUpperCase()
                                            .replace(/[^A-Z0-9_]/g, ""),
                                    )
                                }
                                disabled={secret.isExisting}
                                placeholder="SECRET_NAME"
                                className="w-40 px-2 py-1.5 text-sm font-mono border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60 disabled:bg-gray-50 dark:disabled:bg-gray-800"
                            />
                            <div className="relative flex-1">
                                <input
                                    type={
                                        secret.showValue ? "text" : "password"
                                    }
                                    value={secret.value}
                                    onChange={(e) =>
                                        updateSecret(
                                            index,
                                            "value",
                                            e.target.value,
                                        )
                                    }
                                    placeholder={
                                        secret.isExisting
                                            ? t("Enter new value to update")
                                            : t("Secret value")
                                    }
                                    className="w-full px-2 py-1.5 pr-8 text-sm font-mono border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateSecret(
                                            index,
                                            "showValue",
                                            !secret.showValue,
                                        )
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    {secret.showValue ? (
                                        <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeSecret(index)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                title={t("Delete secret")}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    );
                })}

                {/* Deleted secrets (with undo) */}
                {deletedSecrets.map((secret) => {
                    const index = secrets.indexOf(secret);
                    return (
                        <div
                            key={index}
                            className="flex items-center gap-2 opacity-50"
                        >
                            <span className="w-40 px-2 py-1.5 text-sm font-mono line-through text-gray-400">
                                {secret.name}
                            </span>
                            <span className="flex-1 text-sm text-gray-400 italic">
                                {t("Will be deleted")}
                            </span>
                            <button
                                type="button"
                                onClick={() => undoDelete(index)}
                                className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t("Undo")}
                            </button>
                        </div>
                    );
                })}

                {activeSecrets.length === 0 && deletedSecrets.length === 0 && (
                    <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                        {t("No secrets configured")}
                    </div>
                )}
            </div>

            {/* Add + Save buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                <button
                    type="button"
                    onClick={addSecret}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" />
                    {t("Add Secret")}
                </button>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        {t("Cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        className="px-4 py-1.5 text-sm rounded-lg bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[4rem]"
                    >
                        {isSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                        ) : (
                            t("Save")
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * SecretsEditor - Modal wrapper
 */
const SecretsEditor = ({
    show,
    onClose,
    entityId,
    entityName,
    secretKeys,
    onSave,
}) => {
    const { t } = useTranslation();
    return (
        <Modal
            show={show}
            onHide={onClose}
            widthClassName="max-w-lg"
            title={
                <span className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-amber-500" />
                    {t("Secrets") + (entityName ? ` - ${entityName}` : "")}
                </span>
            }
        >
            <SecretsEditorContent
                entityId={entityId}
                existingKeys={secretKeys}
                onClose={onClose}
                onSave={onSave}
            />
        </Modal>
    );
};

export default SecretsEditor;

"use client";

import {
    useContext,
    useEffect,
    useRef,
    useState,
    useMemo,
    useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import {
    Download,
    Upload,
    Plus,
    X,
    Edit2,
    CheckSquare,
    Square,
    Filter,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
} from "@/components/ui/tooltip";
import { LanguageContext } from "../contexts/LanguageProvider";
import FilterInput from "./common/FilterInput";
import BulkActionsBar from "./common/BulkActionsBar";
import EmptyState from "./common/EmptyState";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useItemSelection } from "./images/hooks/useItemSelection";
import { Modal } from "@/components/ui/modal";

// Memory types from continuity memory design
const MEMORY_TYPES = [
    { value: "CORE", label: "Core" },
    { value: "CORE_EXTENSION", label: "Core Extension" },
    { value: "CAPABILITY", label: "Capability" },
    { value: "ANCHOR", label: "Anchor" },
    { value: "ARTIFACT", label: "Artifact" },
    { value: "IDENTITY", label: "Identity" },
    { value: "EXPRESSION", label: "Expression" },
    { value: "VALUE", label: "Value" },
    { value: "EPISODE", label: "Episode" },
];

function ContinuityMemoryItem({
    item,
    onEdit,
    onDelete,
    isEditing,
    onSaveEdit,
    onCancelEdit,
    isSelected,
    onToggleSelect,
    memoryTypes,
}) {
    const { t } = useTranslation();
    const { direction } = useContext(LanguageContext);
    const isRTL = direction === "rtl";
    const [editContent, setEditContent] = useState(item.content || "");
    const [editType, setEditType] = useState(item.type || "ANCHOR");
    const [editImportance, setEditImportance] = useState(
        String(item.importance || 5),
    );
    const [editTags, setEditTags] = useState(
        (item.tags || []).join(", ") || "",
    );
    const textareaRef = useRef(null);

    useEffect(() => {
        if (isEditing) {
            setEditContent(item.content || "");
            setEditType(item.type || "ANCHOR");
            setEditImportance(String(item.importance || 5));
            setEditTags((item.tags || []).join(", ") || "");
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                    if (item.content) {
                        textareaRef.current.select();
                    }
                }
            }, 100);
        }
    }, [
        isEditing,
        item.id,
        item.content,
        item.type,
        item.importance,
        item.tags,
    ]);

    const handleSave = () => {
        const tagsArray = editTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        onSaveEdit(item.id, {
            content: editContent,
            type: editType,
            importance: parseInt(editImportance) || 5,
            tags: tagsArray,
        });
    };

    if (isEditing) {
        return (
            <div
                data-item-id={item.id}
                className="bg-white dark:bg-gray-800 border-2 border-sky-500 rounded p-1.5 mb-1"
                dir={direction}
            >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                    <div>
                        <label
                            className={`block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5 ${isRTL ? "text-right" : "text-left"}`}
                        >
                            {t("Type")}
                        </label>
                        <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value)}
                            className="lb-input w-full text-xs"
                            dir={direction}
                        >
                            {memoryTypes.map((mt) => (
                                <option key={mt.value} value={mt.value}>
                                    {mt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label
                            className={`block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5 ${isRTL ? "text-right" : "text-left"}`}
                        >
                            {t("Importance")} (1-10)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={editImportance}
                            onChange={(e) => setEditImportance(e.target.value)}
                            className="lb-input w-full text-xs"
                            placeholder="5"
                            dir={direction}
                        />
                    </div>
                    <div>
                        <label
                            className={`block text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-0.5 ${isRTL ? "text-right" : "text-left"}`}
                        >
                            {t("Tags")} ({t("comma separated")})
                        </label>
                        <input
                            type="text"
                            value={editTags}
                            onChange={(e) => setEditTags(e.target.value)}
                            className="lb-input w-full text-xs"
                            placeholder="tag1, tag2"
                            dir={direction}
                        />
                    </div>
                </div>
                <textarea
                    ref={textareaRef}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="lb-input font-mono w-full text-xs mb-1.5 resize-none"
                    rows={3}
                    dir={direction}
                    placeholder={t("Memory content...")}
                />
                <div
                    className={`flex gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}
                >
                    <button
                        onClick={handleSave}
                        className="lb-primary text-[10px] px-1.5 py-0.5"
                    >
                        {t("Save")}
                    </button>
                    <button
                        onClick={() => {
                            setEditContent(item.content || "");
                            setEditType(item.type || "ANCHOR");
                            setEditImportance(String(item.importance || 5));
                            setEditTags((item.tags || []).join(", ") || "");
                            onCancelEdit();
                        }}
                        className="lb-outline-secondary text-[10px] px-1.5 py-0.5"
                    >
                        {t("Cancel")}
                    </button>
                </div>
            </div>
        );
    }

    const typeLabel =
        memoryTypes.find((mt) => mt.value === item.type)?.label || item.type;

    return (
        <div
            data-item-id={item.id}
            className={`bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-1.5 mb-1 ${
                isSelected ? "ring-1 ring-sky-500" : ""
            }`}
            dir={direction}
        >
            <div
                className={`flex items-start gap-1.5 ${isRTL ? "flex-row-reverse" : ""}`}
            >
                {isRTL ? (
                    <>
                        <div className="flex gap-0.5 flex-shrink-0">
                            <button
                                onClick={() => onEdit(item.id)}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                title={t("Edit")}
                            >
                                <Edit2 className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                            </button>
                            <button
                                onClick={() => onDelete(item.id)}
                                className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                title={t("Delete")}
                            >
                                <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                            </button>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words mb-1">
                                {item.content || t("(empty)")}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap flex-row-reverse">
                                <span className="font-mono">
                                    {new Date(
                                        item.timestamp || Date.now(),
                                    ).toLocaleString()}
                                </span>
                                <span className="font-mono bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded">
                                    {t("Imp")}: {item.importance || 5}
                                </span>
                                <span className="font-medium">{typeLabel}</span>
                                {item.tags && item.tags.length > 0 && (
                                    <span className="text-gray-400">
                                        {item.tags.join(", ")}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => onToggleSelect(item)}
                            className="flex-shrink-0 mt-0.5"
                        >
                            {isSelected ? (
                                <CheckSquare className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                            ) : (
                                <Square className="h-3 w-3 text-gray-400" />
                            )}
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => onToggleSelect(item)}
                            className="flex-shrink-0 mt-0.5"
                        >
                            {isSelected ? (
                                <CheckSquare className="h-3 w-3 text-sky-600 dark:text-sky-400" />
                            ) : (
                                <Square className="h-3 w-3 text-gray-400" />
                            )}
                        </button>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words mb-1">
                                {item.content || t("(empty)")}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 flex-wrap">
                                <span className="font-medium">{typeLabel}</span>
                                <span className="font-mono bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded">
                                    {t("Imp")}: {item.importance || 5}
                                </span>
                                {item.tags && item.tags.length > 0 && (
                                    <span className="text-gray-400">
                                        {item.tags.join(", ")}
                                    </span>
                                )}
                                <span className="font-mono">
                                    {new Date(
                                        item.timestamp || Date.now(),
                                    ).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0">
                            <button
                                onClick={() => onEdit(item.id)}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                title={t("Edit")}
                            >
                                <Edit2 className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                            </button>
                            <button
                                onClick={() => onDelete(item.id)}
                                className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                                title={t("Delete")}
                            >
                                <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export const ContinuityMemoryEditorContent = ({
    entityId,
    entityName,
    onClose,
}) => {
    const { t } = useTranslation();
    const { direction } = useContext(LanguageContext);
    const isRTL = direction === "rtl";
    const fileInputRef = useRef();
    const containerRef = useRef(null);

    const [memories, setMemories] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState("timestamp");
    const [sortOrder, setSortOrder] = useState("desc");
    const [typeFilter, setTypeFilter] = useState("all");
    const [importanceFilter, setImportanceFilter] = useState("all");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteIdToDelete, setDeleteIdToDelete] = useState(null);
    const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] =
        useState(false);

    // Use the common selection hook
    const { selectedIds, toggleSelection, clearSelection, setSelectedIds } =
        useItemSelection((item) => item.id);

    // Load memories on mount
    const loadMemories = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await fetch(`/api/entities/${entityId}/memory`);
            const data = await response.json();
            if (data.success) {
                setMemories(data.memories || []);
            } else {
                setError(data.error || t("Failed to load memories"));
            }
        } catch (error) {
            console.error("Error loading memories:", error);
            setError(error.message || t("Failed to load memories"));
        } finally {
            setLoading(false);
        }
    }, [entityId, t]);

    useEffect(() => {
        if (entityId) {
            loadMemories();
        }
    }, [entityId, loadMemories]);

    const filteredMemories = useMemo(() => {
        let filtered = [...memories];

        // Filter by search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (mem) =>
                    mem.content?.toLowerCase().includes(query) ||
                    mem.tags?.some((tag) => tag.toLowerCase().includes(query)),
            );
        }

        // Filter by type
        if (typeFilter !== "all") {
            filtered = filtered.filter((mem) => mem.type === typeFilter);
        }

        // Filter by importance
        if (importanceFilter !== "all") {
            const minImp = parseInt(importanceFilter);
            filtered = filtered.filter(
                (mem) => (mem.importance || 5) >= minImp,
            );
        }

        // Sort
        filtered.sort((a, b) => {
            let comparison = 0;
            if (sortBy === "timestamp") {
                comparison =
                    new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
            } else if (sortBy === "importance") {
                comparison = (a.importance || 5) - (b.importance || 5);
            } else if (sortBy === "content") {
                comparison = (a.content || "").localeCompare(b.content || "");
            } else if (sortBy === "type") {
                comparison = (a.type || "").localeCompare(b.type || "");
            }
            return sortOrder === "asc" ? comparison : -comparison;
        });

        return filtered;
    }, [
        memories,
        searchQuery,
        typeFilter,
        importanceFilter,
        sortBy,
        sortOrder,
    ]);

    const allSelected = useMemo(
        () =>
            filteredMemories.length > 0 &&
            filteredMemories.every((mem) => selectedIds.has(mem.id)),
        [filteredMemories, selectedIds],
    );

    const handleAddItem = () => {
        const newMemory = {
            id: `temp-${Date.now()}`,
            type: "ANCHOR",
            content: "",
            importance: 5,
            tags: [],
            timestamp: new Date().toISOString(),
        };
        const newMemories = [...memories, newMemory];
        setMemories(newMemories);
        setSearchQuery("");
        setTypeFilter("all");
        setImportanceFilter("all");
        setEditingId(newMemory.id);
        setTimeout(() => {
            const element = document.querySelector(
                `[data-item-id="${newMemory.id}"]`,
            );
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 150);
    };

    const handleEdit = (id) => {
        setEditingId(id);
    };

    const handleSaveEdit = async (id, updates) => {
        const memory = memories.find((m) => m.id === id);
        if (!memory) return;

        // If it's a temp ID, create new memory
        if (id.startsWith("temp-")) {
            try {
                setSaving(true);
                const response = await fetch(
                    `/api/entities/${entityId}/memory`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            ...updates,
                            timestamp: new Date().toISOString(),
                        }),
                    },
                );
                const data = await response.json();
                if (data.success) {
                    // Refresh the list to get the latest state from server
                    await loadMemories();
                    setEditingId(null);
                } else {
                    setError(data.error || t("Failed to save memory"));
                }
            } catch (error) {
                console.error("Error saving memory:", error);
                setError(error.message || t("Failed to save memory"));
            } finally {
                setSaving(false);
            }
        } else {
            // Update existing memory
            try {
                setSaving(true);
                const response = await fetch(
                    `/api/entities/${entityId}/memory/${id}`,
                    {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(updates),
                    },
                );
                const data = await response.json();
                if (data.success) {
                    // Refresh the list to get the latest state from server
                    await loadMemories();
                    setEditingId(null);
                } else {
                    setError(data.error || t("Failed to update memory"));
                }
            } catch (error) {
                console.error("Error updating memory:", error);
                setError(error.message || t("Failed to update memory"));
            } finally {
                setSaving(false);
            }
        }
    };

    const handleCancelEdit = () => {
        // Remove temp memories that weren't saved
        const cleaned = memories.filter((m) => !m.id.startsWith("temp-"));
        setMemories(cleaned);
        setEditingId(null);
    };

    const handleDelete = (id) => {
        setDeleteIdToDelete(id);
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        const id = deleteIdToDelete;
        if (!id) return;

        // Remove temp memories immediately
        if (id.startsWith("temp-")) {
            const filtered = memories.filter((m) => m.id !== id);
            setMemories(filtered);
            if (selectedIds.has(id)) {
                toggleSelection({ id });
            }
            setShowDeleteConfirm(false);
            setDeleteIdToDelete(null);
            return;
        }

        try {
            setDeleting(true);
            const response = await fetch(
                `/api/entities/${entityId}/memory/${id}`,
                {
                    method: "DELETE",
                },
            );
            if (response.ok) {
                // Refresh the list to get latest state
                await loadMemories();
                if (selectedIds.has(id)) {
                    toggleSelection({ id });
                }
            } else {
                const data = await response.json();
                setError(data.error || t("Failed to delete memory"));
            }
        } catch (error) {
            console.error("Error deleting memory:", error);
            setError(error.message || t("Failed to delete memory"));
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
            setDeleteIdToDelete(null);
        }
    };

    const handleDeleteSelected = () => {
        setShowDeleteSelectedConfirm(true);
    };

    const handleConfirmDeleteSelected = async () => {
        const toDelete = Array.from(selectedIds);
        if (toDelete.length === 0) {
            setShowDeleteSelectedConfirm(false);
            return;
        }

        try {
            setDeleting(true);
            // Delete all selected memories
            const deletePromises = toDelete
                .filter((id) => !id.startsWith("temp-"))
                .map((id) =>
                    fetch(`/api/entities/${entityId}/memory/${id}`, {
                        method: "DELETE",
                    }),
                );

            await Promise.all(deletePromises);
            // Refresh the list to get latest state
            await loadMemories();
            clearSelection();
        } catch (error) {
            console.error("Error deleting selected memories:", error);
            setError(error.message || t("Failed to delete selected memories"));
        } finally {
            setDeleting(false);
            setShowDeleteSelectedConfirm(false);
        }
    };

    const handleToggleSelect = (item) => {
        toggleSelection(item);
    };

    const handleSelectAll = () => {
        if (allSelected) {
            clearSelection();
        } else {
            setSelectedIds(new Set(filteredMemories.map((mem) => mem.id)));
        }
    };

    const handleClear = () => {
        setShowClearConfirm(true);
    };

    const handleConfirmClear = async () => {
        try {
            setDeleting(true);
            setError("");

            // Use bulk delete endpoint
            const response = await fetch(`/api/entities/${entityId}/memory`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || t("Failed to clear memories"));
            }

            // Refresh the list to get latest state
            await loadMemories();
            clearSelection();
            setShowClearConfirm(false);
        } catch (error) {
            console.error("Error clearing memories:", error);
            setError(error.message || t("Failed to clear memories"));
        } finally {
            setDeleting(false);
        }
    };

    const handleDownload = async () => {
        try {
            setExporting(true);
            // Export all memories to JSON (idempotent - includes all fields including vectors)
            const exportData = memories.map((mem) => {
                // Include all fields including vectors for idempotent import
                return mem;
            });
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const now = new Date();
            const date = now.toISOString().split("T")[0];
            const time = now.toTimeString().split(" ")[0].replace(/:/g, "-");
            a.download = `${(entityName || "entity").toLowerCase()}-continuity-memory-${date}-${time}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error exporting memories:", error);
            setError(error.message || t("Failed to export memories"));
        } finally {
            // Small delay to show spinner briefly for better UX
            setTimeout(() => setExporting(false), 300);
        }
    };

    const handleUpload = async (event) => {
        const file = event.target.files[0];
        setError("");
        if (file) {
            setImporting(true);
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const uploaded = JSON.parse(e.target.result);
                    if (!Array.isArray(uploaded)) {
                        throw new Error(t("Invalid memory file format"));
                    }

                    // Validate and clean memories (preserve vectors, remove entityId/userId)
                    const cleanedMemories = uploaded.map((mem) => {
                        const { entityId, userId, assocEntityIds, ...rest } =
                            mem;
                        // Keep contentVector - it should be preserved for idempotent import
                        return rest;
                    });

                    // Import via PUT (replaces all)
                    setSaving(true);
                    const response = await fetch(
                        `/api/entities/${entityId}/memory`,
                        {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ memories: cleanedMemories }),
                        },
                    );
                    const data = await response.json();
                    if (data.success) {
                        await loadMemories();
                    } else {
                        setError(data.error || t("Failed to import memories"));
                    }
                } catch (error) {
                    console.error("Failed to parse memory file:", error);
                    setError(
                        t(
                            "Failed to parse memory file. Please ensure it is a valid JSON file with the correct memory structure.",
                        ),
                    );
                    if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                    }
                } finally {
                    setSaving(false);
                    setImporting(false);
                    if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                    }
                }
            };
            reader.onerror = () => {
                setError(t("Failed to read the file. Please try again."));
                setImporting(false);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            };
            reader.readAsText(file);
        }
    };

    const clearAllFilters = () => {
        setSearchQuery("");
        setTypeFilter("all");
        setImportanceFilter("all");
    };

    const hasActiveFilters =
        searchQuery || typeFilter !== "all" || importanceFilter !== "all";

    const actionButtonClass =
        "flex items-center justify-center w-9 h-9 rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors";
    const clearButtonClass =
        "flex items-center justify-center w-9 h-9 rounded-md border border-red-300 dark:border-red-600 bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors";

    const sortOptions = [
        { value: "timestamp", label: t("Timestamp") },
        { value: "type", label: t("Type") },
        { value: "importance", label: t("Importance") },
        { value: "content", label: t("Content") },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-200px)] min-h-[600px]">
            {error && (
                <div
                    className={`text-red-500 text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded mb-3 ${isRTL ? "text-right" : "text-left"}`}
                    dir={direction}
                >
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center">
                            <Spinner size="sm" />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 leading-none">
                            {t("Loading memories...")}
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Filter and Action Controls */}
                    <div
                        className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 ${isRTL ? "items-end sm:items-center" : ""}`}
                    >
                        {/* Search */}
                        <div className="w-full sm:flex-1 sm:max-w-lg">
                            <FilterInput
                                value={searchQuery}
                                onChange={setSearchQuery}
                                onClear={() => setSearchQuery("")}
                                placeholder={t("Search content or tags...")}
                                className="w-full"
                            />
                        </div>

                        {/* Action Buttons */}
                        <div
                            className={`flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto ${isRTL ? "ml-auto sm:ml-0" : "justify-start sm:justify-end"}`}
                        >
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            className={actionButtonClass}
                                            onClick={handleAddItem}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {t("Add Memory")}
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            className={actionButtonClass}
                                            onClick={handleDownload}
                                            disabled={
                                                exporting ||
                                                importing ||
                                                saving ||
                                                deleting
                                            }
                                        >
                                            {exporting ? (
                                                <Spinner className="h-4 w-4" />
                                            ) : (
                                                <Download className="h-4 w-4" />
                                            )}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {exporting
                                            ? t("Exporting...")
                                            : t("Export memories")}
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            className={actionButtonClass}
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                            disabled={
                                                exporting ||
                                                importing ||
                                                saving ||
                                                deleting
                                            }
                                        >
                                            {importing ? (
                                                <Spinner className="h-4 w-4" />
                                            ) : (
                                                <Upload className="h-4 w-4" />
                                            )}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {importing
                                            ? t("Importing...")
                                            : t("Import memories")}
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            className={clearButtonClass}
                                            onClick={handleClear}
                                            disabled={
                                                saving || deleting || loading
                                            }
                                        >
                                            {deleting && (
                                                <Spinner className="h-4 w-4" />
                                            )}
                                            {!deleting && (
                                                <X className="h-4 w-4" />
                                            )}
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {t("Clear All")}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                onChange={handleUpload}
                                className="hidden"
                            />
                        </div>
                    </div>

                    {/* Delete Single Memory Confirmation Dialog */}
                    <AlertDialog
                        open={showDeleteConfirm}
                        onOpenChange={setShowDeleteConfirm}
                    >
                        <AlertDialogContent>
                            <AlertDialogHeader
                                className={isRTL ? "text-right" : ""}
                            >
                                <AlertDialogTitle>
                                    {t("Delete Memory?")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t(
                                        "Are you sure you want to delete this memory? This action cannot be undone.",
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter
                                className={
                                    isRTL
                                        ? "flex-row-reverse sm:flex-row-reverse"
                                        : ""
                                }
                            >
                                <AlertDialogCancel
                                    onClick={() => {
                                        setShowDeleteConfirm(false);
                                        setDeleteIdToDelete(null);
                                    }}
                                >
                                    {t("Cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleConfirmDelete}
                                    disabled={deleting}
                                    className="bg-red-600 hover:bg-red-700 focus:ring-red-600 flex items-center gap-2"
                                >
                                    {deleting && (
                                        <Spinner className="h-4 w-4" />
                                    )}
                                    {t("Delete")}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Delete Selected Memories Confirmation Dialog */}
                    <AlertDialog
                        open={showDeleteSelectedConfirm}
                        onOpenChange={setShowDeleteSelectedConfirm}
                    >
                        <AlertDialogContent>
                            <AlertDialogHeader
                                className={isRTL ? "text-right" : ""}
                            >
                                <AlertDialogTitle>
                                    {t("Delete Selected Memories?")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t(
                                        "Are you sure you want to delete {{count}} selected memory/memories? This action cannot be undone.",
                                        { count: selectedIds.size },
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter
                                className={
                                    isRTL
                                        ? "flex-row-reverse sm:flex-row-reverse"
                                        : ""
                                }
                            >
                                <AlertDialogCancel
                                    onClick={() =>
                                        setShowDeleteSelectedConfirm(false)
                                    }
                                >
                                    {t("Cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleConfirmDeleteSelected}
                                    disabled={deleting}
                                    className="bg-red-600 hover:bg-red-700 focus:ring-red-600 flex items-center gap-2"
                                >
                                    {deleting && (
                                        <Spinner className="h-4 w-4" />
                                    )}
                                    {t("Delete Selected")}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Clear All Confirmation Dialog */}
                    <AlertDialog
                        open={showClearConfirm}
                        onOpenChange={setShowClearConfirm}
                    >
                        <AlertDialogContent>
                            <AlertDialogHeader
                                className={isRTL ? "text-right" : ""}
                            >
                                <AlertDialogTitle>
                                    {t("Clear All Memories?")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t(
                                        "Are you sure you want to clear all memories? This action cannot be undone.",
                                    )}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter
                                className={
                                    isRTL
                                        ? "flex-row-reverse sm:flex-row-reverse"
                                        : ""
                                }
                            >
                                <AlertDialogCancel>
                                    {t("Cancel")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleConfirmClear}
                                    disabled={deleting}
                                    className="bg-red-600 hover:bg-red-700 focus:ring-red-600 flex items-center gap-2"
                                >
                                    {deleting && (
                                        <Spinner className="h-4 w-4" />
                                    )}
                                    {t("Clear All")}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Bulk Actions Bar */}
                    {selectedIds.size > 0 && (
                        <BulkActionsBar
                            selectedCount={selectedIds.size}
                            allSelected={allSelected}
                            onSelectAll={handleSelectAll}
                            onClearSelection={clearSelection}
                            isLoadingAll={deleting}
                            actions={{
                                delete: {
                                    onClick: handleDeleteSelected,
                                    label: t("Delete Selected"),
                                    ariaLabel: t("Delete selected memories"),
                                },
                            }}
                        />
                    )}

                    {/* Filters and Sort Controls */}
                    <div
                        className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2 ${isRTL ? "sm:flex-row-reverse" : ""}`}
                    >
                        {/* Filters */}
                        <div
                            className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse justify-end sm:justify-end" : "justify-start"}`}
                        >
                            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <Select
                                value={typeFilter}
                                onValueChange={setTypeFilter}
                            >
                                <SelectTrigger
                                    className="w-[140px] h-8 text-xs"
                                    dir={direction}
                                >
                                    <SelectValue placeholder={t("Type")} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        {t("All")}
                                    </SelectItem>
                                    {MEMORY_TYPES.map((mt) => (
                                        <SelectItem
                                            key={mt.value}
                                            value={mt.value}
                                        >
                                            {mt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={importanceFilter}
                                onValueChange={setImportanceFilter}
                            >
                                <SelectTrigger
                                    className="w-[120px] h-8 text-xs"
                                    dir={direction}
                                >
                                    <SelectValue
                                        placeholder={t("Importance")}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        {t("All")}
                                    </SelectItem>
                                    {[1, 3, 5, 7, 9].map((imp) => (
                                        <SelectItem
                                            key={imp}
                                            value={String(imp)}
                                        >
                                            {t("≥ {{n}}", { n: imp })}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                {hasActiveFilters
                                    ? `${filteredMemories.length} / ${memories.length}`
                                    : memories.length}{" "}
                                {t(
                                    filteredMemories.length === 1
                                        ? "memory"
                                        : "memories",
                                )}
                            </span>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className={actionButtonClass}
                                    title={t("Clear Filters")}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        {/* Sort */}
                        {filteredMemories.length > 0 && (
                            <div
                                className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse justify-end sm:justify-end" : "justify-start sm:justify-end"}`}
                            >
                                <button
                                    onClick={() =>
                                        setSortOrder(
                                            sortOrder === "asc"
                                                ? "desc"
                                                : "asc",
                                        )
                                    }
                                    className="lb-outline-secondary text-xs px-2 py-1 h-8 min-w-[2rem]"
                                    title={t("Toggle sort order")}
                                >
                                    {sortOrder === "asc" ? "↑" : "↓"}
                                </button>
                                <Select
                                    value={sortBy}
                                    onValueChange={setSortBy}
                                >
                                    <SelectTrigger
                                        className="w-[140px] h-8 text-xs"
                                        dir={direction}
                                    >
                                        <SelectValue placeholder={t("Sort")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sortOptions.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Memories List */}
                    <div
                        className="flex-1 overflow-y-auto min-h-0"
                        ref={containerRef}
                    >
                        {memories.length === 0 ? (
                            <EmptyState
                                icon="🧠"
                                title={t("No memories")}
                                description={t(
                                    "Click 'Add Memory' to create your first memory.",
                                )}
                                action={handleAddItem}
                                actionLabel={t("Add Memory")}
                            />
                        ) : filteredMemories.length === 0 ? (
                            <EmptyState
                                icon="🔍"
                                title={t("No memories match your filters")}
                                description={t(
                                    "Try adjusting your search or filter criteria.",
                                )}
                            />
                        ) : (
                            <div>
                                {filteredMemories.map((memory, index) => (
                                    <ContinuityMemoryItem
                                        key={memory.id || `memory-${index}`}
                                        item={memory}
                                        onEdit={handleEdit}
                                        onDelete={handleDelete}
                                        isEditing={editingId === memory.id}
                                        onSaveEdit={handleSaveEdit}
                                        onCancelEdit={handleCancelEdit}
                                        isSelected={selectedIds.has(memory.id)}
                                        onToggleSelect={handleToggleSelect}
                                        memoryTypes={MEMORY_TYPES}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div
                        className={`flex gap-2 pt-3 mt-3 border-t border-gray-200 dark:border-gray-700 relative z-10 bg-white dark:bg-gray-800 ${isRTL ? "flex-row-reverse justify-start" : "justify-end"}`}
                    >
                        <button
                            className="lb-outline-secondary text-xs flex-1 sm:flex-initial"
                            onClick={onClose}
                            disabled={saving}
                        >
                            {t("Close")}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

const ContinuityMemoryEditor = ({ show, onClose, entityId, entityName }) => {
    const { t } = useTranslation();
    return (
        <Modal
            widthClassName="max-w-6xl"
            title={t("Memory Editor") + (entityName ? ` - ${entityName}` : "")}
            show={show}
            onHide={onClose}
        >
            <ContinuityMemoryEditorContent
                entityId={entityId}
                entityName={entityName}
                onClose={onClose}
            />
        </Modal>
    );
};

export default ContinuityMemoryEditor;

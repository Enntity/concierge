"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import i18next from "i18next";
import {
    ArrowUpDown,
    ChevronUp,
    ChevronDown,
    Check,
    Loader2,
    Eye,
    Trash2,
} from "lucide-react";
import { getFileIcon } from "../../../utils/mediaUtils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    getFilename,
    getFileDate,
    formatFileSize,
    HoverPreview,
} from "../FileManager";
import { INVALID_FILENAME_CHARS } from "../../../utils/fileDownloadUtils";

function SortableHeader({
    children,
    sortKey,
    currentSort,
    currentDirection,
    onSort,
    className = "",
}) {
    const isRtl = i18next.language === "ar";
    const isActive = currentSort === sortKey;
    const Icon = isActive
        ? currentDirection === "asc"
            ? ChevronUp
            : ChevronDown
        : ArrowUpDown;

    return (
        <TableHead
            className={`h-9 px-2 sm:px-3 ${isRtl ? "text-right" : "text-left"} ${className}`}
        >
            <button
                onClick={() => onSort(sortKey)}
                className={`flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-100 transition-colors text-gray-600 dark:text-gray-400 ${isRtl ? "flex-row-reverse" : ""}`}
            >
                {children}
                <Icon
                    className={`h-3.5 w-3.5 ${isActive ? "text-sky-600 dark:text-sky-400" : ""}`}
                />
            </button>
        </TableHead>
    );
}

export default function FileContentArea({
    files = [],
    selectedIds = new Set(),
    getFileId,
    onSelectFile,
    onSelectAll,
    allSelected = false,
    onPreview,
    onTogglePermanent,
    showPermanentColumn = true,
    enableHoverPreview = true,
    enableFilenameEdit = true,
    onUpdateMetadata,
    onDelete,
    filterText = "",
    isMobile = false,
}) {
    const { t } = useTranslation();
    const isRtl = i18next.language === "ar";
    void filterText;

    const [sortKey, setSortKey] = useState("date");
    const [sortDirection, setSortDirection] = useState("desc");
    const [editingFileId, setEditingFileId] = useState(null);
    const [editingFilename, setEditingFilename] = useState("");
    const filenameInputRef = useRef(null);
    const savingRef = useRef(false);
    const [hoveredFile, setHoveredFile] = useState(null);
    const hoverTimeoutRef = useRef(null);
    const [togglingPermanentFileId, setTogglingPermanentFileId] =
        useState(null);

    const handleSort = useCallback(
        (key) => {
            if (sortKey === key) {
                setSortDirection(sortDirection === "asc" ? "desc" : "asc");
            } else {
                setSortKey(key);
                setSortDirection(key === "date" ? "desc" : "asc");
            }
        },
        [sortKey, sortDirection],
    );

    const sortedFiles = useMemo(() => {
        const filesCopy = [...files];
        filesCopy.sort((a, b) => {
            if (sortKey === "filename") {
                const nameA = getFilename(a).toLowerCase();
                const nameB = getFilename(b).toLowerCase();
                const comparison = nameA.localeCompare(nameB);
                return sortDirection === "asc" ? comparison : -comparison;
            }
            if (sortKey === "permanent") {
                const permanentA = a?.permanent === true ? 1 : 0;
                const permanentB = b?.permanent === true ? 1 : 0;
                const comparison = permanentB - permanentA;
                return sortDirection === "asc" ? -comparison : comparison;
            }
            if (sortKey === "size") {
                const sizeA = a?.size || 0;
                const sizeB = b?.size || 0;
                const comparison = sizeB - sizeA;
                return sortDirection === "asc" ? -comparison : comparison;
            }

            const dateA = getFileDate(a);
            const dateB = getFileDate(b);
            if (!dateA && !dateB) return 0;
            if (!dateA) return 1;
            if (!dateB) return -1;
            const comparison = dateB.getTime() - dateA.getTime();
            return sortDirection === "asc" ? -comparison : comparison;
        });
        return filesCopy;
    }, [files, sortKey, sortDirection]);

    const handleMouseEnter = useCallback((file) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => setHoveredFile(file), 300);
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setHoveredFile(null);
    }, []);

    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (editingFileId && filenameInputRef.current) {
            filenameInputRef.current.focus();
            filenameInputRef.current.select();
        }
    }, [editingFileId]);

    const handleStartEdit = useCallback(
        (file, event) => {
            if (!enableFilenameEdit) return;
            event?.stopPropagation();
            setEditingFileId(getFileId(file));
            setEditingFilename(getFilename(file));
        },
        [getFileId, enableFilenameEdit],
    );

    const handleSaveFilename = useCallback(
        async (file) => {
            if (savingRef.current) return;
            if (!onUpdateMetadata) return;

            const trimmed = editingFilename.trim();
            if (!trimmed) {
                setEditingFileId(null);
                setEditingFilename("");
                return;
            }
            if (INVALID_FILENAME_CHARS.test(trimmed)) {
                toast.error(t("Filename contains invalid characters."));
                return;
            }
            if (trimmed.length > 255) {
                toast.error(t("Filename is too long."));
                return;
            }

            savingRef.current = true;
            setEditingFileId(null);
            setEditingFilename("");
            try {
                await onUpdateMetadata(file, { displayFilename: trimmed });
            } catch {
                toast.error(t("Failed to save filename."));
            } finally {
                savingRef.current = false;
            }
        },
        [editingFilename, onUpdateMetadata, t],
    );

    const handleCancelEdit = useCallback(() => {
        setEditingFileId(null);
        setEditingFilename("");
    }, []);

    const handleFilenameKeyDown = useCallback(
        (event, file) => {
            if (event.key === "Enter") {
                event.preventDefault();
                handleSaveFilename(file);
            } else if (event.key === "Escape") {
                event.preventDefault();
                handleCancelEdit();
            }
        },
        [handleSaveFilename, handleCancelEdit],
    );

    const handleTogglePermanentInternal = useCallback(
        async (file) => {
            if (!onTogglePermanent) return;
            const fileId = getFileId(file);
            setTogglingPermanentFileId(fileId);
            try {
                await onTogglePermanent(file);
            } finally {
                setTogglingPermanentFileId(null);
            }
        },
        [onTogglePermanent, getFileId],
    );

    if (files.length === 0) {
        return null;
    }

    const showPreviewAction = isMobile && !!onPreview;
    const showActionsColumn = showPreviewAction || !!onDelete;

    return (
        <div className="flex-1 overflow-auto min-w-0">
            <Table>
                <TableHeader>
                    <TableRow className="border-b border-gray-100 dark:border-gray-800">
                        <TableHead className="h-9 w-10 px-2 sm:px-3">
                            <button
                                onClick={onSelectAll}
                                className="flex items-center justify-center w-4 h-4 rounded border border-gray-300 dark:border-gray-600 hover:border-sky-500 dark:hover:border-sky-400 transition-colors"
                            >
                                {allSelected && (
                                    <Check className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                )}
                            </button>
                        </TableHead>
                        <TableHead className="h-9 w-8 px-1" />
                        <SortableHeader
                            sortKey="filename"
                            currentSort={sortKey}
                            currentDirection={sortDirection}
                            onSort={handleSort}
                        >
                            {t("Name")}
                        </SortableHeader>
                        <SortableHeader
                            sortKey="size"
                            currentSort={sortKey}
                            currentDirection={sortDirection}
                            onSort={handleSort}
                            className="hidden sm:table-cell w-24"
                        >
                            {t("Size")}
                        </SortableHeader>
                        <SortableHeader
                            sortKey="date"
                            currentSort={sortKey}
                            currentDirection={sortDirection}
                            onSort={handleSort}
                            className="hidden md:table-cell w-32"
                        >
                            {t("Date")}
                        </SortableHeader>
                        {showPermanentColumn && (
                            <SortableHeader
                                sortKey="permanent"
                                currentSort={sortKey}
                                currentDirection={sortDirection}
                                onSort={handleSort}
                                className="hidden lg:table-cell w-16"
                            >
                                {t("Keep")}
                            </SortableHeader>
                        )}
                        {showActionsColumn && (
                            <TableHead className="h-9 w-10 px-2 sm:px-3" />
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedFiles.map((file, index) => {
                        const fileId = getFileId(file);
                        const isSelected = selectedIds.has(fileId);
                        const filename = getFilename(file);
                        const FileIcon = getFileIcon(
                            file?.displayFilename ||
                                file?.displayName ||
                                file?.filename ||
                                "",
                        );
                        const fileDate = getFileDate(file);
                        const isEditing = editingFileId === fileId;
                        const isTogglingPermanent =
                            togglingPermanentFileId === fileId;

                        return (
                            <TableRow
                                key={fileId}
                                className={`group border-b border-gray-50 dark:border-gray-800/50 cursor-pointer transition-colors ${
                                    isSelected
                                        ? "bg-sky-50 dark:bg-sky-900/20"
                                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                }`}
                                onClick={(event) =>
                                    onSelectFile(file, sortedFiles, index, event)
                                }
                                onDoubleClick={(event) => {
                                    event.stopPropagation();
                                    onPreview?.(file);
                                }}
                            >
                                <TableCell className="px-2 sm:px-3 py-1.5 w-10">
                                    <button
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onSelectFile(
                                                file,
                                                sortedFiles,
                                                index,
                                                event,
                                            );
                                        }}
                                        className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
                                            isSelected
                                                ? "bg-sky-600 border-sky-600 dark:bg-sky-500 dark:border-sky-500"
                                                : "border-gray-300 dark:border-gray-600 hover:border-sky-500 dark:hover:border-sky-400"
                                        }`}
                                    >
                                        {isSelected && (
                                            <Check className="w-3 h-3 text-white" />
                                        )}
                                    </button>
                                </TableCell>
                                <TableCell
                                    className="px-1 py-1.5 w-8"
                                    onMouseEnter={
                                        enableHoverPreview
                                            ? () => handleMouseEnter(file)
                                            : undefined
                                    }
                                    onMouseLeave={
                                        enableHoverPreview
                                            ? handleMouseLeave
                                            : undefined
                                    }
                                >
                                    <FileIcon className="w-4 h-4 text-gray-400" />
                                </TableCell>
                                <TableCell className="px-2 sm:px-3 py-1.5">
                                    {isEditing ? (
                                        <input
                                            ref={filenameInputRef}
                                            type="text"
                                            value={editingFilename}
                                            onChange={(event) =>
                                                setEditingFilename(
                                                    event.target.value,
                                                )
                                            }
                                            onKeyDown={(event) =>
                                                handleFilenameKeyDown(
                                                    event,
                                                    file,
                                                )
                                            }
                                            onBlur={() =>
                                                handleSaveFilename(file)
                                            }
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
                                            className="w-full text-sm bg-white dark:bg-gray-800 border border-sky-500 dark:border-sky-400 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                        />
                                    ) : (
                                        <button
                                            className={`text-sm truncate max-w-[300px] block ${isRtl ? "text-right" : "text-left"} ${
                                                enableFilenameEdit
                                                    ? "hover:text-sky-600 dark:hover:text-sky-400 cursor-text"
                                                    : ""
                                            }`}
                                            onClick={(event) => {
                                                if (enableFilenameEdit) {
                                                    handleStartEdit(file, event);
                                                }
                                            }}
                                            title={filename}
                                        >
                                            {filename}
                                        </button>
                                    )}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell px-2 sm:px-3 py-1.5 w-24 text-xs text-gray-500 tabular-nums">
                                    {file.size
                                        ? formatFileSize(file.size)
                                        : "—"}
                                </TableCell>
                                <TableCell className="hidden md:table-cell px-2 sm:px-3 py-1.5 w-32 text-xs text-gray-500 tabular-nums">
                                    {fileDate
                                        ? fileDate.toLocaleDateString(
                                              undefined,
                                              {
                                                  month: "short",
                                                  day: "numeric",
                                                  year: "numeric",
                                              },
                                          )
                                        : "—"}
                                </TableCell>
                                {showPermanentColumn && (
                                    <TableCell className="hidden lg:table-cell px-2 sm:px-3 py-1.5 w-16">
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleTogglePermanentInternal(
                                                    file,
                                                );
                                            }}
                                            disabled={isTogglingPermanent}
                                            className="flex items-center justify-center w-5 h-5"
                                            title={
                                                file?.permanent
                                                    ? t("Kept permanently")
                                                    : t(
                                                          "Click to keep permanently",
                                                      )
                                            }
                                        >
                                            {isTogglingPermanent ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                                            ) : file?.permanent ? (
                                                <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                                            ) : (
                                                <div className="w-3.5 h-3.5 rounded border border-gray-300 dark:border-gray-600" />
                                            )}
                                        </button>
                                    </TableCell>
                                )}
                                {showActionsColumn && (
                                    <TableCell className="px-2 sm:px-3 py-1.5 w-10">
                                        <div className="flex items-center justify-end gap-1">
                                            {showPreviewAction && (
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onPreview(file);
                                                    }}
                                                    className="flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                                                    title={t("Preview")}
                                                    aria-label={t("Preview")}
                                                    type="button"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            )}
                                            {onDelete && (
                                                <button
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onDelete(file);
                                                    }}
                                                    className={`flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all ${
                                                        isMobile
                                                            ? "opacity-100"
                                                            : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    }`}
                                                    title={t("Delete file")}
                                                    aria-label={t(
                                                        "Delete file",
                                                    )}
                                                    type="button"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            {enableHoverPreview && hoveredFile && (
                <div className="pointer-events-none">
                    <HoverPreview file={hoveredFile} />
                </div>
            )}
        </div>
    );
}

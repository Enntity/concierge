"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { Folder } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { getFileUrl, getFilename, FilePreviewDialog } from "../FileManager";
import { downloadSingleFile } from "../../../utils/fileDownloadUtils";
import { useItemSelection } from "../../images/hooks/useItemSelection";
import BulkActionsBar from "../BulkActionsBar";
import EmptyState from "../EmptyState";
import { createFileId } from "../fileIdUtils";
import { useUnifiedFileData, collectAllFiles } from "./useUnifiedFileData";
import { useFolderNavigation } from "./useFolderNavigation";
import SidebarFolderTree from "./SidebarFolderTree";
import FileContentArea from "./FileContentArea";
import FileGridView from "./FileGridView";
import FileToolbar from "./FileToolbar";
import FileStatusBar from "./FileStatusBar";

const SIDEBAR_MIN = 150;
const SIDEBAR_MAX = 350;
const SIDEBAR_DEFAULT = 220;
const VIEW_MODE_KEY = "unified-file-manager-view-mode";
const MOBILE_BREAKPOINT = 768;

export default function UnifiedFileManager({
    contextId,
    chatId = null,
    chatTitleMap = {},
    onDelete,
    onDownload,
    onUpdateMetadata,
    onTogglePermanent,
    onUploadClick,
    isDownloading = false,
    containerHeight = "60vh",
    reloadToken = 0,
}) {
    const { t } = useTranslation();
    const [isMobile, setIsMobile] = useState(false);
    const [showMobileFolders, setShowMobileFolders] = useState(false);
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem(VIEW_MODE_KEY) || "list";
        } catch {
            return "list";
        }
    });

    const handleViewModeChange = useCallback((mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem(VIEW_MODE_KEY, mode);
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;

        const updateIsMobile = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };

        updateIsMobile();
        window.addEventListener("resize", updateIsMobile);
        return () => {
            window.removeEventListener("resize", updateIsMobile);
        };
    }, []);

    useEffect(() => {
        if (!isMobile) {
            setShowMobileFolders(false);
        }
    }, [isMobile]);

    const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
    const isDragging = useRef(false);
    const dragStartX = useRef(0);
    const dragStartWidth = useRef(0);

    const handleDragStart = useCallback(
        (event) => {
            event.preventDefault();
            isDragging.current = true;
            dragStartX.current = event.clientX;
            dragStartWidth.current = sidebarWidth;

            const handleDragMove = (moveEvent) => {
                if (!isDragging.current) return;
                const diff = moveEvent.clientX - dragStartX.current;
                const newWidth = Math.min(
                    SIDEBAR_MAX,
                    Math.max(SIDEBAR_MIN, dragStartWidth.current + diff),
                );
                setSidebarWidth(newWidth);
            };

            const handleDragEnd = () => {
                isDragging.current = false;
                document.removeEventListener("pointermove", handleDragMove);
                document.removeEventListener("pointerup", handleDragEnd);
            };

            document.addEventListener("pointermove", handleDragMove);
            document.addEventListener("pointerup", handleDragEnd);
        },
        [sidebarWidth],
    );

    const [filterText, setFilterText] = useState("");
    const effectiveViewMode = isMobile ? "list" : viewMode;

    const {
        tree,
        allFiles,
        loading,
        error,
        reloadFiles,
        totalFileCount,
        getFilesRecursive,
        removeFileOptimistically,
        renameFileOptimistically,
        togglePermanentOptimistically,
        getSnapshot,
        revertToSnapshot,
    } = useUnifiedFileData({ contextId, chatId, reloadToken });

    const {
        selectedPath,
        selectFolder,
        toggleExpanded,
        isExpanded,
        isSelected,
        breadcrumbs,
    } = useFolderNavigation({ tree, chatId });

    const currentFiles = useMemo(() => {
        const filesInFolder =
            selectedPath === ""
                ? collectAllFiles(tree)
                : getFilesRecursive(selectedPath);
        const seen = new Set();
        const deduped = filesInFolder.filter((file) => {
            const key = file?.blobPath || file?._id || file?.url;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        if (!filterText.trim()) return deduped;

        const search = filterText.toLowerCase();
        return deduped.filter((file) =>
            getFilename(file).toLowerCase().includes(search),
        );
    }, [tree, selectedPath, getFilesRecursive, filterText]);

    const getFileId = useCallback((file) => createFileId(file), []);

    const {
        selectedIds,
        selectedObjects,
        clearSelection,
        toggleSelection,
        selectRange,
        setSelectedIds,
        setSelectedObjects,
        lastSelectedId,
        setLastSelectedId,
    } = useItemSelection(getFileId);

    useEffect(() => {
        clearSelection();
    }, [selectedPath, clearSelection]);

    const allSelected =
        selectedIds.size === currentFiles.length && currentFiles.length > 0;

    const handleSelectAll = useCallback(() => {
        if (allSelected) {
            clearSelection();
        } else {
            const newIds = new Set(currentFiles.map((file) => getFileId(file)));
            setSelectedIds(newIds);
            setSelectedObjects([...currentFiles]);
        }
    }, [
        allSelected,
        clearSelection,
        currentFiles,
        getFileId,
        setSelectedIds,
        setSelectedObjects,
    ]);

    const handleSelectFile = useCallback(
        (file, orderedFiles, index, event) => {
            const visibleFiles =
                Array.isArray(orderedFiles) && orderedFiles.length > 0
                    ? orderedFiles
                    : currentFiles;

            if (event?.shiftKey) {
                event.preventDefault();
            }
            const fileId = getFileId(file);

            if (event?.shiftKey && lastSelectedId !== null) {
                const lastIndex = visibleFiles.findIndex(
                    (entry) => getFileId(entry) === lastSelectedId,
                );
                if (lastIndex !== -1 && index !== -1) {
                    const start = Math.min(lastIndex, index);
                    const end = Math.max(lastIndex, index);
                    selectRange(visibleFiles, start, end);
                    setLastSelectedId(fileId);
                    return;
                }
            }

            toggleSelection(file);
            setLastSelectedId(fileId);
        },
        [
            lastSelectedId,
            toggleSelection,
            selectRange,
            getFileId,
            setLastSelectedId,
            currentFiles,
        ],
    );

    const [previewFile, setPreviewFile] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [filesToDelete, setFilesToDelete] = useState([]);

    const handleDeleteRequest = useCallback((files) => {
        const arr = Array.isArray(files) ? files : [files];
        setFilesToDelete(arr);
        setShowDeleteConfirm(true);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        setShowDeleteConfirm(false);
        if (!onDelete || filesToDelete.length === 0) return;

        const snapshot = getSnapshot();
        for (const file of filesToDelete) {
            removeFileOptimistically(file);
        }
        clearSelection();

        try {
            await onDelete(filesToDelete);
            setTimeout(() => reloadFiles(), 200);
        } catch {
            revertToSnapshot(snapshot);
            toast.error(t("Failed to delete file(s)."));
        }
        setFilesToDelete([]);
    }, [
        onDelete,
        filesToDelete,
        getSnapshot,
        removeFileOptimistically,
        clearSelection,
        reloadFiles,
        revertToSnapshot,
        t,
    ]);

    const handleBulkDelete = useCallback(() => {
        handleDeleteRequest(selectedObjects);
    }, [selectedObjects, handleDeleteRequest]);

    const handleSelectFolder = useCallback(
        (path) => {
            selectFolder(path);
            if (isMobile) {
                setShowMobileFolders(false);
            }
        },
        [isMobile, selectFolder],
    );

    const handleSingleDownload = useCallback(async (file) => {
        const url = getFileUrl(file);
        if (!url) return;
        await downloadSingleFile(url, getFilename(file) || "");
    }, []);

    const handlePreviewDownload = useCallback(async (file) => {
        const url = getFileUrl(file);
        if (!url) return;
        await downloadSingleFile(url, getFilename(file) || "");
    }, []);

    const handleRenameRequest = useCallback(
        async (file, metadata) => {
            if (!onUpdateMetadata) return;
            const snapshot = getSnapshot();
            if (metadata?.displayFilename) {
                renameFileOptimistically(file, metadata.displayFilename);
            }
            try {
                await onUpdateMetadata(file, metadata);
                setTimeout(() => reloadFiles(), 200);
            } catch {
                revertToSnapshot(snapshot);
                toast.error(t("Failed to save filename."));
            }
        },
        [
            onUpdateMetadata,
            getSnapshot,
            renameFileOptimistically,
            reloadFiles,
            revertToSnapshot,
            t,
        ],
    );

    const handleGridRename = useCallback(
        (file) => {
            const currentName = getFilename(file);
            const newName = window.prompt(
                t("Enter new filename:"),
                currentName,
            );
            if (newName && newName.trim() && newName.trim() !== currentName) {
                handleRenameRequest(file, {
                    displayFilename: newName.trim(),
                });
            }
        },
        [handleRenameRequest, t],
    );

    const handleTogglePermanentInternal = useCallback(
        async (file) => {
            if (!onTogglePermanent) return;
            const snapshot = getSnapshot();
            togglePermanentOptimistically(file);
            try {
                await onTogglePermanent(file);
                setTimeout(() => reloadFiles(), 200);
            } catch {
                revertToSnapshot(snapshot);
                toast.error(t("Failed to update file retention."));
            }
        },
        [
            onTogglePermanent,
            getSnapshot,
            togglePermanentOptimistically,
            reloadFiles,
            revertToSnapshot,
            t,
        ],
    );

    if (loading && allFiles.length === 0) {
        return (
            <div
                className="flex items-center justify-center"
                style={{ height: containerHeight }}
            >
                <Spinner className="w-6 h-6" />
            </div>
        );
    }

    if (error && allFiles.length === 0) {
        return (
            <div
                className="flex flex-col items-center justify-center gap-2"
                style={{ height: containerHeight }}
            >
                <p className="text-sm text-red-500">
                    {t("Failed to load files")}
                </p>
                <p className="text-xs text-gray-400">{error}</p>
                <button
                    onClick={reloadFiles}
                    className="text-xs text-blue-500 hover:underline"
                >
                    {t("Retry")}
                </button>
            </div>
        );
    }

    if (totalFileCount === 0 && !loading) {
        return (
            <div
                className="flex flex-col items-center justify-center"
                style={{ height: containerHeight }}
            >
                <EmptyState
                    icon={<Folder className="w-12 h-12" />}
                    title={t("No files in storage")}
                    description={t("Upload files to get started.")}
                    action={onUploadClick}
                    actionLabel={onUploadClick ? t("Upload") : undefined}
                />
            </div>
        );
    }

    const deleteFilenames = filesToDelete
        .map((file) => getFilename(file))
        .join(", ");

    return (
        <div
            className={`flex flex-col overflow-hidden bg-white dark:bg-gray-900 ${
                isMobile
                    ? "border-0 rounded-none"
                    : "border border-gray-200 dark:border-gray-700 rounded-lg"
            }`}
            style={{ height: containerHeight }}
        >
            <FileToolbar
                breadcrumbs={breadcrumbs}
                onNavigate={handleSelectFolder}
                filterText={filterText}
                onFilterChange={setFilterText}
                viewMode={effectiveViewMode}
                onViewModeChange={handleViewModeChange}
                onUploadClick={onUploadClick}
                onRefresh={reloadFiles}
                chatTitleMap={chatTitleMap}
                isMobile={isMobile}
                showMobileFolders={showMobileFolders}
                onToggleMobileFolders={() =>
                    setShowMobileFolders((current) => !current)
                }
            />

            {isMobile && showMobileFolders && (
                <div className="max-h-64 flex-shrink-0 overflow-y-auto border-b border-gray-200 bg-white px-2 py-2 dark:border-gray-700 dark:bg-gray-900">
                    <SidebarFolderTree
                        tree={tree}
                        chatTitleMap={chatTitleMap}
                        totalFileCount={totalFileCount}
                        isExpanded={isExpanded}
                        isSelected={isSelected}
                        onToggleExpand={toggleExpanded}
                        onSelect={handleSelectFolder}
                    />
                </div>
            )}

            <div className="flex flex-1 min-h-0 overflow-hidden">
                {!isMobile && (
                    <>
                        <div
                            className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto overflow-x-hidden"
                            style={{ width: `${sidebarWidth}px` }}
                        >
                            <SidebarFolderTree
                                tree={tree}
                                chatTitleMap={chatTitleMap}
                                totalFileCount={totalFileCount}
                                isExpanded={isExpanded}
                                isSelected={isSelected}
                                onToggleExpand={toggleExpanded}
                                onSelect={handleSelectFolder}
                            />
                        </div>

                        <div
                            className="w-1 flex-shrink-0 cursor-col-resize hover:bg-sky-200 dark:hover:bg-sky-800 active:bg-sky-300 dark:active:bg-sky-700 transition-colors"
                            onPointerDown={handleDragStart}
                        />
                    </>
                )}

                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {currentFiles.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <EmptyState
                                icon={<Folder className="w-12 h-12" />}
                                title={
                                    filterText
                                        ? t("No files match")
                                        : t("No files in this folder")
                                }
                                description={
                                    filterText
                                        ? t(
                                              "No files match your filter. Try a different search.",
                                          )
                                        : t("This folder is empty.")
                                }
                            />
                        </div>
                    ) : effectiveViewMode === "grid" ? (
                        <FileGridView
                            files={currentFiles}
                            selectedIds={selectedIds}
                            getFileId={getFileId}
                            onSelectFile={handleSelectFile}
                            onPreview={(file) => setPreviewFile(file)}
                            onDownload={handleSingleDownload}
                            onRename={handleGridRename}
                            onDelete={(file) => handleDeleteRequest(file)}
                            enableFilenameEdit={!!onUpdateMetadata}
                        />
                    ) : (
                        <FileContentArea
                            files={currentFiles}
                            selectedIds={selectedIds}
                            getFileId={getFileId}
                            onSelectFile={handleSelectFile}
                            onSelectAll={handleSelectAll}
                            allSelected={allSelected}
                            onPreview={(file) => setPreviewFile(file)}
                            onTogglePermanent={
                                onTogglePermanent
                                    ? handleTogglePermanentInternal
                                    : undefined
                            }
                            showPermanentColumn={!!onTogglePermanent}
                            enableHoverPreview={!isMobile}
                            enableFilenameEdit={!!onUpdateMetadata}
                            onUpdateMetadata={handleRenameRequest}
                            onDelete={
                                onDelete
                                    ? (file) => handleDeleteRequest(file)
                                    : undefined
                            }
                            filterText={filterText}
                            isMobile={isMobile}
                        />
                    )}
                </div>
            </div>

            <FileStatusBar
                fileCount={currentFiles.length}
                totalFileCount={totalFileCount}
                selectedCount={selectedIds.size}
                files={currentFiles}
                selectedPath={selectedPath}
            />

            {selectedIds.size > 0 && (
                <BulkActionsBar
                    selectedCount={selectedIds.size}
                    allSelected={allSelected}
                    onSelectAll={handleSelectAll}
                    onClearSelection={clearSelection}
                    actions={{
                        ...(onDownload
                            ? {
                                  download: {
                                      onClick: async () => {
                                          await onDownload(selectedObjects);
                                      },
                                      disabled: isDownloading,
                                      loadingLabel: t("Creating ZIP..."),
                                      label:
                                          selectedIds.size === 1
                                              ? t("Download")
                                              : t("Download ZIP"),
                                      ariaLabel: `${t("Download")} (${selectedIds.size})`,
                                  },
                              }
                            : {}),
                        ...(onDelete
                            ? {
                                  delete: {
                                      onClick: handleBulkDelete,
                                      disabled: false,
                                      label: t("Delete"),
                                      ariaLabel: `${t("Delete")} (${selectedIds.size})`,
                                  },
                              }
                            : {}),
                    }}
                />
            )}

            {previewFile && (
                <FilePreviewDialog
                    file={previewFile}
                    onClose={() => setPreviewFile(null)}
                    onDownload={handlePreviewDownload}
                    t={t}
                />
            )}

            <AlertDialog
                open={showDeleteConfirm}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowDeleteConfirm(false);
                        setFilesToDelete([]);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {filesToDelete.length === 1
                                ? t("Delete File?")
                                : t("Delete {{count}} Files?", {
                                      count: filesToDelete.length,
                                  })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {filesToDelete.length === 1
                                ? t(
                                      'Are you sure you want to delete "{{filename}}"? This action cannot be undone.',
                                      { filename: deleteFilenames },
                                  )
                                : t(
                                      "Are you sure you want to delete {{count}} files? This action cannot be undone.",
                                      { count: filesToDelete.length },
                                  )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete}>
                            {t("Delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

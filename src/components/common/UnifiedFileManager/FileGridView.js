"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Check,
    Loader2,
    MoreVertical,
    Eye,
    Download,
    Pencil,
    Trash2,
} from "lucide-react";
import { getFileIcon } from "../../../utils/mediaUtils";
import { useFilePreview } from "../../chat/useFilePreview";
import {
    isYoutubeUrl,
    extractYoutubeVideoId,
    getYoutubeThumbnailUrl,
} from "../../../utils/urlUtils";
import { getFileUrl, getFilename, formatFileSize } from "../FileManager";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

function FileGridCard({
    file,
    index,
    isSelected,
    onSelect,
    files,
    onPreview,
    onDownload,
    onRename,
    onDelete,
    enableFilenameEdit,
}) {
    const { t } = useTranslation();
    const url = getFileUrl(file);
    const filename = getFilename(file);
    const mimeType = file?.mimeType;
    const FileIcon = getFileIcon(
        file?.displayFilename || file?.displayName || file?.filename || "",
    );

    const isYouTube = url ? isYoutubeUrl(url) : false;
    const youtubeVideoId = isYouTube && url ? extractYoutubeVideoId(url) : null;
    const youtubeThumbnail = youtubeVideoId
        ? getYoutubeThumbnailUrl(youtubeVideoId, "hqdefault")
        : null;

    const fileType = useFilePreview(url, filename, mimeType);
    const [mediaLoaded, setMediaLoaded] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        setMediaLoaded(false);
    }, [file]);

    const hasVisualPreview = fileType.isImage || fileType.isVideo || isYouTube;

    let thumbnail = null;
    if (isYouTube && youtubeThumbnail) {
        thumbnail = (
            <img
                src={youtubeThumbnail}
                alt={filename}
                className="w-full h-full object-cover"
                onLoad={() => setMediaLoaded(true)}
            />
        );
    } else if (fileType.isImage && url) {
        thumbnail = (
            <img
                src={url}
                alt={filename}
                className="w-full h-full object-cover"
                onLoad={() => setMediaLoaded(true)}
                onError={() => setMediaLoaded(true)}
            />
        );
    } else if (fileType.isVideo && url) {
        thumbnail = (
            <video
                src={url}
                className="w-full h-full object-cover"
                muted
                onLoadedData={() => setMediaLoaded(true)}
            />
        );
    }

    return (
        <div
            className={`relative group rounded-lg border transition-all cursor-pointer overflow-hidden ${
                isSelected
                    ? "border-sky-500 dark:border-sky-400 ring-2 ring-sky-200 dark:ring-sky-800"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
            onClick={(e) => onSelect(file, files, index, e)}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onPreview?.(file);
            }}
        >
            <div className="w-full aspect-square bg-gray-50 dark:bg-gray-800 flex items-center justify-center relative overflow-hidden">
                {hasVisualPreview ? (
                    <>
                        {!mediaLoaded && (
                            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
                        )}
                        <div
                            className={mediaLoaded ? "w-full h-full" : "hidden"}
                        >
                            {thumbnail}
                        </div>
                    </>
                ) : (
                    <FileIcon className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                )}

                <div
                    className={`absolute top-2 left-2 ${isSelected || "opacity-0 group-hover:opacity-100"} transition-opacity`}
                >
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(file, files, index, e);
                        }}
                        className={`flex items-center justify-center w-5 h-5 rounded border-2 transition-colors ${
                            isSelected
                                ? "bg-sky-600 border-sky-600 dark:bg-sky-500 dark:border-sky-500"
                                : "bg-white/80 dark:bg-gray-900/80 border-gray-300 dark:border-gray-500 hover:border-sky-500"
                        }`}
                    >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                    </button>
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center justify-center w-6 h-6 rounded bg-white/80 dark:bg-gray-900/80 hover:bg-white dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-600 transition-colors"
                            >
                                <MoreVertical className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4}>
                            {onPreview && (
                                <DropdownMenuItem
                                    onSelect={() => onPreview(file)}
                                >
                                    <Eye className="w-4 h-4 me-2" />
                                    {t("Preview")}
                                </DropdownMenuItem>
                            )}
                            {onDownload && (
                                <DropdownMenuItem
                                    onSelect={() => onDownload(file)}
                                >
                                    <Download className="w-4 h-4 me-2" />
                                    {t("Download")}
                                </DropdownMenuItem>
                            )}
                            {enableFilenameEdit && onRename && (
                                <DropdownMenuItem
                                    onSelect={() => onRename(file)}
                                >
                                    <Pencil className="w-4 h-4 me-2" />
                                    {t("Rename")}
                                </DropdownMenuItem>
                            )}
                            {onDelete && (
                                <DropdownMenuItem
                                    onSelect={() => onDelete(file)}
                                    className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                >
                                    <Trash2 className="w-4 h-4 me-2" />
                                    {t("Delete")}
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="px-2 py-1.5 min-w-0">
                <p
                    className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate"
                    title={filename}
                >
                    {filename}
                </p>
                <p className="text-[10px] text-gray-400 tabular-nums">
                    {file.size ? formatFileSize(file.size) : ""}
                </p>
            </div>
        </div>
    );
}

export default function FileGridView({
    files = [],
    selectedIds = new Set(),
    getFileId,
    onSelectFile,
    onPreview,
    onDownload,
    onRename,
    onDelete,
    enableFilenameEdit = true,
}) {
    if (files.length === 0) return null;

    return (
        <div className="flex-1 overflow-auto min-w-0 p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {files.map((file, index) => {
                    const fileId = getFileId(file);
                    return (
                        <FileGridCard
                            key={fileId}
                            file={file}
                            files={files}
                            index={index}
                            isSelected={selectedIds.has(fileId)}
                            onSelect={onSelectFile}
                            onPreview={onPreview}
                            onDownload={onDownload}
                            onRename={onRename}
                            onDelete={onDelete}
                            enableFilenameEdit={enableFilenameEdit}
                        />
                    );
                })}
            </div>
        </div>
    );
}
